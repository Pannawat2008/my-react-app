import { getAerodynamicCoefficients } from './airfoils';

export const AIR_DENSITY = 1.225; // kg/m^3
export const KINEMATIC_VISCOSITY = 1.46e-5; // m^2/s

/**
 * High-Precision Blade Element Momentum (BEM) Solver
 * Computes aerodynamic forces, induction factors, Cp, and Ct.
 *
 * @param {Array} segments - Array of blade segments { r, chord, twistDeg, airfoil }
 * @param {Number} windSpeed - Wind speed in m/s
 * @param {Number} rpm - Rotational speed in Revolutions Per Minute
 * @param {Number} R - Total rotor radius (tip radius in meters)
 * @param {Number} B - Number of blades (e.g. 3)
 * @param {Number} bladePitch - Collective blade pitch angle in degrees
 */
export function solveBEM(segments, windSpeed, rpm, R, B = 3, bladePitch = 0) {
  // Prevent division by zero for stationary rotor.
  const safeRpm = Math.max(rpm, 0.05);
  const omega = (safeRpm * Math.PI) / 30; // Rotational speed (rad/s)
  const safeWindSpeed = Math.max(windSpeed, 0.1);

  let totalThrust = 0;
  let totalTorque = 0;
  let totalPower = 0;

  const numSegs = segments.length;
  const results = segments.map((seg, index) => {
    // Determine segment radial width dr
    let dr;
    if (numSegs === 1) {
      dr = R;
    } else if (index === 0) {
      dr = segments[1].r - seg.r;
    } else if (index === numSegs - 1) {
      dr = seg.r - segments[index - 1].r;
    } else {
      dr = (segments[index + 1].r - segments[index - 1].r) / 2;
    }
    if (dr <= 0) dr = R / numSegs;

    // Initial guesses for axial (a) and tangential (a') induction factors
    let a = 0.0;
    let aPrime = 0.0;

    const maxIters = 80;
    const tolerance = 1e-4;

    let alphaDeg = 0;
    let cl = 0;
    let cd = 0;
    let phi = 0;
    let F = 1; // Prandtl tip loss factor

    // BEM Iteration Loop
    for (let iter = 0; iter < maxIters; iter++) {
      // Flow angle
      const tanPhi = ((1 - a) * safeWindSpeed) / ((1 + aPrime) * omega * Math.max(seg.r, 0.01));
      phi = Math.atan(Math.max(0.001, tanPhi));
      const phiDeg = (phi * 180) / Math.PI;

      // Angle of Attack (alpha = phi - (twist + pitch))
      alphaDeg = phiDeg - (seg.twistDeg + bladePitch);

      // Interpolated Aerodynamic coefficients from polar table / custom dat
      const coeffs = getAerodynamicCoefficients(seg.airfoil, alphaDeg);
      cl = coeffs.cl;
      cd = coeffs.cd;

      // Prandtl Combined Tip & Hub Loss Correction
      // 1. Tip Loss: F_tip = (2/pi) * arccos( e^(-(B/2) * (R-r)/(r*sin(phi))) )
      const tipDistance = Math.max(0, R - seg.r);
      const fTipArg = Math.exp(-((B / 2) * tipDistance) / (Math.max(seg.r, 0.01) * Math.sin(phi) + 1e-6));
      const F_tip = (2 / Math.PI) * Math.acos(Math.max(0, Math.min(1, fTipArg)));

      // 2. Hub Loss: F_hub = (2/pi) * arccos( e^(-(B/2) * (r-R_hub)/(R_hub*sin(phi))) )
      const R_hub = Math.max(0.01, segments[0]?.r || 0.05 * R);
      const hubDistance = Math.max(0, seg.r - R_hub);
      const fHubArg = Math.exp(-((B / 2) * hubDistance) / (R_hub * Math.sin(phi) + 1e-6));
      const F_hub = (2 / Math.PI) * Math.acos(Math.max(0, Math.min(1, fHubArg)));

      F = Math.max(0.001, (isNaN(F_tip) ? 1 : F_tip) * (isNaN(F_hub) ? 1 : F_hub));

      // Local Solidity sigma = (B * chord) / (2 * pi * r)
      const sigma = (B * seg.chord) / (2 * Math.PI * Math.max(seg.r, 0.01));

      // K factor for induction calculation
      const denomK = sigma * cl * Math.cos(phi);
      const K = denomK !== 0 ? (4 * F * Math.pow(Math.sin(phi), 2)) / denomK : 100;

      let aNew;
      if (a < 0.33) {
        // Normal momentum theory
        aNew = 1 / (K + 1);
      } else {
        // Glauert empirical correction for high induction
        const a_c = 0.2;
        const sqrtArg = Math.pow(K * (1 - 2 * a_c) + 2, 2) + 4 * (K * a_c * a_c - 1);
        if (sqrtArg >= 0) {
          aNew = 0.5 * (2 + K * (1 - 2 * a_c) - Math.sqrt(sqrtArg));
        } else {
          aNew = 1 / (K + 1);
        }
      }

      const denomAPrime = sigma * cl;
      let aPrimeNew = 0;
      if (denomAPrime !== 0) {
        const factor = (4 * F * Math.sin(phi) * Math.cos(phi)) / denomAPrime;
        if (factor > 1) {
          aPrimeNew = 1 / (factor - 1);
        }
      }

      // Relaxation for fast stable convergence
      const relax = 0.15;
      const errA = Math.abs(aNew - a);
      const errAPrime = Math.abs(aPrimeNew - aPrime);

      a = a * (1 - relax) + aNew * relax;
      aPrime = aPrime * (1 - relax) + aPrimeNew * relax;

      // Bound to physical limits
      a = Math.max(0, Math.min(0.99, a));
      aPrime = Math.max(0, Math.min(0.99, aPrime));

      if (errA < tolerance && errAPrime < tolerance) {
        break;
      }
    }

    // Relative wind velocity
    const sinPhi = Math.sin(phi);
    const vRel = sinPhi > 0.01 ? (safeWindSpeed * (1 - a)) / sinPhi : safeWindSpeed;

    // Reynolds number estimation
    const Re = (vRel * seg.chord) / KINEMATIC_VISCOSITY;

    // Forces per unit length
    const dynamicPressure = 0.5 * AIR_DENSITY * Math.pow(vRel, 2);
    const L = dynamicPressure * seg.chord * cl;
    const D = dynamicPressure * seg.chord * cd;

    const dT = L * Math.cos(phi) + D * Math.sin(phi);
    const dQ = (L * Math.sin(phi) - D * Math.cos(phi)) * seg.r;

    // Segment contributions
    const segThrust = dT * dr * B;
    const segTorque = dQ * dr * B;
    const segPower = segTorque * omega;

    totalThrust += segThrust;
    totalTorque += segTorque;
    totalPower += segPower;

    const liftToDrag = cd > 0.0001 ? cl / cd : 0;

    return {
      ...seg,
      alphaDeg,
      cl,
      cd,
      liftToDrag,
      dT,
      dQ,
      dP: segPower,
      vRel,
      Re,
      a,
      aPrime,
      F,
      stallDetected: alphaDeg > 14 || alphaDeg < -2,
    };
  });

  // Prevent negative total power in extreme wind/stall
  const cleanPower = Math.max(0, totalPower);
  const cleanTorque = Math.max(0, totalTorque);

  // Power Coefficient Cp
  const sweptArea = Math.PI * Math.pow(R, 2);
  const powerWind = 0.5 * AIR_DENSITY * sweptArea * Math.pow(safeWindSpeed, 3);
  const cp = powerWind > 0 ? cleanPower / powerWind : 0;

  // Thrust Coefficient Ct
  const forceWind = 0.5 * AIR_DENSITY * sweptArea * Math.pow(safeWindSpeed, 2);
  const ct = forceWind > 0 ? totalThrust / forceWind : 0;

  // Tip Speed Ratio (TSR = omega * R / V)
  const actualTsr = (omega * R) / safeWindSpeed;

  return {
    segments: results,
    totalThrust,
    totalTorque: cleanTorque,
    totalPower: cleanPower,
    cp: Math.min(0.593, Math.max(0, cp)), // Bound by Betz Limit visually
    ct: Math.max(0, ct),
    tsr: actualTsr,
    windSpeed: safeWindSpeed,
    rpm: safeRpm,
    R,
    B,
  };
}
