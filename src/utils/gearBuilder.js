import * as THREE from 'three';

/**
 * Calculates a point on the involute curve of a circle.
 * @param {number} rBase Base radius
 * @param {number} t Parameter (angle in radians)
 */
function getInvolutePoint(rBase, t) {
  return new THREE.Vector2(
    rBase * (Math.cos(t) + t * Math.sin(t)),
    rBase * (Math.sin(t) - t * Math.cos(t))
  );
}

/**
 * Applies a helical or herringbone twist to extruded geometry vertices.
 */
function applyTwist(geometry, gearType, helixAngleDeg, thickness) {
  if (!gearType || gearType === 'spur' || helixAngleDeg === 0) return;

  const positions = geometry.attributes.position;
  // Convert angle to a factor of radians per mm of Z depth
  const helixFactor = Math.tan(THREE.MathUtils.degToRad(helixAngleDeg)) / (thickness / 2);
  
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    let twistAngle = 0;
    if (gearType === 'helical') {
      twistAngle = z * helixFactor;
    } else if (gearType === 'herringbone') {
      // Mirrored twist from the center (Z=0)
      twistAngle = Math.abs(z) * helixFactor;
    }

    const cos = Math.cos(twistAngle);
    const sin = Math.sin(twistAngle);

    positions.setX(i, x * cos - y * sin);
    positions.setY(i, x * sin + y * cos);
  }
  
  geometry.computeVertexNormals();
}

/**
 * Generates a full 3D gear geometry including spokes, bore, keyway, and compound pinions.
 */
