import { useState, useCallback, useEffect } from 'react';
import { Model, Layout } from 'flexlayout-react';
import { Leva } from 'leva';
import ThemeSwitcher from './components/ThemeSwitcher';
import { ControlsTab, ChartsTab, ExportTab, GearPropsTab, GearViewportTab, ViewportTab } from './components/FlexTabs';
import { SimControlsTab, SimViewportTab } from './components/SimFlexTabs';
import AirfoilSlicerModal from './components/AirfoilSlicerModal';
import { BladeProvider, useBlade } from './context/BladeContext';
import { SimProvider } from './context/SimContext';
import { GearProvider } from './context/GearContext';
import { useTheme, THEMES } from './hooks/useTheme';

/* ── Layout JSON Definitions ── */
const bladeLayoutJson = {
  global: {
    tabEnableClose: false,
    tabSetEnableDrop: true,
    tabSetEnableMaximize: true,
    splitterSize: 6,
    tabSetTabStripHeight: 38,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 26,
        children: [{ type: 'tab', id: 'controls', name: 'Blade Geometry', component: 'controls' }],
      },
      {
        type: 'tabset',
        weight: 48,
        children: [{ type: 'tab', id: 'viewport', name: '3D CAD Viewport', component: 'viewport' }],
      },
      {
        type: 'tabset',
        weight: 26,
        children: [
          { type: 'tab', id: 'charts', name: 'Aerodynamic Analysis', component: 'charts' },
          { type: 'tab', id: 'export', name: 'Optimizer & Export', component: 'export' },
        ],
      },
    ],
  },
};

const gearLayoutJson = {
  global: {
    tabEnableClose: false,
    tabSetEnableDrop: true,
    tabSetEnableMaximize: true,
    splitterSize: 6,
    tabSetTabStripHeight: 38,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 28,
        children: [{ type: 'tab', id: 'gearProps', name: 'Gear Train Parameters', component: 'gearProps' }],
      },
      {
        type: 'tabset',
        weight: 72,
        children: [{ type: 'tab', id: 'gearViewport', name: '3D Gear Viewport', component: 'gearViewport' }],
      },
    ],
  },
};

const simLayoutJson = {
  global: {
    tabEnableClose: false,
    tabSetEnableDrop: true,
    tabSetEnableMaximize: true,
    splitterSize: 6,
    tabSetTabStripHeight: 38,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 28,
        children: [{ type: 'tab', id: 'simControls', name: 'Simulation & Generator', component: 'simControls' }],
      },
      {
        type: 'tabset',
        weight: 72,
        children: [{ type: 'tab', id: 'simViewport', name: 'Aerodynamic Wind Tunnel', component: 'simViewport' }],
      },
    ],
  },
};

const zenLayoutJson = {
  global: {
    tabEnableClose: false,
    tabSetEnableDrop: false,
    tabSetEnableMaximize: true,
    splitterSize: 0,
    tabSetTabStripHeight: 0,
  },
  borders: [],
  layout: {
    type: 'row',
    weight: 100,
    children: [
      {
        type: 'tabset',
        weight: 100,
        children: [{ type: 'tab', id: 'viewport', name: '3D CAD Viewport', component: 'viewport' }],
      },
    ],
  },
};

