/**
 * airfoilProfile.js
 * Advanced Aerodynamic Airfoil Profile Generator and Interpolator.
 * Supports:
 * - High-precision built-in coordinate databases (SG6043, NACA4412, NACA0012, S809, S822, S833, DU91W2250, FFAW3241, NACA63215)
 * - Custom uploaded .dat / .txt Selig and Lednicer airfoils
 * - NACA 4-digit analytical camber line and thickness equations
 * - Trailing edge flap and thickness modification
 * - Leading edge radius modification
 */

import { parseDatFile } from './airfoilParser';

// Built-in Airfoil Coordinate DAT strings
const BUILTIN_DAT_RAW = {
  // Cylindrical Hub Root Section (Circle)
  Circle: `Circular Hub Cylinder
 1.00000  0.00000
 0.95000  0.15000
 0.85000  0.30000
 0.70000  0.42000
 0.50000  0.50000
 0.30000  0.42000
 0.15000  0.30000
 0.05000  0.15000
 0.00000  0.00000
 0.05000 -0.15000
 0.15000 -0.30000
 0.30000 -0.42000
 0.50000 -0.50000
 0.70000 -0.42000
 0.85000 -0.30000
 0.95000 -0.15000
 1.00000  0.00000`,

  // Michael Selig SG6043 (10% High Lift, Low Reynolds Number)
  SG6043: `SG6043 Airfoil
 1.00000  0.00000
 0.95000  0.01050
 0.90000  0.02150
 0.80000  0.04300
 0.70000  0.06350
 0.60000  0.08150
 0.50000  0.09500
 0.40000  0.10000
 0.30000  0.09650
 0.20000  0.08300
 0.15000  0.07250
 0.10000  0.05850
 0.05000  0.03950
 0.02500  0.02650
 0.01250  0.01750
 0.00000  0.00000
 0.01250 -0.01150
 0.02500 -0.01550
 0.05000 -0.01950
 0.10000 -0.02250
 0.15000 -0.02200
 0.20000 -0.01950
 0.30000 -0.01250
 0.40000 -0.00400
 0.50000  0.00400
 0.60000  0.00900
 0.70000  0.00950
 0.80000  0.00700
 0.90000  0.00350
 0.95000  0.00150
 1.00000  0.00000`,

  // NREL S809 (21% HAWT Airfoil with laminar bucket and soft stall)
  S809: `NREL S809 Airfoil
 1.00000  0.00000
 0.95000  0.01469
 0.90000  0.03154
 0.80000  0.06734
 0.70000  0.10189
 0.60000  0.13110
 0.50000  0.14986
 0.40000  0.15243
 0.30000  0.13847
 0.20000  0.11181
 0.15000  0.09459
 0.10000  0.07340
 0.05000  0.04690
 0.02500  0.03052
 0.01250  0.01985
 0.00000  0.00000
 0.01250 -0.01948
 0.02500 -0.02891
 0.05000 -0.04169
 0.10000 -0.05831
 0.15000 -0.06820
 0.20000 -0.07323
 0.30000 -0.07469
 0.40000 -0.06720
 0.50000 -0.05096
 0.60000 -0.02882
 0.70000 -0.00806
 0.80000  0.00690
 0.90000  0.00940
 0.95000  0.00510
 1.00000  0.00000`,

  // NREL S822 (16% Small Wind Turbine Airfoil)
  S822: `NREL S822 Airfoil
 1.00000  0.00000
 0.95000  0.01250
 0.90000  0.02700
 0.80000  0.05800
 0.70000  0.08850
 0.60000  0.11350
 0.50000  0.12800
 0.40000  0.12950
 0.30000  0.11800
 0.20000  0.09500
 0.15000  0.08050
 0.10000  0.06200
 0.05000  0.03950
 0.02500  0.02550
 0.01250  0.01650
 0.00000  0.00000
 0.01250 -0.01450
 0.02500 -0.02150
 0.05000 -0.03100
 0.10000 -0.04250
 0.15000 -0.04850
 0.20000 -0.05050
 0.30000 -0.04750
 0.40000 -0.03750
 0.50000 -0.02250
 0.60000 -0.00750
 0.70000  0.00450
 0.80000  0.01050
 0.90000  0.00800
 0.95000  0.00400
 1.00000  0.00000`,

  // NREL S833 (10% Thin Tip Airfoil)
  S833: `NREL S833 Airfoil
 1.00000  0.00000
 0.95000  0.00850
 0.90000  0.01950
 0.80000  0.04200
 0.70000  0.06350
 0.60000  0.07950
 0.50000  0.08800
 0.40000  0.08750
 0.30000  0.07850
 0.20000  0.06200
 0.15000  0.05150
 0.10000  0.03900
 0.05000  0.02400
 0.02500  0.01500
 0.01250  0.00950
 0.00000  0.00000
 0.01250 -0.00900
 0.02500 -0.01350
 0.05000 -0.01850
 0.10000 -0.02350
 0.15000 -0.02500
 0.20000 -0.02400
 0.30000 -0.01850
 0.40000 -0.01050
 0.50000 -0.00200
 0.60000  0.00500
 0.70000  0.00850
 0.80000  0.00850
 0.90000  0.00550
 0.95000  0.00250
 1.00000  0.00000`,

  // TU Delft DU 91-W2-250 (25% Thick Root Airfoil)
  DU91W2250: `DU 91-W2-250 Airfoil
 1.00000  0.00000
 0.95000  0.01850
 0.90000  0.04100
 0.80000  0.08850
 0.70000  0.13450
 0.60000  0.17150
 0.50000  0.19300
 0.40000  0.19450
 0.30000  0.17700
 0.20000  0.14400
 0.15000  0.12200
 0.10000  0.09500
 0.05000  0.06100
 0.02500  0.04000
 0.01250  0.02600
 0.00000  0.00000
 0.01250 -0.02400
 0.02500 -0.03550
 0.05000 -0.05150
 0.10000 -0.07150
 0.15000 -0.08250
 0.20000 -0.08650
 0.30000 -0.08200
 0.40000 -0.06800
 0.50000 -0.04750
 0.60000 -0.02400
 0.70000 -0.00250
 0.80000  0.01200
 0.90000  0.01450
 0.95000  0.00800
 1.00000  0.00000`,

  // FFA-W3-241 (24% Thick Root/Mid Airfoil)
  FFAW3241: `FFA-W3-241 Airfoil
 1.00000  0.00000
 0.95000  0.01750
 0.90000  0.03850
 0.80000  0.08400
 0.70000  0.12750
 0.60000  0.16300
 0.50000  0.18350
 0.40000  0.18500
 0.30000  0.16900
 0.20000  0.13750
 0.15000  0.11650
 0.10000  0.09050
 0.05000  0.05800
 0.02500  0.03800
 0.01250  0.02450
 0.00000  0.00000
 0.01250 -0.02250
 0.02500 -0.03350
 0.05000 -0.04850
 0.10000 -0.06750
 0.15000 -0.07800
 0.20000 -0.08150
 0.30000 -0.07750
 0.40000 -0.06450
 0.50000 -0.04500
 0.60000 -0.02300
 0.70000 -0.00200
 0.80000  0.01150
 0.90000  0.01350
 0.95000  0.00750
 1.00000  0.00000`,

  // NACA 63-215 (15% Laminar Airfoil)
  NACA63215: `NACA 63-215 Airfoil
 1.00000  0.00000
 0.95000  0.01200
 0.90000  0.02600
 0.80000  0.05450
 0.70000  0.08100
 0.60000  0.10200
 0.50000  0.11350
 0.40000  0.11300
 0.30000  0.10050
 0.20000  0.07900
 0.15000  0.06550
 0.10000  0.04950
 0.05000  0.03050
 0.02500  0.01950
 0.01250  0.01250
 0.00000  0.00000
 0.01250 -0.01250
 0.02500 -0.01950
 0.05000 -0.03050
 0.10000 -0.04550
 0.15000 -0.05450
 0.20000 -0.05850
 0.30000 -0.05750
 0.40000 -0.04900
 0.50000 -0.03600
 0.60000 -0.02200
 0.70000 -0.00950
 0.80000 -0.00050
 0.90000  0.00350
 0.95000  0.00250
 1.00000  0.00000`,
};