export function buildGearGeometry(params) {
  // Extract parameters
  const {
    numTeeth, module, pressureAngle, thickness,
    hasSpokes, numSpokes, spokeWidth,
    hubDiameter, boreDiameter, boreType, keywayWidth, keywayDepth, dShaftFlat,
    hasPinion, pinionTeeth, pinionModule, pinionThickness, pinionPressureAngle, gearType, helixAngle,
    hasBearingStand, bearingStandDiameter, bearingStandThickness, bearingStandBore, spokeChamfer
  } = params;

  // 1. Generate Main Gear Profile
  const mainShape = generateInvoluteGearShape(numTeeth, module, pressureAngle);

  const rPitch = (module * numTeeth) / 2;
  const rRoot = rPitch - 1.25 * module;
  const innerRimRadius = rRoot - 5; // 5mm thick outer ring
  const hubR = hubDiameter / 2;
  const isCompositeSpokes = hasSpokes && numSpokes > 0 && (innerRimRadius > hubR + 5);

  // 2. Add Spoke Cutouts to Main Gear
  if (isCompositeSpokes) {
    const ringHole = new THREE.Path();
    ringHole.absarc(0, 0, innerRimRadius, 0, Math.PI * 2, false);
    mainShape.holes.push(ringHole);
  } else {
    // 3. Add Bore and Keyway directly to Main Gear if no composite spokes
    if (boreDiameter > 0 && !hasPinion) { 
      const boreHole = generateBoreShape(boreDiameter, boreType, keywayWidth, keywayDepth, dShaftFlat);
      mainShape.holes.push(boreHole);
    } else if (boreDiameter > 0 && hasPinion) {
      const boreHole = generateBoreShape(boreDiameter, boreType, keywayWidth, keywayDepth, dShaftFlat);
      mainShape.holes.push(boreHole); 
    }
  }

  const steps = (params.gearType === 'helical' || params.gearType === 'herringbone') ? Math.max(12, Math.ceil(thickness)) : 1;

  // 4. Extrude Main Gear
  const mainGeo = new THREE.ExtrudeGeometry(mainShape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 12,
    steps: steps
  });
  mainGeo.translate(0, 0, -thickness / 2); // Center along Z
  
  if (params.gearType && params.gearType !== 'spur') {
    applyTwist(mainGeo, params.gearType, params.helixAngle || 20, thickness);
  }

  const geometries = [{ geo: mainGeo, color: '#94a3b8' }];

  // 5. Build Hub & 3D Chamfered Spokes
  if (isCompositeSpokes || (hubDiameter > 0 && !hasPinion)) {
    const actualHubR = hubR > 0 ? hubR : innerRimRadius * 0.3; 
    const hubShape = new THREE.Shape();
    hubShape.absarc(0, 0, actualHubR, 0, Math.PI * 2, false);
    if (boreDiameter > 0) {
      const boreHole = generateBoreShape(boreDiameter, boreType, keywayWidth, keywayDepth, dShaftFlat);
      hubShape.holes.push(boreHole);
    }
    const hubDepth = (!hasPinion && hubDiameter > 0 && !isCompositeSpokes) ? thickness + 10 : thickness;
    const hubGeo = new THREE.ExtrudeGeometry(hubShape, {
      depth: hubDepth,
      bevelEnabled: false,
      curveSegments: 24,
      steps: 1
    });
    hubGeo.translate(0, 0, -hubDepth / 2);
    geometries.push({ geo: hubGeo, color: '#cbd5e1' });

    // Build Individual 3D Spokes with Aerodynamic Chamfer
    if (isCompositeSpokes) {
      const sliceAngle = (Math.PI * 2) / numSpokes;
      for (let i = 0; i < numSpokes; i++) {
        const centerAngle = i * sliceAngle;
        
        const spokeLength = innerRimRadius - actualHubR + 4; // Add a bit of overlap
        const w2 = spokeWidth / 2;
        const t2 = thickness / 2;
        const c = Math.min(params.spokeChamfer || 0, w2 - 0.1, t2 - 0.1);
        
        const csShape = new THREE.Shape();
        if (c > 0.01) {
          csShape.moveTo(w2 - c, t2);
          csShape.lineTo(w2, 0);
          csShape.lineTo(w2 - c, -t2);
          csShape.lineTo(-w2 + c, -t2);
          csShape.lineTo(-w2, 0);
          csShape.lineTo(-w2 + c, t2);
        } else {
          csShape.moveTo(w2, t2);
          csShape.lineTo(w2, -t2);
          csShape.lineTo(-w2, -t2);
          csShape.lineTo(-w2, t2);
        }
        csShape.closePath();
        
        const spokeGeo = new THREE.ExtrudeGeometry(csShape, {
          depth: spokeLength,
          bevelEnabled: false,
          curveSegments: 1,
          steps: 1
        });
        
        // Orient to align Extrusion(Z) to Gear(X), Shape(X) to Gear(Y), Shape(Y) to Gear(Z)
        spokeGeo.rotateZ(Math.PI / 2);
        spokeGeo.rotateY(Math.PI / 2);
        
        // Translate radially outward
        spokeGeo.translate(actualHubR - 2, 0, 0);
        
        // Apply Spoke Pitch
        if (params.spokePitch) {
          spokeGeo.rotateX(THREE.MathUtils.degToRad(params.spokePitch));
        }
        
        // Position around the gear
        spokeGeo.rotateZ(centerAngle);
        
        if (params.gearType && params.gearType !== 'spur') {
          applyTwist(spokeGeo, params.gearType, params.helixAngle || 20, thickness);
        }
        
        geometries.push({ geo: spokeGeo, color: '#e2e8f0' });
      }
    }
  }

  // 6. Build Pinion (Compound Gear)
  if (hasPinion) {
    const pinionShape = generateInvoluteGearShape(pinionTeeth, pinionModule, pinionPressureAngle !== undefined ? pinionPressureAngle : pressureAngle);
    if (boreDiameter > 0) {
      const boreHole = generateBoreShape(boreDiameter, boreType, keywayWidth, keywayDepth, dShaftFlat);
      pinionShape.holes.push(boreHole);
    }
    
    const pSteps = (params.gearType === 'helical' || params.gearType === 'herringbone') ? Math.max(8, Math.ceil(pinionThickness)) : 1;
    const pinionGeo = new THREE.ExtrudeGeometry(pinionShape, {
      depth: pinionThickness,
      bevelEnabled: false,
      curveSegments: 12,
      steps: pSteps
    });
    
    // 1. Extrude creates geo from Z=0 to Z=pinionThickness. Shift to Z=0 center for accurate twisting.
    pinionGeo.translate(0, 0, -pinionThickness / 2);
    
    // 2. Apply twist (must be centered on Z=0)
    if (params.gearType && params.gearType !== 'spur') {
      applyTwist(pinionGeo, params.gearType, -(params.helixAngle || 20), pinionThickness); 
    }
    
    // 3. Shift it to sit flush on the positive face of the main gear.
    // The main gear spans from -thickness/2 to thickness/2.
    pinionGeo.translate(0, 0, thickness / 2 + pinionThickness / 2);
    
    geometries.push({ geo: pinionGeo, color: '#64748b' });

  }

  // 7. Build Bearing Stand
  if (hasBearingStand) {
    const standShape = new THREE.Shape();
    standShape.absarc(0, 0, bearingStandDiameter / 2, 0, Math.PI * 2, false);
    if (bearingStandBore > 0) {
      // Just a simple round bore hole for the bearing stand
      const boreHole = new THREE.Path();
      boreHole.absarc(0, 0, bearingStandBore / 2, 0, Math.PI * 2, false);
      standShape.holes.push(boreHole);
    }
    const standGeo = new THREE.ExtrudeGeometry(standShape, {
      depth: bearingStandThickness,
      bevelEnabled: false,
      curveSegments: 32,
      steps: 1
    });

    // Position it on top of the stage
    // If there's a pinion, it sits on the pinion. Otherwise it sits on the main gear.
    let currentTopZ = thickness / 2;
    if (hasPinion) {
      currentTopZ += pinionThickness;
    }
    standGeo.translate(0, 0, currentTopZ);
    geometries.push({ geo: standGeo, color: '#e2e8f0' });
  }

  return geometries;
}

