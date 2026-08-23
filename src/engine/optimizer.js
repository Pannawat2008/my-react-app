import { solveBEM } from './bem';
import { generateSegments } from '../utils/geometryBuilder';

/**
 * High-Performance Parametric Blade Optimizer
 *
 * Sweeps regional chord, twist, and mid-span transition locations to maximize
 * aerodynamic performance (Cp / Torque) based on selected objective.
 *
 * Fixes:
 * 1. Physical RPM is accurately computed from TSR: rpm = (tsr * V * 60) / (2 * π * R)
 * 2. Rotor blade count (B = bladeParams.numBlades) is respected.
 * 3. Batch processing with async yielding prevents UI locking.
 *
 * @param {Object} baseParams - Current blade geometry parameters
 * @param {number} windSpeed - Wind speed in m/s
 * @param {number} tsr - Design Tip Speed Ratio
 * @param {string} objective - 'maxCp' | 'highTorque' | 'balanced'
 * @param {function} onProgress - Progress callback (progress: 0-1, currentBestMetric: number)
 * @returns {Promise<{bestParams: Object, bestCp: number, bestTorque: number, evaluations: number}>}
 */
export function runOptimizer(
  baseParams,
  windSpeed,
  tsr,
  objective = 'maxCp',
  onProgress
) {
  return new Promise((resolve) => {
    const R = baseParams.radiusMm / 1000;
    const B = baseParams.numBlades || 3;
    // Accurately calculate operating RPM from design TSR
    const targetRpm = (tsr * Math.max(windSpeed, 1) * 60) / (2 * Math.PI * Math.max(R, 0.1));

    const regions = ['root', 'mid', 'tip'];
    const chordSteps = 6;
    const twistSteps = 6;

    // Generate candidate variation grids for each region
    const variations = {};
    regions.forEach((region) => {
      const baseChord = Math.max(10, baseParams[region].chordMm);
      const baseTwist = baseParams[region].twistDeg;

      const chords = [];
      for (let i = 0; i < chordSteps; i++) {
        // -35% to +35% chord variation
        const factor = 0.65 + (i / (chordSteps - 1)) * 0.7;
        chords.push(Math.round(baseChord * factor));
      }

      const twists = [];
      for (let i = 0; i < twistSteps; i++) {
        // -6° to +6° twist variation
        const offset = -6 + (i / (twistSteps - 1)) * 12;
        twists.push(parseFloat((baseTwist + offset).toFixed(1)));
      }

      variations[region] = { chords, twists };
    });

    // Scoring function based on optimization objective
    function scoreResult(res, params) {
      if (!res || !isFinite(res.cp) || isNaN(res.cp)) return -Infinity;

      if (objective === 'highTorque') {
        // Prioritize torque for low-wind startup
        return res.totalTorque;
      }

      if (objective === 'balanced') {
        // Maximize Cp, but penalize excessive root chord (structural weight penalty)
        const chordPenalty = params.root.chordMm > 1800 ? 0.05 : 0;
        const stallPenalty = res.segments.some((s) => s.stallDetected) ? 0.08 : 0;
        return res.cp - chordPenalty - stallPenalty;
      }

      // Default: Maximize Cp
      const stallPenalty = res.segments.some((s) => s.stallDetected) ? 0.04 : 0;
      return res.cp - stallPenalty;
    }

    let bestParams = JSON.parse(JSON.stringify(baseParams));
    let bestScore = -Infinity;
    let bestCp = 0;
    let bestTorque = 0;
    let evaluations = 0;

    // Baseline evaluation
    const initialSegments = generateSegments(baseParams);
    const initialResult = solveBEM(initialSegments, windSpeed, targetRpm, R, B);
    bestScore = scoreResult(initialResult, baseParams);
    bestCp = initialResult.cp;
    bestTorque = initialResult.totalTorque;

    const totalEvalsPhase1 = regions.length * chordSteps * twistSteps;
    let regionIdx = 0;
    let chordIdx = 0;
    let twistIdx = 0;
    const BATCH_SIZE = 12;

    function processBatch() {
      let batchCount = 0;

      while (batchCount < BATCH_SIZE && regionIdx < regions.length) {
        const region = regions[regionIdx];
        const { chords, twists } = variations[region];

        const candidateParams = JSON.parse(JSON.stringify(bestParams));
        candidateParams[region] = {
          ...candidateParams[region],
          chordMm: chords[chordIdx],
          twistDeg: twists[twistIdx],
        };

        const segments = generateSegments(candidateParams);
        const result = solveBEM(segments, windSpeed, targetRpm, R, B);
        const score = scoreResult(result, candidateParams);

        if (score > bestScore) {
          bestScore = score;
          bestCp = result.cp;
          bestTorque = result.totalTorque;
          bestParams = candidateParams;
        }

        evaluations++;
        batchCount++;

        twistIdx++;
        if (twistIdx >= twistSteps) {
          twistIdx = 0;
          chordIdx++;
          if (chordIdx >= chordSteps) {
            chordIdx = 0;
            regionIdx++;
          }
        }
      }

      const progress = Math.min((evaluations / totalEvalsPhase1) * 0.7, 0.7);
      if (onProgress) onProgress(progress, bestCp, bestTorque);

      if (regionIdx < regions.length) {
        setTimeout(processBatch, 0);
      } else {
        // Phase 2: High-resolution fine-tuning around the best found parameters
        runFineTune(
          bestParams,
          windSpeed,
          targetRpm,
          R,
          B,
          bestScore,
          bestCp,
          bestTorque,
          evaluations,
          scoreResult,
          onProgress,
          resolve
        );
      }
    }

    setTimeout(processBatch, 0);
  });
}

