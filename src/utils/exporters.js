import { getAirfoilProfile } from './airfoilProfile';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import * as THREE from 'three';
import JSZip from 'jszip';
import { buildWatertightPartGeometry, computeSliceBoundaries, getAirfoilSparCenter } from './jointBuilder';

/* ── CSV Export ── */
export function exportCSV(bemResults) {
  let csvContent =
    'r(m),r/R,Chord(m),Twist(deg),Thickness(%),Airfoil,Alpha(deg),Cl,Cd,Thrust(N/m),Torque(Nm/m)\n';

  const R = bemResults.segments[bemResults.segments.length - 1].r;

  bemResults.segments.forEach((seg) => {
    const row = [
      seg.r.toFixed(4),
      (seg.r / R).toFixed(4),
      seg.chord.toFixed(4),
      seg.twistDeg.toFixed(2),
      (seg.thicknessRatio * 100).toFixed(1),
      seg.airfoil || 'Custom',
      seg.alphaDeg.toFixed(2),
      seg.cl.toFixed(4),
      seg.cd.toFixed(4),
      seg.dT.toFixed(2),
      seg.dQ.toFixed(2),
    ].join(',');
    csvContent += row + '\n';
  });

  downloadBlob(csvContent, 'blade_aerodynamics.csv', 'text/csv;charset=utf-8;');
}

