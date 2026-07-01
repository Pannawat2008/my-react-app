import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Blade from './Blade';
import { getHeatmapColor } from '../utils/heatmapColors';
import { useGearParams, computeGearStages } from '../hooks/useGearParams';
import { GearStage } from './GearView';
import { solveBEM } from '../engine/bem';

export default function SimTurbine({ segments, bemResults, rpm, heatmapProperty, showSpar, bladeParams, simPlaying, windSpeed, bladePitch = 0, timeScale = 1.0, showParticles = true, tunnelScale = 2.5, gearStore, generatorLoad, loadModel, constantLoadGcm, ratedPowerW, ratedRpm, setLiveRpm, setLiveElectricalPowerW }) {
  const rotorRef = useRef();
  const currentRotorAngle = useRef(0);
  const gearRatioRef = useRef(1.0);

  const currentRpmRef = useRef(0.1);
  const lastStateUpdateTime = useRef(0);

  // Rotate the turbine based on dynamically simulated RPM
  useFrame((state, delta) => {
    if (rotorRef.current && simPlaying) {
      const scaledDelta = delta * timeScale;
      
      const R = bladeParams.radiusMm / 1000;
      const B = bladeParams.numBlades || 3;
      
      // Calculate Aerodynamic Torque at current physical RPM
      const result = solveBEM(segments, windSpeed, currentRpmRef.current, R, B, bladePitch);
      const T_aero = result.totalTorque;
      
      // Calculate Generator Load Torque
      const omega = (currentRpmRef.current * Math.PI) / 30;
      const gearRatio = gearRatioRef.current || 1.0;
      const omegaGen = omega * gearRatio;
      
      let T_load = 0;
      let P_elec = 0;
      const coggingTorqueNm = constantLoadGcm * 0.0000980665;
      
      if (loadModel === 'Constant Friction') {
        // Friction from the generator is reflected back to the rotor multiplied by gear ratio
        T_load = coggingTorqueNm * gearRatio;
        // If the turbine is completely stopped, friction matches torque up to the limit
        if (omega < 0.01 && T_aero < T_load) {
          T_load = T_aero; 
        }
      } else if (loadModel === 'Realistic DC Motor') {
        // T_total = T_cogging + T_electrical
        // T_electrical = (P_rated / omega_rated^2) * omegaGen
        const ratedOmega = (ratedRpm * Math.PI) / 30;
        const T_elec = (ratedPowerW / (ratedOmega * ratedOmega)) * omegaGen;
        P_elec = T_elec * omegaGen; // Electrical Power generated
        
        // Generator torque is reflected back through the gearbox
        T_load = (coggingTorqueNm + T_elec) * gearRatio;
        if (omega < 0.01 && T_aero < T_load) {
          T_load = T_aero; // Static friction prevents starting if wind is too weak
          P_elec = 0;
        }
      } else {
        // Simple (%) Model
        const genScale = Math.pow(R, 3) * 50; 
        const T_elec = (generatorLoad / 100) * genScale * omegaGen;
        P_elec = T_elec * omegaGen;
        T_load = T_elec * gearRatio;
      }
      
      const NetTorque = T_aero - T_load;
      
      // Calculate Rotor Inertia (rough estimate: solid blades + hub)
      const massPerBlade = 5 * R; // 5kg per meter
      const inertia = B * (massPerBlade * R * R / 3) + (R * 2.0);
      
      // Angular acceleration (alpha)
      const alpha = NetTorque / inertia;
      
      // Integrate omega
      let nextOmega = omega + alpha * scaledDelta;
      if (nextOmega < 0) nextOmega = 0; // Prevent spinning backwards
      
      // Update RPM
      currentRpmRef.current = Math.max(0.1, (nextOmega * 30) / Math.PI);
      
      // Update Visual Rotation (Clockwise is negative Z in our 3D space)
      rotorRef.current.rotation.z -= nextOmega * scaledDelta;
      currentRotorAngle.current = rotorRef.current.rotation.z;

      // Throttle React state updates to 10Hz to prevent UI lag
      if (state.clock.elapsedTime - lastStateUpdateTime.current > 0.1) {
        lastStateUpdateTime.current = state.clock.elapsedTime;
        if (setLiveRpm) {
          setLiveRpm(currentRpmRef.current);
        }
        if (setLiveElectricalPowerW) {
          setLiveElectricalPowerW(P_elec);
        }
      }
    }
  });

  const segmentColors = useMemo(() => {
    if (!heatmapProperty || heatmapProperty === 'None' || !bemResults || !bemResults.segments) {
      return null; // Return null so Blade uses default color
    }

    // Determine min and max for normalization
    let minVal = Infinity;
    let maxVal = -Infinity;
    
    // Determine which property to read
    const propKeyMap = {
      'Torque': 'dQ',
      'Lift Coeff': 'cl',
      'Drag Coeff': 'cd',
      'Angle of Attack': 'alphaDeg'
    };
    
    const key = propKeyMap[heatmapProperty];
    if (!key) return null;

    bemResults.segments.forEach(seg => {
      if (seg[key] < minVal) minVal = seg[key];
      if (seg[key] > maxVal) maxVal = seg[key];
    });

    const range = maxVal - minVal;
    
    return bemResults.segments.map(seg => {
      const val = seg[key];
      const normalized = range === 0 ? 0.5 : (val - minVal) / range;
      return getHeatmapColor(normalized);
    });
  }, [bemResults, heatmapProperty]);

  const numBlades = bladeParams.numBlades || 3;
  const blades = [];
  for (let i = 0; i < numBlades; i++) {
    const angle = (i * 2 * Math.PI) / numBlades;
    blades.push(
      <group key={i} rotation={[0, 0, angle]}>
        <Blade 
          segments={segments} 
          showSpar={showSpar}
          carbonRodDia={bladeParams.carbonRodDia}
          carbonRodDepthPct={bladeParams.carbonRodDepthPct}
          leRadiusMod={bladeParams.leRadiusMod}
          teThicknessMm={bladeParams.teThicknessMm}
          teFlapDeg={bladeParams.teFlapDeg}
          segmentColors={segmentColors}
          centerBlade={false}
          bladePitch={bladePitch}
        />
      </group>
    );
  }

  const R = bladeParams.radiusMm / 1000;
  const hubRadius = Math.max(0.05, bladeParams.root.chordMm / 1000);
  const hubDepth = hubRadius * 1.5;
  const tunnelRadius = R * tunnelScale;
  const tunnelDepth = tunnelRadius * 2.0;

  return (
    <group>
      {/* Stationary Environment */}
      {/* Wind Tunnel */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[tunnelRadius, tunnelRadius, tunnelDepth, 64, 1, true]} />
        <meshPhysicalMaterial color="#aaddff" transparent={true} opacity={0.15} side={THREE.DoubleSide} depthWrite={false} roughness={0.1} transmission={0.9} />
      </mesh>

      {/* Chaotic Turbulent Smoke Physics */}
      {showParticles && (
        <TurbulentSmoke 
          R={R} 
          tunnelRadius={tunnelRadius}
          tunnelDepth={tunnelDepth} 
          simPlaying={simPlaying} 
          windSpeed={windSpeed} 
          rpm={rpm} 
          bemSegments={bemResults?.segments} 
          timeScale={timeScale} 
          currentRotorAngle={currentRotorAngle} 
          numBlades={bladeParams.numBlades || 3} 
          bladePitch={bladePitch}
        />
      )}

      {/* Rotating Rotor */}
      <group ref={rotorRef}>
        {/* Hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[hubRadius, hubRadius, hubDepth, 32]} />
          <meshStandardMaterial color="#444444" metalness={0.9} roughness={0.4} />
        </mesh>
        
        {/* Dynamic Blades */}
        {blades}
      </group>
      
      {/* Live Gearbox Integration */}
      <SimGearbox 
        gearStore={gearStore} 
        currentRotorAngle={currentRotorAngle} 
        position={[0, 0, hubDepth / 2 + 0.02]} 
        gearRatioRef={gearRatioRef}
      />
    </group>
  );
}

