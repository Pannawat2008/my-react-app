/**
 * jointBuilder.js
 * Generates airfoil-shaped tongue & groove interlocking joint geometry
 * for split blade 3D printing.
 *
 * Joint anatomy at each cut plane:
 *   Piece A (root-side) tip face (y = cutY)  →  TONGUE (boss) extruded outward (+Y, into next part)
 *   Piece B (tip-side) root face (y = cutY)  →  POCKET (cavity) recessed inward (+Y, inside Piece B)
 *
 * When assembled, Piece A's tongue (cutY to cutY + depth) slides directly INTO Piece B's pocket cavity (cutY to cutY + depth).
 */

import * as THREE from 'three';
import { getAirfoilProfile } from './airfoilProfile';

/* ────────────────────────────────────────────────
   1. Offset an airfoil profile inward or outward
   ──────────────────────────────────────────────── */

/**
 * Offset a closed airfoil profile inward by `offsetMm` mm, with flat front and back cuts.
 * Uses paired upper/lower camber-thickness offset and trims sharp ends:
 *  - Shrinks thickness along the camber line symmetrically
 *  - Truncates sharp LE with a flat front bulkhead face at `frontCutMm` from LE
 *  - Truncates sharp TE with a flat rear bulkhead face at `backCutMm` from TE
 *  - Clamps minimum core thickness to prevent self-intersection
 * 
 * Positive offsetMm = shrink inward (smaller tongue/pocket).
 */
export function offsetAirfoilProfile(profile, chordMm, offsetMm, frontCutMm = 5.0, backCutMm = 10.0) {
  const n = profile.length;
  if (n < 6) return profile.map(p => ({ x: p.x * chordMm, y: p.y * chordMm }));

  // Convert normalized profile to mm
  const pts = profile.map(p => ({ x: p.x * chordMm, y: p.y * chordMm }));

  const numUpper = Math.floor(n / 2) + 1; // index 0 is LE, index numUpper-1 is TE
  const teIdx = numUpper - 1;

  const lePt = pts[0];
  const tePt = pts[teIdx];
  const chordLen = Math.abs(lePt.x - tePt.x) || (chordMm || 100);

  // Front Cut (LE Inset) & Back Cut (TE Inset)
  const maxTotalCut = Math.max(0, chordLen - 10);
  let actualFrontCut = Math.max(0, frontCutMm || 0);
  let actualBackCut = Math.max(0, backCutMm || 0);

  if (actualFrontCut + actualBackCut > maxTotalCut && (actualFrontCut + actualBackCut) > 0) {
    const scale = maxTotalCut / (actualFrontCut + actualBackCut);
    actualFrontCut *= scale;
    actualBackCut *= scale;
  }

  // Front cut plane (X limit near LE) and Back cut plane (X limit near TE)
  // In profile coordinates, LE has larger X, TE has smaller X
  const xFrontPlane = lePt.x - actualFrontCut;
  const xBackPlane = tePt.x + actualBackCut;

  const result = new Array(n);

  // 1. Process paired upper and lower surface points
  for (let i = 1; i < teIdx; i++) {
    const upperPt = pts[i];
    const lowerIdx = n - i;
    const lowerPt = pts[lowerIdx];

    const cx = (upperPt.x + lowerPt.x) / 2;
    const cy = (upperPt.y + lowerPt.y) / 2;

    const currentHalfThickness = Math.max(0.01, (upperPt.y - lowerPt.y) / 2);
    // Minimum thickness floor so walls never cross
    const minHalfThick = Math.max(0.2, currentHalfThickness * 0.15);
    const newHalfThickness = Math.max(minHalfThick, currentHalfThickness - offsetMm);

    // Clamp X to the flat front and back cut planes
    const clampedX = Math.max(xBackPlane, Math.min(xFrontPlane, cx));

    result[i] = {
      x: clampedX,
      y: cy + newHalfThickness,
    };

    result[lowerIdx] = {
      x: clampedX,
      y: cy - newHalfThickness,
    };
  }

  // 2. Flat Front Bulkhead (Leading Edge at index 0)
  result[0] = {
    x: xFrontPlane,
    y: lePt.y,
  };

  // 3. Flat Rear Bulkhead (Trailing Edge at index teIdx)
  result[teIdx] = {
    x: xBackPlane,
    y: tePt.y,
  };

  return result;
}