function generateInvoluteGearShape(numTeeth, module, pressureAngleDeg) {
  const shape = new THREE.Shape();
  
  const pa = (pressureAngleDeg * Math.PI) / 180;
  const rPitch = (module * numTeeth) / 2;
  const rBase = rPitch * Math.cos(pa);
  const rAddendum = rPitch + module;
  const rDedendum = Math.max(0.1, rPitch - 1.25 * module);

  const tMax = Math.sqrt((rAddendum * rAddendum) / (rBase * rBase) - 1);
  const pitchPointT = Math.sqrt((rPitch * rPitch) / (rBase * rBase) - 1);
  const pitchPointAngle = pitchPointT - Math.atan(pitchPointT);
  
  // Angle thickness of tooth at pitch circle
  const toothThicknessAngle = Math.PI / numTeeth;

  for (let i = 0; i < numTeeth; i++) {
    const angleOffset = i * (Math.PI * 2 / numTeeth);
    
    // Draw one tooth
    const involutePoints = [];
    const steps = 10;
    
    // 1. Ascending flank (Involute curve from Base to Addendum)
    for (let j = 0; j <= steps; j++) {
      const t = (j / steps) * tMax;
      const r = Math.sqrt(rBase * rBase * (1 + t * t));
      if (r < rDedendum) continue; // Skip points below root
      
      const pt = getInvolutePoint(rBase, t);
      // Rotate back to start at angle 0 for pitch point, then shift to angleOffset
      const rotation = angleOffset - pitchPointAngle - toothThicknessAngle / 2;
      const x = pt.x * Math.cos(rotation) - pt.y * Math.sin(rotation);
      const y = pt.x * Math.sin(rotation) + pt.y * Math.cos(rotation);
      involutePoints.push(new THREE.Vector2(x, y));
    }
    
    // 2. Descending flank (Mirrored involute)
    const descPoints = [];
    for (let j = steps; j >= 0; j--) {
      const t = (j / steps) * tMax;
      const r = Math.sqrt(rBase * rBase * (1 + t * t));
      if (r < rDedendum) continue;
      
      const pt = getInvolutePoint(rBase, t);
      // Mirror over X axis, then rotate
      const rotation = angleOffset + pitchPointAngle + toothThicknessAngle / 2;
      const x = pt.x * Math.cos(rotation) - (-pt.y) * Math.sin(rotation);
      const y = pt.x * Math.sin(rotation) + (-pt.y) * Math.cos(rotation);
      descPoints.push(new THREE.Vector2(x, y));
    }

    if (i === 0) {
      shape.moveTo(involutePoints[0].x, involutePoints[0].y);
    }
    
    involutePoints.forEach(p => shape.lineTo(p.x, p.y));
    descPoints.forEach(p => shape.lineTo(p.x, p.y));
    
    // 3. Root circle to next tooth
    const nextAngleOffset = (i + 1) * (Math.PI * 2 / numTeeth);
    const rootStartAngle = angleOffset + pitchPointAngle + toothThicknessAngle / 2 + tMax; // Approx
    // Just draw a line or arc to the start of the next tooth
    // An arc is better
    const nextStartRotation = nextAngleOffset - pitchPointAngle - toothThicknessAngle / 2;
    shape.absarc(0, 0, rDedendum, angleOffset + toothThicknessAngle, nextStartRotation, false);
  }
  
  return shape;
}