/* ── Fusion 360 Spline CSV Export ── */
export async function exportFusionCSV(segments, leRadiusMod = 1.0, teThicknessMm = 0.0, teFlapDeg = 0.0) {
  const zip = new JSZip();
  const numPoints = 50; // good resolution for splines

  segments.forEach((seg, i) => {
    let csvContent = '';
    const profile = getAirfoilProfile(
      seg.thicknessRatio,
      numPoints,
      seg.chord,
      leRadiusMod,
      teThicknessMm,
      teFlapDeg,
      seg.customInterpolator,
      seg.airfoil
    );
    const twistRad = (seg.twistDeg * Math.PI) / 180;
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    // To prevent Fusion 360 from creating a self-intersecting "bowtie" at the sharp leading edge 
    // when forcing the spline closed, we shift the points so the spline starts and ends at the Trailing Edge.
    const fusionProfile = [];
    
    // 1. Lower surface (from near-TE down to near-LE)
    for (let j = numPoints + 1; j < profile.length; j++) {
      fusionProfile.push(profile[j]);
    }
    // 2. Leading Edge
    fusionProfile.push(profile[0]);
    // 3. Upper surface (from near-LE up to TE)
    for (let j = 1; j <= numPoints; j++) {
      fusionProfile.push(profile[j]);
    }

    // Fusion expects X, Y, Z separated by commas, no headers.
    fusionProfile.forEach((pt) => {
      // Convert to mm
      let x = pt.x * seg.chord * 1000;
      let z = pt.y * seg.chord * 1000;
      
      // Apply twist
      let rotX = x * cosT - z * sinT;
      let rotZ = x * sinT + z * cosT;
      
      // Write line (X, Y, Z) where Y is the radius (spanwise direction)
      csvContent += `${rotX.toFixed(5)},${(seg.r * 1000).toFixed(5)},${rotZ.toFixed(5)}\n`;
    });

    zip.file(`section_${String(i + 1).padStart(2, '0')}_r${(seg.r * 1000).toFixed(0)}.csv`, csvContent);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fusion360_splines.zip';
  a.click();
}

/* ── DAT Airfoil Export ── */
export async function exportAirfoilDAT(segments, leRadiusMod = 1.0, teThicknessMm = 0.0, teFlapDeg = 0.0) {
  const zip = new JSZip();
  const numPoints = 100; // High resolution for 2D export

  // Export Root, Mid, Tip cross sections
  const sectionsToExport = [
    { name: 'root', seg: segments[0] },
    { name: 'mid', seg: segments[Math.floor(segments.length / 2)] },
    { name: 'tip', seg: segments[segments.length - 1] }
  ];

  sectionsToExport.forEach((section) => {
    // Generate normalized profile (chord = 1)
    const profile = getAirfoilProfile(
      section.seg.thicknessRatio,
      numPoints,
      1,
      leRadiusMod,
      teThicknessMm,
      teFlapDeg,
      section.seg.customInterpolator,
      section.seg.airfoil
    );
    
    // Selig format expects points from TE over upper surface to LE, then lower surface back to TE.
    // Our getAirfoilProfile returns upper surface (LE -> TE) then lower surface (TE -> LE).
    
    const upper = profile.slice(0, numPoints + 1);
    const lower = profile.slice(numPoints + 1);
    
    // Reverse upper to go from TE -> LE
    const seligPoints = [...upper.reverse(), ...lower.reverse()];
    
    let datStr = `${section.name}_airfoil\n`;
    seligPoints.forEach(pt => {
      datStr += `  ${pt.x.toFixed(6)}  ${pt.y.toFixed(6)}\n`;
    });
    
    zip.file(`airfoil_${section.name}.dat`, datStr);
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'blade_airfoils.zip';
  a.click();
}

/* ── STL Export (Watertight Binary STL for all Slicers) ── */
export async function exportSTL(
  segments,
  carbonRodDia = 0,
  carbonRodDepthPct = 100,
  leRadiusMod = 1.0,
  teThicknessMm = 0.0,
  teFlapDeg = 0.0,
  sliceHeightMm = 0,
  jointParams = null
) {
  const profileParams = { leRadiusMod, teThicknessMm, teFlapDeg };
  const sliceBoundaries = computeSliceBoundaries(segments, sliceHeightMm);
  const exporter = new STLExporter();
  const zip = new JSZip();

  // If single piece (no slicing):
  if (sliceBoundaries.length <= 2) {
    const partGeo = buildWatertightPartGeometry(
      segments,
      0,
      segments.length - 1,
      false,
      false,
      null,
      profileParams,
      carbonRodDia,
      carbonRodDepthPct
    );
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(partGeo));
    const stlBinary = exporter.parse(scene, { binary: true });
    downloadBlob(stlBinary, 'blade.stl', 'application/octet-stream');
    return;
  }

  // Multi-piece slicing (with or without interlocking joints):
  const numParts = sliceBoundaries.length - 1;
  const isJointsEnabled = jointParams && jointParams.enabled;

  for (let p = 0; p < numParts; p++) {
    const startIndex = sliceBoundaries[p];
    const endIndex = sliceBoundaries[p + 1];
    if (startIndex >= endIndex) continue;

    const hasTongue = isJointsEnabled && (p < numParts - 1);
    const hasPocket = isJointsEnabled && (p > 0);

    const partGeo = buildWatertightPartGeometry(
      segments,
      startIndex,
      endIndex,
      hasTongue,
      hasPocket,
      jointParams,
      profileParams,
      carbonRodDia,
      carbonRodDepthPct
    );

    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(partGeo));
    const partStlBinary = exporter.parse(scene, { binary: true });
    const buffer = partStlBinary instanceof DataView ? partStlBinary.buffer : partStlBinary;
    zip.file(`blade_part_${p + 1}.stl`, buffer);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = isJointsEnabled ? 'blade_sliced_joints_stls.zip' : 'blade_sliced_stls.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── OBJ Export (3D Mesh) ── */
export async function exportOBJ(
  segments,
  carbonRodDia = 0,
  carbonRodDepthPct = 100,
  leRadiusMod = 1.0,
  teThicknessMm = 0.0,
  teFlapDeg = 0.0,
  sliceHeightMm = 0
) {
  const profileParams = { leRadiusMod, teThicknessMm, teFlapDeg };
  const sliceBoundaries = computeSliceBoundaries(segments, sliceHeightMm);
  const zip = new JSZip();

  function geometryToOBJ(geo, partName) {
    let obj = `# AeroBlade Pro - ${partName}\n`;
    const pos = geo.attributes.position.array;
    const idx = geo.index ? geo.index.array : null;

    for (let i = 0; i < pos.length; i += 3) {
      obj += `v ${pos[i].toFixed(4)} ${pos[i + 1].toFixed(4)} ${pos[i + 2].toFixed(4)}\n`;
    }
    obj += `g ${partName}\ns 1\n`;

    if (idx) {
      for (let i = 0; i < idx.length; i += 3) {
        obj += `f ${idx[i] + 1} ${idx[i + 1] + 1} ${idx[i + 2] + 1}\n`;
      }
    } else {
      for (let i = 0; i < pos.length / 3; i += 3) {
        obj += `f ${i + 1} ${i + 2} ${i + 3}\n`;
      }
    }
    return obj;
  }

  if (sliceBoundaries.length <= 2) {
    const geo = buildWatertightPartGeometry(
      segments,
      0,
      segments.length - 1,
      false,
      false,
      null,
      profileParams,
      carbonRodDia,
      carbonRodDepthPct
    );
    const objStr = geometryToOBJ(geo, 'blade');
    downloadBlob(objStr, 'blade.obj', 'text/plain;charset=utf-8;');
    return;
  }

  const numParts = sliceBoundaries.length - 1;
  for (let p = 0; p < numParts; p++) {
    const startIndex = sliceBoundaries[p];
    const endIndex = sliceBoundaries[p + 1];
    if (startIndex >= endIndex) continue;

    const geo = buildWatertightPartGeometry(
      segments,
      startIndex,
      endIndex,
      false,
      false,
      null,
      profileParams,
      carbonRodDia,
      carbonRodDepthPct
    );
    const objStr = geometryToOBJ(geo, `blade_part_${p + 1}`);
    zip.file(`blade_part_${p + 1}.obj`, objStr);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'blade_sliced_objs.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ── ASC Export (Point Cloud) ── */
export async function exportASC(segments, carbonRodDia = 0, carbonRodDepthPct = 100, leRadiusMod = 1.0, teThicknessMm = 0.0, teFlapDeg = 0.0, sliceHeightMm = 0) {
  const numPoints = 30;
  const totalPointsPerSegment = numPoints * 2;
  const vertices = [];
  
  const hasHole = carbonRodDia > 0;
  const holeR = (carbonRodDia / 1000) / 2;
  const holeEndIndex = hasHole ? Math.max(0, Math.floor((carbonRodDepthPct / 100) * (segments.length - 1))) : -1;
  
  const segmentOffsets = [];
  let currentVertexCount = 0;

  segments.forEach((seg, i) => {
    segmentOffsets.push(currentVertexCount);
    const isHoleLayer = hasHole && i <= holeEndIndex;

    const profile = getAirfoilProfile(
      seg.thicknessRatio,
      numPoints,
      seg.chord,
      leRadiusMod,
      teThicknessMm,
      teFlapDeg,
      seg.customInterpolator,
      seg.airfoil
    );
    const twistRad = (seg.twistDeg * Math.PI) / 180;
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    // Outer skin
    profile.forEach((pt) => {
      let x = pt.x * seg.chord * 1000;
      let z = pt.y * seg.chord * 1000;
      let rotX = x * cosT - z * sinT;
      let rotZ = x * sinT + z * cosT;
      vertices.push({ x: rotX, y: seg.r * 1000, z: rotZ });
    });
    currentVertexCount += totalPointsPerSegment;

    // Inner skin (Spar hole)
    if (isHoleLayer) {
      const sparCenter = getAirfoilSparCenter(seg, { carbonRodPosPct: 30 });
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const theta = (j / totalPointsPerSegment) * Math.PI * 2;
        const px = sparCenter.px + Math.cos(theta) * holeR * 1000;
        const pz = sparCenter.pz + Math.sin(theta) * holeR * 1000;
        const rotX = px * cosT - pz * sinT;
        const rotZ = px * sinT + pz * cosT;
        vertices.push({ x: rotX, y: seg.r * 1000, z: rotZ });
      }
      currentVertexCount += totalPointsPerSegment;
    }
  });

  const R_mm = segments[segments.length - 1].r * 1000;
  const sliceBoundaries = [0];
  
  if (sliceHeightMm > 0 && sliceHeightMm < R_mm) {
    let currentLimit = sliceHeightMm;
    for (let i = 0; i < segments.length; i++) {
      if (segments[i].r * 1000 >= currentLimit) {
        sliceBoundaries.push(i);
        currentLimit += sliceHeightMm;
      }
    }
  }
  sliceBoundaries.push(segments.length - 1);

  const zip = new JSZip();

  function buildSliceASC(startIndex, endIndex) {
    let asc = '';
    // Determine the vertex range for this slice
    const startVertex = segmentOffsets[startIndex];
    // The end vertex is the offset of (endIndex + 1), or total vertices if it's the last segment
    const endVertex = (endIndex + 1 < segmentOffsets.length) ? segmentOffsets[endIndex + 1] : vertices.length;
    
    for (let i = startVertex; i < endVertex; i++) {
      const v = vertices[i];
      asc += `${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}\n`;
    }
    return asc;
  }

  for (let p = 0; p < sliceBoundaries.length - 1; p++) {
    const startIndex = sliceBoundaries[p];
    const endIndex = sliceBoundaries[p + 1];
    if (startIndex >= endIndex) continue;

    const ascStr = buildSliceASC(startIndex, endIndex);
    
    if (sliceBoundaries.length > 2) {
      zip.file(`blade_part_${p + 1}.asc`, ascStr);
    } else {
      downloadBlob(ascStr, 'blade.asc', 'text/plain');
      return;
    }
  }

  if (sliceBoundaries.length > 2) {
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blade_sliced_asc.zip';
    a.click();
  }
}

/* ── JSON Export (Save Design) ── */
export function exportJSON(bladeParams, windSpeed, tsr) {
  const data = {
    version: '1.0',
    name: 'AeroBlade Pro Design',
    timestamp: new Date().toISOString(),
    bladeParams,
    windSpeed,
    tsr,
  };

  downloadBlob(
    JSON.stringify(data, null, 2),
    `blade_design_${Date.now()}.json`,
    'application/json'
  );
}

/* ── Shared download helper ── */
function downloadBlob(content, filename, mimeType) {
  const data = content instanceof DataView ? content.buffer : content;
  const blob = new Blob([data], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ── Gear STL Export ── */
export function exportGearSTL(geometries) {
  const scene = new THREE.Scene();
  geometries.forEach((g) => {
    const mesh = new THREE.Mesh(g.geo);
    scene.add(mesh);
  });

  const exporter = new STLExporter();
  const stlString = exporter.parse(scene, { binary: true });
  downloadBlob(stlString, 'gear_assembly.stl', 'application/octet-stream');
}

/* ── Multi-Part Watertight ZIP Gear Export for Slicers ── */
export async function exportGearZipSTL(stagesData) {
  const zip = new JSZip();
  const exporter = new STLExporter();

  // 1. Export each stage gear and pinion individually
  stagesData.forEach((stage, idx) => {
    const stageNum = idx + 1;
    const stageGeos = stage.geometries || [];

    stageGeos.forEach((g) => {
      const scene = new THREE.Scene();
      const mesh = new THREE.Mesh(g.geo.clone());
      scene.add(mesh);

      const isPinion = g.isPinion;
      const teeth = isPinion ? stage.params.pinionTeeth : stage.params.numTeeth;
      const mod = isPinion ? stage.params.pinionModule : stage.params.module;
      const partName = isPinion
        ? `Stage_${stageNum}_Pinion_${teeth}T_m${mod.toFixed(1)}mm.stl`
        : `Stage_${stageNum}_Gear_${teeth}T_m${mod.toFixed(1)}mm.stl`;

      const stlData = exporter.parse(scene, { binary: true });
      zip.file(partName, stlData);
    });
  });

  // 2. Export combined assembled drivetrain
  const fullScene = new THREE.Scene();
  stagesData.forEach((stage) => {
    const stageGeos = stage.geometries || [];
    stageGeos.forEach((g) => {
      const cloned = g.geo.clone();
      cloned.rotateZ(stage.rotationOffset);
      cloned.translate(stage.position[0], stage.position[1], stage.position[2]);
      cloned.rotateX(Math.PI / 2);
      fullScene.add(new THREE.Mesh(cloned));
    });
  });

  const fullStl = exporter.parse(fullScene, { binary: true });
  zip.file('Complete_Drivetrain_Assembly.stl', fullStl);

  // Generate and download ZIP
  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = `drivetrain_3d_print_pack_${Date.now()}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

