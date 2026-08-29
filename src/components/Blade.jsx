import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { getAirfoilProfile } from '../utils/airfoilProfile';
import { buildWatertightPartGeometry, computeSliceBoundaries, getAirfoilSparCenter } from '../utils/jointBuilder';

/* ── Zebra Stripe Curvature Shader ── */
const ZebraShaderMaterial = {
  uniforms: {
    stripeFrequency: { value: 24.0 },
  },
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    uniform float stripeFrequency;
    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 reflectDir = reflect(-viewDir, normalize(vNormal));
      float stripe = sin(reflectDir.y * stripeFrequency);
      float val = step(0.0, stripe);
      gl_FragColor = vec4(vec3(val), 1.0);
    }
  `,
};

/* ── RGB Surface Normal Vector Diagnostic Shader ── */
const NormalShaderMaterial = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;
    void main() {
      vec3 fdx = dFdx(vWorldPosition);
      vec3 fdy = dFdy(vWorldPosition);
      vec3 faceNormal = normalize(cross(fdx, fdy));
      vec3 rgb = faceNormal * 0.5 + 0.5;
      gl_FragColor = vec4(rgb, 1.0);
    }
  `,
};

/* ── Studio MatCap Clay / CAD Specular Shader ── */
const MatCapClayShaderMaterial = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(vViewPosition);
      
      // Studio 3-point light clay shading
      vec3 keyLight = normalize(vec3(1.0, 1.2, 1.5));
      vec3 fillLight = normalize(vec3(-1.0, -0.5, 0.8));
      
      float diffKey = max(0.0, dot(N, keyLight));
      float diffFill = max(0.0, dot(N, fillLight)) * 0.45;
      float diffRim = pow(1.0 - max(0.0, dot(N, V)), 2.8) * 0.5;
      
      // Specular highlight
      vec3 H = normalize(keyLight + V);
      float spec = pow(max(0.0, dot(N, H)), 24.0) * 0.4;
      
      // Warm CAD studio clay base color
      vec3 clayColor = vec3(0.85, 0.76, 0.68);
      vec3 shadowColor = vec3(0.22, 0.20, 0.18);
      
      vec3 color = mix(shadowColor, clayColor, diffKey + diffFill) + vec3(spec + diffRim);
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

/* ── Piece color palette for sliced / exploded view ── */
const PIECE_COLORS = [
  '#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa',
  '#f472b6', '#38bdf8', '#4ade80', '#facc15', '#fb923c',
];

