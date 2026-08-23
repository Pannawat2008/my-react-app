import { createContext, useContext, useState, useCallback } from 'react';
import { useCreateStore } from 'leva';
import { findBestGearStages } from '../utils/gearOptimizer';

export const GEAR_PRESETS = {
  singleStage1to4: {
    name: '⚡ 1:4.0 Single-Stage Step-Up',
    description: 'Direct step-up for small DIY alternators (32T Gear + 8T Pinion, Module 2.5).',
    stages: [{ numTeeth: 32, pinionTeeth: 8, module: 2.5, pinionModule: 2.5 }],
  },
  twoStage1to16: {
    name: '⚙️ 1:16.0 Two-Stage Compound',
    description: 'High-efficiency 2-stage compound gearbox for medium turbines (40T/10T × 40T/10T).',
    stages: [
      { numTeeth: 40, pinionTeeth: 10, module: 2.0, pinionModule: 2.0 },
      { numTeeth: 40, pinionTeeth: 10, module: 1.5, pinionModule: 1.5 },
    ],
  },
  highTorque1to64: {
    name: '🚀 1:64.0 Three-Stage High-Torque',
    description: '3-stage extreme reduction / step-up for utility direct generators (48T/12T × 48T/12T × 48T/12T).',
    stages: [
      { numTeeth: 48, pinionTeeth: 12, module: 2.5, pinionModule: 2.5 },
      { numTeeth: 48, pinionTeeth: 12, module: 2.0, pinionModule: 2.0 },
      { numTeeth: 48, pinionTeeth: 12, module: 1.5, pinionModule: 1.5 },
    ],
  },
  nema17Direct: {
    name: '🔩 NEMA 17 Stepper (D-Shaft 5mm)',
    description: 'Precision 1:5 step-up with 5mm D-shaft bore flat for NEMA 17 stepper motors.',
    stages: [
      {
        numTeeth: 40,
        pinionTeeth: 8,
        module: 1.5,
        pinionModule: 1.5,
        boreType: 'd-shaft',
        boreDiameter: 5.0,
        dShaftFlat: 0.5,
      },
    ],
  },
};

const GearContext = createContext(null);

export function GearProvider({ children }) {
  const gearStore = useCreateStore();
  const [explodedPct, setExplodedPct] = useState(0.0); // 0.0 to 1.0 continuous exploded view
  const [gearRatio, setGearRatio] = useState(1.0);
  const [activePreset, setActivePreset] = useState('twoStage1to16');

  // Apply updates to the Leva store safely
  const applyLevaUpdates = useCallback(
    (updates) => {
      if (!gearStore) return;
      try {
        if (gearStore.set) {
          gearStore.set(updates);
        } else if (gearStore.setState) {
          const currentData = gearStore.getState()?.data;
          if (currentData) {
            Object.keys(updates).forEach((key) => {
              if (currentData[key]) {
                gearStore.getState().setValueAtPath(key, updates[key], true);
              }
            });
          }
        }
      } catch (e) {
        console.warn('Leva store update exception:', e);
      }
    },
    [gearStore]
  );

  // Apply a named preset
  const applyPreset = useCallback(
    (presetKey) => {
      const preset = GEAR_PRESETS[presetKey];
      if (!preset) return;
      setActivePreset(presetKey);

      const updates = {
        'Global Settings.numStages': preset.stages.length,
      };

      preset.stages.forEach((stage, idx) => {
        const p = `s${idx}`;
        if (stage.numTeeth) updates[`Stage ${idx + 1}.Gear Geometry.${p}_numTeeth`] = stage.numTeeth;
        if (stage.module) updates[`Stage ${idx + 1}.Gear Geometry.${p}_module`] = stage.module;
        if (stage.pinionTeeth) {
          updates[`Stage ${idx + 1}.Pinion.${p}_pinionTeeth`] = stage.pinionTeeth;
          updates[`Stage ${idx + 1}.Pinion.${p}_hasPinion`] = true;
        }
        if (stage.pinionModule) updates[`Stage ${idx + 1}.Pinion.${p}_pinionModule`] = stage.pinionModule;
        if (stage.boreType) updates[`Stage ${idx + 1}.Hub & Bore.${p}_boreType`] = stage.boreType;
        if (stage.boreDiameter) updates[`Stage ${idx + 1}.Hub & Bore.${p}_boreDiameter`] = stage.boreDiameter;
        if (stage.dShaftFlat) updates[`Stage ${idx + 1}.Hub & Bore.${p}_dShaftFlat`] = stage.dShaftFlat;
      });

      applyLevaUpdates(updates);
    },
    [applyLevaUpdates]
  );

  // Auto-optimize gear ratio to match target turbine-generator ratio
  const autoOptimizeGearRatio = useCallback(
    (targetRatio) => {
      if (!targetRatio || targetRatio <= 0) return null;
      const best = findBestGearStages(targetRatio);

      if (best && best.stages) {
        const updates = { 'Global Settings.numStages': best.stages.length };
        best.stages.forEach((stage, idx) => {
          const p = `s${idx}`;
          updates[`Stage ${idx + 1}.Gear Geometry.${p}_numTeeth`] = stage.numTeeth;
          updates[`Stage ${idx + 1}.Pinion.${p}_pinionTeeth`] = stage.pinionTeeth;
          updates[`Stage ${idx + 1}.Pinion.${p}_hasPinion`] = true;
        });
        applyLevaUpdates(updates);
      }
      return best;
    },
    [applyLevaUpdates]
  );

  const value = {
    gearStore,
    explodedPct,
    setExplodedPct,
    gearRatio,
    setGearRatio,
    activePreset,
    applyPreset,
    autoOptimizeGearRatio,
  };

  return <GearContext.Provider value={value}>{children}</GearContext.Provider>;
}

export function useGear() {
  const ctx = useContext(GearContext);
  if (!ctx) throw new Error('useGear must be used within GearProvider');
  return ctx;
}
