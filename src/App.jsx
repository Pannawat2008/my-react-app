import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Model, Layout } from 'flexlayout-react';
import { Leva, useCreateStore } from 'leva';
import { solveBEM } from './engine/bem';
import { runOptimizer } from './engine/optimizer';
import { generateSegments } from './utils/geometryBuilder';
import { parseDatFile } from './utils/airfoilParser';
import ThemeSwitcher from './components/ThemeSwitcher';
import { ControlsTab, ChartsTab, ExportTab, GearPropsTab, ViewportTab } from './components/FlexTabs';
import { SimControlsTab, SimViewportTab } from './components/SimFlexTabs';
import useHistory from './hooks/useHistory';
import { useTheme, THEMES } from './hooks/useTheme';

export const AppContext = React.createContext();

/* ── Preset Configurations ── */
const PRESETS = {
  custom: { label: 'Custom Design' },
  smallResearch: {
    label: '🔬  Small Research Turbine (1 m)',
    params: {
      radiusMm: 500,
      numSegments: 15,
      midPosition: 0.45,
      midLength: 0.1,
      planform: 'optimized',
      root: { chordMm: 80, twistDeg: 18, thicknessPct: 28, airfoil: 'DU91W2250' },
      mid:  { chordMm: 50, twistDeg: 8,  thicknessPct: 21, airfoil: 'S809' },
      tip:  { chordMm: 20, twistDeg: 0,  thicknessPct: 12, airfoil: 'NACA4412' },
      carbonRodDia: 0,
      carbonRodDepthPct: 100,
      leRadiusMod: 1.0,
      teThicknessMm: 0.0,
      teFlapDeg: 0,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
  },
  mediumHAWT: {
    label: '🌬️  Medium HAWT (5 m)',
    params: {
      radiusMm: 2500,
      numSegments: 15,
      midPosition: 0.5,
      midLength: 0.15,
      planform: 'optimized',
      root: { chordMm: 400, twistDeg: 20, thicknessPct: 30, airfoil: 'DU91W2250' },
      mid:  { chordMm: 200, twistDeg: 10, thicknessPct: 21, airfoil: 'S809' },
      tip:  { chordMm: 80,  twistDeg: 2,  thicknessPct: 12, airfoil: 'NACA4412' },
      carbonRodDia: 0,
      carbonRodDepthPct: 100,
      leRadiusMod: 1.0,
      teThicknessMm: 0.0,
      teFlapDeg: 0,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
  },
  utilityScale: {
    label: '⚡  Utility Scale (10 m)',
    params: {
      radiusMm: 10000,
      numSegments: 15,
      midPosition: 0.5,
      midLength: 0.15,
      planform: 'optimized',
      root: { chordMm: 1500, twistDeg: 20, thicknessPct: 30, airfoil: 'DU91W2250' },
      mid:  { chordMm: 800,  twistDeg: 10, thicknessPct: 21, airfoil: 'S809' },
      tip:  { chordMm: 300,  twistDeg: 0,  thicknessPct: 12, airfoil: 'NACA4412' },
      carbonRodDia: 0,
      carbonRodDepthPct: 100,
      leRadiusMod: 1.0,
      teThicknessMm: 0.0,
      teFlapDeg: 0,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
  },
};



/* ──────────────────────────────────────────── */
/*                    APP                       */
/* ──────────────────────────────────────────── */
function App() {
  const { themeId } = useTheme();
  const currentTheme = THEMES[themeId] || THEMES.ocean;
  const canvasBg = currentTheme.vars['--3d-bg'];
  const gridSection = currentTheme.vars['--grid-section'];
  const gridCell = currentTheme.vars['--grid-cell'];

  /* ── State Initialization with Auto-Load ── */
  const defaultParams = {
    radiusMm: 10000,
    numSegments: 15,
    midPosition: 0.5,
    midLength: 0.15,
    planform: 'optimized',
    root: { chordMm: 1500, twistDeg: 20, thicknessPct: 30, airfoil: 'DU91W2250' },
    mid:  { chordMm: 800,  twistDeg: 10, thicknessPct: 21, airfoil: 'S809' },
    tip:  { chordMm: 300,  twistDeg: 0,  thicknessPct: 12, airfoil: 'NACA4412' },
    carbonRodDia: 0,
    carbonRodDepthPct: 100,
    leRadiusMod: 1.0,
    teThicknessMm: 0.0,
    teFlapDeg: 0,
    numBlades: 3,
    customAirfoils: { root: null, mid: null, tip: null },
  };

  const loadSavedState = (key, defaultValue) => {
    try {
      const saved = localStorage.getItem(key);
      return saved !== null ? JSON.parse(saved) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [bladeParams, setBladeParams, history] = useHistory(
    loadSavedState('aeroblade_params', defaultParams)
  );

  const [windSpeed, setWindSpeed] = useState(() => loadSavedState('aeroblade_windSpeed', 10));
  const [tsr, setTsr] = useState(() => loadSavedState('aeroblade_tsr', 7));
  const [showSpar, setShowSpar] = useState(() => loadSavedState('aeroblade_showSpar', false));
  const [activePreset, setActivePreset] = useState(() => loadSavedState('aeroblade_preset', 'utilityScale'));
  const [overlayMinimized, setOverlayMinimized] = useState(() => loadSavedState('aeroblade_overlayMinimized', false));

  /* ── Simulation State ── */
  const [heatmapProperty, setHeatmapProperty] = useState(() => loadSavedState('aeroblade_heatmapProp', 'None'));
  const [simPlaying, setSimPlaying] = useState(true);
  const [bladePitch, setBladePitch] = useState(0);
  const [timeScale, setTimeScale] = useState(1.0);
  const [showParticles, setShowParticles] = useState(true);
  const [tunnelScale, setTunnelScale] = useState(2.5);
  const [generatorLoad, setGeneratorLoad] = useState(15); // Percentage
  const [loadModel, setLoadModel] = useState('Realistic DC Motor');
  const [constantLoadGcm, setConstantLoadGcm] = useState(10.0); // g.cm
  const [ratedPowerW, setRatedPowerW] = useState(3.0); // Watts
  const [ratedRpm, setRatedRpm] = useState(1000); // RPM
  const [liveRpm, setLiveRpm] = useState(0);
  const [liveElectricalPowerW, setLiveElectricalPowerW] = useState(0);

  /* ── App Mode & Gear State ── */
  const [appMode, setAppMode] = useState(() => loadSavedState('aeroblade_appMode', 'blade')); // 'blade' | 'gear'
  
  /* ── 3D Camera Controls ── */
  const orbitRef = useRef(null);

  /* ── Layout Configurations ── */
  const bladeLayoutJson = useMemo(() => ({
    global: { tabEnableClose: false, tabSetEnableDrop: true, tabSetEnableMaximize: true, splitterSize: 6, tabSetTabStripHeight: 40 },
    borders: [],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 25,
          children: [{ type: "tab", id: "controls", name: "Blade Settings", component: "controls" }]
        },
        {
          type: "tabset",
          weight: 50,
          children: [{ type: "tab", id: "viewport", name: "3D Viewport", component: "viewport" }]
        },
        {
          type: "tabset",
          weight: 25,
          children: [
            { type: "tab", id: "charts", name: "Analysis", component: "charts" },
            { type: "tab", id: "export", name: "Export & Optimization", component: "export" }
          ]
        }
      ]
    }
  }), []);

  const gearLayoutJson = useMemo(() => ({
    global: { tabEnableClose: false, tabSetEnableDrop: true, tabSetEnableMaximize: true, splitterSize: 6, tabSetTabStripHeight: 40 },
    borders: [],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 25,
          children: [{ type: "tab", id: "gearProps", name: "Gear Settings", component: "gearProps" }]
        },
        {
          type: "tabset",
          weight: 75,
          children: [{ type: "tab", id: "viewport", name: "3D Viewport", component: "viewport" }]
        }
      ]
    }
  }), []);

  const simLayoutJson = useMemo(() => ({
    global: { tabEnableClose: false, tabSetEnableDrop: true, tabSetEnableMaximize: true, splitterSize: 6, tabSetTabStripHeight: 40 },
    borders: [],
    layout: {
      type: "row",
      weight: 100,
      children: [
        {
          type: "tabset",
          weight: 25,
          children: [{ type: "tab", id: "simControls", name: "Simulation Settings", component: "simControls" }]
        },
        {
          type: "tabset",
          weight: 75,
          children: [{ type: "tab", id: "simViewport", name: "Simulation Viewport", component: "simViewport" }]
        }
      ]
    }
  }), []);

  const [layoutModel, setLayoutModel] = useState(() => {
    const savedMode = loadSavedState('aeroblade_appMode', 'blade');
    if (savedMode === 'blade') return Model.fromJson(bladeLayoutJson);
    if (savedMode === 'gear') return Model.fromJson(gearLayoutJson);
    if (savedMode === 'simulation') return Model.fromJson(simLayoutJson);
    return Model.fromJson(bladeLayoutJson);
  });

  // Switch layout when mode changes
  useEffect(() => {
    if (appMode === 'blade') setLayoutModel(Model.fromJson(bladeLayoutJson));
    else if (appMode === 'gear') setLayoutModel(Model.fromJson(gearLayoutJson));
    else if (appMode === 'simulation') setLayoutModel(Model.fromJson(simLayoutJson));
  }, [appMode, bladeLayoutJson, gearLayoutJson, simLayoutJson]);

  const gearStore = useCreateStore();

  /* ── Optimizer State ── */
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState(0);
  const [optimizeBestCp, setOptimizeBestCp] = useState(0);

  /* ── Keyboard Shortcuts: Ctrl+Z / Ctrl+Y ── */
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        history.redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  /* ── Auto-Save to localStorage ── */
  useEffect(() => {
    localStorage.setItem('aeroblade_params', JSON.stringify(bladeParams));
  }, [bladeParams]);

  useEffect(() => {
    localStorage.setItem('aeroblade_windSpeed', JSON.stringify(windSpeed));
  }, [windSpeed]);

  useEffect(() => {
    localStorage.setItem('aeroblade_tsr', JSON.stringify(tsr));
  }, [tsr]);

  useEffect(() => {
    localStorage.setItem('aeroblade_showSpar', JSON.stringify(showSpar));
  }, [showSpar]);

  useEffect(() => {
    localStorage.setItem('aeroblade_preset', JSON.stringify(activePreset));
  }, [activePreset]);

  useEffect(() => {
    localStorage.setItem('aeroblade_appMode', JSON.stringify(appMode));
  }, [appMode]);

  useEffect(() => {
    localStorage.setItem('aeroblade_overlayMinimized', JSON.stringify(overlayMinimized));
  }, [overlayMinimized]);

  useEffect(() => {
    localStorage.setItem('aeroblade_heatmapProp', JSON.stringify(heatmapProperty));
  }, [heatmapProperty]);

  /* ── Computed ── */
  const parsedCustomAirfoils = useMemo(() => {
    return {
      root: bladeParams.customAirfoils?.root ? parseDatFile(bladeParams.customAirfoils.root) : null,
      mid: bladeParams.customAirfoils?.mid ? parseDatFile(bladeParams.customAirfoils.mid) : null,
      tip: bladeParams.customAirfoils?.tip ? parseDatFile(bladeParams.customAirfoils.tip) : null,
    };
  }, [bladeParams.customAirfoils]);

  const segments = useMemo(() => generateSegments(bladeParams, parsedCustomAirfoils), [bladeParams, parsedCustomAirfoils]);

  const bemResults = useMemo(() => {
    const R = bladeParams.radiusMm / 1000;
    const B = bladeParams.numBlades || 3;
    return solveBEM(segments, windSpeed, liveRpm, R, B, bladePitch);
  }, [segments, windSpeed, liveRpm, bladeParams.radiusMm, bladeParams.numBlades, bladePitch]);

  // Power curve — sweep wind speeds from 3–25 m/s
  const powerCurve = useMemo(() => {
    const R = bladeParams.radiusMm / 1000;
    const B = bladeParams.numBlades || 3;
    const curve = [];
    for (let v = 3; v <= 25; v += 1) {
      const optimalRpm = (tsr * v * 60) / (2 * Math.PI * R);
      const result = solveBEM(segments, v, optimalRpm, R, B, bladePitch);
      curve.push({
        windSpeed: v,
        power: parseFloat((result.totalPower / 1000).toFixed(2)),
        cp: parseFloat(result.cp.toFixed(3)),
      });
    }
    return curve;
  }, [segments, tsr, bladeParams.radiusMm, bladeParams.numBlades, bladePitch]);

  /* ── Preset loading ── */
  const loadPreset = (key) => {
    setActivePreset(key);
    if (key !== 'custom' && PRESETS[key]?.params) {
      setBladeParams(PRESETS[key].params);
    }
  };

  // Wraps setBladeParams — auto-switches to "Custom" when user edits params manually
  const handleParamsChange = useCallback((updater) => {
    setActivePreset('custom');
    setBladeParams(updater);
  }, [setBladeParams]);

  /* ── Auto-Optimize ── */
  const handleOptimize = useCallback(async () => {
    if (optimizing) return;
    setOptimizing(true);
    setOptimizeProgress(0);
    setOptimizeBestCp(bemResults.cp);

    try {
      const result = await runOptimizer(bladeParams, windSpeed, tsr, (progress, bestCp) => {
        setOptimizeProgress(progress);
        setOptimizeBestCp(bestCp);
      });

      // Apply best params (pushed to undo history)
      setBladeParams(result.bestParams);
      setActivePreset('custom');
    } finally {
      setOptimizing(false);
    }
  }, [bladeParams, windSpeed, tsr, bemResults.cp, optimizing, setBladeParams]);

  /* ── Derived flags ── */
  const thickTipWarning = bladeParams.tip.thicknessPct > 15;
  const stallDetected = bemResults.segments.some((s) => s.stallDetected);
  const R = bladeParams.radiusMm / 1000;
  const rpm = liveRpm;

  /* ── JSON import ── */
  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          if (data.bladeParams) {
            setBladeParams(data.bladeParams);
            if (data.windSpeed) setWindSpeed(data.windSpeed);
            if (data.tsr) setTsr(data.tsr);
            setActivePreset('custom');
          }
        } catch {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const contextValue = {
    themeId, currentTheme, canvasBg, gridSection, gridCell,
    bladeParams, setBladeParams, history,
    windSpeed, setWindSpeed, tsr, setTsr,
    showSpar, setShowSpar, activePreset, setActivePreset, loadPreset, PRESETS,
    overlayMinimized, setOverlayMinimized,
    appMode, setAppMode, orbitRef, gearStore,
    optimizing, optimizeProgress, optimizeBestCp, handleOptimize, handleImportJSON,
    segments, bemResults, powerCurve,
    thickTipWarning, stallDetected, rpm,
    heatmapProperty, setHeatmapProperty,
    simPlaying, setSimPlaying,
    bladePitch, setBladePitch,
    timeScale, setTimeScale,
    showParticles, setShowParticles,
    tunnelScale, setTunnelScale,
    generatorLoad, setGeneratorLoad,
    loadModel, setLoadModel,
    constantLoadGcm, setConstantLoadGcm,
    ratedPowerW, setRatedPowerW,
    ratedRpm, setRatedRpm,
    setLiveRpm,
    liveElectricalPowerW, setLiveElectricalPowerW,
    overlayMinimized, setOverlayMinimized
  };

  const factory = useCallback((node) => {
    const component = node.getComponent();
    if (component === "controls") return <ControlsTab ctx={contextValue} />;
    if (component === "viewport") return <ViewportTab ctx={contextValue} />;
    if (component === "charts") return <ChartsTab ctx={contextValue} />;
    if (component === "export") return <ExportTab ctx={contextValue} />;
    if (component === "gearProps") return <GearPropsTab ctx={contextValue} />;
    if (component === "simControls") return <SimControlsTab ctx={contextValue} />;
    if (component === "simViewport") return <SimViewportTab ctx={contextValue} />;
    return null;
  });

  return (
    <div className={`app theme-${THEMES[themeId]?.id || 'ocean'}`} style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw' }}>
      
      {/* Top Branding Bar */}
      <div className="logo-bar" style={{ flexShrink: 0, padding: '8px 16px', background: 'var(--bg-sidebar-header)' }}>
        <div className="logo-icon" style={{ width: 32, height: 32, fontSize: 16 }}>⚡</div>
        <div className="logo-info">
          <div className="logo-text" style={{ fontSize: 16 }}>AeroBlade <span className="logo-accent">Pro</span></div>
        </div>
        
        <div className="app-mode-tabs" style={{ margin: '0 auto', padding: 0, borderBottom: 'none', background: 'transparent' }}>
          <button className={`app-mode-tab ${appMode === 'blade' ? 'active' : ''}`} onClick={() => setAppMode('blade')}>
            🎐 Blade Designer
          </button>
          <button className={`app-mode-tab ${appMode === 'gear' ? 'active' : ''}`} onClick={() => setAppMode('gear')}>
            ⚙️ Gear Generator
          </button>
          <button className={`app-mode-tab ${appMode === 'simulation' ? 'active' : ''}`} onClick={() => setAppMode('simulation')}>
            🌪️ Simulation
          </button>
        </div>

        <ThemeSwitcher />
      </div>

      {/* Hide the default global Leva panel — we use LevaPanel inline instead */}
      <Leva hidden />

      {/* FlexLayout Main Area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Layout model={layoutModel} factory={factory} />
      </div>
      
      {/* ─── Optimize Overlay ─── */}
      {optimizing && (
        <div className="optimize-overlay">
          <div className="optimize-modal glass">
            <div className="optimize-modal-icon">🚀</div>
            <div className="optimize-modal-title">Auto-Optimizing Blade</div>
            <div className="optimize-modal-subtitle">
              Sweeping chord &amp; twist to maximize Cp
            </div>
            <div className="optimize-modal-progress-bar">
              <div
                className="optimize-modal-progress-fill"
                style={{ width: `${optimizeProgress * 100}%` }}
              />
            </div>
            <div className="optimize-modal-stats">
              <div>Progress: <strong>{(optimizeProgress * 100).toFixed(0)}%</strong></div>
              <div>Best Cp: <strong>{optimizeBestCp.toFixed(4)}</strong></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
