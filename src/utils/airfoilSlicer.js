import { getAirfoilProfile } from './airfoilProfile';
import { generateSegments } from './geometryBuilder';

/**
 * Airfoil Slicer Utility
 * Computes exact 2D section geometry, chord length, twist angle, thickness %,
 * camber line, and aerodynamic center at any arbitrary normalized span position (r/R).
 *
 * @param {Object} bladeParams - Full blade configuration
 * @param {number} normalizedSpan - Position along blade span (0.0 at root to 1.0 at tip)
 * @param {Object} parsedCustomAirfoils - Optional custom .dat airfoil interpolators
 * @returns {Object} Sliced section parameters and 2D coordinates
 */
export function sliceBladeSection(bladeParams, normalizedSpan, parsedCustomAirfoils = {}) {
  const span = Math.max(0.0, Math.min(1.0, normalizedSpan));
  const R_meters = bladeParams.radiusMm / 1000;
  const currentR = span * R_meters;

  // Generate high-resolution segments for interpolation
  const segParams = { ...bladeParams, numSegments: 60 };
  const segments = generateSegments(segParams, parsedCustomAirfoils);

  // Find nearest segments
  let segIndex = 0;
  for (let i = 0; i < segments.length - 1; i++) {
    if (currentR >= segments[i].r && currentR <= segments[i + 1].r) {
      segIndex = i;
      break;
    }
  }

  const s1 = segments[segIndex];
  const s2 = segments[Math.min(segments.length - 1, segIndex + 1)];
  const t = s2.r !== s1.r ? (currentR - s1.r) / (s2.r - s1.r) : 0;
  const clampedT = Math.max(0, Math.min(1, t));

  // Interpolated properties at span slice
  const chord_m = s1.chord + clampedT * (s2.chord - s1.chord);
  const twistDeg = s1.twistDeg + clampedT * (s2.twistDeg - s1.twistDeg);
  const thicknessRatio = s1.thicknessRatio + clampedT * (s2.thicknessRatio - s1.thicknessRatio);
  const activeAirfoil = clampedT < 0.5 ? s1.airfoil : s2.airfoil;
  const customInterpolator = clampedT < 0.5 ? s1.customInterpolator : s2.customInterpolator;

  // Generate 2D Profile Points
  const numPoints = 50;
  const rawPoints = getAirfoilProfile(
    thicknessRatio,
    numPoints,
    chord_m,
    bladeParams.leRadiusMod || 1.0,
    bladeParams.teThicknessMm || 0.0,
    bladeParams.teFlapDeg || 0.0,
    customInterpolator,
    activeAirfoil
  );

  // Extract upper & lower coordinates and scale by chord
  const upperSurface = [];
  const lowerSurface = [];
  const camberLine = [];

  const halfLen = Math.floor(rawPoints.length / 2);
  for (let i = 0; i < halfLen; i++) {
    const ptUpper = rawPoints[i];
    const ptLower = rawPoints[rawPoints.length - 1 - i];

    const upX = (0.25 - ptUpper.x) * chord_m;
    const upY = ptUpper.y * chord_m;
    const lowX = (0.25 - ptLower.x) * chord_m;
    const lowY = ptLower.y * chord_m;

    upperSurface.push({ x: upX, y: upY });
    lowerSurface.push({ x: lowX, y: lowY });
    camberLine.push({
      x: (upX + lowX) / 2,
      y: (upY + lowY) / 2,
    });
  }

  return {
    span,
    r_meters: currentR,
    chord_mm: chord_m * 1000,
    chord_m,
    twistDeg,
    thicknessPct: thicknessRatio * 100,
    maxThickness_mm: thicknessRatio * chord_m * 1000,
    airfoil: activeAirfoil,
    upperSurface,
    lowerSurface,
    camberLine,
    rawProfilePoints: rawPoints,
  };
}
