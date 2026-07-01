/**
 * geometryBuilder.js
 * Interpolates regional parameters into discrete blade segments for the BEM solver.
 * 
 * The blade is divided into 3 zones:
 *   Root zone:  0          → midStart   (interpolates Root → Mid)
 *   Mid zone:   midStart   → midEnd     (uses Mid properties)
 *   Tip zone:   midEnd     → 1.0        (interpolates Mid → Tip)
 */

// Smooth interpolation function (cosine interpolation for smoother transitions)
function smoothStep(t) {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

export function generateSegments(params, parsedCustomAirfoils = {}) {
  const { 
    radiusMm, 
    numSegments = 15,
    midPosition = 0.5,
    midLength = 0,
    planform = 'linear', 
    root, 
    mid, 
    tip 
  } = params;

  const R = radiusMm / 1000; // Convert to meters
  const mp = Math.max(0.1, Math.min(0.9, midPosition)); // Clamp center
  const ml = Math.max(0, Math.min(0.6, midLength));      // Clamp length (0–60%)

  // Compute the start and end of the mid zone
  const midStart = Math.max(0.05, mp - ml / 2);
  const midEnd   = Math.min(0.95, mp + ml / 2);

  const segments = [];

  for (let i = 0; i < numSegments; i++) {
    // r is the radial distance to the segment center
    const r = (i + 0.5) * (R / numSegments);
    const normalizedR = r / R; // 0 to 1

    let chordMm, twistDeg, thicknessPct, airfoil, customInterpolator;

    if (normalizedR <= midStart) {
      // Root → Mid transition zone
      const t = midStart > 0 ? normalizedR / midStart : 0; // 0 to 1
      const interpT = planform === 'optimized' ? smoothStep(t) : t;
      
      chordMm = root.chordMm + interpT * (mid.chordMm - root.chordMm);
      twistDeg = root.twistDeg + interpT * (mid.twistDeg - root.twistDeg);
      thicknessPct = root.thicknessPct + interpT * (mid.thicknessPct - root.thicknessPct);
      const region = t < 0.5 ? 'root' : 'mid';
      airfoil = params[region].airfoil;
      customInterpolator = parsedCustomAirfoils[region];

    } else if (normalizedR <= midEnd) {
      // Mid-span zone — constant mid properties
      chordMm = mid.chordMm;
      twistDeg = mid.twistDeg;
      thicknessPct = mid.thicknessPct;
      airfoil = mid.airfoil;
      customInterpolator = parsedCustomAirfoils['mid'];

    } else {
      // Mid → Tip transition zone
      const range = 1.0 - midEnd;
      const t = range > 0 ? (normalizedR - midEnd) / range : 1;
      const interpT = planform === 'optimized' ? smoothStep(t) : t;
      
      chordMm = mid.chordMm + interpT * (tip.chordMm - mid.chordMm);
      twistDeg = mid.twistDeg + interpT * (tip.twistDeg - mid.twistDeg);
      thicknessPct = mid.thicknessPct + interpT * (tip.thicknessPct - mid.thicknessPct);
      const region = t < 0.5 ? 'mid' : 'tip';
      airfoil = params[region].airfoil;
      customInterpolator = parsedCustomAirfoils[region];
    }

    segments.push({
      r,
      chord: chordMm / 1000, // meters
      twistDeg,
      thicknessRatio: thicknessPct / 100,
      airfoil,
      customInterpolator
    });
  }

  return segments;
}
