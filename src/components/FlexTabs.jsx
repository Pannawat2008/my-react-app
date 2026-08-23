import { Suspense, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid } from '@react-three/drei';
import { LevaPanel } from 'leva';
import ControlsPanel from './ControlsPanel';
import ChartsPanel from './ChartsPanel';
import ExportPanel from './ExportPanel';
import Blade from './Blade';
import GearView from './GearView';
import { useBlade } from '../context/BladeContext';
import { useSim } from '../context/SimContext';
import { useGear, GEAR_PRESETS } from '../context/GearContext';
import { useGearParams, computeGearStages } from '../hooks/useGearParams';
import { exportGearZipSTL } from '../utils/exporters';
import { useTheme } from '../hooks/useTheme';

export const ControlsTab = () => {
  return <ControlsPanel />;
};

export const ChartsTab = () => {
  return (
    <div style={{ height: '100%', width: '100%', background: 'var(--bg-sidebar)', overflow: 'hidden' }}>
      <ChartsPanel />
    </div>
  );
};

export const ExportTab = () => {
  return (
    <div style={{ background: 'var(--bg-sidebar)', height: '100%', overflowY: 'auto' }}>
      <ExportPanel />
    </div>
  );
};

export const GearPropsTab = () => {
  const { gearStore, activePreset, applyPreset, autoOptimizeGearRatio } = useGear();
  const { designRpm } = useBlade();
  const { ratedRpm } = useSim();

  // 1-Click Sync with Active Turbine
  const handleSyncWithTurbine = () => {
    const turbineRpm = designRpm > 0 ? designRpm : 60;
    const targetGenRpm = ratedRpm > 0 ? ratedRpm : 1200;
    const idealRatio = targetGenRpm / turbineRpm;
    autoOptimizeGearRatio(idealRatio);
  };

  return (
    <div className="sidebar-scroll" style={{ background: 'var(--bg-sidebar)', height: '100%', overflowY: 'auto' }}>
      {/* ── Presets & Turbine Sync Quick Header ── */}
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
          Drivetrain Configuration Presets
        </div>
        <select
          className="preset-select"
          value={activePreset}
          onChange={(e) => applyPreset(e.target.value)}
        >
          {Object.entries(GEAR_PRESETS).map(([k, p]) => (
            <option key={k} value={k}>
              {p.name}
            </option>
          ))}
        </select>

        <button
          className="btn-primary"
          style={{ width: '100%', padding: '8px 10px', fontSize: '11.5px', marginTop: '2px' }}
          onClick={handleSyncWithTurbine}
          title="Auto-calculates the ideal gear ratio to match your blade design RPM to the generator"
        >
          ⚡ Sync with Active Turbine ({designRpm.toFixed(0)} → {ratedRpm} RPM)
        </button>
      </div>

      <LevaPanel
        store={gearStore}
        fill
        flat
        titleBar={{ title: 'Parametric Gear Parameters', drag: false, filter: false }}
        theme={{
          colors: {
            elevation1: 'transparent',
            elevation2: 'var(--bg-card)',
            elevation3: 'var(--bg-canvas)',
            accent1: 'var(--accent)',
            accent2: 'var(--accent-border)',
            accent3: 'var(--accent-light)',
            text: 'var(--text-primary)',
            highlight1: 'var(--text-secondary)',
          },
        }}
      />
    </div>
  );
};

