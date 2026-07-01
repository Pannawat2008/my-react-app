import React, { useContext, Suspense } from 'react';
import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, Grid } from '@react-three/drei';
import { LevaPanel } from 'leva';
import { AppContext } from '../App';
import ControlsPanel from './ControlsPanel';
import ChartsPanel from './ChartsPanel';
import ExportPanel from './ExportPanel';
import Blade from './Blade';
import GearView from './GearView';
import { THEMES } from '../hooks/useTheme';

export const ControlsTab = ({ ctx }) => {
  return (
    <div className="sidebar-scroll" style={{ height: '100%', overflowY: 'auto', background: 'var(--bg-sidebar)' }}>
      <div className="preset-bar">
        <label className="preset-label">Preset Configuration</label>
        <select
          className="preset-select"
          value={ctx.activePreset}
          onChange={(e) => ctx.loadPreset(e.target.value)}
        >
          {Object.entries(ctx.PRESETS).map(([key, p]) => (
            <option key={key} value={key}>{p.label}</option>
          ))}
        </select>
      </div>
      <ControlsPanel
        params={ctx.bladeParams}
        setParams={ctx.setBladeParams}
        windSpeed={ctx.windSpeed}
        setWindSpeed={ctx.setWindSpeed}
        tsr={ctx.tsr}
        setTsr={ctx.setTsr}
        showSpar={ctx.showSpar}
        setShowSpar={ctx.setShowSpar}
      />
    </div>
  );
};

export const ChartsTab = ({ ctx }) => {
  return (
    <div className="charts-panel" style={{ height: '100%', minHeight: '100%', background: 'var(--bg-sidebar)' }}>
      <ChartsPanel powerCurve={ctx.powerCurve} results={ctx.bemResults} />
    </div>
  );
};

export const ExportTab = ({ ctx }) => {
  return (
    <div style={{ background: 'var(--bg-sidebar)', height: '100%', overflowY: 'auto' }}>
      <ExportPanel {...ctx} />
    </div>
  );
};

export const GearPropsTab = ({ ctx }) => {
  return (
    <div style={{ background: 'var(--bg-sidebar)', height: '100%', overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}>
      <LevaPanel 
        store={ctx.gearStore}
        fill
        flat 
        titleBar={{ title: 'Gear Settings', drag: false, filter: false }}
        theme={{
          colors: {
            elevation1: 'transparent',
            elevation2: 'var(--bg-card)',
            elevation3: 'var(--bg-canvas)',
            accent1: 'var(--accent)',
            accent2: 'var(--accent-border)',
            accent3: 'var(--accent-hover)',
            text: 'var(--text-primary)',
            highlight1: 'var(--text-secondary)'
          }
        }} 
      />
    </div>
  );
};

export const ViewportTab = ({ ctx }) => {
  return (
    <div className="canvas-area" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {ctx.appMode === 'blade' && (
        <div className={`overlay-bar ${ctx.overlayMinimized ? 'minimized' : ''}`}>
          {!ctx.overlayMinimized && (
            <div className="overlay-left">
              {ctx.thickTipWarning && (
                <div className="warning-box">
                  <strong>⚠ Tip thickness is {ctx.bladeParams.tip.thicknessPct}%.</strong> Above 15% drastically increases drag.
                </div>
              )}
              {ctx.stallDetected && (
                <div className="stall-box">
                  <strong>⚠ Stall Detected!</strong> High AoA (&gt;14°) causing flow separation.
                </div>
              )}
            </div>
          )}
          <div className="overlay-right">
            <button 
              className="overlay-toggle" 
              onClick={() => ctx.setOverlayMinimized(!ctx.overlayMinimized)}
            >
              {ctx.overlayMinimized ? "👁️ Show Stats" : "👁️ Hide Stats"}
            </button>
            {!ctx.overlayMinimized && (
              <div className="power-card glass">
                <div className="power-label">Estimated Power Output</div>
                <div className="power-value">
                  {(ctx.bemResults.totalPower / 1000).toFixed(2)}
                  <span className="power-unit"> kW</span>
                </div>
                <div className="power-stats">
                  <div className="power-stat">
                    <span className="power-stat-label">Cp</span>
                    <span className="power-stat-value">{ctx.bemResults.cp.toFixed(3)}</span>
                  </div>
                  <div className="power-stat-divider" />
                  <div className="power-stat">
                    <span className="power-stat-label">Thrust</span>
                    <span className="power-stat-value">
                      {(ctx.bemResults.totalThrust / 1000).toFixed(2)} kN
                    </span>
                  </div>
                  <div className="power-stat-divider" />
                  <div className="power-stat">
                    <span className="power-stat-label">RPM</span>
                    <span className="power-stat-value">{ctx.rpm.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Undo/Redo Toolbar */}
      <div className="undo-redo-toolbar">
        <button className="undo-redo-btn" onClick={ctx.history.undo} disabled={!ctx.history.canUndo} title="Undo (Ctrl+Z)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
          </svg>
        </button>
        <button className="undo-redo-btn" onClick={ctx.history.redo} disabled={!ctx.history.canRedo} title="Redo (Ctrl+Y)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
          </svg>
        </button>
        {ctx.history.canUndo && <span className="undo-redo-count">{ctx.history.historyLength}</span>}
      </div>

      <Canvas camera={{ position: [5, 2, 10], fov: 50 }}>
        <color attach="background" args={[ctx.canvasBg]} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 5]} intensity={2.5} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={1.0} color="#e0f2fe" />
        <Environment preset="city" />
        <Suspense fallback={null}>
          {ctx.appMode === 'blade' ? (
            <Blade 
              segments={ctx.segments} 
              showSpar={ctx.showSpar} 
              carbonRodDia={ctx.bladeParams.carbonRodDia} 
              carbonRodDepthPct={ctx.bladeParams.carbonRodDepthPct}
              leRadiusMod={ctx.bladeParams.leRadiusMod}
              teThicknessMm={ctx.bladeParams.teThicknessMm}
              teFlapDeg={ctx.bladeParams.teFlapDeg}
            />
          ) : (
            <GearView ctx={ctx} />
          )}
        </Suspense>
        <ContactShadows position={[0, -2, 0]} opacity={0.3} scale={20} blur={2.5} far={10} color="#0f172a" />
        <Grid infiniteGrid fadeDistance={40} sectionColor={ctx.gridSection} cellColor={ctx.gridCell} position={[0, -2, 0]} />
        <OrbitControls 
          ref={ctx.orbitRef}
          makeDefault 
          mouseButtons={{ LEFT: THREE.MOUSE.NONE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: THREE.MOUSE.PAN }}
        />
      </Canvas>
      
      <div className="blender-nav-hint" style={{ position: 'absolute', bottom: 10, left: 10, right: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
        <span><strong>Blender Navigation</strong> • MMB: Orbit • RMB: Pan • Scroll: Zoom</span>
        <button 
          className="export-btn"
          style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--bg-sidebar)', border: '1px solid var(--border)', pointerEvents: 'auto', cursor: 'pointer' }}
          onClick={() => {
            if (ctx.orbitRef.current) {
              ctx.orbitRef.current.reset();
              ctx.orbitRef.current.target.set(0, 0, 0);
            }
          }}
        >
          🎯 Center Model
        </button>
      </div>
    </div>
  );
};