function AppContent() {
  const { themeId } = useTheme();
  const { optimizing, optimizeProgress, optimizeBestCp, optimizeBestTorque, history } = useBlade();

  const [appMode, setAppMode] = useState(() => {
    try {
      return localStorage.getItem('aeroblade_appMode') || 'blade';
    } catch {
      return 'blade';
    }
  });

  const [zenMode, setZenMode] = useState(false);

  const [layoutModel, setLayoutModel] = useState(() => {
    if (appMode === 'gear') return Model.fromJson(gearLayoutJson);
    if (appMode === 'simulation') return Model.fromJson(simLayoutJson);
    return Model.fromJson(bladeLayoutJson);
  });

  // Switch layout when application mode changes
  const switchAppMode = (mode) => {
    setAppMode(mode);
    setZenMode(false);
    try {
      localStorage.setItem('aeroblade_appMode', mode);
    } catch {
      /* ignore */
    }
    if (mode === 'blade') setLayoutModel(Model.fromJson(bladeLayoutJson));
    else if (mode === 'gear') setLayoutModel(Model.fromJson(gearLayoutJson));
    else if (mode === 'simulation') setLayoutModel(Model.fromJson(simLayoutJson));
  };

  const toggleZenMode = () => {
    setZenMode((prev) => {
      const next = !prev;
      if (next) {
        setLayoutModel(Model.fromJson(zenLayoutJson));
      } else {
        if (appMode === 'blade') setLayoutModel(Model.fromJson(bladeLayoutJson));
        else if (appMode === 'gear') setLayoutModel(Model.fromJson(gearLayoutJson));
        else if (appMode === 'simulation') setLayoutModel(Model.fromJson(simLayoutJson));
      }
      return next;
    });
  };

  // Keyboard Shortcuts: Ctrl+Z / Ctrl+Y
  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        history?.undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        history?.redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [history]);

  // Stable FlexLayout Node Factory
  const factory = useCallback((node) => {
    const component = node.getComponent();
    if (component === 'controls') return <ControlsTab />;
    if (component === 'viewport') return <ViewportTab />;
    if (component === 'charts') return <ChartsTab />;
    if (component === 'export') return <ExportTab />;
    if (component === 'gearProps') return <GearPropsTab />;
    if (component === 'gearViewport') return <GearViewportTab />;
    if (component === 'simControls') return <SimControlsTab />;
    if (component === 'simViewport') return <SimViewportTab />;
    return null;
  }, []);

  return (
    <div
      className={`app theme-${THEMES[themeId]?.id || 'dark'}`}
      style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', overflow: 'hidden' }}
    >
      {/* ── Top Header Navigation Bar ── */}
      <header className="logo-bar">
        <div className="logo-brand">
          <div className="logo-icon">⚡</div>
          <div className="logo-info">
            <div className="logo-text">
              AeroBlade <span className="logo-accent">Pro</span>
            </div>
            <span className="logo-subtitle">Wind Engineering CAD &amp; BEM Studio</span>
          </div>
        </div>

        {/* Segmented Mode Selector */}
        <nav className="app-mode-tabs">
          <button
            className={`app-mode-tab ${appMode === 'blade' ? 'active' : ''}`}
            onClick={() => switchAppMode('blade')}
          >
            🎐 Blade Designer
          </button>
          <button
            className={`app-mode-tab ${appMode === 'gear' ? 'active' : ''}`}
            onClick={() => switchAppMode('gear')}
          >
            ⚙️ Gear Generator
          </button>
          <button
            className={`app-mode-tab ${appMode === 'simulation' ? 'active' : ''}`}
            onClick={() => switchAppMode('simulation')}
          >
            🌪️ Wind Simulation
          </button>
        </nav>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            className={`zen-mode-btn ${zenMode ? 'active' : ''}`}
            onClick={toggleZenMode}
            title="Toggle Fullscreen 3D CAD Viewport (Hides side panels for smaller screens)"
          >
            {zenMode ? '🗗 Exit Zen' : '🖥️ Zen CAD'}
          </button>
          <ThemeSwitcher />
        </div>
      </header>

      {/* Hide global Leva panel — inline LevaPanels are used */}
      <Leva hidden />

      {/* Main FlexLayout Docking Area */}
      <main style={{ flex: 1, position: 'relative', width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
        <Layout model={layoutModel} factory={factory} />
      </main>

      {/* ── Interactive 2D Airfoil Cross-Section Slicer Modal ── */}
      <AirfoilSlicerModal />

      {/* ── Parametric Auto-Optimizer Modal Overlay ── */}
      {optimizing && (
        <div className="optimize-overlay">
          <div className="optimize-modal glass">
            <div className="optimize-modal-icon">🚀</div>
            <div className="optimize-modal-title">Parametric Auto-Optimizer Active</div>
            <div className="optimize-modal-subtitle">
              Evaluating multi-zone chord, twist, and airfoil distributions...
            </div>
            <div className="optimize-modal-progress-bar">
              <div className="optimize-modal-progress-fill" style={{ width: `${((optimizeProgress || 0) * 100).toFixed(0)}%` }} />
            </div>
            <div className="optimize-modal-stats">
              <div>
                Progress: <strong>{((optimizeProgress || 0) * 100).toFixed(0)}%</strong>
              </div>
              <div>
                Best Cp: <strong>{(optimizeBestCp || 0).toFixed(4)}</strong>
              </div>
              <div>
                Best Torque: <strong>{(optimizeBestTorque || 0).toFixed(1)} N·m</strong>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <BladeProvider>
      <SimProvider>
        <GearProvider>
          <AppContent />
        </GearProvider>
      </SimProvider>
    </BladeProvider>
  );
}