function generateSpokeCutouts(outerR, innerR, numSpokes, spokeWidth) {
  const holes = [];
  const spokeHalfAngle = Math.asin((spokeWidth / 2) / innerR);
  const sliceAngle = (Math.PI * 2) / numSpokes;

  for (let i = 0; i < numSpokes; i++) {
    const centerAngle = i * sliceAngle;
    const startAngle = centerAngle + spokeHalfAngle + 0.1; // Add small padding
    const endAngle = centerAngle + sliceAngle - spokeHalfAngle - 0.1;
    
    if (endAngle > startAngle) {
      const hole = new THREE.Path();
      // Draw wedge shape
      hole.absarc(0, 0, outerR, startAngle, endAngle, false);
      hole.absarc(0, 0, innerR, endAngle, startAngle, true);
      hole.closePath();
      holes.push(hole);
    }
  }
  return holes;
}

function generateBoreShape(boreDiameter, boreType, keywayWidth, keywayDepth, dShaftFlatDepth) {
  const hole = new THREE.Path();
  const r = boreDiameter / 2;
  
  if (boreType === 'keyway') {
    // Bore with a keyway slot at the top (Y axis)
    const kwHalf = keywayWidth / 2;
    const kwAngle = Math.asin(Math.min(1, kwHalf / r));
    
    // Draw arc from right side, around bottom, to left side of keyway
    hole.absarc(0, 0, r, Math.PI/2 + kwAngle, Math.PI/2 - kwAngle, false);
    // Draw keyway box up
    hole.lineTo(kwHalf, r + keywayDepth);
    hole.lineTo(-kwHalf, r + keywayDepth);
    hole.lineTo(-kwHalf, r * Math.cos(kwAngle)); // back to circle
  } else if (boreType === 'd-shaft') {
    const dDist = r - (dShaftFlatDepth || 1.0);
    if (dDist >= r || dDist <= -r) {
      hole.absarc(0, 0, r, 0, Math.PI * 2, false); // invalid flat depth
    } else {
      const dAngle = Math.acos(dDist / r);
      // Arc from right side of flat around bottom to left side
      hole.absarc(0, 0, r, Math.PI/2 + dAngle, Math.PI/2 - dAngle, false);
      // Close the flat straight across
      hole.closePath();
    }
  } else {
    // 'round' or 'none'
    hole.absarc(0, 0, r, 0, Math.PI * 2, false);
  }
  return hole;
}
