/**
 * Finds the optimal combination of integer tooth counts to achieve a target gear ratio.
 * Limits the number of stages to 1 or 2 to keep the physical gearbox compact.
 * 
 * @param {number} targetRatio - The desired total gear ratio (e.g., 10.45)
 * @returns {object} - The best ratio, error, and stage configurations
 */
export function findBestGearStages(targetRatio) {
  const minTeeth = 8;
  const maxTeeth = 80; // Hard cap on physical size of the gear

  // Target ratio must be > 0. If it's 1.0 or less, just return 1:1 direct drive.
  if (targetRatio <= 1.0) {
    return {
      ratio: 1.0,
      error: 0,
      stages: []
    };
  }

  let bestError = Infinity;
  let bestStages = [];

  // Pass 1: Try 1 stage
  for (let pinion = minTeeth; pinion <= maxTeeth; pinion++) {
    for (let ring = pinion; ring <= maxTeeth; ring++) {
      const ratio = ring / pinion;
      const error = Math.abs(ratio - targetRatio);
      if (error < bestError) {
        bestError = error;
        bestStages = [{ numTeeth: ring, pinionTeeth: pinion }];
      }
    }
  }

  // Pass 2: Try 2 stages if error is large (> 2%) or targetRatio is too high for one stage
  // To avoid massive computation (O(N^4)), we restrict the inner loops slightly.
  if (targetRatio > (maxTeeth / minTeeth) || bestError / targetRatio > 0.02) {
    for (let p1 = minTeeth; p1 <= 30; p1++) { // First pinion is usually small
      for (let r1 = p1; r1 <= maxTeeth; r1++) {
        for (let p2 = minTeeth; p2 <= 30; p2++) {
          for (let r2 = p2; r2 <= maxTeeth; r2++) {
            const ratio = (r1 / p1) * (r2 / p2);
            const error = Math.abs(ratio - targetRatio);
            if (error < bestError) {
              bestError = error;
              bestStages = [
                { numTeeth: r1, pinionTeeth: p1 },
                { numTeeth: r2, pinionTeeth: p2 }
              ];
            }
          }
        }
      }
    }
  }

  return {
    ratio: bestStages.reduce((acc, stage) => acc * (stage.numTeeth / stage.pinionTeeth), 1),
    error: bestError,
    stages: bestStages
  };
}
