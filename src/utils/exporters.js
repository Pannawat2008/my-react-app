import { getAirfoilProfile } from './airfoilProfile';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import * as THREE from 'three';
import JSZip from 'jszip';
import { buildWatertightPartGeometry, computeSliceBoundaries, getAirfoilSparCenter } from './jointBuilder';
import { createPDFDocument } from './pdfReport';

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
    const twistRad = (-(seg.twistDeg || 0) * Math.PI) / 180;
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
    const twistRad = (-(seg.twistDeg || 0) * Math.PI) / 180;
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

/* ── Export All: Complete Blade Engineering & Manufacturing Package ── */
export async function exportCompleteBladePackage({
  bladeParams,
  windSpeed,
  tsr,
  bemResults,
  powerCurve,
  segments,
  sliceEnabled = false,
  maxZHeight = 200,
  jointParams = null,
}) {
  const zip = new JSZip();
  const safeParams = bladeParams || {};
  const profileParams = {
    leRadiusMod: safeParams.leRadiusMod || 1.0,
    teThicknessMm: safeParams.teThicknessMm || 0.0,
    teFlapDeg: safeParams.teFlapDeg || 0.0,
    carbonRodPosPct: safeParams.carbonRodPosPct || 30,
  };
  const carbonRodDia = safeParams.carbonRodDia || 0;
  const carbonRodDepthPct = safeParams.carbonRodDepthPct ?? 100;
  const numSegments = segments?.length || 20;
  const R_m = (safeParams.radiusMm || 500) / 1000;
  const omega = (tsr * windSpeed) / Math.max(0.01, R_m);
  const rpm = (omega * 60) / (2 * Math.PI);
  const tipSpeed = omega * R_m;
  const sweptArea = Math.PI * Math.pow(R_m, 2);

  // 1. PDF Engineering Report
  try {
    const pdfDoc = createPDFDocument(bladeParams, windSpeed, tsr, bemResults, powerCurve);
    const pdfArrayBuffer = pdfDoc.output('arraybuffer');
    zip.file('01_Engineering_Report_AeroBlade.pdf', pdfArrayBuffer);
  } catch (err) {
    console.error('Failed to bundle PDF report into package:', err);
  }

  // 2. BEM Aerodynamics Spanwise Matrix CSV
  let bemCsv = 'Station,Radius_m,Normalized_r_R,Chord_m,Twist_deg,Thickness_pct,Airfoil_Name,Alpha_deg,Cl,Cd,Lift_to_Drag_Ratio,Thrust_N_per_m,Torque_Nm_per_m,Flow_State\n';
  (bemResults?.segments || segments || []).forEach((seg, i) => {
    const r_m = seg.r || ((i + 0.5) / numSegments) * R_m;
    const cl = seg.cl ?? 0;
    const cd = seg.cd ?? 0.01;
    const l_over_d = cd > 0 ? (cl / cd).toFixed(2) : '0';
    const flowState = seg.alphaDeg > 14 ? 'Deep Stall' : seg.alphaDeg > 11.5 ? 'Stall Inception' : 'Attached Laminar';
    bemCsv += [
      i + 1,
      r_m.toFixed(4),
      (r_m / R_m).toFixed(4),
      (seg.chord || 0.05).toFixed(4),
      (seg.twistDeg || 0).toFixed(2),
      ((seg.thicknessRatio || 0.12) * 100).toFixed(1),
      seg.airfoil || 'SG6043',
      (seg.alphaDeg || 0).toFixed(2),
      cl.toFixed(4),
      cd.toFixed(4),
      l_over_d,
      (seg.dT || 0).toFixed(2),
      (seg.dQ || 0).toFixed(2),
      flowState,
    ].join(',') + '\n';
  });
  zip.file('02_BEM_Aerodynamics_Matrix.csv', bemCsv);

  // 3. Power Curve & AEP Data CSV
  let powerCsv = 'WindSpeed_ms,Rotor_RPM,Tip_Speed_ms,Mechanical_Power_kW,Electrical_Power_kW,Power_Coefficient_Cp,Thrust_Force_kN\n';
  (powerCurve || []).forEach((pt) => {
    const pMech = pt.power || 0;
    const pElec = pMech * 0.90;
    const ptOmega = (tsr * pt.windSpeed) / Math.max(0.01, R_m);
    const ptRpm = (ptOmega * 60) / (2 * Math.PI);
    const ptTipSpeed = ptOmega * R_m;
    const thrust_kN = ((pt.thrust || 0) / 1000);
    powerCsv += [
      pt.windSpeed.toFixed(1),
      ptRpm.toFixed(1),
      ptTipSpeed.toFixed(1),
      pMech.toFixed(3),
      pElec.toFixed(3),
      (pt.cp || 0).toFixed(4),
      thrust_kN.toFixed(3),
    ].join(',') + '\n';
  });
  zip.file('03_Power_Curve_and_AEP.csv', powerCsv);

  // 4. CAD Splines for Fusion 360 & SolidWorks (Folder)
  const fusionFolder = zip.folder('04_CAD_Splines_Fusion360');
  const numSplinePoints = 50;
  segments.forEach((seg, i) => {
    let csvContent = '';
    const profile = getAirfoilProfile(
      seg.thicknessRatio,
      numSplinePoints,
      seg.chord,
      profileParams.leRadiusMod,
      profileParams.teThicknessMm,
      profileParams.teFlapDeg,
      seg.customInterpolator,
      seg.airfoil
    );
    const twistRad = (seg.twistDeg * Math.PI) / 180;
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    const fusionProfile = [];
    for (let j = numSplinePoints + 1; j < profile.length; j++) {
      fusionProfile.push(profile[j]);
    }
    fusionProfile.push(profile[0]);
    for (let j = 1; j <= numSplinePoints; j++) {
      fusionProfile.push(profile[j]);
    }

    fusionProfile.forEach((pt) => {
      let x = pt.x * seg.chord * 1000;
      let z = pt.y * seg.chord * 1000;
      let rotX = x * cosT - z * sinT;
      let rotZ = x * sinT + z * cosT;
      csvContent += `${rotX.toFixed(5)},${(seg.r * 1000).toFixed(5)},${rotZ.toFixed(5)}\n`;
    });

    fusionFolder.file(`section_${String(i + 1).padStart(2, '0')}_r${(seg.r * 1000).toFixed(0)}mm.csv`, csvContent);
  });

  // 5. Airfoil DAT Coordinates (Folder)
  const datFolder = zip.folder('05_Airfoil_Profiles_DAT');
  ['root', 'mid', 'tip'].forEach((region) => {
    const chord = (safeParams[region]?.chordMm || 50) / 1000;
    const thickRatio = (safeParams[region]?.thicknessPct || 12) / 100;
    const airfoil = safeParams[region]?.airfoil || 'SG6043';
    const profile = getAirfoilProfile(thickRatio, 100, chord, profileParams.leRadiusMod, profileParams.teThicknessMm, profileParams.teFlapDeg, null, airfoil);

    let datContent = `${airfoil} (${region.toUpperCase()} Section - t/c=${(thickRatio * 100).toFixed(1)}%)\n`;
    profile.forEach((pt) => {
      const normX = 0.25 - pt.x;
      const normY = pt.y;
      datContent += `  ${normX.toFixed(6)}  ${normY.toFixed(6)}\n`;
    });
    datFolder.file(`${region}_section_${airfoil}.dat`, datContent);
  });

  // 6. 3D Models (OBJ & STL)
  const modelsFolder = zip.folder('06_3D_Models');
  const exporter = new STLExporter();
  const sliceHeightMm = sliceEnabled ? maxZHeight : 0;
  const sliceBoundaries = computeSliceBoundaries(segments, sliceHeightMm);

  if (sliceBoundaries.length <= 2) {
    const fullGeo = buildWatertightPartGeometry(segments, 0, segments.length - 1, false, false, null, profileParams, carbonRodDia, carbonRodDepthPct);
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(fullGeo));
    const stlBinary = exporter.parse(scene, { binary: true });
    const buffer = stlBinary instanceof DataView ? stlBinary.buffer : stlBinary;
    modelsFolder.file('blade_full_rotor.stl', buffer);
    
    // Wavefront OBJ
    let objStr = `# AeroBlade Pro - Complete Blade Mesh\n`;
    const pos = fullGeo.attributes.position.array;
    const idx = fullGeo.index ? fullGeo.index.array : null;
    for (let i = 0; i < pos.length; i += 3) {
      objStr += `v ${pos[i].toFixed(4)} ${pos[i + 1].toFixed(4)} ${pos[i + 2].toFixed(4)}\n`;
    }
    objStr += `g blade\ns 1\n`;
    if (idx) {
      for (let i = 0; i < idx.length; i += 3) objStr += `f ${idx[i] + 1} ${idx[i + 1] + 1} ${idx[i + 2] + 1}\n`;
    }
    modelsFolder.file('blade_assembly.obj', objStr);
  } else {
    const numParts = sliceBoundaries.length - 1;
    const isJointsEnabled = jointParams && jointParams.enabled;

    for (let p = 0; p < numParts; p++) {
      const startIndex = sliceBoundaries[p];
      const endIndex = sliceBoundaries[p + 1];
      if (startIndex >= endIndex) continue;

      const hasTongue = isJointsEnabled && (p < numParts - 1);
      const hasPocket = isJointsEnabled && (p > 0);
      const partGeo = buildWatertightPartGeometry(segments, startIndex, endIndex, hasTongue, hasPocket, jointParams, profileParams, carbonRodDia, carbonRodDepthPct);

      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(partGeo));
      const partStlBinary = exporter.parse(scene, { binary: true });
      const buffer = partStlBinary instanceof DataView ? partStlBinary.buffer : partStlBinary;
      modelsFolder.file(`blade_part_${p + 1}_of_${numParts}.stl`, buffer);
    }
  }

  // 7. Point Cloud Coordinates (ASC)
  let ascContent = `# AeroBlade Pro Point Cloud (X Y Z mm)\n`;
  segments.forEach((seg) => {
    const profile = getAirfoilProfile(seg.thicknessRatio, 30, seg.chord, profileParams.leRadiusMod, profileParams.teThicknessMm, profileParams.teFlapDeg, seg.customInterpolator, seg.airfoil);
    const twistRad = (seg.twistDeg * Math.PI) / 180;
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);
    profile.forEach((pt) => {
      let x = pt.x * seg.chord * 1000;
      let z = pt.y * seg.chord * 1000;
      let rotX = x * cosT - z * sinT;
      let rotZ = x * sinT + z * cosT;
      ascContent += `${rotX.toFixed(4)} ${(seg.r * 1000).toFixed(4)} ${rotZ.toFixed(4)}\n`;
    });
  });
  zip.file('07_Point_Cloud_Cartesian.asc', ascContent);

  // 8. Project Backup JSON
  const projectJSON = {
    version: '1.0',
    name: 'AeroBlade 3D Pro Wind Turbine Design',
    timestamp: new Date().toISOString(),
    windSpeed,
    tsr,
    bladeParams: safeParams,
    aerodynamicSummary: {
      powerOutputKw: ((bemResults?.totalPower || 0) / 1000).toFixed(3),
      powerCoefficientCp: (bemResults?.cp || 0).toFixed(4),
      thrustForceKn: ((bemResults?.totalThrust || 0) / 1000).toFixed(3),
      operatingRpm: rpm.toFixed(1),
    },
  };
  zip.file('08_Blade_Design_Project.json', JSON.stringify(projectJSON, null, 2));

  // 9. Manufacturing & Assembly Spec README
  const readmeText = `========================================================================
AEROBLADE 3D PRO - COMPREHENSIVE WIND TURBINE MANUFACTURING PACKAGE
========================================================================
Project Design Name: ${projectJSON.name}
Generated Timestamp: ${projectJSON.timestamp}

1. EXECUTIVE ROTOR SPECIFICATIONS:
------------------------------------------------------------------------
- Total Rotor Blade Radius (R): ${(safeParams.radiusMm || 500).toFixed(0)} mm (${R_m.toFixed(2)} m)
- Rotor Diameter: ${(R_m * 2).toFixed(2)} m
- Total Swept Area: ${sweptArea.toFixed(2)} m²
- Blade Count (B): ${safeParams.numBlades || 3} blades
- Design Wind Speed (V_rated): ${windSpeed.toFixed(1)} m/s
- Design Tip Speed Ratio (TSR / λ): ${tsr.toFixed(1)}
- Optimal Operating RPM: ${rpm.toFixed(1)} RPM
- Maximum Blade Tip Velocity: ${tipSpeed.toFixed(1)} m/s (${(tipSpeed * 3.6).toFixed(1)} km/h)
- Max Aerodynamic Power Coefficient (Cp): ${(bemResults?.cp || 0).toFixed(4)} (${(((bemResults?.cp || 0) / 0.5926) * 100).toFixed(1)}% Betz Limit)
- Predicted Power Output: ${((bemResults?.totalPower || 0) / 1000).toFixed(2)} kW
- Total Axial Rotor Thrust Load: ${((bemResults?.totalThrust || 0) / 1000).toFixed(2)} kN

2. INTERNAL STRUCTURAL REINFORCEMENT:
------------------------------------------------------------------------
- Carbon Fiber Spar Rod Diameter: ${carbonRodDia > 0 ? `${carbonRodDia} mm` : 'None (Solid/Hollow Skin)'}
- Spar Channel Spanwise Insertion Depth: ${carbonRodDepthPct}% of span
- Spar Chordwise Centroid Position: ${profileParams.carbonRodPosPct}% from Leading Edge (centered along mean camber line)

3. RECOMMENDED 3D PRINTING GUIDELINES:
------------------------------------------------------------------------
- Recommended Filaments: PETG, ASA, ABS, or Carbon-Fiber reinforced PLA (CF-PLA).
- Print Orientation: Stand vertically on flat root/pocket joint face with brim.
- Layer Height: 0.16 mm - 0.20 mm for smooth aerodynamic skin contour.
- Wall Line Count: 3 to 4 perimeter walls (minimum 1.6 mm shell thickness).
- Infill Density: 20% to 30% Gyroid or Cubic infill for isotropic stiffness.
- Top / Bottom Thickness: Minimum 4 solid layers (0.8 - 1.0 mm).

4. MULTI-PIECE INTERLOCKING JOINT ASSEMBLY:
------------------------------------------------------------------------
- Interlocking Tongue & Groove Joints: ${sliceEnabled ? 'ENABLED' : 'DISABLED'}
- Tongue Extrusion Depth: ${jointParams?.extrusionDepth || 8} mm
- Print Joint Clearance: ${jointParams?.clearance || 0.15} mm per side
- Glue Channel Groove: ${jointParams?.glueChannel ? '0.5mm × 0.3mm resin distribution channel enabled' : 'Disabled'}
- Assembly Adhesive: Medium-viscosity structural cyanoacrylate (CA) or slow-cure 2-part epoxy resin (e.g. West System 105/205).
- Insertion Procedure: Apply thin film of epoxy along tongue and inside receiver pocket, insert through carbon fiber spar rod, and clamp under longitudinal pressure for 24 hours.

========================================================================
Package Contents:
- 01_Engineering_Report_AeroBlade.pdf  (Full Executive Multi-Page PDF Report)
- 02_BEM_Aerodynamics_Matrix.csv       (Spanwise Airflow & Aerodynamic Stations)
- 03_Power_Curve_and_AEP.csv           (Wind Speed vs Power, RPM, and Cp)
- 04_CAD_Splines_Fusion360/            (Autodesk Fusion 360 & SolidWorks Splines)
- 05_Airfoil_Profiles_DAT/             (Selig DAT Cross-Section Coordinate Files)
- 06_3D_Models/                        (Watertight 3D Printable Binary STLs & OBJ)
- 07_Point_Cloud_Cartesian.asc         (3D Cartesian Coordinate Point Cloud)
- 08_Blade_Design_Project.json         (Re-importable Design Project File)
- README_MANUFACTURING_SPEC.txt        (This Document)
========================================================================
`;
  zip.file('README_MANUFACTURING_SPEC.txt', readmeText);

  // Generate and trigger download
  const content = await zip.generateAsync({ type: 'blob' });
  const filename = `AeroBlade_Complete_Package_${(safeParams.radiusMm || 500)}mm_${Date.now()}.zip`;
  downloadBlob(content, filename, 'application/zip');
}