/**
 * Calculates the exact (x, z) centroid on the camber line at the maximum-thickness
 * core (default: 30% chord from LE) so the carbon fiber spar rod has maximum and equal
 * skin clearance on both upper and lower surfaces.
 */
export function getAirfoilSparCenter(seg, profileParams = {}) {
  const chordMm = (seg?.chord || 0.05) * 1000;
  const rodPosPct = Math.max(0.10, Math.min(0.75, (profileParams.carbonRodPosPct ?? 30) / 100));
  const x = rodPosPct; // 0 to 1
  const yOffsetMm = profileParams.carbonRodYOffsetMm || 0;

  let camberY = 0;
  if (seg?.customInterpolator) {
    const y_up = seg.customInterpolator.getUpper(x);
    const y_lo = seg.customInterpolator.getLower(x);
    const actualThickness = seg.customInterpolator.maxThickness || 0.12;
    const scale = (seg.thicknessRatio || 0.12) / Math.max(0.01, actualThickness);
    camberY = ((y_up + y_lo) / 2) * scale;
  } else {
    // NACA 4-digit analytical camber line
    const isSymmetric = seg?.airfoil === 'NACA0012';
    const m = isSymmetric ? 0 : 0.04;
    const p = isSymmetric ? 0 : 0.4;
    if (m > 0 && p > 0) {
      if (x < p) {
        camberY = (m / (p * p)) * (2 * p * x - x * x);
      } else {
        camberY = (m / Math.pow(1 - p, 2)) * ((1 - 2 * p) + 2 * p * x - x * x);
      }
    }
  }

  return {
    px: (0.25 - x) * chordMm,
    pz: camberY * chordMm + yOffsetMm,
  };
}

/* ────────────────────────────────────────────────
   2. Build tongue (boss) preview triangles
   ──────────────────────────────────────────────── */

export function buildTongueTriangles(
  seg, wallOffset, extrusionDepth, cutPlaneYMm, carbonRodRadiusMm, profileParams = {}, frontCut = 5.0, backCut = 10.0
) {
  const numPoints = 30;
  const profile = getAirfoilProfile(
    seg.thicknessRatio, numPoints, seg.chord,
    profileParams.leRadiusMod, profileParams.teThicknessMm,
    profileParams.teFlapDeg, seg.customInterpolator, seg.airfoil
  );

  const chordMm = seg.chord * 1000;
  const tongueProfile = offsetAirfoilProfile(profile, chordMm, wallOffset, frontCut, backCut);
  const totalPts = tongueProfile.length;

  const twistRad = (-(seg.twistDeg + (profileParams.bladePitch || 0)) * Math.PI) / 180;
  const cosT = Math.cos(twistRad);
  const sinT = Math.sin(twistRad);

  function transformPoint(px, pz, y) {
    const rx = px * cosT - pz * sinT;
    const rz = px * sinT + pz * cosT;
    return { x: rx, y, z: rz };
  }

  const triangles = [];
  const baseY = cutPlaneYMm;
  const tipY = cutPlaneYMm + extrusionDepth;

  const baseRing = tongueProfile.map(p => transformPoint(p.x, p.y, baseY));
  const tipRing = tongueProfile.map(p => transformPoint(p.x, p.y, tipY));

  // Exterior side walls (outward normals)
  for (let i = 0; i < totalPts; i++) {
    const ni = (i + 1) % totalPts;
    triangles.push(baseRing[i], tipRing[i], baseRing[ni]);
    triangles.push(tipRing[i], tipRing[ni], baseRing[ni]);
  }

  // Tongue tip end cap (outward normal points +Y)
  if (carbonRodRadiusMm > 0) {
    const sparCenter = getAirfoilSparCenter(seg, profileParams);
    const holePoints = 30;
    const holeTipRing = [];
    for (let j = 0; j < holePoints; j++) {
      const theta = (j / holePoints) * Math.PI * 2;
      const hx = sparCenter.px + Math.cos(theta) * carbonRodRadiusMm;
      const hz = sparCenter.pz + Math.sin(theta) * carbonRodRadiusMm;
      holeTipRing.push(transformPoint(hx, hz, tipY));
    }

    for (let i = 0; i < totalPts; i++) {
      const ni = (i + 1) % totalPts;
      const hi = Math.floor((i / totalPts) * holePoints) % holePoints;
      const hni = (hi + 1) % holePoints;
      triangles.push(tipRing[i], tipRing[ni], holeTipRing[hi]);
      triangles.push(tipRing[ni], holeTipRing[hni], holeTipRing[hi]);
    }
  } else {
    for (let i = 1; i < totalPts - 1; i++) {
      triangles.push(tipRing[0], tipRing[i + 1], tipRing[i]);
    }
  }

  return triangles;
}

