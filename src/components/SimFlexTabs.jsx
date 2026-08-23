import { useControls, LevaPanel, useCreateStore } from 'leva';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment, ContactShadows } from '@react-three/drei';
import SimTurbine from './SimTurbine';
import { useSim } from '../context/SimContext';
import { useBlade } from '../context/BladeContext';
import { useGear } from '../context/GearContext';
import { useTheme } from '../hooks/useTheme';

/* ──────────────────────────────────────────── */
/*              SIM CONTROLS TAB                */
/* ──────────────────────────────────────────── */
export function SimControlsTab() {
  const {
    windSpeed,
    setWindSpeed,
    heatmapProperty,
    setHeatmapProperty,
    simPlaying,
    setSimPlaying,
    bladePitch,
    setBladePitch,
    timeScale,
    setTimeScale,
    showParticles,
    setShowParticles,
    tunnelScale,
    setTunnelScale,
    loadModel,
    setLoadModel,
    generatorLoad,
    setGeneratorLoad,
    constantLoadGcm,
    setConstantLoadGcm,
    ratedPowerW,
    setRatedPowerW,
    ratedRpm,
    setRatedRpm,
    liveRpm,
    liveElectricalPowerW,
    liveAeroTorqueNm,
    liveThrustN,
  } = useSim();

  const { bladeParams, designTsr } = useBlade();
  const { autoOptimizeGearRatio } = useGear();

  const store = useCreateStore();

  useControls(
    {
      'Wind Speed (m/s)': {
        value: windSpeed,
        min: 1,
        max: 25,
        step: 0.5,
        onChange: (v) => setWindSpeed(v),
      },
      'Blade Pitch (°)': {
        value: bladePitch,
        min: -10,
        max: 80,
        step: 1,
        onChange: (v) => setBladePitch(v),
      },
      'Heatmap Overlay': {
        value: heatmapProperty,
        options: ['None', 'Torque', 'Lift Coeff', 'Drag Coeff', 'Angle of Attack', 'Induction'],
        onChange: (v) => setHeatmapProperty(v),
      },
      'Drivetrain Load Model': {
        value: loadModel,
        options: ['Realistic DC Motor', 'Constant Friction', 'Simple (%)'],
        onChange: (v) => setLoadModel(v),
      },
      'Generator Load (%)': {
        value: generatorLoad,
        min: 0,
        max: 100,
        step: 1,
        onChange: (v) => setGeneratorLoad(v),
        render: (get) => get('Drivetrain Load Model') === 'Simple (%)',
      },
      'Cogging Friction (g·cm)': {
        value: constantLoadGcm,
        min: 0,
        max: 300,
        step: 1,
        onChange: (v) => setConstantLoadGcm(v),
        render: (get) => get('Drivetrain Load Model') !== 'Simple (%)',
      },
      'Generator Rated Power (W)': {
        value: ratedPowerW,
        min: 0.5,
        max: 100,
        step: 0.5,
        onChange: (v) => setRatedPowerW(v),
        render: (get) => get('Drivetrain Load Model') === 'Realistic DC Motor',
      },
      'Generator Rated RPM': {
        value: ratedRpm,
        min: 100,
        max: 5000,
        step: 50,
        onChange: (v) => setRatedRpm(v),
        render: (get) => get('Drivetrain Load Model') === 'Realistic DC Motor',
      },
      'Tunnel Multiplier': {
        value: tunnelScale,
        min: 1.2,
        max: 4.0,
        step: 0.1,
        onChange: (v) => setTunnelScale(v),
      },
      'Smoke Streamlines': {
        value: showParticles,
        onChange: (v) => setShowParticles(v),
      },
      'Sim Animation Active': {
        value: simPlaying,
        onChange: (v) => setSimPlaying(v),
      },
      'Time Acceleration': {
        value: timeScale,
        min: 0.2,
        max: 3.0,
        step: 0.1,
        onChange: (v) => setTimeScale(v),
      },
    },
    { store },
    [windSpeed, bladePitch, heatmapProperty, loadModel, generatorLoad, constantLoadGcm, ratedPowerW, ratedRpm, tunnelScale, showParticles, simPlaying, timeScale]
  );

  const handleAutoGearMatch = () => {
    const R = bladeParams.radiusMm / 1000;
    const optimalRotorRpm = (designTsr * windSpeed * 60) / (2 * Math.PI * Math.max(0.1, R));
    if (optimalRotorRpm <= 0) return;

    const targetRatio = ratedRpm / optimalRotorRpm;
    const result = autoOptimizeGearRatio(targetRatio);

    if (result) {
      alert(`⚙️ Gear Ratio Optimized!\n\nTarget Ratio: ${targetRatio.toFixed(2)}:1\nAchieved Ratio: ${result.ratio.toFixed(2)}:1\nStages: ${result.stages.map((s) => `${s.numTeeth}T ring / ${s.pinionTeeth}T pinion`).join(', ')}`);
    }
  };

  return (
    <div className="sidebar-scroll" style={{ height: '100%', overflowY: 'auto' }}>
      {/* Live Telemetry Card */}
      <div className="sim-telemetry-panel">
        <div className="sim-telemetry-header">
          <span>⚡ Live Aerodynamic Telemetry</span>
          <span className={`sim-pulse-badge ${simPlaying ? 'active' : ''}`}>
            {simPlaying ? 'LIVE' : 'PAUSED'}
          </span>
        </div>
        <div className="sim-telemetry-grid">
          <div className="sim-metric">
            <span className="sim-metric-label">Rotor Speed</span>
            <span className="sim-metric-val">{liveRpm.toFixed(1)} <small>RPM</small></span>
          </div>
          <div className="sim-metric">
            <span className="sim-metric-label">Electrical Power</span>
            <span className="sim-metric-val">
              {liveElectricalPowerW < 1000 ? `${liveElectricalPowerW.toFixed(1)} W` : `${(liveElectricalPowerW / 1000).toFixed(2)} kW`}
            </span>
          </div>
          <div className="sim-metric">
            <span className="sim-metric-label">Aero Torque</span>
            <span className="sim-metric-val">{liveAeroTorqueNm.toFixed(2)} <small>N·m</small></span>
          </div>
          <div className="sim-metric">
            <span className="sim-metric-label">Axial Thrust</span>
            <span className="sim-metric-val">{liveThrustN.toFixed(1)} <small>N</small></span>
          </div>
        </div>
      </div>

      <button className="optimize-btn" style={{ margin: '14px 0 16px' }} onClick={handleAutoGearMatch}>
        <span>⚙️</span> Auto-Match Gearbox to Generator
      </button>

      <div className="sim-leva-wrapper">
        <LevaPanel
          store={store}
          fill
          flat
          titleBar={false}
          theme={{
            colors: {
              elevation1: 'var(--bg-card)',
              elevation2: 'var(--bg-app)',
              elevation3: 'var(--bg-sidebar-header)',
              accent1: 'var(--accent)',
              accent2: 'var(--accent-light)',
              accent3: 'var(--accent)',
              highlight1: 'var(--text-secondary)',
              highlight2: 'var(--text-primary)',
              highlight3: 'var(--text-primary)',
            },
          }}
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────── */
/*              SIM VIEWPORT TAB                */
/* ──────────────────────────────────────────── */
export function SimViewportTab() {
  const { currentTheme } = useTheme();
  const {
    liveRpm,
    liveElectricalPowerW,
    liveAeroTorqueNm,
    heatmapProperty,
    overlayMinimized,
    setOverlayMinimized,
  } = useSim();

  const { bladeParams, designBemResults } = useBlade();
  const R = bladeParams.radiusMm / 1000;

  const canvasBg = currentTheme.vars['--3d-bg'] || '#090d16';
  const gridSection = currentTheme.vars['--grid-section'] || '#1e293b';
  const gridCell = currentTheme.vars['--grid-cell'] || '#0f172a';

  const stallDetected = designBemResults.segments?.some((s) => s.stallDetected);

  return (
    <div className="canvas-area" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* ── Overlay Bar ── */}
      <div className="overlay-bar">
        <div className="overlay-left">
          {stallDetected && !overlayMinimized && (
            <div className="stall-box">
              <strong>⚠ Aerodynamic Stall Warning</strong> High angle of attack inducing separation.
            </div>
          )}
        </div>

        <div className="overlay-right">
          <div className={`power-card glass ${overlayMinimized ? 'collapsed' : ''}`}>
            <div className="power-card-header" onClick={() => setOverlayMinimized(!overlayMinimized)}>
              <div className="power-label">
                <span className="power-status-dot" />
                Live Generator Power
              </div>
              <button
                className="power-collapse-btn"
                title={overlayMinimized ? 'Expand Live Stats' : 'Collapse Live Stats'}
                onClick={(e) => {
                  e.stopPropagation();
                  setOverlayMinimized(!overlayMinimized);
                }}
              >
                {overlayMinimized ? '▾' : '▴'}
              </button>
            </div>

            {!overlayMinimized ? (
              <div className="power-card-body animate-fadeIn">
                <div className="power-value">
                  {liveElectricalPowerW < 1000
                    ? `${liveElectricalPowerW.toFixed(1)}`
                    : `${(liveElectricalPowerW / 1000).toFixed(2)}`}
                  <span className="power-unit">{liveElectricalPowerW < 1000 ? ' W' : ' kW'}</span>
                </div>
                <div className="power-stats">
                  <div className="power-stat">
                    <span className="power-stat-label">Live RPM</span>
                    <span className="power-stat-value">{liveRpm.toFixed(1)}</span>
                  </div>
                  <div className="power-stat-divider" />
                  <div className="power-stat">
                    <span className="power-stat-label">Torque</span>
                    <span className="power-stat-value">{liveAeroTorqueNm.toFixed(1)} N·m</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="power-mini-readout animate-fadeIn" onClick={() => setOverlayMinimized(false)}>
                <span className="power-mini-val">
                  {liveElectricalPowerW < 1000
                    ? `${liveElectricalPowerW.toFixed(0)} W`
                    : `${(liveElectricalPowerW / 1000).toFixed(1)} kW`}
                </span>
                <span className="power-mini-chip">{liveRpm.toFixed(0)} RPM</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3D Simulation Canvas */}
      <Canvas camera={{ position: [0, 0, Math.max(3, R * 2.6)], fov: 45 }}>
        <color attach="background" args={[canvasBg]} />
        <ambientLight intensity={0.9} />
        <directionalLight position={[10, 15, 10]} intensity={1.8} />
        <directionalLight position={[-10, -10, -10]} intensity={0.6} color="#38bdf8" />
        <Environment preset="city" />

        <SimTurbine />

        <ContactShadows position={[0, -R * 1.15, 0]} opacity={0.4} scale={R * 4} blur={2.5} far={R * 3} />
        <Grid
          position={[0, -R * 1.15, 0]}
          args={[R * 4, R * 4]}
          cellSize={1}
          cellThickness={1}
          cellColor={gridCell}
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor={gridSection}
          fadeDistance={R * 4}
        />

        <OrbitControls makeDefault />
      </Canvas>

      {/* Heatmap Legend */}
      {heatmapProperty !== 'None' && (
        <div className="sim-heatmap-legend glass">
          <div className="sim-heatmap-title">Heatmap: {heatmapProperty}</div>
          <div className="sim-heatmap-bar" />
          <div className="sim-heatmap-labels">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      )}
    </div>
  );
}