export default function Blade({
  segments,
  showSpar = false,
  viewMode = 'solid',
  showDimensions = true,
  showForceVectors = false,
  carbonRodDia = 0,
  carbonRodDepthPct = 100,
  carbonRodPosPct = 30,
  carbonRodYOffsetMm = 0,
  leRadiusMod = 1.0,
  teThicknessMm = 0.0,
  teFlapDeg = 0.0,
  segmentColors = null,
  centerBlade = true,
  bladePitch = 0,
  bemSegments = null,
  sliceEnabled = false,
  sliceMode = 'manual',
  sliceCuts = [50],
  maxZHeight = 220,
  jointParams = null,
}) {
  const zebraMatRef = useRef();

  const maxR = segments[segments.length - 1].r;
  const spanOffset = centerBlade ? maxR / 2 : 0;
  const totalR = maxR;
  const rootChord = segments[0].chord;
  const tipChord = segments[segments.length - 1].chord;

  /* ── Compute Slice Boundaries ── */
  const boundaries = useMemo(() => {
    if (!sliceEnabled) return [0, segments.length - 1];
    return computeSliceBoundaries(segments, {
      mode: sliceMode || 'manual',
      maxZHeight: maxZHeight || 220,
      customCuts: sliceCuts || [50],
    });
  }, [sliceEnabled, sliceMode, maxZHeight, sliceCuts, segments]);

  const isSliced = sliceEnabled && boundaries.length >= 3;
  const numParts = boundaries.length - 1;

  /* ── Build Watertight Geometries for Each Part ── */
  const partGeometries = useMemo(() => {
    const profileParams = { leRadiusMod, teThicknessMm, teFlapDeg, carbonRodPosPct, carbonRodYOffsetMm, bladePitch };
    const isJointsEnabled = jointParams && jointParams.enabled;

    if (!isSliced) {
      // Single continuous blade
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
      // Convert mm to meters and apply center offset
      geo.scale(0.001, 0.001, 0.001);
      geo.translate(0, -spanOffset, 0);
      geo.computeVertexNormals();
      return [{ geo, startIdx: 0, endIdx: segments.length - 1, partNum: 1 }];
    }

    // Multiple sliced parts
    const parts = [];
    for (let p = 0; p < numParts; p++) {
      const startIndex = boundaries[p];
      const endIndex = boundaries[p + 1];
      if (startIndex >= endIndex) continue;

      const hasTongue = isJointsEnabled && (p < numParts - 1);
      const hasPocket = isJointsEnabled && (p > 0);

      const geo = buildWatertightPartGeometry(
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

      // Convert mm to meters and apply center offset
      geo.scale(0.001, 0.001, 0.001);
      geo.translate(0, -spanOffset, 0);
      geo.computeVertexNormals();

      parts.push({
        geo,
        startIndex,
        endIndex,
        partNum: p + 1,
        hasTongue,
        hasPocket,
        cutY: segments[endIndex].r - spanOffset,
      });
    }
    return parts;
  }, [segments, boundaries, isSliced, numParts, jointParams, leRadiusMod, teThicknessMm, teFlapDeg, carbonRodDia, carbonRodDepthPct, carbonRodPosPct, carbonRodYOffsetMm, bladePitch, spanOffset]);

  /* ── Exploded View Offsets (along Y spanwise axis in meters) ── */
  const explodedOffsets = useMemo(() => {
    if (!isSliced || !jointParams) return null;
    const explodeDist = (jointParams.explodedDistance || 0) / 1000; // mm -> meters
    if (explodeDist <= 0) return null;

    const offsets = [];
    for (let p = 0; p < numParts; p++) {
      offsets.push(p * explodeDist);
    }
    return offsets;
  }, [isSliced, jointParams, numParts]);

  /* ── Rib geometries for wireframe/ribs mode ── */
  const ribsGeometries = useMemo(() => {
    const numPoints = 30;
    const ribs = [];
    segments.forEach((seg) => {
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
      const twistRad = (-(seg.twistDeg + bladePitch) * Math.PI) / 180;
      const cosT = Math.cos(twistRad);
      const sinT = Math.sin(twistRad);
      const spanY = seg.r - spanOffset;

      const pts = [];
      profile.forEach((pt) => {
        const x = pt.x * seg.chord;
        const z = pt.y * seg.chord;
        pts.push(new THREE.Vector3(x * cosT - z * sinT, spanY, x * sinT + z * cosT));
      });
      if (pts.length > 0) {
        pts.push(pts[0].clone());
        ribs.push(new THREE.BufferGeometry().setFromPoints(pts));
      }
    });
    return ribs;
  }, [segments, leRadiusMod, teThicknessMm, teFlapDeg, bladePitch, spanOffset]);

  /* ── 3D Carbon Fiber Spar Rod Tube Geometry following Camber & Twist ── */
  const sparGeometry = useMemo(() => {
    if (!showSpar && viewMode !== 'spar') return null;
    const rodRadius_m = Math.max(0.0015, (carbonRodDia || 4) / 2000);
    const depthPct = carbonRodDepthPct ?? 100;
    const endIdx = Math.max(1, Math.floor((depthPct / 100) * (segments.length - 1)));

    const curvePoints = [];
    for (let i = 0; i <= endIdx; i++) {
      const seg = segments[i];
      const sparCenter = getAirfoilSparCenter(seg, { carbonRodPosPct, carbonRodYOffsetMm });
      const twistRad = (-(seg.twistDeg + bladePitch) * Math.PI) / 180;
      const cosT = Math.cos(twistRad);
      const sinT = Math.sin(twistRad);

      const px_m = sparCenter.px / 1000;
      const pz_m = sparCenter.pz / 1000;
      const rotX = px_m * cosT - pz_m * sinT;
      const rotZ = px_m * sinT + pz_m * cosT;
      const spanY = seg.r - spanOffset;

      curvePoints.push(new THREE.Vector3(rotX, spanY, rotZ));
    }

    if (curvePoints.length < 2) return null;
    const path = new THREE.CatmullRomCurve3(curvePoints);
    return new THREE.TubeGeometry(path, Math.max(20, endIdx * 4), rodRadius_m, 16, false);
  }, [showSpar, viewMode, segments, carbonRodDia, carbonRodDepthPct, carbonRodPosPct, carbonRodYOffsetMm, bladePitch, spanOffset]);

  const isAirflowMode = viewMode === 'airflow';
  const isWireframe = viewMode === 'wireframe';
  const isFaceted = viewMode === 'faceted';
  const isNormalsMode = viewMode === 'normals';
  const isClayMode = viewMode === 'clay';
  const isSparMode = showSpar || viewMode === 'spar';
  const isRibsMode = viewMode === 'ribs';
  const isZebraMode = viewMode === 'zebra';

  /* ── Apply Aerodynamic Flow State Vertex Colors in Airflow Mode ── */
  useMemo(() => {
    if (!isAirflowMode || !bemSegments || bemSegments.length === 0) return;

    const minR = segments[0]?.r || 0.05;
    const maxR = segments[segments.length - 1]?.r || 1.0;
    const spanLen = maxR - minR || 1.0;

    partGeometries.forEach((part) => {
      const geo = part.geo;
      const posAttr = geo.getAttribute('position');
      if (!posAttr) return;

      const colors = new Float32Array(posAttr.count * 3);
      const color = new THREE.Color();

      for (let i = 0; i < posAttr.count; i++) {
        const y = posAttr.getY(i) + spanOffset;
        const t = Math.max(0, Math.min(1, (y - minR) / spanLen));
        const segIdx = Math.min(bemSegments.length - 1, Math.floor(t * (bemSegments.length - 1)));
        const seg = bemSegments[segIdx] || bemSegments[0];

        const hex = seg?.flowStateColor || (seg?.alphaDeg > 14 ? '#ef4444' : seg?.alphaDeg > 11.5 ? '#f59e0b' : '#10b981');
        color.set(hex);
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      if (geo.attributes.color) geo.attributes.color.needsUpdate = true;
    });
  }, [isAirflowMode, bemSegments, partGeometries, segments, spanOffset]);

  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {/* ── Render Watertight Blade Parts ── */}
      {partGeometries.map((part, p) => {
        const yOffset = explodedOffsets ? (explodedOffsets[p] || 0) : 0;
        const pieceColor = isSliced ? PIECE_COLORS[p % PIECE_COLORS.length] : '#f8fafc';
        const startSeg = segments[part.startIndex || 0];
        const endSeg = segments[part.endIndex || segments.length - 1];
        const partMidY = ((startSeg?.r || 0) + (endSeg?.r || 0)) / 2 - spanOffset;

        return (
          <group key={`blade-part-${p}`} position={[0, yOffset, 0]}>
            <mesh geometry={part.geo} castShadow receiveShadow>
              {isZebraMode ? (
                <shaderMaterial
                  ref={zebraMatRef}
                  vertexShader={ZebraShaderMaterial.vertexShader}
                  fragmentShader={ZebraShaderMaterial.fragmentShader}
                  uniforms={ZebraShaderMaterial.uniforms}
                  side={THREE.DoubleSide}
                />
              ) : isNormalsMode ? (
                <shaderMaterial
                  vertexShader={NormalShaderMaterial.vertexShader}
                  fragmentShader={NormalShaderMaterial.fragmentShader}
                  side={THREE.DoubleSide}
                />
              ) : isClayMode ? (
                <shaderMaterial
                  vertexShader={MatCapClayShaderMaterial.vertexShader}
                  fragmentShader={MatCapClayShaderMaterial.fragmentShader}
                  side={THREE.DoubleSide}
                />
              ) : isFaceted ? (
                <meshStandardMaterial
                  color={pieceColor}
                  flatShading={true}
                  roughness={0.4}
                  metalness={0.12}
                  side={THREE.DoubleSide}
                  polygonOffset={true}
                  polygonOffsetFactor={1}
                  polygonOffsetUnits={1}
                />
              ) : (
                <meshPhysicalMaterial
                  color={isAirflowMode ? '#ffffff' : pieceColor}
                  vertexColors={isAirflowMode || (!isSliced && segmentColors !== null)}
                  wireframe={isWireframe}
                  metalness={isAirflowMode ? 0.05 : 0.08}
                  roughness={isAirflowMode ? 0.35 : 0.18}
                  clearcoat={1.0}
                  clearcoatRoughness={0.05}
                  reflectivity={0.9}
                  side={THREE.DoubleSide}
                  transparent={isSparMode}
                  opacity={isSparMode ? 0.35 : 1.0}
                />
              )}
            </mesh>

            {/* Wireframe Overlay on Solid in Faceted Mode */}
            {isFaceted && (
              <mesh geometry={part.geo}>
                <meshBasicMaterial
                  wireframe={true}
                  color="#1e293b"
                  transparent={true}
                  opacity={0.35}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}

            {/* Part Label in Exploded View */}
            {isSliced && (
              <Html position={[0.15, partMidY, 0.05]} center>
                <div
                  className="cad-dimension-badge glass"
                  style={{
                    background: pieceColor + '22',
                    borderColor: pieceColor,
                    transform: 'scale(0.9)',
                  }}
                >
                  <span className="cad-dim-label">Part {part.partNum}</span>
                  <span className="cad-dim-val" style={{ color: pieceColor }}>
                    {part.hasTongue ? 'Boss 🟢' : part.hasPocket ? 'Pocket 🟡' : 'Solid'}
                  </span>
                </div>
              </Html>
            )}
          </group>
        );
      })}

      {/* ── Cut plane indicator badges & lines ── */}
      {isSliced &&
        boundaries.slice(1, -1).map((segIdx, idx) => {
          const cutY = segments[segIdx].r - spanOffset;
          const maxChord = segments[segIdx].chord || 0.1;
          const explodeY = explodedOffsets ? (explodedOffsets[idx] + explodedOffsets[idx + 1]) / 2 : 0;

          return (
            <group key={`cutplane-${idx}`}>
              <line position={[0, explodeY, 0]}>
                <bufferGeometry
                  attach="geometry"
                  {...new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(-maxChord * 0.9, cutY, 0),
                    new THREE.Vector3(maxChord * 0.9, cutY, 0),
                  ])}
                />
                <lineDashedMaterial color="#ef4444" dashSize={0.02} gapSize={0.01} linewidth={2} />
              </line>

              <Html position={[0, cutY + explodeY, 0.08]} center>
                <div className="joint-cut-badge">
                  <span>✂️ Cut {idx + 1} ({((segments[segIdx].r) * 1000).toFixed(0)}mm)</span>
                </div>
              </Html>
            </group>
          );
        })}

      {/* Internal Spar Geometry */}
      {isSparMode && sparGeometry && (
        <mesh geometry={sparGeometry}>
          <meshStandardMaterial color="#0284c7" roughness={0.3} metalness={0.8} />
        </mesh>
      )}

      {/* Rib Wireframe Stations */}
      {isRibsMode &&
        ribsGeometries.map((ribGeo, idx) => (
          <line key={idx} geometry={ribGeo}>
            <lineBasicMaterial color="#38bdf8" linewidth={2} />
          </line>
        ))}

      {/* ── 3D In-Viewport Dimension Callouts & Ruler Badges ── */}
      {showDimensions && centerBlade && !explodedOffsets && (
        <group>
          <line>
            <bufferGeometry
              attach="geometry"
              {...new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, -spanOffset - 0.05, 0),
                new THREE.Vector3(0, totalR - spanOffset + 0.05, 0),
              ])}
            />
            <lineDashedMaterial color="#f59e0b" dashSize={0.05} gapSize={0.02} linewidth={2} />
          </line>

          <Html position={[0.2, 0, 0]} center>
            <div className="cad-dimension-badge glass">
              <span className="cad-dim-label">Span R</span>
              <span className="cad-dim-val">{totalR.toFixed(2)} m</span>
            </div>
          </Html>

          <Html position={[0, -spanOffset, 0.1]} center>
            <div className="cad-dimension-badge glass">
              <span className="cad-dim-label">Root Chord</span>
              <span className="cad-dim-val">{(rootChord * 1000).toFixed(0)} mm</span>
            </div>
          </Html>

          <Html position={[0, totalR - spanOffset, 0.1]} center>
            <div className="cad-dimension-badge glass">
              <span className="cad-dim-label">Tip Chord</span>
              <span className="cad-dim-val">{(tipChord * 1000).toFixed(0)} mm</span>
            </div>
          </Html>
        </group>
      )}

      {/* ── Aerodynamic Force Vectors (Lift & Drag) ── */}
      {showForceVectors &&
        bemSegments &&
        bemSegments.map((seg, i) => {
          if (i % 3 !== 0) return null;
          const spanY = seg.r - spanOffset;
          const liftMag = Math.min(1.5, (seg.dT || 0) / 400);
          const torqueMag = Math.min(1.0, (seg.dQ || 0) / 200);

          return (
            <group key={i} position={[0, spanY, 0]}>
              <arrowHelper
                args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), liftMag, '#ef4444', 0.2, 0.1]}
              />
              <arrowHelper
                args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), torqueMag, '#8b5cf6', 0.15, 0.08]}
              />
            </group>
          );
        })}
    </group>
  );
}
