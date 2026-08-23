/**
 * geometryBuilder.js
 * High-Precision Parametric Blade Geometry Builder.
 * Interpolates regional parameters (Root, Mid-Span, Tip) into discrete blade segments.
 *
 * Supports:
 * - Linear or Optimized (Cosine / Smooth-Step) Planform interpolation
 * - Custom Airfoil (.dat) interpolation
 * - Spanwise sweep & pre-bend distributions
 */

function smoothStep(t) {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

function cubicHermite(t) {
  return t * t * (3 - 2 * t);
}

export function generateSegments(params, parsedCustomAirfoils = {}) {
  const {
    radiusMm = 10000,
    numSegments = 16,
    midPosition = 0.5,
    midLength = 0.15,
    planform = 'optimized',
    root,
    mid,
    tip,
    preBendMm = 0,
    sweepAngleDeg = 0,
  } = params;

  const R = Math.max(0.1, radiusMm / 1000); // meters
  const mp = Math.max(0.1, Math.min(0.9, midPosition));
  const ml = Math.max(0.0, Math.min(0.6, midLength));

  // Compute start and end of mid zone
  const midStart = Math.max(0.05, mp - ml / 2);
  const midEnd = Math.min(0.95, mp + ml / 2);

  const segments = [];
  const count = Math.max(5, numSegments);

  for (let i = 0; i < count; i++) {
    // r is radial distance to segment center
    const normalizedR = (i + 0.5) / count;
    const r = normalizedR * R;

    let chordMm, twistDeg, thicknessPct, airfoil, customInterpolator;

    if (normalizedR <= midStart) {
      // Root → Mid transition zone
      const t = midStart > 0 ? normalizedR / midStart : 0;
      const interpT = planform === 'optimized' ? smoothStep(t) : cubicHermite(t);

      chordMm = root.chordMm + interpT * (mid.chordMm - root.chordMm);
      twistDeg = root.twistDeg + interpT * (mid.twistDeg - root.twistDeg);
      thicknessPct = root.thicknessPct + interpT * (mid.thicknessPct - root.thicknessPct);
      const region = t < 0.5 ? 'root' : 'mid';
      airfoil = params[region]?.airfoil || root.airfoil;
      customInterpolator = parsedCustomAirfoils[region];
    } else if (normalizedR <= midEnd) {
      // Mid-span zone — pure mid properties
      chordMm = mid.chordMm;
      twistDeg = mid.twistDeg;
      thicknessPct = mid.thicknessPct;
      airfoil = mid.airfoil;
      customInterpolator = parsedCustomAirfoils['mid'];
    } else {
      // Mid → Tip transition zone
      const range = 1.0 - midEnd;
      const t = range > 0 ? (normalizedR - midEnd) / range : 1;
      const interpT = planform === 'optimized' ? smoothStep(t) : cubicHermite(t);

      chordMm = mid.chordMm + interpT * (tip.chordMm - mid.chordMm);
      twistDeg = mid.twistDeg + interpT * (tip.twistDeg - mid.twistDeg);
      thicknessPct = mid.thicknessPct + interpT * (tip.thicknessPct - mid.thicknessPct);
      const region = t < 0.5 ? 'mid' : 'tip';
      airfoil = params[region]?.airfoil || tip.airfoil;
      customInterpolator = parsedCustomAirfoils[region];
    }

    // Parametric out-of-plane pre-bend and in-plane sweep
    const preBendOffset = (preBendMm / 1000) * Math.pow(normalizedR, 2);
    const sweepOffset = Math.sin((sweepAngleDeg * Math.PI) / 180) * r * Math.pow(normalizedR, 1.5);

    segments.push({
      r,
      normalizedR,
      chord: Math.max(0.01, chordMm / 1000), // in meters
      chordMm,
      twistDeg,
      thicknessRatio: Math.max(0.06, thicknessPct / 100),
      thicknessPct,
      airfoil,
      customInterpolator,
      preBendOffset,
      sweepOffset,
    });
  }

  return segments;
}
