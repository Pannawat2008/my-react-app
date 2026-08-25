import { getAerodynamicCoefficients } from './airfoils';

export const AIR_DENSITY = 1.225; // kg/m^3
export const KINEMATIC_VISCOSITY = 1.46e-5; // m^2/s

/**
 * 3D Rotational Stall Delay Correction (Du-Selig & Snel Model)
 * Accounts for centrifugal and Coriolis pumping effects on rotating blades,
 * which delays flow separation and enhances lift at inboard/mid stations.
 */
function apply3DRotationalCorrection(cl2D, cd2D, r, R, chord, tsr, alphaDeg) {
  const rOverR = Math.max(0.01, Math.min(1.0, r / R));
  const chordOverR = Math.max(0.01, chord / r);
  const speedRatio = Math.max(0.1, tsr * rOverR);

  // Du-Selig 3D Lift Augmentation factor
  const d = 1.0;
  const fCl = (1 / (2 * Math.PI)) * chordOverR * (speedRatio / (1 + speedRatio * speedRatio)) * Math.pow(chordOverR / 0.12, d);
  
  // Potential flow linear lift slope (2*pi*alpha in radians)
  const alphaRad = (alphaDeg * Math.PI) / 180;
  const clPotential = 2 * Math.PI * alphaRad;

  // 3D Lift is augmented when operating near or beyond stall
  let cl3D = cl2D;
  if (alphaDeg > 6 && rOverR < 0.85) {
    const deltaCl = Math.max(0, clPotential - cl2D);
    cl3D = cl2D + Math.min(0.6, fCl * deltaCl);
  }

  // Snel 3D Drag Correction
  const fCd = Math.min(0.5, Math.pow(chordOverR, 2) * 0.5);
  const cd3D = cd2D + fCd * Math.max(0, cd2D - 0.008);

  return { cl3D, cd3D };
}

/**
 * Dynamic Reynolds Number Scaling
 * Adjusts minimum drag and stall characteristics based on local Re.
 */
function applyReynoldsScaling(cl, cd, Re, refRe = 500000) {
  const safeRe = Math.max(10000, Re || refRe);
  // Viscous drag scales with Re^(-0.18) based on turbulent boundary layer skin friction
  const reScaleFactor = Math.max(0.7, Math.min(2.2, Math.pow(refRe / safeRe, 0.18)));
  const scaledCd = cd * reScaleFactor;

  // At very low Re (< 80,000), laminar separation bubbles reduce peak lift slightly
  let scaledCl = cl;
  if (safeRe < 80000 && cl > 1.0) {
    const rePenalty = Math.max(0.82, 1 - 0.18 * ((80000 - safeRe) / 80000));
    scaledCl = cl * rePenalty;
  }

  return { scaledCl, scaledCd };
}

/**
 * High-Precision Blade Element Momentum (BEM) Solver
 * Computes aerodynamic forces, induction factors, Cp, Ct, and full airflow characterization.
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
  const actualTsr = (omega * R) / safeWindSpeed;

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
    let cl2D = 0;
    let cd2D = 0;
    let phi = 0;
    let F = 1; // Prandtl tip loss factor
    let vRel = safeWindSpeed;
    let Re = 100000;

    // BEM Iteration Loop
    for (let iter = 0; iter < maxIters; iter++) {
      // Flow angle
      const tanPhi = ((1 - a) * safeWindSpeed) / ((1 + aPrime) * omega * Math.max(seg.r, 0.01));
      phi = Math.atan(Math.max(0.001, tanPhi));
      const phiDeg = (phi * 180) / Math.PI;

      // Angle of Attack (alpha = phi - (twist + pitch))
      alphaDeg = phiDeg - (seg.twistDeg + bladePitch);

      // Relative wind velocity & local Reynolds number
      const sinPhi = Math.sin(phi);
      vRel = sinPhi > 0.01 ? (safeWindSpeed * (1 - a)) / sinPhi : safeWindSpeed;
      Re = (vRel * seg.chord) / KINEMATIC_VISCOSITY;

      // 1. Interpolated 2D Aerodynamic coefficients from polar table
      const rawCoeffs = getAerodynamicCoefficients(seg.airfoil, alphaDeg);
      cl2D = rawCoeffs.cl;
      cd2D = rawCoeffs.cd;

      // 2. Reynolds Number dynamic scaling
      const reScaled = applyReynoldsScaling(cl2D, cd2D, Re);

      // 3. 3D Rotational Stall Delay correction (Du-Selig & Snel)
      const rotCorrected = apply3DRotationalCorrection(
        reScaled.scaledCl, reScaled.scaledCd,
        seg.r, R, seg.chord, actualTsr, alphaDeg
      );

      cl = rotCorrected.cl3D;
      cd = rotCorrected.cd3D;

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

    // Aerodynamic Flow Characterization
    const nominalStallAngle = 14.0;
    const stallMarginDeg = nominalStallAngle - alphaDeg;

    let flowState = 'attached'; // 'attached' | 'transition' | 'stalled'
    let flowStateColor = '#10b981'; // green

    if (alphaDeg > nominalStallAngle || alphaDeg < -4) {
      flowState = 'stalled';
      flowStateColor = '#ef4444'; // red
    } else if (alphaDeg > nominalStallAngle - 2.5) {
      flowState = 'transition';
      flowStateColor = '#f59e0b'; // amber/yellow
    }

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
      flowAngleDeg: (phi * 180) / Math.PI,
      cl,
      cd,
      cl2D,
      cd2D,
      liftToDrag,
      dT,
      dQ,
      dP: segPower,
      vRel,
      Re,
      a,
      aPrime,
      F,
      flowState,
      flowStateColor,
      stallMarginDeg,
      stallDetected: flowState === 'stalled',
      dynamicPressure,
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
