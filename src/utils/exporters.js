import { getAirfoilProfile } from './airfoilProfile';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';
import * as THREE from 'three';
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
    const profile = getAirfoilProfile(seg.thicknessRatio, numPoints, seg.chord, leRadiusMod, teThicknessMm, teFlapDeg, seg.customInterpolator);
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

import JSZip from 'jszip';

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

  sectionsToExport.forEach(section => {
    // Generate normalized profile (chord = 1)
    const profile = getAirfoilProfile(section.seg.thicknessRatio, numPoints, 1, leRadiusMod, teThicknessMm, teFlapDeg, section.seg.customInterpolator);
    
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

/* ── STL Export ── */
export async function exportSTL(segments, carbonRodDia = 0, carbonRodDepthPct = 100, leRadiusMod = 1.0, teThicknessMm = 0.0, teFlapDeg = 0.0, sliceHeightMm = 0) {
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

    const profile = getAirfoilProfile(seg.thicknessRatio, numPoints, seg.chord, leRadiusMod, teThicknessMm, teFlapDeg, seg.customInterpolator);
    const twistRad = (seg.twistDeg * Math.PI) / 180;
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    // 1. Outer skin
    profile.forEach((pt) => {
      // Convert from meters to millimeters for 3D printing
      let x = pt.x * seg.chord * 1000;
      let z = pt.y * seg.chord * 1000;
      let rotX = x * cosT - z * sinT;
      let rotZ = x * sinT + z * cosT;
      vertices.push({ x: rotX, y: seg.r * 1000, z: rotZ });
    });
    currentVertexCount += totalPointsPerSegment;

    // 2. Inner skin (Hole)
    if (isHoleLayer) {
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const theta = (j / totalPointsPerSegment) * Math.PI * 2;
        const hX = Math.cos(theta) * holeR * 1000;
        const hZ = Math.sin(theta) * holeR * 1000;
        vertices.push({ x: hX, y: seg.r * 1000, z: hZ });
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

  function buildSliceSTL(startIndex, endIndex, partIndex) {
    let stl = `solid wind_turbine_blade_part_${partIndex}\n`;
    const indices = [];

    // Stitch outer skin for this slice
    for (let i = startIndex; i < endIndex; i++) {
      const curOffset = segmentOffsets[i];
      const nextOffset = segmentOffsets[i + 1];
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        indices.push(curOffset + j, curOffset + nextJ, nextOffset + j);
        indices.push(nextOffset + j, curOffset + nextJ, nextOffset + nextJ);
      }
    }

    // Stitch inner skin for this slice
    if (hasHole) {
      const localHoleEnd = Math.min(holeEndIndex, endIndex);
      for (let i = startIndex; i < localHoleEnd; i++) {
        const curInnerOffset = segmentOffsets[i] + totalPointsPerSegment;
        const nextInnerOffset = segmentOffsets[i + 1] + totalPointsPerSegment;
        for (let j = 0; j < totalPointsPerSegment; j++) {
          const nextJ = (j + 1) % totalPointsPerSegment;
          indices.push(curInnerOffset + j, nextInnerOffset + j, curInnerOffset + nextJ);
          indices.push(nextInnerOffset + j, nextInnerOffset + nextJ, curInnerOffset + nextJ);
        }
      }
    }

    // Root cap for this slice
    if (hasHole && startIndex <= holeEndIndex) {
      // Hollow cap
      const curOffset = segmentOffsets[startIndex];
      const curInnerOffset = curOffset + totalPointsPerSegment;
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        indices.push(curOffset + j, curInnerOffset + j, curOffset + nextJ);
        indices.push(curOffset + nextJ, curInnerOffset + j, curInnerOffset + nextJ);
      }
    } else {
      // Solid cap
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(segmentOffsets[startIndex], segmentOffsets[startIndex] + j + 1, segmentOffsets[startIndex] + j);
      }
    }

    // Tip cap for this slice
    const tipOffset = segmentOffsets[endIndex];
    if (hasHole && endIndex <= holeEndIndex) {
      // Hollow cap
      const tipInnerOffset = tipOffset + totalPointsPerSegment;
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        indices.push(tipOffset + j, tipOffset + nextJ, tipInnerOffset + j);
        indices.push(tipOffset + nextJ, tipInnerOffset + nextJ, tipInnerOffset + j);
      }
    } else {
      // Solid cap
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(tipOffset, tipOffset + j, tipOffset + j + 1);
      }
    }

    function addTriangle(v1, v2, v3) {
      const ux = v2.x - v1.x, uy = v2.y - v1.y, uz = v2.z - v1.z;
      const vx = v3.x - v1.x, vy = v3.y - v1.y, vz = v3.z - v1.z;
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      if (len > 0) { nx /= len; ny /= len; nz /= len; }
      stl += `  facet normal ${nx.toFixed(5)} ${ny.toFixed(5)} ${nz.toFixed(5)}\n`;
      stl += `    outer loop\n`;
      stl += `      vertex ${v1.x.toFixed(5)} ${v1.y.toFixed(5)} ${v1.z.toFixed(5)}\n`;
      stl += `      vertex ${v2.x.toFixed(5)} ${v2.y.toFixed(5)} ${v2.z.toFixed(5)}\n`;
      stl += `      vertex ${v3.x.toFixed(5)} ${v3.y.toFixed(5)} ${v3.z.toFixed(5)}\n`;
      stl += `    endloop\n  endfacet\n`;
    }

    for (let i = 0; i < indices.length; i += 3) {
      addTriangle(vertices[indices[i]], vertices[indices[i+1]], vertices[indices[i+2]]);
    }

    stl += `endsolid wind_turbine_blade_part_${partIndex}\n`;
    return stl;
  }

  for (let p = 0; p < sliceBoundaries.length - 1; p++) {
    const startIndex = sliceBoundaries[p];
    const endIndex = sliceBoundaries[p + 1];
    if (startIndex >= endIndex) continue;

    const stlStr = buildSliceSTL(startIndex, endIndex, p + 1);
    
    if (sliceBoundaries.length > 2) {
      zip.file(`blade_part_${p + 1}.stl`, stlStr);
    } else {
      downloadBlob(stlStr, 'blade.stl', 'text/plain');
      return; // Single file downloaded
    }
  }

  if (sliceBoundaries.length > 2) {
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blade_sliced_stls.zip';
    a.click();
  }
}

