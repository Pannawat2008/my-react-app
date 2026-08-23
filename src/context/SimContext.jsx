import { createContext, useContext, useState, useEffect } from 'react';

function loadStorage(key, fallback) {
  try {
    const val = localStorage.getItem(key);
    return val !== null ? JSON.parse(val) : fallback;
  } catch {
    return fallback;
  }
}

const SimContext = createContext(null);

export function SimProvider({ children }) {
  const [simPlaying, setSimPlaying] = useState(true);
  const [windSpeed, setWindSpeed] = useState(() => loadStorage('aeroblade_sim_wind', 3.6));
  const [bladePitch, setBladePitch] = useState(0);
  const [timeScale, setTimeScale] = useState(1.0);
  const [showParticles, setShowParticles] = useState(true);
  const [tunnelScale, setTunnelScale] = useState(2.2);
  const [heatmapProperty, setHeatmapProperty] = useState('None'); // 'None' | 'Torque' | 'Lift Coeff' | 'Drag Coeff' | 'Angle of Attack' | 'Induction'

  // Generator & Electrical Load Model
  const [loadModel, setLoadModel] = useState('Realistic DC Motor'); // 'Realistic DC Motor' | 'Constant Friction' | 'Simple (%)'
  const [generatorLoad, setGeneratorLoad] = useState(15);
  const [constantLoadGcm, setConstantLoadGcm] = useState(4.0); // g.cm cogging torque
  const [ratedPowerW, setRatedPowerW] = useState(5.0); // Watts
  const [ratedRpm, setRatedRpm] = useState(430); // RPM matched to 3.6 m/s optimal TSR

  // Real-time Dynamic Telemetry
  const [liveRpm, setLiveRpm] = useState(0);
  const [liveElectricalPowerW, setLiveElectricalPowerW] = useState(0);
  const [liveAeroTorqueNm, setLiveAeroTorqueNm] = useState(0);
  const [liveThrustN, setLiveThrustN] = useState(0);
  const [overlayMinimized, setOverlayMinimized] = useState(false);

  useEffect(() => {
    localStorage.setItem('aeroblade_sim_wind', JSON.stringify(windSpeed));
  }, [windSpeed]);

  const value = {
    simPlaying,
    setSimPlaying,
    windSpeed,
    setWindSpeed,
    bladePitch,
    setBladePitch,
    timeScale,
    setTimeScale,
    showParticles,
    setShowParticles,
    tunnelScale,
    setTunnelScale,
    heatmapProperty,
    setHeatmapProperty,
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
    setLiveRpm,
    liveElectricalPowerW,
    setLiveElectricalPowerW,
    liveAeroTorqueNm,
    setLiveAeroTorqueNm,
    liveThrustN,
    setLiveThrustN,
    overlayMinimized,
    setOverlayMinimized,
  };

  return <SimContext.Provider value={value}>{children}</SimContext.Provider>;
}

export function useSim() {
  const ctx = useContext(SimContext);
  if (!ctx) throw new Error('useSim must be used within SimProvider');
  return ctx;
}
