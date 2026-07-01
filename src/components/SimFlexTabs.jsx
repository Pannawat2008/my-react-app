import React, { useMemo } from 'react';
import { useControls, LevaPanel, useCreateStore } from 'leva';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Environment } from '@react-three/drei';
import SimTurbine from './SimTurbine';
import { findBestGearStages } from '../utils/gearOptimizer';

/* ──────────────────────────────────────────── */
/*              SIM CONTROLS TAB                */
/* ──────────────────────────────────────────── */
export function SimControlsTab({ ctx }) {
  const { 
    windSpeed, setWindSpeed, 
    heatmapProperty, setHeatmapProperty,
    simPlaying, setSimPlaying,
    bladePitch, setBladePitch,
    timeScale, setTimeScale,
    showParticles, setShowParticles,
    tunnelScale, setTunnelScale,
    bladeParams, setBladeParams,
    rpm, tsr, generatorLoad, setGeneratorLoad,
    loadModel, setLoadModel, constantLoadGcm, setConstantLoadGcm,
    ratedPowerW, setRatedPowerW, ratedRpm, setRatedRpm,
    gearStore, powerCurve
  } = ctx;

  const store = useCreateStore();

  useControls(
    {
      'Wind Speed (m/s)': {
        value: windSpeed,
        min: 1,
        max: 25,
        step: 0.01,
        onChange: (v) => setWindSpeed(v)
      },
      'Num Blades': {
        value: bladeParams.numBlades || 3,
        min: 1,
        max: 6,
        step: 1,
        onChange: (v) => setBladeParams(prev => ({ ...prev, numBlades: v }))
      },
      'Heatmap Property': {
        value: heatmapProperty,
        options: ['None', 'Torque', 'Lift Coeff', 'Drag Coeff', 'Angle of Attack'],
        onChange: (v) => setHeatmapProperty(v)
      },
      'Collective Pitch (deg)': {
        value: bladePitch,
        min: -10,
        max: 90,
        step: 1,
        onChange: (v) => setBladePitch(v)
      },
      'Load Model': {
        value: loadModel,
        options: ['Simple (%)', 'Constant Friction', 'Realistic DC Motor'],
        onChange: (v) => setLoadModel(v)
      },
      'Generator Load (%)': {
        value: generatorLoad,
        min: 0,
        max: 100,
        step: 1,
        onChange: (v) => setGeneratorLoad(v),
        render: (get) => get('Load Model') === 'Simple (%)'
      },
      'Cogging Torque (g·cm)': {
        value: constantLoadGcm,
        min: 0,
        max: 500,
        step: 0.1,
        onChange: (v) => setConstantLoadGcm(v),
        render: (get) => get('Load Model') !== 'Simple (%)'
      },
      'Rated Power (Watts)': {
        value: ratedPowerW,
        min: 0.1,
        max: 50,
        step: 0.1,
        onChange: (v) => setRatedPowerW(v),
        render: (get) => get('Load Model') === 'Realistic DC Motor'
      },
      'Rated RPM': {
        value: ratedRpm,
        min: 100,
        max: 5000,
        step: 10,
        onChange: (v) => setRatedRpm(v),
        render: (get) => get('Load Model') === 'Realistic DC Motor'
      },
      'Tunnel Size Multiplier': {
        value: tunnelScale,
        min: 1.0,
        max: 5.0,
        step: 0.1,
        onChange: (v) => setTunnelScale(v)
      },
      'Show Smoke Particles': {
        value: showParticles,
        onChange: (v) => setShowParticles(v)
      },
      'Play Animation': {
        value: simPlaying,
        onChange: (v) => setSimPlaying(v)
      },
      'Time Scale': {
        value: timeScale,
        min: 0.1,
        max: 2.0,
        step: 0.1,
        onChange: (v) => setTimeScale(v)
      }
    },
    { store },
    [windSpeed, heatmapProperty, simPlaying, bladeParams.numBlades, bladePitch, timeScale, showParticles, tunnelScale]
  );

  return (
    <div className="tab-container" style={{ padding: '0px' }}>
      <div className="tab-header" style={{ padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
        <h3 style={{ margin: 0, marginBottom: '8px' }}>Simulation Controls</h3>
        <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          Real-time simulation inputs.
        </p>
      </div>
      
      <div style={{ padding: '16px' }}>
        <div style={{ marginBottom: '16px', background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Rotor RPM:</span>
            <span style={{ fontWeight: 'bold' }}>{rpm.toFixed(1)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>TSR:</span>
            <span style={{ fontWeight: 'bold' }}>{tsr.toFixed(1)}</span>
          </div>
        </div>

        <button 
          className="panel-btn primary"
          style={{ width: '100%', marginBottom: '16px', padding: '10px' }}
          onClick={() => {
            const R = bladeParams.radiusMm / 1000;
            const optimalRpm = (tsr * windSpeed * 60) / (2 * Math.PI * R);
            
            if (optimalRpm <= 0) {
              alert("Wind speed or TSR is too low to optimize.");
              return;
            }
            
            const targetRatio = ratedRpm / optimalRpm;
            const best = findBestGearStages(targetRatio);
            
            if (gearStore) {
              // Programmatically update Leva store
              const updates = { 'Global Settings.numStages': best.stages.length };
              
              best.stages.forEach((stage, idx) => {
                updates[`Stage ${idx + 1}.Gear Geometry.s${idx}_numTeeth`] = stage.numTeeth;
                updates[`Stage ${idx + 1}.Pinion.s${idx}_pinionTeeth`] = stage.pinionTeeth;
                updates[`Stage ${idx + 1}.Pinion.s${idx}_hasPinion`] = true; // Ensure pinion is enabled
              });
              
              // Apply to Leva state (Note: using undocumented internal zustand store update for Leva)
              // Wait, leva's set method is store.set(updates) but store is passed in as prop to useControls.
              // If it's a zustand store, we can use setState or store.set
              try {
                if (gearStore.set) {
                  gearStore.set(updates);
                } else if (gearStore.setState) {
                  // Direct zustand store mutation may not trigger leva UI updates perfectly, but we'll try
                  // Actually Leva exposes a context or we can just update the data path.
                  const currentData = gearStore.getState().data;
                  Object.keys(updates).forEach(key => {
                    if (currentData[key]) {
                      gearStore.getState().setValueAtPath(key, updates[key], true);
                    }
                  });
                }
              } catch (e) {
                console.error("Failed to update gear store programmatically", e);
                alert("Calculated Best Gear Ratio: " + best.ratio.toFixed(2) + " (" + best.stages.map(s => s.numTeeth + ":" + s.pinionTeeth).join(', ') + "). Please enter this manually in the Gear Settings tab.");
                return;
              }
              
              alert(`Optimized Gearbox Applied!\n\nTarget Ratio: ${targetRatio.toFixed(2)}:1\nActual Ratio: ${best.ratio.toFixed(2)}:1\nStages: ${best.stages.map(s => s.numTeeth + "T ring / " + s.pinionTeeth + "T pinion").join(', ')}`);
            }
          }}
        >
          ⚙️ Auto-Optimize Gearbox Ratio
        </button>

        <LevaPanel 
          store={store} 
          fill 
          flat 
          titleBar={false}
          theme={{
            colors: {
              elevation1: 'var(--bg-card)',
              elevation2: 'var(--bg-body)',
              elevation3: 'var(--bg-sidebar-header)',
              accent1: 'var(--primary)',
              accent2: 'var(--primary-hover)',
              accent3: 'var(--primary)',
              highlight1: 'var(--text-secondary)',
              highlight2: 'var(--text-primary)',
              highlight3: 'var(--text-primary)',
              vivid1: 'var(--primary)',
            },
            radii: { sm: '4px', md: '6px', lg: '8px' }
          }} 
        />
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────── */
/*              SIM VIEWPORT TAB                */
/* ──────────────────────────────────────────── */
export function SimViewportTab({ ctx }) {
  const {
    canvasBg, gridSection, gridCell,
    segments, bemResults, rpm, heatmapProperty, showSpar, bladeParams, simPlaying, windSpeed, bladePitch, timeScale, showParticles, tunnelScale, gearStore, generatorLoad, loadModel, constantLoadGcm, ratedPowerW, ratedRpm, setLiveRpm, setLiveElectricalPowerW, liveElectricalPowerW, overlayMinimized, setOverlayMinimized
  } = ctx;

  const R = bladeParams.radiusMm / 1000;
  
  // Format power nicely (Watts vs kW)
  const formatPower = (watts) => {
    if (watts < 1000) return { val: watts.toFixed(1), unit: 'W' };
    return { val: (watts / 1000).toFixed(2), unit: 'kW' };
  };

  const aeroPower = formatPower(bemResults.totalPower);
  const elecPower = formatPower(liveElectricalPowerW || 0);

  return (
    <div className="tab-container viewport-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
      
      {/* ── LIVE STATS OVERLAY ── */}
      <div className={`overlay-bar ${overlayMinimized ? 'minimized' : ''}`} style={{ zIndex: 10 }}>
        {!overlayMinimized && (
          <div className="overlay-left">
            {bemResults.segments.some(s => s.stallDetected) && (
              <div className="stall-box">
                <strong>⚠ Stall Detected!</strong> Turbine is struggling.
              </div>
            )}
          </div>
        )}
        <div className="overlay-right">
          <button 
            className="overlay-toggle" 
            onClick={() => setOverlayMinimized(!overlayMinimized)}
          >
            {overlayMinimized ? "👁️ Show Live Stats" : "👁️ Hide Stats"}
          </button>
          {!overlayMinimized && (
            <div className="power-card glass">
              <div className="power-label" style={{ color: 'var(--primary)' }}>Electrical Output</div>
              <div className="power-value" style={{ color: 'var(--primary)' }}>
                {elecPower.val}
                <span className="power-unit"> {elecPower.unit}</span>
              </div>
              <div className="power-stats">
                <div className="power-stat">
                  <span className="power-stat-label">Aero Power</span>
                  <span className="power-stat-value">{aeroPower.val} {aeroPower.unit}</span>
                </div>
                <div className="power-stat-divider" />
                <div className="power-stat">
                  <span className="power-stat-label">Live RPM</span>
                  <span className="power-stat-value">{rpm.toFixed(1)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <Canvas
        camera={{ position: [0, 0, R * 2.5], fov: 45 }}
        style={{ background: canvasBg, width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 10]} intensity={0.8} />
        <directionalLight position={[-10, -10, -10]} intensity={0.3} />
        <Environment preset="city" />

        <SimTurbine 
          segments={segments} 
          bemResults={bemResults} 
          rpm={rpm} 
          heatmapProperty={heatmapProperty} 
          showSpar={showSpar}
          bladeParams={bladeParams}
          simPlaying={simPlaying}
          windSpeed={windSpeed}
          bladePitch={bladePitch}
          timeScale={timeScale}
          showParticles={showParticles}
          tunnelScale={tunnelScale}
          gearStore={gearStore}
          generatorLoad={generatorLoad}
          loadModel={loadModel}
          constantLoadGcm={constantLoadGcm}
          ratedPowerW={ratedPowerW}
          ratedRpm={ratedRpm}
          setLiveRpm={setLiveRpm}
          setLiveElectricalPowerW={setLiveElectricalPowerW}
        />

        {/* 3D Grid floor */}
        <Grid
          position={[0, -R * 1.1, 0]}
          args={[R * 4, R * 4]}
          cellSize={1}
          cellThickness={1}
          cellColor={gridCell}
          sectionSize={5}
          sectionThickness={1.5}
          sectionColor={gridSection}
          fadeDistance={R * 3}
          fadeStrength={1}
        />

        <OrbitControls makeDefault />
      </Canvas>
      
      {/* Overlay legend for Heatmap */}
      {heatmapProperty !== 'None' && (
        <div style={{
          position: 'absolute',
          bottom: 20,
          right: 20,
          background: 'var(--bg-card)',
          padding: '12px',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
          pointerEvents: 'none'
        }}>
          <div style={{ marginBottom: 8, fontSize: '0.9rem', fontWeight: 'bold' }}>{heatmapProperty}</div>
          <div style={{ display: 'flex', width: 200, height: 10, borderRadius: 5, background: 'linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)' }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            <span>Min</span>
            <span>Max</span>
          </div>
        </div>
      )}
    </div>
  );
}
