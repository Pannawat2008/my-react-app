import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useControls, button } from 'leva';
import { buildGearGeometry } from '../utils/gearBuilder';
import { exportGearZipSTL } from '../utils/exporters';
import { useGearParams, computeGearStages } from '../hooks/useGearParams';
import { useGear } from '../context/GearContext';

export function GearStage({
  params,
  position,
  rotationOffset,
  speedRatio,
  animate,
  linkedAngleRef,
  explodedOffset = 0,
  stageIndex = 0,
}) {
  const groupRef = useRef();

  const geometries = useMemo(() => {
    try {
      const geos = buildGearGeometry(params);
      // Mark pinion geometries
      if (params.hasPinion && geos.length > 0) {
        geos[geos.length - 1].isPinion = true;
      }
      return geos;
    } catch (e) {
      console.error('Error building gear:', e);
      return [];
    }
  }, [params]);

  // Pitch Circle Radius = (module * numTeeth) / 2
  const pitchRadius = (params.module * params.numTeeth) / 2;
  const pitchCircleGeo = useMemo(() => {
    const pts = [];
    const segs = 64;
    for (let i = 0; i <= segs; i++) {
      const theta = (i / segs) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * pitchRadius, Math.sin(theta) * pitchRadius, 0.5));
    }
    return new THREE.BufferGeometry().setFromPoints(pts);
  }, [pitchRadius]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    if (linkedAngleRef) {
      groupRef.current.rotation.z = linkedAngleRef.current * speedRatio + rotationOffset;
    } else if (animate) {
      const time = clock.getElapsedTime() * 1.5;
      groupRef.current.rotation.z = time * speedRatio + rotationOffset;
    } else {
      groupRef.current.rotation.z = rotationOffset;
    }
  });

  if (geometries.length === 0) return null;

  const adjustedPosition = [
    position[0],
    position[1],
    position[2] + explodedOffset,
  ];

  return (
    <group ref={groupRef} position={adjustedPosition}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g.geo}>
          <meshPhysicalMaterial
            color={g.color}
            metalness={0.85}
            roughness={0.25}
            clearcoat={0.6}
            clearcoatRoughness={0.15}
          />
        </mesh>
      ))}

      {/* Tangential Pitch Circle Marker */}
      <line geometry={pitchCircleGeo}>
        <lineDashedMaterial color="#10b981" dashSize={2} gapSize={1} linewidth={1.5} />
      </line>

      {/* Stage Dimension & Spec Badge */}
      <Html position={[0, pitchRadius * 1.15, 2]} center>
        <div className="cad-dimension-badge glass" style={{ fontSize: 9 }}>
          <span className="cad-dim-label">Stage {stageIndex + 1}</span>
          <span className="cad-dim-val">
            {params.numTeeth}T (Ø{(pitchRadius * 2).toFixed(1)}mm)
          </span>
        </div>
      </Html>
    </group>
  );
}

export default function GearView() {
  const { gearStore, explodedPct } = useGear();
  const levaParams = useGearParams(gearStore);

  const stagesData = useMemo(() => {
    const rawStages = computeGearStages(levaParams);
    return rawStages.map((stg) => {
      const geos = buildGearGeometry(stg.params);
      if (stg.params.hasPinion && geos.length > 0) {
        geos[geos.length - 1].isPinion = true;
      }
      return { ...stg, geometries: geos };
    });
  }, [levaParams]);

  useControls(
    {
      '📦 Download 3D Print Pack (ZIP)': button(() => {
        exportGearZipSTL(stagesData);
      }),
    },
    { store: gearStore },
    [stagesData]
  );

  if (stagesData.length === 0) {
    return (
      <Html center>
        <div style={{ color: '#ef4444', background: '#fee2e2', padding: '10px', borderRadius: '8px' }}>
          Invalid Gear Parameters
        </div>
      </Html>
    );
  }

  const scale = 0.05;

  return (
    <group rotation={[Math.PI / 2, 0, 0]} scale={[scale, scale, scale]}>
      {stagesData.map((stage, idx) => (
        <GearStage
          key={idx}
          params={stage.params}
          position={stage.position}
          speedRatio={stage.speedRatio}
          rotationOffset={stage.rotationOffset}
          animate={levaParams.animate}
          explodedOffset={(explodedPct || 0) * idx * 60}
          stageIndex={idx}
          kinematics={stage.kinematics}
        />
      ))}
    </group>
  );
}
