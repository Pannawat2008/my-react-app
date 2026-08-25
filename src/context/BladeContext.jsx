import { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import useHistory from '../hooks/useHistory';
import { generateSegments } from '../utils/geometryBuilder';
import { solveBEM } from '../engine/bem';
import { parseDatFile } from '../utils/airfoilParser';
import { runOptimizer } from '../engine/optimizer';

export const PRESETS = {
  custom: { label: '🛠️  Custom Parametric Blade' },
  highTorqueMicro400: {
    label: '⚡ High-Torque Micro 400mm (SG6043 Low-Re, 3.6 m/s)',
    params: {
      radiusMm: 400,
      numSegments: 20,
      midPosition: 0.45,
      midLength: 0.15,
      planform: 'optimized',
      root: { chordMm: 68, twistDeg: 18.5, thicknessPct: 14, airfoil: 'SG6043' },
      mid:  { chordMm: 46, twistDeg: 8.2,  thicknessPct: 10, airfoil: 'SG6043' },
      tip:  { chordMm: 22, twistDeg: 1.5,  thicknessPct: 10, airfoil: 'SG6043' },
      carbonRodDia: 4,
      carbonRodDepthPct: 85,
      carbonRodPosPct: 30,
      leRadiusMod: 1.0,
      teThicknessMm: 0.6,
      teFlapDeg: 0,
      preBendMm: 0,
      sweepAngleDeg: 0,
      hubRootEnabled: false,
      hubDiameterMm: 28,
      hubTransitionPct: 10,
      wingletEnabled: false,
      wingletHeightMm: 25,
      wingletAngleDeg: 75,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
    designWindSpeed: 3.6,
    designTsr: 4.5,
  },
  microLowWind400: {
    label: '🍃  Micro 400mm Low-Wind (3.6 m/s, 30Ω Load)',
    params: {
      radiusMm: 400,
      numSegments: 20,
      midPosition: 0.45,
      midLength: 0.15,
      planform: 'optimized',
      root: { chordMm: 78, twistDeg: 22.5, thicknessPct: 20, airfoil: 'NACA4412' },
      mid:  { chordMm: 48, twistDeg: 10.2, thicknessPct: 14, airfoil: 'NACA4412' },
      tip:  { chordMm: 22, twistDeg: 2.5,  thicknessPct: 11, airfoil: 'NACA4412' },
      carbonRodDia: 4,
      carbonRodDepthPct: 85,
      carbonRodPosPct: 30,
      leRadiusMod: 1.0,
      teThicknessMm: 0.6,
      teFlapDeg: 0,
      preBendMm: 0,
      sweepAngleDeg: 0,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
    designWindSpeed: 3.6,
    designTsr: 5.0,
  },
  smallResearch: {
    label: '🔬  Small Research Turbine (1.0 m)',
    params: {
      radiusMm: 500,
      numSegments: 16,
      midPosition: 0.45,
      midLength: 0.12,
      planform: 'optimized',
      root: { chordMm: 80, twistDeg: 18, thicknessPct: 25, airfoil: 'DU91W2250' },
      mid:  { chordMm: 50, twistDeg: 7,  thicknessPct: 21, airfoil: 'S809' },
      tip:  { chordMm: 20, twistDeg: 0,  thicknessPct: 12, airfoil: 'NACA4412' },
      carbonRodDia: 4,
      carbonRodDepthPct: 90,
      carbonRodPosPct: 30,
      leRadiusMod: 1.0,
      teThicknessMm: 0.8,
      teFlapDeg: 0,
      preBendMm: 0,
      sweepAngleDeg: 0,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
    designWindSpeed: 8.0,
    designTsr: 6.0,
  },
  mediumHAWT: {
    label: '🌬️  Commercial HAWT (5.0 m)',
    params: {
      radiusMm: 2500,
      numSegments: 18,
      midPosition: 0.5,
      midLength: 0.15,
      planform: 'optimized',
      root: { chordMm: 420, twistDeg: 20, thicknessPct: 25, airfoil: 'DU91W2250' },
      mid:  { chordMm: 220, twistDeg: 9,  thicknessPct: 21, airfoil: 'S809' },
      tip:  { chordMm: 85,  twistDeg: 1.5, thicknessPct: 12, airfoil: 'NACA4412' },
      carbonRodDia: 12,
      carbonRodDepthPct: 95,
      carbonRodPosPct: 30,
      leRadiusMod: 1.0,
      teThicknessMm: 1.5,
      teFlapDeg: 0,
      preBendMm: 25,
      sweepAngleDeg: 2.0,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
    designWindSpeed: 10.0,
    designTsr: 7.0,
  },
  utilityScale: {
    label: '⚡  Utility Scale IEC-Class (10.0 m)',
    params: {
      radiusMm: 10000,
      numSegments: 20,
      midPosition: 0.48,
      midLength: 0.16,
      planform: 'optimized',
      root: { chordMm: 1450, twistDeg: 22, thicknessPct: 28, airfoil: 'DU91W2250' },
      mid:  { chordMm: 780,  twistDeg: 8.5, thicknessPct: 21, airfoil: 'S809' },
      tip:  { chordMm: 280,  twistDeg: 0.5, thicknessPct: 12, airfoil: 'NACA4412' },
      carbonRodDia: 40,
      carbonRodDepthPct: 100,
      carbonRodPosPct: 30,
      leRadiusMod: 1.0,
      teThicknessMm: 3.0,
      teFlapDeg: 0,
      preBendMm: 120,
      sweepAngleDeg: 3.5,
      numBlades: 3,
      customAirfoils: { root: null, mid: null, tip: null },
    },
    designWindSpeed: 11.0,
    designTsr: 7.5,
  },
};

const DEFAULT_PARAMS = PRESETS.highTorqueMicro400.params;

function loadBladeParams() {
  try {
    const val = localStorage.getItem('aeroblade_params_v2');
    if (!val) return DEFAULT_PARAMS;
    const parsed = JSON.parse(val);
    if (!parsed || typeof parsed !== 'object' || !parsed.root || !parsed.mid || !parsed.tip) {
      return DEFAULT_PARAMS;
    }
    return {
      ...DEFAULT_PARAMS,
      ...parsed,
      root: { ...DEFAULT_PARAMS.root, ...parsed.root },
      mid: { ...DEFAULT_PARAMS.mid, ...parsed.mid },
      tip: { ...DEFAULT_PARAMS.tip, ...parsed.tip },
    };
  } catch {
    return DEFAULT_PARAMS;
  }
}

function loadStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

const BladeContext = createContext(null);

export function BladeProvider({ children }) {
  const [bladeParams, setBladeParams, history] = useHistory(
    loadBladeParams()
  );

  const [activePreset, setActivePreset] = useState(() => loadStorage('aeroblade_preset_v2', 'highTorqueMicro400'));
  const [designWindSpeed, setDesignWindSpeed] = useState(() => loadStorage('aeroblade_design_wind', 3.6));
  const [designTsr, setDesignTsr] = useState(() => loadStorage('aeroblade_design_tsr', 4.5));
  const [viewMode, setViewMode] = useState('solid'); // 'solid' | 'wireframe' | 'ribs' | 'spar' | 'zebra'
  const [showSpar, setShowSpar] = useState(false);
  const [sliceModalOpen, setSliceModalOpen] = useState(false);
  const [activeSliceSpan, setActiveSliceSpan] = useState(0.5);

  // Slicing & Interlocking Joint State
  const [sliceEnabled, setSliceEnabled] = useState(false);
  const [maxZHeight, setMaxZHeight] = useState(220);
  const [jointParams, setJointParams] = useState({
    enabled: true,
    wallOffset: 3.0,
    frontCut: 5.0,
    backCut: 10.0,
    extrusionDepth: 8,
    clearance: 0.15,
    glueChannel: true,
    glueChannelWidth: 0.5,
    glueChannelDepth: 0.3,
    explodedDistance: 0,
  });

  // Optimizer State
  const [optimizing, setOptimizing] = useState(false);
  const [optimizeProgress, setOptimizeProgress] = useState(0);
  const [optimizeBestCp, setOptimizeBestCp] = useState(0);
  const [optimizeBestTorque, setOptimizeBestTorque] = useState(0);
  const [optimizeObjective, setOptimizeObjective] = useState('maxCp');

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem('aeroblade_params_v2', JSON.stringify(bladeParams));
  }, [bladeParams]);

  useEffect(() => {
    localStorage.setItem('aeroblade_preset_v2', JSON.stringify(activePreset));
  }, [activePreset]);

  useEffect(() => {
    localStorage.setItem('aeroblade_design_wind', JSON.stringify(designWindSpeed));
  }, [designWindSpeed]);

  useEffect(() => {
    localStorage.setItem('aeroblade_design_tsr', JSON.stringify(designTsr));
  }, [designTsr]);

  // Parse custom airfoils
  const parsedCustomAirfoils = useMemo(() => {
    return {
      root: bladeParams.customAirfoils?.root ? parseDatFile(bladeParams.customAirfoils.root) : null,
      mid: bladeParams.customAirfoils?.mid ? parseDatFile(bladeParams.customAirfoils.mid) : null,
      tip: bladeParams.customAirfoils?.tip ? parseDatFile(bladeParams.customAirfoils.tip) : null,
    };
  }, [bladeParams.customAirfoils]);

  // Generate 3D blade segments
  const segments = useMemo(
    () => generateSegments(bladeParams, parsedCustomAirfoils),
    [bladeParams, parsedCustomAirfoils]
  );

  // Design operating RPM (from design TSR)
  const designRpm = useMemo(() => {
    const R = bladeParams.radiusMm / 1000;
    return (designTsr * designWindSpeed * 60) / (2 * Math.PI * Math.max(0.1, R));
  }, [bladeParams.radiusMm, designTsr, designWindSpeed]);

  // Baseline BEM Evaluation at design condition
  const designBemResults = useMemo(() => {
    const R = bladeParams.radiusMm / 1000;
    const B = bladeParams.numBlades || 3;
    return solveBEM(segments, designWindSpeed, designRpm, R, B, 0);
  }, [segments, designWindSpeed, designRpm, bladeParams.radiusMm, bladeParams.numBlades]);

  // Power Curve (Sweep wind speeds from 2 to 15 m/s)
  const powerCurve = useMemo(() => {
    const R = bladeParams.radiusMm / 1000;
    const B = bladeParams.numBlades || 3;
    const curve = [];

    for (let v = 2; v <= 16; v += 0.5) {
      const optimalRpm = (designTsr * v * 60) / (2 * Math.PI * Math.max(0.1, R));
      const res = solveBEM(segments, v, optimalRpm, R, B, 0);
      curve.push({
        windSpeed: parseFloat(v.toFixed(1)),
        powerKw: parseFloat((res.totalPower / 1000).toFixed(3)),
        powerW: parseFloat(res.totalPower.toFixed(2)),
        cp: parseFloat(res.cp.toFixed(3)),
        thrustKn: parseFloat((res.totalThrust / 1000).toFixed(3)),
        torqueNm: parseFloat(res.totalTorque.toFixed(2)),
      });
    }
    return curve;
  }, [segments, designTsr, bladeParams.radiusMm, bladeParams.numBlades]);

  // Load Preset
  const loadPreset = useCallback(
    (key) => {
      setActivePreset(key);
      const preset = PRESETS[key];
      if (preset && preset.params) {
        setBladeParams(preset.params);
        if (preset.designWindSpeed) setDesignWindSpeed(preset.designWindSpeed);
        if (preset.designTsr) setDesignTsr(preset.designTsr);
      }
    },
    [setBladeParams]
  );

  // Update specific blade parameters
  const updateBladeParams = useCallback(
    (updater) => {
      setActivePreset('custom');
      setBladeParams(updater);
    },
    [setBladeParams]
  );

  // Run Auto-Optimizer
  const handleOptimize = useCallback(async () => {
    if (optimizing) return;
    setOptimizing(true);
    setOptimizeProgress(0);

    try {
      const result = await runOptimizer(
        bladeParams,
        designWindSpeed,
        designTsr,
        (progress, best) => {
          setOptimizeProgress(progress);
          if (best) {
            setOptimizeBestCp(best.cp || 0);
            setOptimizeBestTorque(best.totalTorque || 0);
          }
        },
        optimizeObjective
      );

      if (result && result.bestParams) {
        setBladeParams(result.bestParams);
        setActivePreset('custom');
      }
    } catch (e) {
      console.error('Optimization error:', e);
    } finally {
      setOptimizing(false);
    }
  }, [optimizing, bladeParams, designWindSpeed, designTsr, optimizeObjective, setBladeParams]);

  const value = {
    bladeParams,
    setBladeParams,
    updateBladeParams,
    history,
    activePreset,
    loadPreset,
    PRESETS,
    designWindSpeed,
    setDesignWindSpeed,
    designTsr,
    setDesignTsr,
    designRpm,
    designBemResults,
    powerCurve,
    segments,
    viewMode,
    setViewMode,
    showSpar,
    setShowSpar,
    sliceModalOpen,
    setSliceModalOpen,
    activeSliceSpan,
    setActiveSliceSpan,
    sliceEnabled,
    setSliceEnabled,
    maxZHeight,
    setMaxZHeight,
    jointParams,
    setJointParams,
    optimizing,
    optimizeProgress,
    optimizeBestCp,
    optimizeBestTorque,
    optimizeObjective,
    setOptimizeObjective,
    handleOptimize,
  };

  return <BladeContext.Provider value={value}>{children}</BladeContext.Provider>;
}

export function useBlade() {
  const ctx = useContext(BladeContext);
  if (!ctx) throw new Error('useBlade must be used within BladeProvider');
  return ctx;
}
