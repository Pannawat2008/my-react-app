import { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import Blade from './Blade';
import { getHeatmapColor } from '../utils/heatmapColors';
import { useGearParams, computeGearStages } from '../hooks/useGearParams';
import { GearStage } from './GearView';
import { solveBEM } from '../engine/bem';
import { useSim } from '../context/SimContext';
import { useBlade } from '../context/BladeContext';
import { useGear } from '../context/GearContext';

export default function SimTurbine() {
  const { bladeParams, segments } = useBlade();
  const {
    simPlaying,
    windSpeed,
    bladePitch,
    timeScale,
    showParticles,
    tunnelScale,
    heatmapProperty,
    loadModel,
    generatorLoad,
    constantLoadGcm,
    ratedPowerW,
    ratedRpm,
    liveRpm,
    setLiveRpm,
    setLiveElectricalPowerW,
    setLiveAeroTorqueNm,
    setLiveThrustN,
  } = useSim();

  const { gearStore } = useGear();

  const rotorRef = useRef();
  const currentRotorAngle = useRef(0);
  const gearRatioRef = useRef(1.0);

  const currentRpmRef = useRef(0.1);
  const lastStateUpdateTime = useRef(0);
  const lastBemTime = useRef(0);
  const cachedAeroTorque = useRef(0);
  const cachedThrust = useRef(0);
  const cachedBemResults = useRef(null);

  const R = bladeParams.radiusMm / 1000;
  const B = bladeParams.numBlades || 3;

  // Real-time Physics integration loop (60 / 120 fps)
  useFrame((state, delta) => {
    if (!rotorRef.current || !simPlaying) return;

    const scaledDelta = Math.min(delta, 0.05) * timeScale;
    const now = state.clock.elapsedTime;

    // Run heavy BEM at 15Hz for smooth 60fps frame rate without stutter
    if (now - lastBemTime.current > 0.065 || !cachedBemResults.current) {
      lastBemTime.current = now;
      const res = solveBEM(segments, windSpeed, currentRpmRef.current, R, B, bladePitch);
      cachedBemResults.current = res;
      cachedAeroTorque.current = res.totalTorque;
      cachedThrust.current = res.totalThrust;
    }

    const T_aero = cachedAeroTorque.current;
    const omega = (currentRpmRef.current * Math.PI) / 30; // rad/s
    const gearRatio = gearRatioRef.current || 1.0;
    const omegaGen = omega * gearRatio;

    let T_load;
    let P_elec = 0;
    const coggingTorqueNm = (constantLoadGcm || 0) * 0.0000980665;

    if (loadModel === 'Constant Friction') {
      T_load = coggingTorqueNm * gearRatio;
      if (omega < 0.02 && T_aero < T_load) {
        T_load = T_aero;
      }
    } else if (loadModel === 'Realistic DC Motor') {
      const ratedOmega = (ratedRpm * Math.PI) / 30;
      const T_elec = ratedOmega > 0 ? (ratedPowerW / (ratedOmega * ratedOmega)) * omegaGen : 0;
      P_elec = T_elec * omegaGen;
      T_load = (coggingTorqueNm + T_elec) * gearRatio;

      if (omega < 0.02 && T_aero < T_load) {
        T_load = T_aero;
        P_elec = 0;
      }
    } else {
      const genScale = Math.pow(R, 3) * 45;
      const T_elec = (generatorLoad / 100) * genScale * (omegaGen / 20);
      P_elec = T_elec * omegaGen;
      T_load = T_elec * gearRatio;
    }

    const netTorque = T_aero - T_load;
    const massPerBlade = 4.5 * R;
    const inertia = Math.max(0.1, B * (massPerBlade * R * R * 0.33) + R * 1.5);
    const alpha = netTorque / inertia;

    let nextOmega = omega + alpha * scaledDelta;
    if (nextOmega < 0) nextOmega = 0;

    currentRpmRef.current = Math.max(0.05, (nextOmega * 30) / Math.PI);

    // Visual rotation around Z axis
    rotorRef.current.rotation.z -= nextOmega * scaledDelta;
    currentRotorAngle.current = rotorRef.current.rotation.z;

    // Broadcast UI telemetry at 10Hz
    if (now - lastStateUpdateTime.current > 0.1) {
      lastStateUpdateTime.current = now;
      setLiveRpm(currentRpmRef.current);
      setLiveElectricalPowerW(P_elec);
      setLiveAeroTorqueNm(T_aero);
      setLiveThrustN(cachedThrust.current);
    }
  });

  // Dynamic Heatmap colors
  const segmentColors = useMemo(() => {
    if (!heatmapProperty || heatmapProperty === 'None' || !segments || segments.length === 0) {
      return null;
    }

    const propKeyMap = {
      'Torque': 'dQ',
      'Lift Coeff': 'cl',
      'Drag Coeff': 'cd',
      'Angle of Attack': 'alphaDeg',
      'Induction': 'a',
    };

    const key = propKeyMap[heatmapProperty];
    if (!key) return null;

    const res = solveBEM(segments, windSpeed, liveRpm || 0.1, R, B, bladePitch);
    const segs = res?.segments || [];
    let minVal = Infinity;
    let maxVal = -Infinity;

    segs.forEach((s) => {
      if (s[key] < minVal) minVal = s[key];
      if (s[key] > maxVal) maxVal = s[key];
    });

    const range = maxVal - minVal || 1;

    return segs.map((s) => {
      const norm = (s[key] - minVal) / range;
      return getHeatmapColor(norm);
    });
  }, [heatmapProperty, segments, windSpeed, liveRpm, R, B, bladePitch]);

  const numBlades = bladeParams.numBlades || 3;
  const blades = [];
  for (let i = 0; i < numBlades; i++) {
    const angle = (i * 2 * Math.PI) / numBlades;
    blades.push(
      <group key={i} rotation={[0, 0, angle]}>
        <Blade
          segments={segments}
          showSpar={false}
          viewMode="solid"
          showDimensions={false}
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

  const hubRadius = Math.max(0.06, (bladeParams.root.chordMm / 1000) * 0.9);
  const hubDepth = hubRadius * 1.4;
  const tunnelRadius = R * (tunnelScale || 2.2);
  const tunnelDepth = tunnelRadius * 2.2;
  const towerHeight = R * 1.6;
  const towerRadiusBottom = R * 0.08;
  const towerRadiusTop = R * 0.05;

  return (
    <group>
      {/* ── 3D Turbine Nacelle & Tower ── */}
      <group position={[0, 0, hubDepth * 0.8]}>
        {/* Streamlined Nacelle Housing */}
        <mesh position={[0, 0, R * 0.15]} rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[hubRadius * 0.85, R * 0.35, 16, 24]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
        </mesh>

        {/* Tubular Steel Turbine Tower */}
        <mesh position={[0, -towerHeight / 2, R * 0.15]}>
          <cylinderGeometry args={[towerRadiusTop, towerRadiusBottom, towerHeight, 32]} />
          <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
        </mesh>
      </group>

      {/* Aerodynamic Wind Tunnel Shell */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <cylinderGeometry args={[tunnelRadius, tunnelRadius, tunnelDepth, 64, 1, true]} />
        <meshPhysicalMaterial
          color="#38bdf8"
          transparent={true}
          opacity={0.08}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={0.1}
          transmission={0.9}
        />
      </mesh>

      {/* Chaotic Smoke Streamlines & Helical Tip Vortices */}
      {showParticles && (
        <TurbulentSmoke
          R={R}
          tunnelRadius={tunnelRadius}
          tunnelDepth={tunnelDepth}
          simPlaying={simPlaying}
          windSpeed={windSpeed}
          rpm={liveRpm}
          timeScale={timeScale}
          currentRotorAngle={currentRotorAngle}
          numBlades={numBlades}
          bladePitch={bladePitch}
        />
      )}

      {/* Rotating Turbine Rotor */}
      <group ref={rotorRef}>
        {/* Hub Nose Cone */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[hubRadius * 0.3, hubRadius, hubDepth, 32]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.25} />
        </mesh>

        {blades}
      </group>

      {/* Live Drivetrain Gearbox */}
      <SimGearbox
        gearStore={gearStore}
        currentRotorAngle={currentRotorAngle}
        position={[0, 0, hubDepth / 2 + 0.04]}
        gearRatioRef={gearRatioRef}
      />
    </group>
  );
}

function SimGearbox({ gearStore, currentRotorAngle, position, gearRatioRef }) {
  const levaParams = useGearParams(gearStore);
  const stagesData = useMemo(() => {
    if (!gearStore) return [];
    return computeGearStages(levaParams);
  }, [gearStore, levaParams]);

  useEffect(() => {
    if (stagesData && stagesData.length > 0 && gearRatioRef) {
      const lastStage = stagesData[stagesData.length - 1];
      gearRatioRef.current = Math.abs(lastStage.speedRatio);
    } else if (gearRatioRef) {
      gearRatioRef.current = 1.0;
    }
  }, [stagesData, gearRatioRef]);

  if (!gearStore || stagesData.length === 0) return null;

  return (
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

function createInitialParticles(count, R, tunnelRadius, tunnelDepth, windSpeed) {
  const pos = new Float32Array(count * 3);
  const vel = new Float32Array(count * 3);
  const types = new Uint8Array(count); // 0 = ambient smoke, 1 = tip vortex particle

  for (let i = 0; i < count; i++) {
    const isVortex = i % 4 === 0;
    types[i] = isVortex ? 1 : 0;

    const pseudo1 = ((i * 1337 + 7) % 1000) / 1000;
    const pseudo2 = ((i * 7919 + 13) % 1000) / 1000;
    const pseudo3 = ((i * 4973 + 23) % 1000) / 1000;

    const r = isVortex ? R * (0.95 + pseudo1 * 0.1) : pseudo1 * tunnelRadius * 0.95;
    const theta = pseudo2 * Math.PI * 2;
    pos[i * 3 + 0] = Math.cos(theta) * r;
    pos[i * 3 + 1] = Math.sin(theta) * r;
    pos[i * 3 + 2] = (pseudo3 - 1.0) * (tunnelDepth / 2);

    vel[i * 3 + 0] = 0;
    vel[i * 3 + 1] = 0;
    vel[i * 3 + 2] = windSpeed;
  }
  return { positions: pos, velocities: vel, types };
}

function TurbulentSmoke({
  R,
  tunnelRadius,
  tunnelDepth,
  simPlaying,
  windSpeed,
  rpm,
  timeScale = 1.0,
  currentRotorAngle,
  numBlades,
  bladePitch,
}) {
  const meshRef = useRef();
  const count = 4800;
  const dummyRef = useRef(new THREE.Object3D());
  const dummy = dummyRef.current;
  const particlesRef = useRef(null);
  if (particlesRef.current == null) {
    particlesRef.current = createInitialParticles(count, R, tunnelRadius, tunnelDepth, windSpeed);
  }

  useFrame((state, delta) => {
    if (!simPlaying || !meshRef.current || !particlesRef.current) return;
    const { positions, velocities, types } = particlesRef.current;

    const safeDelta = Math.min(delta, 0.05);
    const scaledDelta = safeDelta * timeScale;
    const t = state.clock.elapsedTime * timeScale;

    const B = numBlades;
    const rotorAngle = currentRotorAngle.current;
    const omega = (rpm * Math.PI) / 30;

    const bladeAngles = [];
    for (let i = 0; i < B; i++) {
      let ba = (rotorAngle + i * ((2 * Math.PI) / B)) % (2 * Math.PI);
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

      // Swirling aerodynamic wake turbulence behind rotor
      if (z > -R * 0.3) {
        const curlX = Math.sin(y * 3 + t * 4) * 0.18 * windSpeed;
        const curlY = Math.cos(x * 3 + t * 5) * 0.18 * windSpeed;
        vx += (curlX - vx) * 3 * scaledDelta;
        vy += (curlY - vy) * 3 * scaledDelta;
      }

      vz += (windSpeed - vz) * 0.5 * scaledDelta;

      const rp = Math.sqrt(x * x + y * y);
      let tp = Math.atan2(y, x);
      if (tp < 0) tp += 2 * Math.PI;

      // Helical Tip Vortex induction
      if (types[i] === 1 && z > 0) {
        const vortexSwirl = (omega * R * 0.8) / Math.max(0.5, z * 0.5);
        vx += -Math.sin(tp) * vortexSwirl * scaledDelta;
        vy += Math.cos(tp) * vortexSwirl * scaledDelta;
      }

      // Blade contact impulse and tangential swirl
      if (z > -0.12 && z < 0.12 && rp < R) {
        const bladeThickness = 0.2;

        for (let b = 0; b < B; b++) {
          let diff = Math.abs(tp - bladeAngles[b]);
          if (diff > Math.PI) diff = 2 * Math.PI - diff;

          if (diff < bladeThickness) {
            const vTangential = omega * rp;
            const beta = ((10 + bladePitch) * Math.PI) / 180;

            vz += vTangential * Math.sin(beta);
            const swirlAmount = vTangential * Math.cos(beta);

            vx += y * swirlAmount * 0.5 * scaledDelta;
            vy += -x * swirlAmount * 0.5 * scaledDelta;

            z = 0.13;
            break;
          }
        }
      }

      x += vx * scaledDelta;
      y += vy * scaledDelta;
      z += vz * scaledDelta;

      // Wrap boundary
      if (z > tunnelDepth / 2 || rp > tunnelRadius * 1.15) {
        z = -tunnelDepth / 2;
        const isVortex = types[i] === 1;
        const spawnR = isVortex ? R * (0.95 + Math.random() * 0.1) : Math.random() * tunnelRadius * 0.95;
        const theta = Math.random() * Math.PI * 2;
        x = Math.cos(theta) * spawnR;
        y = Math.sin(theta) * spawnR;
        vx = 0;
        vy = 0;
        vz = windSpeed;
      }

      positions[idx + 0] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;

      velocities[idx + 0] = vx;
      velocities[idx + 1] = vy;
      velocities[idx + 2] = vz;

      dummy.position.set(x, y, z);
      const vLen = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (vLen > 0.01) {
        vecVel.set(vx / vLen, vy / vLen, vz / vLen);
        dummy.quaternion.setFromUnitVectors(vecZ, vecVel);
      }
      dummy.scale.set(1, 1, Math.max(1, (vLen / Math.max(1, windSpeed)) * 2.2));
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Color coding: Tip vortex filaments are glowing cyan, stream particles are velocity gradient
      if (types[i] === 1) {
        colorObj.set('#38bdf8');
      } else {
        const vRatio = vLen / (windSpeed || 1);
        const hue = Math.max(0, Math.min(240, (1 - vRatio) * 240));
        colorObj.setHSL(hue / 360, 1.0, 0.5);
      }
      meshRef.current.setColorAt(i, colorObj);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true;
    }
  });

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <boxGeometry args={[R * 0.012, R * 0.012, R * 0.09]} />
      <meshBasicMaterial blending={THREE.AdditiveBlending} depthWrite={false} transparent opacity={0.7} />
    </instancedMesh>
  );
}