/* ────────────────────────────────────────────────
   3. Build pocket (cavity) preview triangles
   ──────────────────────────────────────────────── */

export function buildPocketTriangles(
  seg, wallOffset, clearance, pocketDepth, cutPlaneYMm,
  carbonRodRadiusMm, glueChannelWidth, glueChannelDepth, enableGlueChannel, profileParams, frontCut = 5.0, backCut = 10.0
) {
  const numPoints = 30;
  const profile = getAirfoilProfile(
    seg.thicknessRatio, numPoints, seg.chord,
    profileParams.leRadiusMod, profileParams.teThicknessMm,
    profileParams.teFlapDeg, seg.customInterpolator, seg.airfoil
  );

  const chordMm = seg.chord * 1000;
  const effectiveOffset = wallOffset - clearance;
  // Pocket front/back cut adjusted by clearance so the flat front/back bulkheads slide in smoothly
  const pocketFrontCut = Math.max(0, frontCut - clearance);
  const pocketBackCut = Math.max(0, backCut - clearance);
  const pocketProfile = offsetAirfoilProfile(profile, chordMm, effectiveOffset, pocketFrontCut, pocketBackCut);
  const totalPts = pocketProfile.length;

  const twistRad = (seg.twistDeg * Math.PI) / 180;
  const cosT = Math.cos(twistRad);
  const sinT = Math.sin(twistRad);

  function transformPoint(px, pz, y) {
    const rx = px * cosT - pz * sinT;
    const rz = px * sinT + pz * cosT;
    return { x: rx, y, z: rz };
  }

  const triangles = [];
  const faceY = cutPlaneYMm;
  // Pocket goes INSIDE the receiving part (in +Y direction from the cut plane!)
  const bottomY = cutPlaneYMm + pocketDepth;

  const faceRing = pocketProfile.map(p => transformPoint(p.x, p.y, faceY));
  const bottomRing = pocketProfile.map(p => transformPoint(p.x, p.y, bottomY));

  // Cavity interior walls (normals face inward into the cavity space)
  for (let i = 0; i < totalPts; i++) {
    const ni = (i + 1) % totalPts;
    triangles.push(faceRing[i], bottomRing[i], faceRing[ni]);
    triangles.push(bottomRing[i], bottomRing[ni], faceRing[ni]);
  }

  // Pocket cavity bottom floor (normal points -Y, back towards entrance)
  if (carbonRodRadiusMm > 0) {
    const sparCenter = getAirfoilSparCenter(seg, profileParams);
    const holePoints = 30;
    const holeBottomRing = [];
    for (let j = 0; j < holePoints; j++) {
      const theta = (j / holePoints) * Math.PI * 2;
      const hx = sparCenter.px + Math.cos(theta) * carbonRodRadiusMm;
      const hz = sparCenter.pz + Math.sin(theta) * carbonRodRadiusMm;
      holeBottomRing.push(transformPoint(hx, hz, bottomY));
    }

    for (let i = 0; i < totalPts; i++) {
      const ni = (i + 1) % totalPts;
      const hi = Math.floor((i / totalPts) * holePoints) % holePoints;
      const hni = (hi + 1) % holePoints;
      triangles.push(bottomRing[i], bottomRing[ni], holeBottomRing[hi]);
      triangles.push(bottomRing[ni], holeBottomRing[hni], holeBottomRing[hi]);
    }
  } else {
    for (let i = 1; i < totalPts - 1; i++) {
      triangles.push(bottomRing[0], bottomRing[i], bottomRing[i + 1]);
    }
  }

  return triangles;
}