function SimGearbox({ gearStore, currentRotorAngle, position, gearRatioRef }) {
  if (!gearStore) return null;
  const levaParams = useGearParams(gearStore);
  const stagesData = useMemo(() => computeGearStages(levaParams), [levaParams]);
  
  React.useEffect(() => {
    if (stagesData && stagesData.length > 0 && gearRatioRef) {
      const lastStage = stagesData[stagesData.length - 1];
      gearRatioRef.current = Math.abs(lastStage.speedRatio);
    } else if (gearRatioRef) {
      gearRatioRef.current = 1.0;
    }
  }, [stagesData, gearRatioRef]);

  if (stagesData.length === 0) return null;
  
  return (
    // Scale down from mm to meters
    <group position={position} scale={[0.001, 0.001, 0.001]}>
      {stagesData.map((stage, idx) => (
        <GearStage 
          key={idx} 
          params={stage.params} 
          position={stage.position} 
          speedRatio={stage.speedRatio}
          rotationOffset={stage.rotationOffset}
          animate={false}
          linkedAngleRef={currentRotorAngle}
        />
      ))}
    </group>
  );
}

function TurbulentSmoke({ R, tunnelRadius, tunnelDepth, simPlaying, windSpeed, rpm, bemSegments, timeScale = 1.0, currentRotorAngle, numBlades, bladePitch }) {
  const meshRef = useRef();
  const count = 3000;
  
  const dummy = useMemo(() => new THREE.Object3D(), []);
  
  // Store physical state in flat typed arrays for massive performance
  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      // Spawn evenly in the front half of the tunnel
      const r = Math.random() * tunnelRadius * 0.95;
      const theta = Math.random() * Math.PI * 2;
      pos[i * 3 + 0] = Math.cos(theta) * r;
      pos[i * 3 + 1] = Math.sin(theta) * r;
      pos[i * 3 + 2] = (Math.random() - 1.0) * (tunnelDepth / 2); // -tunnelDepth/2 to 0
      
      vel[i * 3 + 0] = 0;
      vel[i * 3 + 1] = 0;
      vel[i * 3 + 2] = windSpeed;
    }
    return [pos, vel];
  }, [count, R, tunnelDepth, windSpeed]);

  const omega = (rpm * Math.PI) / 30; // radians per sec

  useFrame((state, delta) => {
    if (!simPlaying || !meshRef.current) return;
    
    // Safety cap on delta to prevent explosive physics drops
    const safeDelta = Math.min(delta, 0.05);
    const scaledDelta = safeDelta * timeScale;
    const t = state.clock.elapsedTime * timeScale;
    
    const B = numBlades;
    const rotorAngle = currentRotorAngle.current;
    
    // Pre-calculate current blade angles for hit detection
    const bladeAngles = [];
    for (let i = 0; i < B; i++) {
      let ba = (rotorAngle + i * (2 * Math.PI / B)) % (2 * Math.PI);
      if (ba < 0) ba += 2 * Math.PI;
      bladeAngles.push(ba);
    }
    
    const colorObj = new THREE.Color();
    const vecZ = new THREE.Vector3(0, 0, 1);
    const vecVel = new THREE.Vector3();
    
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      let x = positions[idx + 0];
      let y = positions[idx + 1];
      let z = positions[idx + 2];
      
      let vx = velocities[idx + 0];
      let vy = velocities[idx + 1];
      let vz = velocities[idx + 2];
      
      // Turbulence (Curl noise approximation)
      // Engages as the particle approaches and passes the rotor
      if (z > -R * 0.5) {
        // Pseudo-random chaotic curl fields
        const curlX = Math.sin(y * 3 + t * 4) * 0.15 * windSpeed;
        const curlY = Math.cos(x * 3 + t * 5) * 0.15 * windSpeed;
        vx += (curlX - vx) * 3 * scaledDelta;
        vy += (curlY - vy) * 3 * scaledDelta;
      }
      
      // Global wind tunnel acceleration
      vz += (windSpeed - vz) * 0.5 * scaledDelta;
      
      // Particle Polar Coordinates
      const rp = Math.sqrt(x * x + y * y);
      let tp = Math.atan2(y, x);
      if (tp < 0) tp += 2 * Math.PI;
      
      // 💥 BLADE COLLISION DETECTION 💥
      // Is particle passing through the rotor disk?
      if (z > -0.1 && z < 0.1 && rp < R) {
        // Angular thickness of a blade (simplified collision box)
        const bladeThickness = 0.15; 
        
        for (let b = 0; b < B; b++) {
          let diff = Math.abs(tp - bladeAngles[b]);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;
          
          if (diff < bladeThickness) {
            // WHACK! The particle was hit by the blade.
            
            // Find closest segment to get the aerodynamic twist
            let closestSeg = bemSegments?.[0];
            let minDiff = Infinity;
            if (bemSegments) {
              bemSegments.forEach(seg => {
                const d = Math.abs(seg.r - rp);
                if (d < minDiff) {
                  minDiff = d;
                  closestSeg = seg;
                }
              });
            }
            
            const betaDeg = (closestSeg ? closestSeg.twistDeg : 0) + bladePitch;
            const beta = (betaDeg * Math.PI) / 180;
            
            const vTangential = omega * rp; // How fast the blade is moving here
            
            // The blade ramps the air forward (Thrust)
            vz += vTangential * Math.sin(beta);
            
            // The blade drags the air sideways (Swirl)
            const swirlAmount = vTangential * Math.cos(beta);
            
            // Convert swirl (which pushes in direction of blade rotation) to XY vectors
            // Rotor rotates -Z (clockwise). Swirl pushes air clockwise.
            // Clockwise rotation of vector (x,y) -> (y, -x)
            const swirlVx = y * swirlAmount * 0.5;
            const swirlVy = -x * swirlAmount * 0.5;
            
            vx += swirlVx * scaledDelta;
            vy += swirlVy * scaledDelta;
            
            // Violent scattering / Tip vortex generation
            vx += (Math.random() - 0.5) * windSpeed;
            vy += (Math.random() - 0.5) * windSpeed;
            
            // Push it safely through so it doesn't get hit twice
            z = 0.11;
            break;
          }
        }
      }
      
      // Apply Velocity
      x += vx * scaledDelta;
      y += vy * scaledDelta;
      z += vz * scaledDelta;
      
      // Boundary Wrapping: Reset particle to front of tunnel
      if (z > tunnelDepth / 2 || rp > tunnelRadius * 1.2) {
        z = -tunnelDepth / 2;
        const theta = Math.random() * Math.PI * 2;
        const spawnR = Math.random() * tunnelRadius * 0.95;
        x = Math.cos(theta) * spawnR;
        y = Math.sin(theta) * spawnR;
        vx = 0;
        vy = 0;
        vz = windSpeed;
      }
      
      // Save State
      positions[idx + 0] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      
      velocities[idx + 0] = vx;
      velocities[idx + 1] = vy;
      velocities[idx + 2] = vz;
      
      // Update InstancedMesh Matrix
      dummy.position.set(x, y, z);
      
      const vLen = Math.sqrt(vx*vx + vy*vy + vz*vz);
      if (vLen > 0.01) {
        vecVel.set(vx/vLen, vy/vLen, vz/vLen);
        dummy.quaternion.setFromUnitVectors(vecZ, vecVel);
      }
      
      // Make particles stretch based on their speed (motion blur effect)
      dummy.scale.set(1, 1, Math.max(1, vLen / windSpeed * 2));
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      
      // Update Color (Heatmap)
      const vRatio = vLen / (windSpeed || 1);
      // Red (fast) to Blue (slow)
      const hue = Math.max(0, Math.min(240, (1 - vRatio) * 240));
      colorObj.setHSL(hue / 360, 1.0, 0.5);
      meshRef.current.setColorAt(i, colorObj);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
    meshRef.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      {/* Box geometry oriented along Z axis gives a great glowing spark/smoke effect */}
      <boxGeometry args={[R * 0.015, R * 0.015, R * 0.08]} />
      <meshBasicMaterial blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.6} />
    </instancedMesh>
  );
}
