import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getAirfoilProfile } from '../utils/airfoilProfile';

export default function Blade({ segments, showSpar, carbonRodDia = 0, carbonRodDepthPct = 100, leRadiusMod = 1.0, teThicknessMm = 0.0, teFlapDeg = 0.0, segmentColors = null, centerBlade = true, bladePitch = 0 }) {
  const geometry = useMemo(() => {
    const numPoints = 30;
    const totalPointsPerSegment = numPoints * 2;
    const vertices = [];
    const indices = [];
    const uvs = [];
    const colors = [];

    const hasHole = carbonRodDia > 0;
    const holeR = (carbonRodDia / 1000) / 2;
    const holeEndIndex = hasHole ? Math.max(0, Math.floor((carbonRodDepthPct / 100) * (segments.length - 1))) : -1;
    
    const segmentOffsets = [];
    let currentVertexCount = 0;

    segments.forEach((seg, i) => {
      segmentOffsets.push(currentVertexCount);
      const isHoleLayer = hasHole && i <= holeEndIndex;

      const profile = getAirfoilProfile(seg.thicknessRatio, numPoints, seg.chord, leRadiusMod, teThicknessMm, teFlapDeg, seg.customInterpolator);
      // bladePitch represents rigid-body collective rotation around the spanwise axis.
      // We add it to twistDeg here so the entire blade mesh is generated with the feathered orientation.
      const twistRad = (-(seg.twistDeg + bladePitch) * Math.PI) / 180;
      const cosT = Math.cos(twistRad);
      const sinT = Math.sin(twistRad);
      const offset = centerBlade ? segments[segments.length - 1].r / 2 : 0;
      const spanY = seg.r - offset;

      // 1. Outer skin
      profile.forEach((pt, j) => {
        let x = pt.x * seg.chord;
        let z = pt.y * seg.chord;
        const rotX = x * cosT - z * sinT;
        const rotZ = x * sinT + z * cosT;
        vertices.push(rotX, spanY, rotZ);
        uvs.push(j / totalPointsPerSegment, i / (segments.length - 1));
        
        if (segmentColors && segmentColors[i]) {
          colors.push(segmentColors[i].r, segmentColors[i].g, segmentColors[i].b);
        } else {
          colors.push(1, 1, 1);
        }
      });
      currentVertexCount += totalPointsPerSegment;

      // 2. Inner skin (Hole)
      if (isHoleLayer) {
        for (let j = 0; j < totalPointsPerSegment; j++) {
          const theta = (j / totalPointsPerSegment) * Math.PI * 2;
          const hX = Math.cos(theta) * holeR;
          const hZ = Math.sin(theta) * holeR;
          vertices.push(hX, spanY, hZ);
          uvs.push(j / totalPointsPerSegment, i / (segments.length - 1));

          if (segmentColors && segmentColors[i]) {
            colors.push(segmentColors[i].r, segmentColors[i].g, segmentColors[i].b);
          } else {
            colors.push(1, 1, 1);
          }
        }
        currentVertexCount += totalPointsPerSegment;
      }
    });

    // Stitch outer skin
    for (let i = 0; i < segments.length - 1; i++) {
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
      for (let i = 0; i < holeEndIndex; i++) {
        const curInnerOffset = segmentOffsets[i] + totalPointsPerSegment;
        const nextInnerOffset = segmentOffsets[i + 1] + totalPointsPerSegment;
        for (let j = 0; j < totalPointsPerSegment; j++) {
          const nextJ = (j + 1) % totalPointsPerSegment;
          // Flipped winding order for inside-out normals
          indices.push(curInnerOffset + j, nextInnerOffset + j, curInnerOffset + nextJ);
          indices.push(nextInnerOffset + j, nextInnerOffset + nextJ, curInnerOffset + nextJ);
        }
      }
    }

    // Root cap
    if (hasHole) {
      // Hollow root cap
      const curOffset = segmentOffsets[0];
      const curInnerOffset = curOffset + totalPointsPerSegment;
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        // Faces down (-y)
        indices.push(curOffset + j, curInnerOffset + j, curOffset + nextJ);
        indices.push(curOffset + nextJ, curInnerOffset + j, curInnerOffset + nextJ);
      }
    } else {
      // Solid root cap
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(segmentOffsets[0], segmentOffsets[0] + j + 1, segmentOffsets[0] + j);
      }
    }

    // Hole ceiling cap (if hole stops inside blade)
    if (hasHole && holeEndIndex < segments.length - 1) {
      const innerOffset = segmentOffsets[holeEndIndex] + totalPointsPerSegment;
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        // Faces down (-y) towards the root
        indices.push(innerOffset, innerOffset + j + 1, innerOffset + j);
      }
    }

    // Tip cap
    const tipOffset = segmentOffsets[segments.length - 1];
    if (hasHole && holeEndIndex === segments.length - 1) {
      // Hollow tip cap
      const tipInnerOffset = tipOffset + totalPointsPerSegment;
      for (let j = 0; j < totalPointsPerSegment; j++) {
        const nextJ = (j + 1) % totalPointsPerSegment;
        // Faces up (+y)
        indices.push(tipOffset + j, tipOffset + nextJ, tipInnerOffset + j);
        indices.push(tipOffset + nextJ, tipInnerOffset + nextJ, tipInnerOffset + j);
      }
    } else {
      // Solid tip cap
      for (let j = 1; j < totalPointsPerSegment - 1; j++) {
        indices.push(tipOffset, tipOffset + j, tipOffset + j + 1);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [segments, carbonRodDia, segmentColors, centerBlade, bladePitch]);

  const sparGeometry = useMemo(() => {
    if (!showSpar) return null;
    const maxR = segments[segments.length - 1].r;
    const geo = new THREE.CylinderGeometry(0.1, 0.4, maxR, 16);
    if (!centerBlade) {
      geo.translate(0, maxR / 2, 0);
    }
    return geo;
  }, [segments, showSpar, centerBlade]);

  // NO auto-rotation — the model stays still, user orbits with mouse
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      <mesh geometry={geometry}>
        <meshPhysicalMaterial
          color="#ffffff"
          vertexColors={true}
          metalness={0.1}
          roughness={0.4}
          clearcoat={1.0}
          clearcoatRoughness={0.1}
          side={THREE.DoubleSide}
          transparent={showSpar}
          opacity={showSpar ? 0.4 : 1}
        />
      </mesh>

      {showSpar && sparGeometry && (
        <mesh geometry={sparGeometry}>
          <meshStandardMaterial color="#0284c7" roughness={0.7} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
}