/* ────────────────────────────────────────────────
   4. Generate Three.js BufferGeometry helper
   ──────────────────────────────────────────────── */

export function trianglesToBufferGeometry(triangles) {
  const positions = new Float32Array(triangles.length * 3);
  for (let i = 0; i < triangles.length; i++) {
    positions[i * 3] = triangles[i].x;
    positions[i * 3 + 1] = triangles[i].y;
    positions[i * 3 + 2] = triangles[i].z;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.computeVertexNormals();
  return geo;
}

/* ────────────────────────────────────────────────
   5. Compute slice boundaries
   ──────────────────────────────────────────────── */

export function computeSliceBoundaries(segments, sliceHeightMm) {
  const R_mm = segments[segments.length - 1].r * 1000;
  const boundaries = [0];

  if (sliceHeightMm > 0 && sliceHeightMm < R_mm) {
    let currentLimit = sliceHeightMm;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].r * 1000 >= currentLimit) {
        boundaries.push(i);
        currentLimit += sliceHeightMm;
      }
    }
  }
  boundaries.push(segments.length - 1);
  return boundaries;
}

/* ────────────────────────────────────────────────
   6. Generate all joint preview geometries
   ──────────────────────────────────────────────── */

export function generateAllJointGeometries(
  segments, sliceHeightMm, jointParams, profileParams, carbonRodDia, carbonRodDepthPct
) {
  if (!jointParams || !jointParams.enabled || sliceHeightMm <= 0) return [];

  const boundaries = computeSliceBoundaries(segments, sliceHeightMm);
  if (boundaries.length <= 2) return [];

  const holeEndIndex = carbonRodDia > 0
    ? Math.max(0, Math.floor((carbonRodDepthPct / 100) * (segments.length - 1)))
    : -1;
  const holeR = (carbonRodDia / 2) || 0;

  const joints = [];

  const frontCut = jointParams.frontCut ?? 5.0;
  const backCut = jointParams.backCut ?? 10.0;

  for (let b = 1; b < boundaries.length - 1; b++) {
    const segIdx = boundaries[b];
    const seg = segments[segIdx];
    const cutPlaneYMm = seg.r * 1000;
    const hasHoleAtCut = carbonRodDia > 0 && segIdx <= holeEndIndex;
    const rodR = hasHoleAtCut ? holeR : 0;

    const tongueTriangles = buildTongueTriangles(
      seg, jointParams.wallOffset, jointParams.extrusionDepth,
      cutPlaneYMm, rodR, profileParams, frontCut, backCut
    );

    const pocketTriangles = buildPocketTriangles(
      seg, jointParams.wallOffset, jointParams.clearance,
      jointParams.extrusionDepth, cutPlaneYMm,
      rodR, jointParams.glueChannelWidth || 0.5, jointParams.glueChannelDepth || 0.3,
      jointParams.glueChannel !== false, profileParams, frontCut, backCut
    );

    joints.push({
      boundaryIndex: segIdx,
      cutPlaneYMm,
      tongueGeo: trianglesToBufferGeometry(tongueTriangles),
      pocketGeo: trianglesToBufferGeometry(pocketTriangles),
      tongueTriangles,
      pocketTriangles,
      partNumber: b,
    });
  }

  return joints;
}

/* ────────────────────────────────────────────────
   7. Build complete, watertight BufferGeometry for each slice part
   ──────────────────────────────────────────────── */