/* ── OBJ Export (3D Mesh) ── */
export async function exportOBJ(segments, carbonRodDia = 0, carbonRodDepthPct = 100, leRadiusMod = 1.0, teThicknessMm = 0.0, teFlapDeg = 0.0, sliceHeightMm = 0) {
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

    const profile = getAirfoilProfile(seg.thicknessRatio, numPoints, seg.chord, leRadiusMod, teThicknessMm, teFlapDeg, seg.customInterpolator);
    const twistRad = (seg.twistDeg * Math.PI) / 180;
    const cosT = Math.cos(twistRad);
    const sinT = Math.sin(twistRad);

    // Outer skin
    profile.forEach((pt) => {
      // Convert from meters to millimeters for 3D printing
      let x = pt.x * seg.chord * 1000;
      let z = pt.y * seg.chord * 1000;
      let rotX = x * cosT - z * sinT;
      let rotZ = x * sinT + z * cosT;
      vertices.push({ x: rotX, y: seg.r * 1000, z: rotZ });
    });
    currentVertexCount += totalPointsPerSegment;

    // Inner skin
    if (isHoleLayer) {
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const theta = (j / totalPointsPerSegment) * Math.PI * 2;
        const hX = Math.cos(theta) * holeR * 1000;
        const hZ = Math.sin(theta) * holeR * 1000;
        vertices.push({ x: hX, y: seg.r * 1000, z: hZ });
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

  function buildSliceOBJ(startIndex, endIndex, partIndex) {
    let obj = `# AeroBlade Pro - 3D Mesh Export Part ${partIndex}\n`;
    const indices = [];

    // Dump ALL vertices (OBJ indices are 1-based). It's slightly inefficient to dump all vertices for every slice, but OBJ allows unused vertices.
    // For smaller files, we could filter vertices, but since this is local export, it's fine.
    vertices.forEach(v => {
      obj += `v ${v.x.toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}\n`;
    });

    // Stitch outer skin
    for (let i = startIndex; i < endIndex; i++) {
      const curOffset = segmentOffsets[i];
      const nextOffset = segmentOffsets[i + 1];
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        indices.push(curOffset + j, curOffset + nextJ, nextOffset + j);
        indices.push(nextOffset + j, curOffset + nextJ, nextOffset + nextJ);
      }
    }

    // Stitch inner skin
    if (hasHole) {
      const localHoleEnd = Math.min(holeEndIndex, endIndex);
      for (let i = startIndex; i < localHoleEnd; i++) {
        const curInnerOffset = segmentOffsets[i] + totalPointsPerSegment;
        const nextInnerOffset = segmentOffsets[i + 1] + totalPointsPerSegment;
        for (let j = 0; j < totalPointsPerSegment; j++) {
          const nextJ = (j + 1) % totalPointsPerSegment;
          indices.push(curInnerOffset + j, nextInnerOffset + j, curInnerOffset + nextJ);
          indices.push(nextInnerOffset + j, nextInnerOffset + nextJ, curInnerOffset + nextJ);
        }
      }
    }

    // Root cap
    if (hasHole && startIndex <= holeEndIndex) {
      const curOffset = segmentOffsets[startIndex];
      const curInnerOffset = curOffset + totalPointsPerSegment;
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        indices.push(curOffset + j, curInnerOffset + j, curOffset + nextJ);
        indices.push(curOffset + nextJ, curInnerOffset + j, curInnerOffset + nextJ);
      }
    } else {
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(segmentOffsets[startIndex], segmentOffsets[startIndex] + j + 1, segmentOffsets[startIndex] + j);
      }
    }

    // Tip cap
    const tipOffset = segmentOffsets[endIndex];
    if (hasHole && endIndex <= holeEndIndex) {
      const tipInnerOffset = tipOffset + totalPointsPerSegment;
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        indices.push(tipOffset + j, tipOffset + nextJ, tipInnerOffset + j);
        indices.push(tipOffset + nextJ, tipInnerOffset + nextJ, tipInnerOffset + j);
      }
    } else {
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(tipOffset, tipOffset + j, tipOffset + j + 1);
      }
    }

    obj += `o blade_part_${partIndex}\n`;
    for (let i = 0; i < indices.length; i += 3) {
      // OBJ indices are 1-based
      obj += `f ${indices[i] + 1} ${indices[i+1] + 1} ${indices[i+2] + 1}\n`;
    }

    return obj;
  }

  for (let p = 0; p < sliceBoundaries.length - 1; p++) {
    const startIndex = sliceBoundaries[p];
    const endIndex = sliceBoundaries[p + 1];
    if (startIndex >= endIndex) continue;

    const objStr = buildSliceOBJ(startIndex, endIndex, p + 1);
    
    if (sliceBoundaries.length > 2) {
      zip.file(`blade_part_${p + 1}.obj`, objStr);
    } else {
      downloadBlob(objStr, 'blade.obj', 'text/plain');
      return;
    }
  }

  if (sliceBoundaries.length > 2) {
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blade_sliced_objs.zip';
    a.click();
  }
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

    const profile = getAirfoilProfile(seg.thicknessRatio, numPoints, seg.chord, leRadiusMod, teThicknessMm, teFlapDeg, seg.customInterpolator);
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

    // Inner skin
    if (isHoleLayer) {
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const theta = (j / totalPointsPerSegment) * Math.PI * 2;
        const hX = Math.cos(theta) * holeR * 1000;
        const hZ = Math.sin(theta) * holeR * 1000;
        vertices.push({ x: hX, y: seg.r * 1000, z: hZ });
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
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/* ── Gear STL Export ── */
export function exportGearSTL(geometries) {
  const scene = new THREE.Scene();
  geometries.forEach(g => {
    const mesh = new THREE.Mesh(g.geo);
    scene.add(mesh);
  });

  const exporter = new STLExporter();
  const stlString = exporter.parse(scene);

  downloadBlob(stlString, 'gear_assembly.stl', 'text/plain');
}
