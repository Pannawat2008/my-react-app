import { solveBEM } from './bem';
import { generateSegments } from '../utils/geometryBuilder';

/**
 * Aerodynamic Physics & High-Resolution BEM Web Worker
 * Offloads heavy mathematical iterations (multi-speed sweeps, unsteady wake simulations)
 * from the main React render thread.
 */

self.onmessage = function (e) {
  const { type, payload, id } = e.data;

  if (type === 'SOLVE_SWEEP') {
    const { bladeParams, minWind, maxWind, windSteps, tsr } = payload;
    const R = bladeParams.radiusMm / 1000;
    const B = bladeParams.numBlades || 3;
    const segments = generateSegments(bladeParams);

    const curve = [];
    const step = (maxWind - minWind) / Math.max(1, windSteps - 1);

    for (let i = 0; i < windSteps; i++) {
      const v = minWind + i * step;
      const rpm = (tsr * v * 60) / (2 * Math.PI * Math.max(0.1, R));
      const res = solveBEM(segments, v, rpm, R, B, 0);

      curve.push({
        windSpeed: parseFloat(v.toFixed(1)),
        powerKw: parseFloat((res.totalPower / 1000).toFixed(2)),
        cp: parseFloat(res.cp.toFixed(3)),
        thrustKn: parseFloat((res.totalThrust / 1000).toFixed(2)),
        torqueNm: parseFloat(res.totalTorque.toFixed(1)),
      });
    }

    self.postMessage({ type: 'SWEEP_COMPLETE', id, curve });
  } else if (type === 'SOLVE_BEM_FRAME') {
    const { bladeParams, windSpeed, rpm, bladePitch } = payload;
    const R = bladeParams.radiusMm / 1000;
    const B = bladeParams.numBlades || 3;
    const segments = generateSegments(bladeParams);

    const result = solveBEM(segments, windSpeed, rpm, R, B, bladePitch);
    self.postMessage({ type: 'BEM_FRAME_RESULT', id, result });
  }
};