/**
 * Builds a single, manifold, watertight Three.js BufferGeometry for a sliced piece of the blade.
 *
 * For Part 1:
 *   - Root face at y = 0: flat root cap
 *   - Outer skin from y = 0 to y = cutY
 *   - Tip face at y = cutY: shoulder ring + tongue boss extruded outward (+Y, cutY to cutY + tongueDepth)
 *
 * For Part 2:
 *   - Root face at y = cutY: shoulder ring + pocket cavity recessed inward (+Y, cutY to cutY + pocketDepth)
 *   - Outer skin from y = cutY to y = tipY
 *   - Tip face at y = tipY: flat tip cap
 */
export function buildWatertightPartGeometry(
  segments,
  startIndex,
  endIndex,
  hasTongue,
  hasPocket,
  jointParams,
  profileParams,
  carbonRodDia = 0,
  carbonRodDepthPct = 100
) {
  const numPoints = 48;
  const totalPointsPerSegment = numPoints * 2;
  const vertices = [];
  const indices = [];

  const hasHole = carbonRodDia > 0;
  const holeR = (carbonRodDia / 2) || 0;
  const holeEndIndex = hasHole
    ? Math.max(0, Math.floor((carbonRodDepthPct / 100) * (segments.length - 1)))
    : -1;

  const outerOffsets = [];
  const innerOffsets = [];

  function addV(x, y, z) {
    vertices.push(x, y, z);
    return (vertices.length / 3) - 1;
  }

  // 1. Build outer and inner rings for all segments in this slice
  for (let s = startIndex; s <= endIndex; s++) {
    const seg = segments[s];
    const yMm = seg.r * 1000;
    const twistRad = (-(seg.twistDeg + (profileParams.bladePitch || 0)) * Math.PI) / 180;
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    const profile = getAirfoilProfile(
      seg.thicknessRatio,
      numPoints,
      seg.chord,
      profileParams.leRadiusMod || 1.0,
      profileParams.teThicknessMm || 0.0,
      profileParams.teFlapDeg || 0.0,
      seg.customInterpolator,
      seg.airfoil
    );

    const isHoleLayer = hasHole && s <= holeEndIndex;

    const layerOuter = [];
    profile.forEach((pt) => {
      let x = pt.x * seg.chord * 1000;
      let z = pt.y * seg.chord * 1000;
      let rotX = x * cosT - z * sinT;
      let rotZ = x * sinT + z * cosT;
      layerOuter.push(addV(rotX, yMm, rotZ));
    });
    outerOffsets.push(layerOuter);

    if (isHoleLayer) {
      const sparCenter = getAirfoilSparCenter(seg, profileParams);
      const layerInner = [];
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const theta = (j / totalPointsPerSegment) * Math.PI * 2;
        const px = sparCenter.px + Math.cos(theta) * holeR;
        const pz = sparCenter.pz + Math.sin(theta) * holeR;
        const rotX = px * cosT - pz * sinT;
        const rotZ = px * sinT + pz * cosT;
        layerInner.push(addV(rotX, yMm, rotZ));
      }
      innerOffsets.push(layerInner);
    } else {
      innerOffsets.push(null);
    }
  }

  const numLayers = endIndex - startIndex + 1;

  // 2. Stitch outer blade loft skin
  for (let s = 0; s < numLayers - 1; s++) {
    const curO = outerOffsets[s];
    const nextO = outerOffsets[s + 1];
    for (let j = 0; j < totalPointsPerSegment; j++) {
      const nj = (j + 1) % totalPointsPerSegment;
      indices.push(curO[j], curO[nj], nextO[j]);
      indices.push(nextO[j], curO[nj], nextO[nj]);
    }
  }

  // 3. Stitch inner spar hole skin
  if (hasHole) {
    for (let s = 0; s < numLayers - 1; s++) {
      const curI = innerOffsets[s];
      const nextI = innerOffsets[s + 1];
      if (curI && nextI) {
        for (let j = 0; j < totalPointsPerSegment; j++) {
          const nj = (j + 1) % totalPointsPerSegment;
          indices.push(curI[j], nextI[j], curI[nj]);
          indices.push(nextI[j], nextI[nj], curI[nj]);
        }
      }
    }
  }

  // 4. Root end closure (at startIndex)
  const rootOuter = outerOffsets[0];
  const rootInner = innerOffsets[0];
  const rootSeg = segments[startIndex];
  const rootY = rootSeg.r * 1000;
  const rootTwistRad = (-(rootSeg.twistDeg + (profileParams.bladePitch || 0)) * Math.PI) / 180;
  const rootCosT = Math.cos(rootTwistRad);
  const rootSinT = Math.sin(rootTwistRad);

  function transformRoot(px, pz, y) {
    const rx = px * rootCosT - pz * rootSinT;
    const rz = px * rootSinT + pz * rootCosT;
    return addV(rx, y, rz);
  }

  if (hasPocket && jointParams && jointParams.enabled) {
    // ── POCKET CAVITY AT ROOT FACE ──
    // Pocket enters at rootY and recesses INWARD (+Y) into this part's body!
    const pocketDepth = jointParams.extrusionDepth || 8;
    const clearance = jointParams.clearance || 0.15;
    const wallOffset = jointParams.wallOffset || 1.2;
    const frontCut = jointParams.frontCut ?? 5.0;
    const backCut = jointParams.backCut ?? 10.0;
    const effectiveOffset = wallOffset - clearance;
    const pocketFrontCut = Math.max(0, frontCut - clearance);
    const pocketBackCut = Math.max(0, backCut - clearance);

    const profile = getAirfoilProfile(
      rootSeg.thicknessRatio,
      numPoints,
      rootSeg.chord,
      profileParams.leRadiusMod || 1.0,
      profileParams.teThicknessMm || 0.0,
      profileParams.teFlapDeg || 0.0,
      rootSeg.customInterpolator,
      rootSeg.airfoil
    );
    const chordMm = rootSeg.chord * 1000;
    const pocketProfile = offsetAirfoilProfile(profile, chordMm, effectiveOffset, pocketFrontCut, pocketBackCut);

    const pocketEntrance = pocketProfile.map(p => transformRoot(p.x, p.y, rootY));
    const pocketBottom = pocketProfile.map(p => transformRoot(p.x, p.y, rootY + pocketDepth));

    // (a) Shoulder face: normal points -Y (downwards)
    for (let j = 0; j < totalPointsPerSegment; j++) {
      const nj = (j + 1) % totalPointsPerSegment;
      indices.push(rootOuter[j], rootOuter[nj], pocketEntrance[j]);
      indices.push(rootOuter[nj], pocketEntrance[nj], pocketEntrance[j]);
    }

    // (b) Pocket cavity interior side walls: normals face inward into cavity
    for (let j = 0; j < totalPointsPerSegment; j++) {
      const nj = (j + 1) % totalPointsPerSegment;
      indices.push(pocketEntrance[j], pocketBottom[j], pocketEntrance[nj]);
      indices.push(pocketBottom[j], pocketBottom[nj], pocketEntrance[nj]);
    }

    // (c) Pocket bottom floor: at rootY + pocketDepth, normal points -Y
    if (rootInner) {
      const rootSpar = getAirfoilSparCenter(rootSeg, profileParams);
      const pocketHole = [];
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const theta = (j / totalPointsPerSegment) * Math.PI * 2;
        const px = rootSpar.px + Math.cos(theta) * holeR;
        const pz = rootSpar.pz + Math.sin(theta) * holeR;
        pocketHole.push(transformRoot(px, pz, rootY + pocketDepth));
      }
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nj = (j + 1) % totalPointsPerSegment;
        indices.push(pocketBottom[j], pocketBottom[nj], pocketHole[j]);
        indices.push(pocketBottom[nj], pocketHole[nj], pocketHole[j]);
      }
    } else {
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(pocketBottom[0], pocketBottom[j], pocketBottom[j + 1]);
      }
    }
  } else {
    // Flat root cap (normal points -Y)
    if (rootInner) {
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nj = (j + 1) % totalPointsPerSegment;
        indices.push(rootOuter[j], rootOuter[nj], rootInner[j]);
        indices.push(rootOuter[nj], rootInner[nj], rootInner[j]);
      }
    } else {
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(rootOuter[0], rootOuter[j], rootOuter[j + 1]);
      }
    }
  }

  // 5. Tip end closure (at endIndex)
  const tipOuter = outerOffsets[numLayers - 1];
  const tipInner = innerOffsets[numLayers - 1];
  const tipSeg = segments[endIndex];
  const tipY = tipSeg.r * 1000;
  const tipTwistRad = (-(tipSeg.twistDeg + (profileParams.bladePitch || 0)) * Math.PI) / 180;
  const tipCosT = Math.cos(tipTwistRad);
  const tipSinT = Math.sin(tipTwistRad);

  function transformTip(px, pz, y) {
    const rx = px * tipCosT - pz * tipSinT;
    const rz = px * tipSinT + pz * tipCosT;
    return addV(rx, y, rz);
  }

  if (hasTongue && jointParams && jointParams.enabled) {
    // ── TONGUE BOSS AT TIP FACE ──
    // Tongue extrudes OUTWARD (+Y) from tip face!
    const tongueDepth = jointParams.extrusionDepth || 8;
    const wallOffset = jointParams.wallOffset || 1.2;
    const frontCut = jointParams.frontCut ?? 5.0;
    const backCut = jointParams.backCut ?? 10.0;

    const profile = getAirfoilProfile(
      tipSeg.thicknessRatio,
      numPoints,
      tipSeg.chord,
      profileParams.leRadiusMod || 1.0,
      profileParams.teThicknessMm || 0.0,
      profileParams.teFlapDeg || 0.0,
      tipSeg.customInterpolator,
      tipSeg.airfoil
    );
    const chordMm = tipSeg.chord * 1000;
    const tongueProfile = offsetAirfoilProfile(profile, chordMm, wallOffset, frontCut, backCut);

    const tongueBase = tongueProfile.map(p => transformTip(p.x, p.y, tipY));
    const tongueTip = tongueProfile.map(p => transformTip(p.x, p.y, tipY + tongueDepth));

    // (a) Shoulder face: normal points +Y (upwards)
    for (let j = 0; j < totalPointsPerSegment; j++) {
      const nj = (j + 1) % totalPointsPerSegment;
      indices.push(tipOuter[j], tongueBase[j], tipOuter[nj]);
      indices.push(tipOuter[nj], tongueBase[j], tongueBase[nj]);
    }

    // (b) Tongue exterior side walls: normals face outward
    for (let j = 0; j < totalPointsPerSegment; j++) {
      const nj = (j + 1) % totalPointsPerSegment;
      indices.push(tongueBase[j], tongueBase[nj], tongueTip[j]);
      indices.push(tongueBase[nj], tongueTip[nj], tongueTip[j]);
    }

    // (c) Tongue tip cap: at tipY + tongueDepth, normal points +Y
    if (tipInner) {
      const tipSpar = getAirfoilSparCenter(tipSeg, profileParams);
      const tongueHole = [];
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const theta = (j / totalPointsPerSegment) * Math.PI * 2;
        const px = tipSpar.px + Math.cos(theta) * holeR;
        const pz = tipSpar.pz + Math.sin(theta) * holeR;
        tongueHole.push(transformTip(px, pz, tipY + tongueDepth));
      }
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nj = (j + 1) % totalPointsPerSegment;
        indices.push(tongueTip[j], tongueHole[j], tongueTip[nj]);
        indices.push(tongueTip[nj], tongueHole[j], tongueHole[nj]);
      }
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nj = (j + 1) % totalPointsPerSegment;
        indices.push(tipInner[j], tongueHole[j], tipInner[nj]);
        indices.push(tipInner[nj], tongueHole[j], tongueHole[nj]);
      }
    } else {
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(tongueTip[0], tongueTip[j + 1], tongueTip[j]);
      }
    }
  } else {
    // Flat tip cap (normal points +Y)
    if (tipInner) {
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nj = (j + 1) % totalPointsPerSegment;
        indices.push(tipOuter[j], tipInner[j], tipOuter[nj]);
        indices.push(tipOuter[nj], tipInner[j], tipInner[nj]);
      }
    } else {
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(tipOuter[0], tipOuter[j + 1], tipOuter[j]);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(vertices), 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
