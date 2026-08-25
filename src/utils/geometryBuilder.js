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

  // ── Authentic Wind Turbine Blade Planform Parameters ──
  // 1. Hub Mount: r/R in [0, 0.08] (Circular base)
  // 2. Shoulder Transition: r/R in [0.08, shoulderFrac] (Expands to Max Chord & Root Airfoil)
  // 3. Main Aerodynamic Span: r/R in [shoulderFrac, 0.92] (Power generation taper to Mid & Tip)
  // 4. Streamlined Tip: r/R in [0.92, 1.00] (Aerodynamic tip fairing)
  const shoulderFrac = Math.max(0.12, Math.min(0.25, mp * 0.4)); // shoulder at ~15-20% span
  const hubCylDia = Math.max(12, hubDiameterMm || 28);

  for (let i = 0; i < count; i++) {
    // r is radial distance to segment center
    const normalizedR = (i + 0.5) / count;
    const r = normalizedR * R;

    let chordMm, twistDeg, thicknessPct, airfoil, customInterpolator;

    if (normalizedR <= shoulderFrac) {
      // ── Zone 1 & 2: Hub Cylinder → Aerodynamic Shoulder (Max Chord) ──
      const u = normalizedR / shoulderFrac;
      const blend = smoothStep(u);

      // Transition from circular hub diameter to maximum shoulder chord
      chordMm = hubCylDia * (1 - blend) + root.chordMm * blend;
      twistDeg = 0 * (1 - blend) + root.twistDeg * blend;
      thicknessPct = 100 * (1 - blend) + root.thicknessPct * blend;

      if (u < 0.25) {
        airfoil = 'Circle';
      } else {
        airfoil = root.airfoil;
        customInterpolator = parsedCustomAirfoils['root'];
      }
    } else if (normalizedR <= mp) {
      // ── Zone 3a: Shoulder (Max Chord) → Mid-Span ──
      const u = (normalizedR - shoulderFrac) / Math.max(0.01, mp - shoulderFrac);
      const blend = smoothStep(u);

      chordMm = root.chordMm + blend * (mid.chordMm - root.chordMm);
      twistDeg = root.twistDeg + blend * (mid.twistDeg - root.twistDeg);
      thicknessPct = root.thicknessPct + blend * (mid.thicknessPct - root.thicknessPct);
      const region = u < 0.5 ? 'root' : 'mid';
      airfoil = params[region]?.airfoil || root.airfoil;
      customInterpolator = parsedCustomAirfoils[region];
    } else {
      // ── Zone 3b: Mid-Span → Tip Taper ──
      const u = (normalizedR - mp) / Math.max(0.01, 1.0 - mp);
      const blend = smoothStep(u);

      chordMm = mid.chordMm + blend * (tip.chordMm - mid.chordMm);
      twistDeg = mid.twistDeg + blend * (tip.twistDeg - mid.twistDeg);
      thicknessPct = mid.thicknessPct + blend * (tip.thicknessPct - mid.thicknessPct);

      // Zone 4: Tip streamlining fairing at extreme outer 8%
      if (normalizedR > 0.92) {
        const tipU = (normalizedR - 0.92) / 0.08;
        chordMm *= (1.0 - 0.25 * smoothStep(tipU));
      }

      const region = u < 0.5 ? 'mid' : 'tip';
      airfoil = params[region]?.airfoil || tip.airfoil;
      customInterpolator = parsedCustomAirfoils[region];
    }

    // ── Parametric Out-of-Plane Pre-Bend & Sweep ──
    let preBendOffset = (preBendMm / 1000) * Math.pow(normalizedR, 2);
    let sweepOffset = Math.sin((sweepAngleDeg * Math.PI) / 180) * r * Math.pow(normalizedR, 1.5);

    // ── Parametric Tip Winglet Curvature ──
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
