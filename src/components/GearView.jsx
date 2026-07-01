import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { buildGearGeometry } from '../utils/gearBuilder';
import { Html } from '@react-three/drei';
import { useControls, button } from 'leva';
import { exportGearSTL } from '../utils/exporters';
import { useGearParams, computeGearStages } from '../hooks/useGearParams';

/**
 * A single gear stage component that holds the built geometry and handles its own rotation.
 */
export function GearStage({ params, position, rotationOffset, speedRatio, animate, linkedAngleRef }) {
  const groupRef = useRef();

  const geometries = useMemo(() => {
    try {
      return buildGearGeometry(params);
    } catch (e) {
      console.error("Error building gear:", e);
      return [];
    }
  }, [params]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    
    if (linkedAngleRef) {
      groupRef.current.rotation.z = linkedAngleRef.current * speedRatio + rotationOffset;
    } else if (animate) {
      // Base speed is 1 rad/s
      const time = clock.getElapsedTime();
      groupRef.current.rotation.z = time * speedRatio + rotationOffset;
    } else {
      // Snap to initial position if not animating
      groupRef.current.rotation.z = rotationOffset;
    }
  });

  if (geometries.length === 0) return null;

  return (
    <group ref={groupRef} position={position}>
      {geometries.map((g, i) => (
        <mesh key={i} geometry={g.geo}>
          <meshPhysicalMaterial
            color={g.color}
            metalness={0.8}
            roughness={0.2}
            clearcoat={0.5}
            clearcoatRoughness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function GearView({ ctx }) {
  // Use Leva to create a CAD-like floating GUI for the gear generator.
  const levaParams = useGearParams(ctx.gearStore);

  // Compute layout for multiple stages
  const stagesData = useMemo(() => computeGearStages(levaParams), [levaParams]);

  // Download Action Hooked to Leva
  useControls({
    'Download STL': button(() => {
       const allGeometries = [];
       stagesData.forEach(stage => {
         const geos = buildGearGeometry(stage.params);
         geos.forEach(g => {
           const clonedGeo = g.geo.clone();
           clonedGeo.rotateZ(stage.rotationOffset);
           clonedGeo.translate(stage.position[0], stage.position[1], stage.position[2]);
           clonedGeo.rotateX(Math.PI / 2);
           allGeometries.push({ geo: clonedGeo });
         });
       });
       exportGearSTL(allGeometries);
    })
  }, [stagesData]);

  if (stagesData.length === 0) {
    return (
      <Html center>
        <div style={{ color: '#ef4444', background: '#fee2e2', padding: '10px', borderRadius: '8px' }}>
          Invalid Gear Parameters
        </div>
      </Html>
    );
  }

  return (
    <group rotation={[Math.PI / 2, 0, 0]}>
      {stagesData.map((stage, idx) => (
        <GearStage 
          key={idx} 
          params={stage.params} 
          position={stage.position} 
          speedRatio={stage.speedRatio}
          rotationOffset={stage.rotationOffset}
          animate={levaParams.animate}
        />
      ))}
      <gridHelper args={[500, 50, '#334155', '#1e293b']} position={[0, -20, 0]} />
    </group>
  );
}