export const GearViewportTab = () => {
  const { currentTheme } = useTheme();
  const { gearStore, explodedPct, setExplodedPct } = useGear();
  const { designBemResults } = useBlade();
  const levaParams = useGearParams(gearStore);

  const stagesData = useMemo(() => computeGearStages(levaParams), [levaParams]);
  const [showSpecsTable, setShowSpecsTable] = useState(false);
  const [isKinematicsExpanded, setIsKinematicsExpanded] = useState(true);
  const orbitRef = useRef(null);

  const canvasBg = currentTheme.vars['--3d-bg'] || '#090d16';
  const gridSection = currentTheme.vars['--grid-section'] || '#1e293b';
  const gridCell = currentTheme.vars['--grid-cell'] || '#0f172a';

  // Kinematic computations
  const totalRatio = stagesData.length > 0 ? Math.abs(1 / (stagesData[stagesData.length - 1].speedRatio || 1)) : 1.0;
  const totalCenterDist = stagesData.reduce((sum, s) => sum + (s.kinematics?.centerDist || 0), 0);
  const avgContactRatio =
    stagesData.length > 1
      ? (stagesData.slice(1).reduce((sum, s) => sum + (s.kinematics?.contactRatio || 1.4), 0) / (stagesData.length - 1)).toFixed(2)
      : '1.45';

  const turbineRpm = designBemResults?.rpm || 100;
  const outputRpm = turbineRpm * totalRatio;
  const turbineTorque = designBemResults?.totalTorque || 100;
  const outputTorque = turbineTorque / totalRatio;

  // Camera presets
  const setCameraView = (view) => {
    if (!orbitRef.current) return;
    if (view === 'top') {
      orbitRef.current.object.position.set(0, 0, 14);
    } else if (view === 'side') {
      orbitRef.current.object.position.set(14, 0, 0);
    } else if (view === 'iso') {
      orbitRef.current.object.position.set(6, 7, 8);
    }
    orbitRef.current.target.set(0, 0, 0);
    orbitRef.current.update();
  };

  return (
    <div className="canvas-area" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* ── Top Ribbon: Camera, Exploded Slider, ZIP Export ── */}
      <div className="cad-viewport-ribbon glass">
        <div className="cad-ribbon-group">
          <span className="cad-ribbon-label">Camera:</span>
          <button className="cad-tool-btn" onClick={() => setCameraView('top')} title="Top View (Axial)">📐 Top</button>
          <button className="cad-tool-btn" onClick={() => setCameraView('side')} title="Side View (Stack)">👁️ Side</button>
          <button className="cad-tool-btn" onClick={() => setCameraView('iso')} title="Isometric 3D">🧭 ISO</button>
        </div>

        <div className="cad-ribbon-divider" />

        {/* Continuous Exploded View Slider */}
        <div className="cad-ribbon-group" style={{ gap: '6px' }}>
          <span className="cad-ribbon-label">💥 Exploded:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={explodedPct}
            onChange={(e) => setExplodedPct(parseFloat(e.target.value))}
            style={{ width: '80px', accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '10px', fontFamily: 'JetBrains Mono', color: 'var(--accent)', fontWeight: 700 }}>
            {(explodedPct * 100).toFixed(0)}%
          </span>
        </div>

        <div className="cad-ribbon-divider" />

        <button
          className={`cad-tool-btn ${showSpecsTable ? 'active' : ''}`}
          onClick={() => setShowSpecsTable(!showSpecsTable)}
        >
          📊 Sizing Specs
        </button>

        <button
          className="cad-tool-btn active"
          style={{ background: 'var(--accent)', color: '#ffffff' }}
          onClick={() => exportGearZipSTL(stagesData)}
          title="Download all gears and pinions packaged in a clean ZIP file"
        >
          📦 Download Slicer ZIP
        </button>
      </div>

      {/* ── Floating Live Kinematics Card (GearGenerator style) ── */}
      <div className="overlay-bar" style={{ pointerEvents: 'none' }}>
        <div style={{ marginLeft: 'auto', pointerEvents: 'auto' }}>
          <div className={`power-card glass ${!isKinematicsExpanded ? 'collapsed' : ''}`} style={{ width: isKinematicsExpanded ? '270px' : 'auto' }}>
            <div className="power-card-header" onClick={() => setIsKinematicsExpanded(!isKinematicsExpanded)}>
              <div className="power-label">
                <span className="power-status-dot" />
                Drivetrain Kinematics
              </div>
              <button
                className="power-collapse-btn"
                title={isKinematicsExpanded ? 'Collapse Kinematics' : 'Expand Kinematics'}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsKinematicsExpanded(!isKinematicsExpanded);
                }}
              >
                {isKinematicsExpanded ? '▴' : '▾'}
              </button>
            </div>

            {isKinematicsExpanded ? (
              <div className="power-card-body animate-fadeIn">
                <div className="power-value" style={{ fontSize: '20px' }}>
                  1 : {totalRatio.toFixed(1)}
                  <span className="power-unit" style={{ fontSize: '11px' }}> ratio</span>
                </div>

                <div className="power-stats" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  <div className="power-stat">
                    <span className="power-stat-label">Center Distance</span>
                    <span className="power-stat-value">{totalCenterDist.toFixed(1)} mm</span>
                  </div>
                  <div className="power-stat">
                    <span className="power-stat-label">Contact Ratio (ε)</span>
                    <span className="power-stat-value">{avgContactRatio}</span>
                  </div>
                  <div className="power-stat">
                    <span className="power-stat-label">Output Speed</span>
                    <span className="power-stat-value">{outputRpm.toFixed(0)} RPM</span>
                  </div>
                  <div className="power-stat">
                    <span className="power-stat-label">Output Torque</span>
                    <span className="power-stat-value">{outputTorque.toFixed(1)} N·m</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="power-mini-readout animate-fadeIn" onClick={() => setIsKinematicsExpanded(true)}>
                <span className="power-mini-val">1 : {totalRatio.toFixed(1)}</span>
                <span className="power-mini-chip">{outputRpm.toFixed(0)} RPM</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Gear Sizing Specs Modal / Table Overlay ── */}
      {showSpecsTable && (
        <div className="gear-specs-overlay glass">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>📐 Involute Gear Sizing Table</strong>
            <button className="panel-sub-btn" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => setShowSpecsTable(false)}>
              ✕
            </button>
          </div>
          <table className="gear-specs-table">
            <thead>
              <tr>
                <th>Stage</th>
                <th>Teeth</th>
                <th>Mod</th>
                <th>Pitch Ø</th>
                <th>Base Ø</th>
                <th>Tip Ø</th>
                <th>Root Ø</th>
              </tr>
            </thead>
            <tbody>
              {stagesData.map((s, idx) => (
                <tr key={idx}>
                  <td>Stage {idx + 1}</td>
                  <td>{s.params.numTeeth}T</td>
                  <td>{s.params.module}</td>
                  <td>{s.kinematics?.pitchDia.toFixed(1)}mm</td>
                  <td>{s.kinematics?.baseDia.toFixed(1)}mm</td>
                  <td>{s.kinematics?.tipDia.toFixed(1)}mm</td>
                  <td>{s.kinematics?.rootDia.toFixed(1)}mm</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 3D Canvas */}
      <Canvas camera={{ position: [6, 7, 8], fov: 40 }}>
        <color attach="background" args={[canvasBg]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 15, 10]} intensity={2.5} castShadow />
        <directionalLight position={[-10, -10, -10]} intensity={1.0} color="#38bdf8" />
        <Environment preset="city" />

        <Suspense fallback={null}>
          <GearView />
        </Suspense>

        <ContactShadows position={[0, -5, 0]} opacity={0.3} scale={20} blur={2.5} far={10} color="#000000" />
        <Grid
          infiniteGrid
          fadeDistance={30}
          sectionColor={gridSection}
          cellColor={gridCell}
          position={[0, -5, 0]}
        />
        <OrbitControls
          ref={orbitRef}
          makeDefault
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        />
      </Canvas>

      <div className="blender-nav-hint">
        <span>🖱️ LMB: Orbit • MMB/Scroll: Zoom • RMB: Pan</span>
        <button
          className="panel-sub-btn"
          style={{ padding: '3px 8px', fontSize: 11, marginLeft: 8 }}
          onClick={() => {
            if (orbitRef.current) {
              orbitRef.current.reset();
              orbitRef.current.object.position.set(6, 7, 8);
              orbitRef.current.target.set(0, 0, 0);
              orbitRef.current.update();
            }
          }}
        >
          🎯 Recenter Camera
        </button>
      </div>
    </div>
  );
};

export const ViewportTab = () => {
  const { currentTheme } = useTheme();
  const {
    bladeParams,
    segments,
    viewMode,
    setViewMode,
    showSpar,
    designBemResults,
    designRpm,
    history,
    sliceEnabled,
    maxZHeight,
    jointParams,
  } = useBlade();

  const [showDimensions, setShowDimensions] = useState(true);
  const [showForceVectors, setShowForceVectors] = useState(false);
  const [isPowerExpanded, setIsPowerExpanded] = useState(true);
  const orbitRef = useRef(null);

  const canvasBg = currentTheme.vars['--3d-bg'] || '#090d16';
  const gridSection = currentTheme.vars['--grid-section'] || '#1e293b';
  const gridCell = currentTheme.vars['--grid-cell'] || '#0f172a';

  const thickTipWarning = bladeParams.tip.thicknessPct > 15;
  // Smarter stall alert: only trigger if active aerodynamic sections (r/R > 0.25) are stalling
  const stallDetected = designBemResults.segments?.some(
    (s, idx) => idx > designBemResults.segments.length * 0.25 && s.stallDetected
  );
  const powerKw = designBemResults.totalPower ? (designBemResults.totalPower / 1000).toFixed(2) : '0.00';
  const thrustKn = designBemResults.totalThrust ? (designBemResults.totalThrust / 1000).toFixed(2) : '0.00';
  const R = Math.max(0.4, bladeParams.radiusMm / 1000);

  // Camera Snapping Presets
  const setCameraView = (view) => {
    if (!orbitRef.current) return;
    const dist = Math.max(5, R * 1.5);

    if (view === 'top') {
      orbitRef.current.object.position.set(0, dist, 0);
    } else if (view === 'side') {
      orbitRef.current.object.position.set(dist, 0, 0);
    } else if (view === 'front') {
      orbitRef.current.object.position.set(0, 0, dist);
    } else if (view === 'iso') {
      orbitRef.current.object.position.set(R * 0.7, R * 0.3, R * 1.0);
    }
    orbitRef.current.target.set(0, 0, 0);
    orbitRef.current.update();
  };

  return (
    <div className="canvas-area" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* ── Top-Left CAD Tool Ribbon & Camera Snap Presets ── */}
      <div className="cad-viewport-ribbon glass">
        <div className="cad-ribbon-group">
          <span className="cad-ribbon-label">Camera:</span>
          <button className="cad-tool-btn" onClick={() => setCameraView('top')} title="Top View (Planform)">📐 Top</button>
          <button className="cad-tool-btn" onClick={() => setCameraView('side')} title="Side View (Profile)">👁️ Side</button>
          <button className="cad-tool-btn" onClick={() => setCameraView('front')} title="Front View">🔲 Front</button>
          <button className="cad-tool-btn" onClick={() => setCameraView('iso')} title="Isometric 3D">🧭 ISO</button>
        </div>

        <div className="cad-ribbon-divider" />

        <div className="cad-ribbon-group">
          <button
            className={`cad-tool-btn ${showDimensions ? 'active' : ''}`}
            onClick={() => setShowDimensions(!showDimensions)}
            title="Toggle 3D Dimension Callouts"
          >
            📏 Dimensions
          </button>
          <button
            className={`cad-tool-btn ${showForceVectors ? 'active' : ''}`}
            onClick={() => setShowForceVectors(!showForceVectors)}
            title="Toggle Lift/Drag Force Vector Arrows"
          >
            🏹 Lift/Drag
          </button>
          <button
            className={`cad-tool-btn ${viewMode === 'zebra' ? 'active' : ''}`}
            onClick={() => setViewMode(viewMode === 'zebra' ? 'solid' : 'zebra')}
            title="Zebra Curvature Surface Analysis"
          >
            🦓 Zebra
          </button>
        </div>
      </div>

      {/* ── Top Aerodynamic Warnings & Telemetry HUD ── */}
      <div className="overlay-bar">
        <div className="overlay-left">
          {thickTipWarning && (
            <div className="warning-box">
              <strong>⚠ Tip Thickness ({bladeParams.tip.thicknessPct}%)</strong> Above 15% increases tip drag.
            </div>
          )}
          {stallDetected && (
            <div className="stall-box">
              <strong>⚠ Aerodynamic Stall Warning</strong> Mid-span Angle of Attack &gt;14°.
            </div>
          )}
        </div>

        <div className="overlay-right">
          <div className={`power-card glass ${!isPowerExpanded ? 'collapsed' : ''}`}>
            <div className="power-card-header" onClick={() => setIsPowerExpanded(!isPowerExpanded)}>
              <div className="power-label">
                <span className="power-status-dot" />
                Design Output Power
              </div>
              <button
                className="power-collapse-btn"
                title={isPowerExpanded ? 'Collapse Telemetry Card' : 'Expand Telemetry Card'}
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPowerExpanded(!isPowerExpanded);
                }}
              >
                {isPowerExpanded ? '▴' : '▾'}
              </button>
            </div>

            {isPowerExpanded ? (
              <div className="power-card-body animate-fadeIn">
                <div className="power-value">
                  {powerKw}
                  <span className="power-unit"> kW</span>
                </div>
                <div className="power-stats">
                  <div className="power-stat">
                    <span className="power-stat-label">Power Coeff (Cp)</span>
                    <span className="power-stat-value">{(designBemResults.cp || 0).toFixed(3)}</span>
                  </div>
                  <div className="power-stat-divider" />
                  <div className="power-stat">
                    <span className="power-stat-label">Axial Thrust</span>
                    <span className="power-stat-value">{thrustKn} kN</span>
                  </div>
                  <div className="power-stat-divider" />
                  <div className="power-stat">
                    <span className="power-stat-label">Design RPM</span>
                    <span className="power-stat-value">{designRpm.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="power-mini-readout animate-fadeIn" onClick={() => setIsPowerExpanded(true)}>
                <span className="power-mini-val">{powerKw} kW</span>
                <span className="power-mini-chip">Cp {(designBemResults.cp || 0).toFixed(3)}</span>
                <span className="power-mini-chip">{designRpm.toFixed(0)} RPM</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Undo/Redo & Quick Control HUD */}
      <div className="undo-redo-toolbar">
        <button
          className="undo-redo-btn"
          onClick={history.undo}
          disabled={!history.canUndo}
          title="Undo (Ctrl+Z)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button
          className="undo-redo-btn"
          onClick={history.redo}
          disabled={!history.canRedo}
          title="Redo (Ctrl+Y)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
        </button>
        {history.canUndo && <span className="undo-redo-count">{history.historyLength}</span>}
      </div>

      {/* 3D Canvas */}
      <Canvas key={`blade-cam-${R.toFixed(1)}`} camera={{ position: [R * 0.7, R * 0.3, R * 1.0], fov: 45 }}>
        <color attach="background" args={[canvasBg]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[12, 16, 8]} intensity={2.2} castShadow />
        <directionalLight position={[-12, -10, -8]} intensity={0.8} color="#38bdf8" />
        <Environment preset="city" />

        <Suspense fallback={null}>
          <Blade
            segments={segments}
            showSpar={showSpar}
            viewMode={viewMode}
            showDimensions={showDimensions}
            showForceVectors={showForceVectors}
            bemSegments={designBemResults.segments}
            carbonRodDia={bladeParams.carbonRodDia}
            carbonRodDepthPct={bladeParams.carbonRodDepthPct}
            leRadiusMod={bladeParams.leRadiusMod}
            teThicknessMm={bladeParams.teThicknessMm}
            teFlapDeg={bladeParams.teFlapDeg}
            centerBlade={true}
            sliceEnabled={sliceEnabled}
            maxZHeight={maxZHeight}
            jointParams={jointParams}
          />
        </Suspense>

        <ContactShadows position={[0, -R * 0.2, 0]} opacity={0.35} scale={R * 3} blur={2.5} far={R * 2} color="#000000" />
        <Grid
          infiniteGrid
          fadeDistance={R * 4}
          sectionColor={gridSection}
          cellColor={gridCell}
          position={[0, -R * 0.2, 0]}
        />
        <OrbitControls
          ref={orbitRef}
          makeDefault
          mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }}
        />
      </Canvas>

      {/* Blender Navigation & Reset Button */}
      <div className="blender-nav-hint">
        <span>🖱️ LMB: Orbit • MMB/Scroll: Zoom • RMB: Pan</span>
        <button
          className="panel-sub-btn"
          style={{ padding: '3px 8px', fontSize: 11, marginLeft: 8 }}
          onClick={() => {
            if (orbitRef.current) {
              orbitRef.current.reset();
              orbitRef.current.object.position.set(R * 0.7, R * 0.3, R * 1.0);
              orbitRef.current.target.set(0, 0, 0);
              orbitRef.current.update();
            }
          }}
        >
          🎯 Recenter Camera
        </button>
      </div>
    </div>
  );
};
