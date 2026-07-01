/**
 * airfoilProfile.js
 * Shared utility for generating NACA 4-digit airfoil profile points.
 * Used by both Blade.jsx (3D rendering) and exporters.js (STL export).
 */

/**
 * Generate airfoil profile points using the NACA 4-digit thickness distribution.
 * Returns upper surface points (leading to trailing edge) followed by lower surface points.
 * Points are centered at quarter-chord (x=0.25).
 *
 * @param {number} thicknessRatio - Thickness as a fraction (e.g., 0.12 for 12%)
 * @param {number} numPoints - Number of points per surface (default 40)
 * @returns {Array<{x: number, y: number}>} Array of {x, y} coordinate pairs
 */
export function getAirfoilProfile(thicknessRatio, numPoints = 40, chord = 1, leMod = 1.0, teThicknessMm = 0, teFlapDeg = 0, customInterpolator = null) {
  const points = [];

  // Base trailing edge thickness of standard NACA 4-digit (at x=1)
  const currentTE = customInterpolator ? (customInterpolator.getUpper(1) - customInterpolator.getLower(1)) / 2 : 5 * thicknessRatio * 0.0021; 
  // Convert teThicknessMm to meters before calculating the relative targetTE
  const targetTE = (teThicknessMm / 1000 / 2) / chord;
  const diffTE = targetTE - currentTE;
  
  const leScale = Math.sqrt(Math.max(0.01, leMod));

  // Trailing edge flap logic
  const flapRad = (teFlapDeg * Math.PI) / 180;
  const xHinge = 0.6; // Flap starts at 60% chord
  const tanBeta = Math.tan(flapRad);

  // Upper surface
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * Math.PI;
    const x = 0.5 * (1 - Math.cos(theta));
    
    let yt = 0;
    let base_yc = 0;

    if (customInterpolator) {
      const y_up = customInterpolator.getUpper(x);
      const y_lo = customInterpolator.getLower(x);
      const actualThickness = customInterpolator.maxThickness || 0.12;
      const scale = thicknessRatio / actualThickness;
      
      yt = ((y_up - y_lo) / 2) * scale;
      base_yc = ((y_up + y_lo) / 2) * scale; // Also scale camber
    } else {
      yt =
        5 *
        thicknessRatio *
        (0.2969 * Math.sqrt(x) -
          0.126 * x -
          0.3516 * x ** 2 +
          0.2843 * x ** 3 -
          0.1015 * x ** 4);
    }
    
    // Localized Leading Edge modifier (blends out completely by x=0.2)
    if (x < 0.2) {
      const u = x / 0.2;
      const blend = 1 + (leScale - 1) * Math.pow(1 - u, 2);
      if (customInterpolator) {
         yt *= blend; // Simple scaling for custom airfoils near LE
      } else {
         yt += 5 * thicknessRatio * 0.2969 * Math.sqrt(x) * (blend - 1);
      }
    }
    
    // Localized Trailing Edge modifier (flares smoothly from x=0.5 to x=1.0)
    if (x > 0.5) {
      const v = (x - 0.5) / 0.5;
      yt += diffTE * Math.pow(v, 2);
    }

    // Camber (Trailing Edge Flap)
    let yc = 0;
    let dyc_dx = 0;
    if (x > xHinge) {
      // Parabolic camber starting at xHinge and reaching flapRad slope at TE
      yc = -tanBeta * 0.5 * Math.pow(x - xHinge, 2) / (1 - xHinge);
      dyc_dx = -tanBeta * (x - xHinge) / (1 - xHinge);
    }

    const thetaC = Math.atan(dyc_dx);
    const cosT = Math.cos(thetaC);
    const sinT = Math.sin(thetaC);

    const xUpper = x - yt * sinT;
    const yUpper = yc + yt * cosT;

    points.push({ x: 0.25 - xUpper, y: yUpper });
  }

  // Lower surface (mirrored)
  for (let i = numPoints - 1; i > 0; i--) {
    const theta = (i / numPoints) * Math.PI;
    const x = 0.5 * (1 - Math.cos(theta));
    
    let yt = 0;
    let base_yc = 0;

    if (customInterpolator) {
      const y_up = customInterpolator.getUpper(x);
      const y_lo = customInterpolator.getLower(x);
      const actualThickness = customInterpolator.maxThickness || 0.12;
      const scale = thicknessRatio / actualThickness;
      
      yt = ((y_up - y_lo) / 2) * scale;
      base_yc = ((y_up + y_lo) / 2) * scale;
    } else {
      yt =
        5 *
        thicknessRatio *
        (0.2969 * Math.sqrt(x) -
          0.126 * x -
          0.3516 * x ** 2 +
          0.2843 * x ** 3 -
          0.1015 * x ** 4);
    }

    if (x < 0.2) {
      const u = x / 0.2;
      const blend = 1 + (leScale - 1) * Math.pow(1 - u, 2);
      if (customInterpolator) {
         yt *= blend;
      } else {
         yt += 5 * thicknessRatio * 0.2969 * Math.sqrt(x) * (blend - 1);
      }
    }
    
    if (x > 0.5) {
      const v = (x - 0.5) / 0.5;
      yt += diffTE * Math.pow(v, 2);
    }

    // Camber (Trailing Edge Flap)
    let yc = base_yc;
    let dyc_dx = 0;
    if (x > xHinge) {
      yc += -tanBeta * 0.5 * Math.pow(x - xHinge, 2) / (1 - xHinge);
      dyc_dx += -tanBeta * (x - xHinge) / (1 - xHinge);
    }

    const thetaC = Math.atan(dyc_dx);
    const cosT = Math.cos(thetaC);
    const sinT = Math.sin(thetaC);

    const xLower = x + yt * sinT;
    const yLower = yc - yt * cosT;

    points.push({ x: 0.25 - xLower, y: yLower });
  }

  return points;
}
