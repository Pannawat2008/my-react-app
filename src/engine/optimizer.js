import { solveBEM } from './bem';
import { generateSegments } from '../utils/geometryBuilder';

/**
 * Auto-Optimizer: Grid search to maximize Cp by sweeping chord & twist.
 *
 * Sweeps each region's chord ±30% (5 steps) and twist ±5° (5 steps)
 * across root, mid, and tip — evaluating BEM at each combination.
 *
 * To avoid blocking the UI, runs in async batches.
 *
 * @param {Object} baseParams - Current blade parameters
 * @param {number} windSpeed - Wind speed (m/s)
 * @param {number} tsr - Tip speed ratio
 * @param {function} onProgress - Callback (progress: 0-1, currentBestCp: number)
 * @returns {Promise<{bestParams: Object, bestCp: number, evaluations: number}>}
 */
export function runOptimizer(baseParams, windSpeed, tsr, onProgress) {
  return new Promise((resolve) => {
    const R = baseParams.radiusMm / 1000;
    const regions = ['root', 'mid', 'tip'];

    // Generate candidate values for each region
    const chordSteps = 5; // 5 steps per region
    const twistSteps = 5;

    // Build parameter variations for each region
    const variations = {};
    regions.forEach((region) => {
      const baseChord = baseParams[region].chordMm;
      const baseTwist = baseParams[region].twistDeg;

      const chords = [];
      for (let i = 0; i < chordSteps; i++) {
        const factor = 0.7 + (i / (chordSteps - 1)) * 0.6; // 0.7 to 1.3
        chords.push(Math.round(baseChord * factor));
      }

      const twists = [];
      for (let i = 0; i < twistSteps; i++) {
        const offset = -5 + (i / (twistSteps - 1)) * 10; // -5 to +5
        twists.push(parseFloat((baseTwist + offset).toFixed(1)));
      }

      variations[region] = { chords, twists };
    });

    // Phase 1: Optimize each region independently (greedy)
    // This is much faster than full grid search across all 3 regions simultaneously
    let bestParams = JSON.parse(JSON.stringify(baseParams));
    let bestCp = -Infinity;
    let evaluations = 0;

    // Calculate total evaluations: 3 regions × chordSteps × twistSteps
    const totalEvals = regions.length * chordSteps * twistSteps;

    // Evaluate baseline
    const baseSegments = generateSegments(baseParams);
    const baseResult = solveBEM(baseSegments, windSpeed, tsr, R, 1);
    bestCp = baseResult.cp;

    // Process regions sequentially, each with a grid sweep
    let regionIdx = 0;
    let chordIdx = 0;
    let twistIdx = 0;
    const BATCH_SIZE = 10; // Evaluations per frame

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
        const result = solveBEM(segments, windSpeed, tsr, R, 1);

        if (result.cp > bestCp && isFinite(result.cp)) {
          bestCp = result.cp;
          bestParams = candidateParams;
        }

        evaluations++;
        batchCount++;

        // Advance indices
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

      const progress = Math.min(evaluations / totalEvals, 1);
      if (onProgress) onProgress(progress, bestCp);

      if (regionIdx < regions.length) {
        setTimeout(processBatch, 0);
      } else {
        // Phase 2: Fine-tune — do a second pass with narrower range around best
        runFineTune(bestParams, windSpeed, tsr, R, bestCp, evaluations, onProgress, resolve);
      }
    }

    setTimeout(processBatch, 0);
  });
}

/**
 * Fine-tune: narrower grid around the best found parameters.
 */
function runFineTune(bestParams, windSpeed, tsr, R, bestCp, evalsSoFar, onProgress, resolve) {
  const regions = ['root', 'mid', 'tip'];
  const fineSteps = 5;
  let fineBestParams = JSON.parse(JSON.stringify(bestParams));
  let fineBestCp = bestCp;
  let evaluations = evalsSoFar;

  const totalFineEvals = regions.length * fineSteps * fineSteps;
  let regionIdx = 0;
  let ci = 0;
  let ti = 0;

  function processBatch() {
    let batchCount = 0;

    while (batchCount < 15 && regionIdx < regions.length) {
      const region = regions[regionIdx];
      const baseChord = fineBestParams[region].chordMm;
      const baseTwist = fineBestParams[region].twistDeg;

      // ±10% chord, ±2° twist
      const chordFactor = 0.9 + (ci / (fineSteps - 1)) * 0.2;
      const twistOffset = -2 + (ti / (fineSteps - 1)) * 4;

      const candidateParams = JSON.parse(JSON.stringify(fineBestParams));
      candidateParams[region] = {
        ...candidateParams[region],
        chordMm: Math.round(baseChord * chordFactor),
        twistDeg: parseFloat((baseTwist + twistOffset).toFixed(1)),
      };

      const segments = generateSegments(candidateParams);
      const result = solveBEM(segments, windSpeed, tsr, R, 1);

      if (result.cp > fineBestCp && isFinite(result.cp)) {
        fineBestCp = result.cp;
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

    const progress = Math.min(0.5 + (regionIdx * fineSteps * fineSteps + ci * fineSteps + ti) / (totalFineEvals * 2), 1);
    if (onProgress) onProgress(progress, fineBestCp);

    if (regionIdx < regions.length) {
      setTimeout(processBatch, 0);
    } else {
      resolve({
        bestParams: fineBestParams,
        bestCp: fineBestCp,
        evaluations,
      });
    }
  }

  setTimeout(processBatch, 0);
}
