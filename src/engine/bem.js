import { getAerodynamicCoefficients } from './airfoils';

export const AIR_DENSITY = 1.225; // kg/m^3
export const KINEMATIC_VISCOSITY = 1.46e-5; // m^2/s

/**
 * Blade Element Momentum (BEM) Solver
 * @param {Array} segments - Array of blade segments { r, chord, twistDeg, airfoil }
 * @param {Number} windSpeed - Wind speed in m/s
 * @param {Number} rpm - Rotational speed in Revolutions Per Minute
 * @param {Number} R - Total rotor radius (tip radius)
 * @param {Number} B - Number of blades (default 1 as per "realistic for a single blade")
 * @param {Number} bladePitch - Collective blade pitch angle in degrees
 */
export function solveBEM(segments, windSpeed, rpm, R, B = 1, bladePitch = 0) {
  // Prevent division by zero for stationary rotor. We use a tiny non-zero omega.
  const safeRpm = Math.max(rpm, 0.1); 
  const omega = (safeRpm * Math.PI) / 30; // Rotational speed (rad/s)
  
  let totalThrust = 0;
  let totalTorque = 0;
  let totalPower = 0;
  
  const results = segments.map((seg, index) => {
    // We assume spacing between segments is dr
    const dr = index < segments.length - 1 
      ? segments[index+1].r - seg.r 
      : (index > 0 ? seg.r - segments[index-1].r : R / segments.length);
      
    // Initial guesses for induction factors
    let a = 0.0;
    let aPrime = 0.0;
    
    const maxIters = 100;
    const tolerance = 1e-4;
    
    let alphaDeg = 0;
    let cl = 0;
    let cd = 0;
    let phi = 0;
    let F = 1; // Prandtl tip loss factor
    
    // BEM Iteration
    for (let iter = 0; iter < maxIters; iter++) {
      // Flow angle
      phi = Math.atan(((1 - a) * windSpeed) / ((1 + aPrime) * omega * seg.r));
      const phiDeg = (phi * 180) / Math.PI;
      
      // Angle of Attack (alpha = phi - (twist + pitch))
      alphaDeg = phiDeg - (seg.twistDeg + bladePitch);
      
      // Get aerodynamic coefficients
      const coeffs = getAerodynamicCoefficients(seg.airfoil, alphaDeg);
      cl = coeffs.cl;
      cd = coeffs.cd;
      
      // Prandtl Tip Loss Correction
      // F = (2/pi) * arccos( e^(-(B/2) * (R-r)/(r*sin(phi))) )
      const fArg = Math.exp(-((B / 2) * (R - seg.r)) / (seg.r * Math.sin(phi) + 1e-6));
      F = (2 / Math.PI) * Math.acos(Math.max(0, Math.min(1, fArg)));
      if (isNaN(F) || F < 0.001) F = 0.001; // Avoid division by zero
      
      // Solidity
      const sigma = (B * seg.chord) / (2 * Math.PI * seg.r);
      
      // K factor used in both branches
      const K = (4 * F * Math.sin(phi) ** 2) / (sigma * cl * Math.cos(phi));
      
      let aNew = 0;
      
      if (a < 0.33) {
        // Normal momentum theory
        aNew = 1 / (K + 1);
      } else {
        // Glauert empirical correction for high induction
        const a_c = 0.2;
        const sqrtArg = (K * (1 - 2 * a_c) + 2) ** 2 + 4 * (K * a_c ** 2 - 1);
        if (sqrtArg >= 0) {
          aNew = 0.5 * (2 + K * (1 - 2 * a_c) - Math.sqrt(sqrtArg));
        } else {
          aNew = 1 / (K + 1); // Fallback to standard if numerically unstable
        }
      }
      
      const aPrimeNew = 1 / ( (4 * F * Math.sin(phi) * Math.cos(phi)) / (sigma * cl) - 1 );
      
      // Relaxation
      const relax = 0.1;
      const errA = Math.abs(aNew - a);
      const errAPrime = Math.abs(aPrimeNew - aPrime);
      
      a = a * (1 - relax) + aNew * relax;
      aPrime = aPrime * (1 - relax) + aPrimeNew * relax;
      
      // Prevent unphysical values
      a = Math.max(0, Math.min(0.99, a));
      aPrime = Math.max(0, Math.min(0.99, aPrime));
      
      if (errA < tolerance && errAPrime < tolerance) {
        break;
      }
    }
    
    // Relative wind velocity
    const vRel = windSpeed * (1 - a) / Math.sin(phi);
    
    // Forces per unit length

    
    // Thrust and Torque (per unit length)
    const L = 0.5 * AIR_DENSITY * vRel**2 * seg.chord * cl;
    const D = 0.5 * AIR_DENSITY * vRel**2 * seg.chord * cd;
    
    const dT = L * Math.cos(phi) + D * Math.sin(phi);
    const dQ = (L * Math.sin(phi) - D * Math.cos(phi)) * seg.r;
    
    // Integrate
    totalThrust += dT * dr * B;
    totalTorque += dQ * dr * B;
    const dP = dQ * dr * B * omega;
    totalPower += dP;
    
    return {
      ...seg,
      alphaDeg,
      cl,
      cd,
      dT,
      dQ,
      dP,
      a,
      aPrime,
      stallDetected: alphaDeg > 14 || alphaDeg < -2 // "Stall Warning" rule
    };
  });
  
  // Power Coefficient Cp
  const sweptArea = Math.PI * R**2;
  const powerWind = 0.5 * AIR_DENSITY * sweptArea * windSpeed**3;
  const cp = totalPower / (powerWind || 1e-6);
  
  // Thrust Coefficient Ct
  const forceWind = 0.5 * AIR_DENSITY * sweptArea * windSpeed**2;
  const ct = totalThrust / (forceWind || 1e-6);
  
  const tsr = (omega * R) / Math.max(windSpeed, 0.1);
  
  return {
    segments: results,
    totalThrust,
    totalTorque,
    totalPower,
    cp,
    ct,
    tsr
  };
}
