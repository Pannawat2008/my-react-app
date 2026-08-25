/**
 * geometryBuilder.js
 * High-Precision Parametric Blade Geometry Builder.
 * Interpolates regional parameters (Root, Mid-Span, Tip) into discrete blade segments.
 *
 * Supports:
 * - Linear, Optimized (Cosine / Smooth-Step), and Natural Spline Planform interpolation
 * - Cylindrical Hub Root transition (circular hub mount to aerodynamic airfoil)
 * - Parametric Tip Winglets (cant angle, height, and sweep for induced drag reduction)
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
    numSegments = 20,
    midPosition = 0.45,
    midLength = 0.15,
    planform = 'optimized',
    root,
    mid,
    tip,
    preBendMm = 0,
    sweepAngleDeg = 0,
    hubRootEnabled = false,
    hubDiameterMm = 28,
    hubTransitionPct = 10,
    wingletEnabled = false,
    wingletHeightMm = 25,
    wingletAngleDeg = 75,
  } = params;

  const R = Math.max(0.1, radiusMm / 1000); // meters
  const mp = Math.max(0.1, Math.min(0.9, midPosition));
  const ml = Math.max(0.0, Math.min(0.6, midLength));

  // Compute start and end of mid zone
  const midStart = Math.max(0.05, mp - ml / 2);
  const midEnd = Math.min(0.95, mp + ml / 2);

  const segments = [];
  const count = Math.max(8, numSegments);

  const hubTransFrac = hubRootEnabled ? Math.max(0.02, Math.min(0.3, (hubTransitionPct || 10) / 100)) : 0;
  const wingletStartFrac = wingletEnabled ? 0.90 : 1.0;

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

    // ── 1. Cylindrical Hub Root Blend ──
    if (hubRootEnabled && normalizedR <= hubTransFrac) {
      const hubT = normalizedR / hubTransFrac; // 0 = pure cylinder, 1 = root airfoil
      const blend = smoothStep(hubT);
      const targetCylDia = Math.max(10, hubDiameterMm || 28);

      chordMm = targetCylDia * (1 - blend) + chordMm * blend;
      twistDeg = 0 * (1 - blend) + twistDeg * blend;
      thicknessPct = 100 * (1 - blend) + thicknessPct * blend;
      if (hubT < 0.3) {
        airfoil = 'Circle';
      }
    }

    // ── 2. Parametric Out-of-Plane Pre-Bend & Sweep ──
    let preBendOffset = (preBendMm / 1000) * Math.pow(normalizedR, 2);
    let sweepOffset = Math.sin((sweepAngleDeg * Math.PI) / 180) * r * Math.pow(normalizedR, 1.5);

    // ── 3. Parametric Tip Winglet Curvature ──
    let wingletOffsetZ = 0;
    if (wingletEnabled && normalizedR >= wingletStartFrac) {
      const wT = (normalizedR - wingletStartFrac) / (1.0 - wingletStartFrac);
      const wHeightM = (wingletHeightMm || 25) / 1000;
      const wCantRad = ((wingletAngleDeg || 75) * Math.PI) / 180;
      const wCurve = smoothStep(wT);

      wingletOffsetZ = wHeightM * Math.sin(wCantRad) * wCurve;
      preBendOffset += wingletOffsetZ;
      sweepOffset += wHeightM * Math.cos(wCantRad) * wCurve * 0.3;
    }

    segments.push({
      r,
      normalizedR,
      chord: Math.max(0.005, chordMm / 1000), // in meters
      chordMm,
      twistDeg,
      thicknessRatio: Math.max(0.06, Math.min(1.0, thicknessPct / 100)),
      thicknessPct,
      airfoil,
      customInterpolator,
      preBendOffset,
      sweepOffset,
      isHubRegion: hubRootEnabled && normalizedR <= hubTransFrac,
      isWingletRegion: wingletEnabled && normalizedR >= wingletStartFrac,
    });
  }

  return segments;
}