/**
 * Phase 2: Fine-Tuning Grid Search (Local Gradient Refinement)
 */
function runFineTune(
  bestParams,
  windSpeed,
  targetRpm,
  R,
  B,
  scoreSoFar,
  cpSoFar,
  torqueSoFar,
  evalsSoFar,
  scoreResult,
  onProgress,
  resolve
) {
  const regions = ['root', 'mid', 'tip'];
  const fineSteps = 4;
  let fineBestParams = JSON.parse(JSON.stringify(bestParams));
  let fineBestScore = scoreSoFar;
  let fineBestCp = cpSoFar;
  let fineBestTorque = torqueSoFar;
  let evaluations = evalsSoFar;

  const totalFineEvals = regions.length * fineSteps * fineSteps;
  let regionIdx = 0;
  let ci = 0;
  let ti = 0;
  const BATCH_SIZE = 16;

  function processFineBatch() {
    let batchCount = 0;

    while (batchCount < BATCH_SIZE && regionIdx < regions.length) {
      const region = regions[regionIdx];
      const baseChord = fineBestParams[region].chordMm;
      const baseTwist = fineBestParams[region].twistDeg;

      // Tight window: ±8% chord, ±1.5° twist
      const chordFactor = 0.92 + (ci / (fineSteps - 1)) * 0.16;
      const twistOffset = -1.5 + (ti / (fineSteps - 1)) * 3.0;

      const candidateParams = JSON.parse(JSON.stringify(fineBestParams));
      candidateParams[region] = {
        ...candidateParams[region],
        chordMm: Math.max(10, Math.round(baseChord * chordFactor)),
        twistDeg: parseFloat((baseTwist + twistOffset).toFixed(1)),
      };

      const segments = generateSegments(candidateParams);
      const result = solveBEM(segments, windSpeed, targetRpm, R, B);
      const score = scoreResult(result, candidateParams);

      if (score > fineBestScore) {
        fineBestScore = score;
        fineBestCp = result.cp;
        fineBestTorque = result.totalTorque;
        fineBestParams = candidateParams;
      }

      evaluations++;
      batchCount++;

      ti++;
      if (ti >= fineSteps) {
        ti = 0;
        ci++;
        if (ci >= fineSteps) {
          ci = 0;
          regionIdx++;
        }
      }
    }

    const fineProgress = 0.7 + ((regionIdx * fineSteps * fineSteps + ci * fineSteps + ti) / totalFineEvals) * 0.3;
    const progress = Math.min(1.0, fineProgress);
    if (onProgress) onProgress(progress, fineBestCp, fineBestTorque);

    if (regionIdx < regions.length) {
      setTimeout(processFineBatch, 0);
    } else {
      resolve({
        bestParams: fineBestParams,
        bestCp: fineBestCp,
        bestTorque: fineBestTorque,
        evaluations,
      });
    }
  }

  setTimeout(processFineBatch, 0);
}