// Cache parsed built-in interpolators
const BUILTIN_INTERPOLATORS = {};
for (const [key, datStr] of Object.entries(BUILTIN_DAT_RAW)) {
  try {
    BUILTIN_INTERPOLATORS[key] = parseDatFile(datStr);
  } catch (e) {
    console.error(`Failed to parse builtin airfoil ${key}:`, e);
  }
}

/**
 * Analytical NACA 4-digit profile calculation.
 * Camber: m = max camber (0 to 0.09), p = position of max camber (0.1 to 0.9)
 * NACA 4412: m=0.04, p=0.40, t=0.12
 * NACA 0012: m=0.00, p=0.00, t=0.12
 */
function getNACA4DigitProfile(x, thicknessRatio, m = 0.04, p = 0.4) {
  // Thickness distribution
  const yt =
    5 *
    thicknessRatio *
    (0.2969 * Math.sqrt(x) -
      0.126 * x -
      0.3516 * x ** 2 +
      0.2843 * x ** 3 -
      0.1015 * x ** 4);

  let yc = 0;
  let dyc_dx = 0;

  if (m > 0 && p > 0) {
    if (x <= p) {
      yc = (m / (p * p)) * (2 * p * x - x * x);
      dyc_dx = ((2 * m) / (p * p)) * (p - x);
    } else {
      yc = (m / ((1 - p) * (1 - p))) * (1 - 2 * p + 2 * p * x - x * x);
      dyc_dx = ((2 * m) / ((1 - p) * (1 - p))) * (p - x);
    }
  }

  return { yt, yc, dyc_dx };
}

/**
 * Generate 2D airfoil profile points along the chord.
 *
 * @param {number} thicknessRatio - Thickness as a fraction (e.g. 0.12 for 12%)
 * @param {number} numPoints - Number of points per upper/lower surface
 * @param {number} chord - Chord length in meters
 * @param {number} leMod - Leading edge radius multiplier
 * @param {number} teThicknessMm - Trailing edge blunt thickness in mm
 * @param {number} teFlapDeg - Trailing edge flap deflection in degrees
 * @param {Object} customInterpolator - User-uploaded custom .dat interpolator
 * @param {string} airfoilName - Built-in airfoil family name (e.g. 'SG6043', 'NACA4412', 'S809')
 * @returns {Array<{x: number, y: number}>} Normalized/scaled coordinate pairs
 */
export function getAirfoilProfile(
  thicknessRatio,
  numPoints = 40,
  chord = 1,
  leMod = 1.0,
  teThicknessMm = 0,
  teFlapDeg = 0,
  customInterpolator = null,
  airfoilName = 'NACA4412'
) {
  const points = [];

  // True analytical circle for cylindrical hub root adapter
  if (airfoilName === 'Circle') {
    const radius = 0.5;
    for (let i = 0; i <= numPoints; i++) {
      const theta = (i / numPoints) * Math.PI;
      const x = 0.5 - 0.5 * Math.cos(theta);
      const y = Math.sin(theta) * radius;
      points.push({ x: 0.25 - x, y });
    }
    for (let i = numPoints - 1; i > 0; i--) {
      const theta = (i / numPoints) * Math.PI;
      const x = 0.5 - 0.5 * Math.cos(theta);
      const y = -Math.sin(theta) * radius;
      points.push({ x: 0.25 - x, y });
    }
    return points;
  }

  // Determine active interpolator (Custom file OR built-in dataset)
  let activeInterpolator = customInterpolator;
  if (!activeInterpolator && BUILTIN_INTERPOLATORS[airfoilName]) {
    activeInterpolator = BUILTIN_INTERPOLATORS[airfoilName];
  }

  // Trailing edge thickness offset calculation
  const currentTE = activeInterpolator
    ? (activeInterpolator.getUpper(1) - activeInterpolator.getLower(1)) / 2
    : 5 * thicknessRatio * 0.0021;
  const targetTE = (teThicknessMm / 1000 / 2) / Math.max(0.001, chord);
  const diffTE = targetTE - currentTE;

  const leScale = Math.sqrt(Math.max(0.01, leMod));

  // Trailing edge flap deflection
  const flapRad = (teFlapDeg * Math.PI) / 180;
  const xHinge = 0.65; // Flap starts at 65% chord
  const tanBeta = Math.tan(flapRad);

  // Upper Surface (LE -> TE)
  for (let i = 0; i <= numPoints; i++) {
    const theta = (i / numPoints) * Math.PI;
    const x = 0.5 * (1 - Math.cos(theta));

    let yt;
    let yc;
    let dyc_dx = 0;

    if (activeInterpolator) {
      const y_up = activeInterpolator.getUpper(x);
      const y_lo = activeInterpolator.getLower(x);
      const actualThickness = activeInterpolator.maxThickness || 0.12;
      const scale = thicknessRatio / Math.max(0.01, actualThickness);

      yt = ((y_up - y_lo) / 2) * scale;
      yc = ((y_up + y_lo) / 2) * scale;
    } else {
      // Analytical NACA evaluation
      const isSymmetric = airfoilName === 'NACA0012';
      const m = isSymmetric ? 0 : 0.04;
      const p = isSymmetric ? 0 : 0.4;
      const res = getNACA4DigitProfile(x, thicknessRatio, m, p);
      yt = res.yt;
      yc = res.yc;
      dyc_dx = res.dyc_dx;
    }

    // Leading Edge modifier
    if (x < 0.2) {
      const u = x / 0.2;
      const blend = 1 + (leScale - 1) * Math.pow(1 - u, 2);
      yt *= blend;
    }

    // Trailing Edge bluntness modifier
    if (x > 0.5) {
      const v = (x - 0.5) / 0.5;
      yt += diffTE * Math.pow(v, 2);
    }

    // Trailing Edge flap deflection
    if (x > xHinge) {
      const flapCamber = -tanBeta * 0.5 * Math.pow(x - xHinge, 2) / (1 - xHinge);
      yc += flapCamber;
      dyc_dx += -tanBeta * (x - xHinge) / (1 - xHinge);
    }

    const thetaC = Math.atan(dyc_dx);
    const cosT = Math.cos(thetaC);
    const sinT = Math.sin(thetaC);

    const xUpper = x - yt * sinT;
    const yUpper = yc + yt * cosT;

    points.push({ x: 0.25 - xUpper, y: yUpper });
  }

  // Lower Surface (TE -> LE)
  for (let i = numPoints - 1; i > 0; i--) {
    const theta = (i / numPoints) * Math.PI;
    const x = 0.5 * (1 - Math.cos(theta));

    let yt;
    let yc;
    let dyc_dx = 0;

    if (activeInterpolator) {
      const y_up = activeInterpolator.getUpper(x);
      const y_lo = activeInterpolator.getLower(x);
      const actualThickness = activeInterpolator.maxThickness || 0.12;
      const scale = thicknessRatio / Math.max(0.01, actualThickness);

      yt = ((y_up - y_lo) / 2) * scale;
      yc = ((y_up + y_lo) / 2) * scale;
    } else {
      const isSymmetric = airfoilName === 'NACA0012';
      const m = isSymmetric ? 0 : 0.04;
      const p = isSymmetric ? 0 : 0.4;
      const res = getNACA4DigitProfile(x, thicknessRatio, m, p);
      yt = res.yt;
      yc = res.yc;
      dyc_dx = res.dyc_dx;
    }

    if (x < 0.2) {
      const u = x / 0.2;
      const blend = 1 + (leScale - 1) * Math.pow(1 - u, 2);
      yt *= blend;
    }

    if (x > 0.5) {
      const v = (x - 0.5) / 0.5;
      yt += diffTE * Math.pow(v, 2);
    }

    if (x > xHinge) {
      const flapCamber = -tanBeta * 0.5 * Math.pow(x - xHinge, 2) / (1 - xHinge);
      yc += flapCamber;
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
