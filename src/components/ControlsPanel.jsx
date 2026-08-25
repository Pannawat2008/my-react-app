import { useState, useCallback, memo, useEffect } from 'react';
import { useBlade } from '../context/BladeContext';
import { calculateSchmitzOptimum } from '../engine/optimizer';
import JsonImportModal from './JsonImportModal';

/* ── Educational Help Tooltip Badge ── */
export function HelpTooltip({ text }) {
  return (
    <span className="help-tooltip-trigger" tabIndex={0} aria-label={text}>
      ?
      <span className="help-tooltip-popup">{text}</span>
    </span>
  );
}

/* ── Memoized Regional Airfoil & Shape Editor ── */
const RegionEditor = memo(function RegionEditor({ title, regionKey, data, onChange }) {
  const update = (field, value) => onChange(regionKey, field, value);

  return (
    <div className="cp-card" style={{ marginBottom: 12 }}>
      <div className="cp-card-title">{title}</div>

      <div className="cp-field-row">
        <span className="cp-field-label">
          Airfoil Family
          <HelpTooltip text="Aerodynamic cross-section contour. Thicker profiles provide structural stiffness; thinner profiles yield high lift-to-drag at speed." />
        </span>
      </div>
      <select
        className="cp-select"
        value={data.airfoil}
        onChange={(e) => update('airfoil', e.target.value)}
      >
        <optgroup label="── Low Reynolds Micro (High Lift) ──">
          <option value="SG6043">Selig SG6043 (10% High Lift / Low Re)</option>
        </optgroup>
        <optgroup label="── Thick Root (Structural) ──">
          <option value="DU91W2250">DU 91-W2-250 (25% Thick)</option>
          <option value="FFAW3241">FFA-W3-241 (24% Thick)</option>
        </optgroup>
        <optgroup label="── Mid-Span (High Lift) ──">
          <option value="S809">NREL S809 (21% Standard)</option>
          <option value="S822">NREL S822 (16% Small Turbine)</option>
          <option value="NACA63215">NACA 63-215 (15% Laminar)</option>
          <option value="NACA4412">NACA 4412 (12% Cambered)</option>
        </optgroup>
        <optgroup label="── Thin Tip (Low Drag) ──">
          <option value="NACA4412">NACA 4412 (12% Cambered)</option>
          <option value="NACA0012">NACA 0012 (12% Symmetric)</option>
          <option value="S833">NREL S833 (10% High TSR)</option>
          <option value="SG6043">Selig SG6043 (10% Low Re)</option>
        </optgroup>
        <optgroup label="── Custom Airfoil (.dat) ──">
          <option value="Custom">Custom Airfoil File</option>
        </optgroup>
      </select>

      {data.airfoil === 'Custom' && (
        <div className="cp-field-row" style={{ marginTop: 6, marginBottom: 12 }}>
          <label className="cp-upload-btn">
            {data.customPoints ? '✅ Custom .dat Loaded' : '📁 Upload Airfoil .dat'}
            <input
              type="file"
              accept=".dat,.txt"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (evt) => {
                  update('customPoints', evt.target.result);
                };
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      )}

      {/* Chord */}
      <div className="cp-field-row">
        <span className="cp-field-label">
          Chord Width
          <HelpTooltip text="Width of the blade cross-section from leading edge to trailing edge." />
        </span>
        <div className="cp-field-value">
          <input
            type="number"
            className="cp-number-input"
            value={data.chordMm}
            min="10"
            max="4000"
            onChange={(e) => update('chordMm', parseFloat(e.target.value) || 0)}
          />
          <span className="cp-unit">mm</span>
        </div>
      </div>
      <input
        type="range"
        className="cp-slider"
        min="10"
        max="3000"
        step="10"
        value={data.chordMm}
        onChange={(e) => update('chordMm', parseFloat(e.target.value))}
      />

      {/* Twist */}
      <div className="cp-field-row">
        <span className="cp-field-label">
          Twist Angle
          <HelpTooltip text="Aerodynamic pitch angle offset to match incoming relative flow angle along the span." />
        </span>
        <div className="cp-field-value">
          <input
            type="number"
            className="cp-number-input"
            value={data.twistDeg}
            step="0.5"
            onChange={(e) => update('twistDeg', parseFloat(e.target.value) || 0)}
          />
          <span className="cp-unit">°</span>
        </div>
      </div>
      <input
        type="range"
        className="cp-slider"
        min="-10"
        max="45"
        step="0.5"
        value={data.twistDeg}
        onChange={(e) => update('twistDeg', parseFloat(e.target.value))}
      />

      {/* Thickness */}
      <div className="cp-field-row">
        <span className="cp-field-label">
          Thickness Ratio (t/c)
          <HelpTooltip text="Profile thickness expressed as a percentage of chord length." />
        </span>
        <div className="cp-field-value">
          <input
            type="number"
            className="cp-number-input"
            value={data.thicknessPct}
            min="8"
            max="50"
            onChange={(e) => update('thicknessPct', parseFloat(e.target.value) || 0)}
          />
          <span className="cp-unit">%</span>
        </div>
      </div>
      <input
        type="range"
        className="cp-slider"
        min="8"
        max="45"
        step="1"
        value={data.thicknessPct}
        onChange={(e) => update('thicknessPct', parseFloat(e.target.value))}
      />
    </div>
  );
});

export default function ControlsPanel() {
  const {
    bladeParams,
    setBladeParams,
    activePreset,
    loadPreset,
    PRESETS,
    designWindSpeed,
    setDesignWindSpeed,
    designTsr,
    setDesignTsr,
    viewMode,
    setViewMode,
    setSliceModalOpen,
    setActiveSliceSpan,
  } = useBlade();

  // Accordion State
  const [openAccordions, setOpenAccordions] = useState({
    scale: true,
    regional: true,
    planform: false,
    aero: false,
    structural: false,
  });

  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const toggleAccordion = (key) => {
    setOpenAccordions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const expandAll = () => {
    setOpenAccordions({
      scale: true,
      regional: true,
      planform: true,
      aero: true,
      structural: true,
    });
  };

  const collapseAll = () => {
    setOpenAccordions({
      scale: false,
      regional: false,
      planform: false,
      aero: false,
      structural: false,
    });
  };

  const handleRegionChange = useCallback(
    (regionKey, field, value) => {
      setBladeParams((prev) => {
        const next = {
          ...prev,
          [regionKey]: { ...prev[regionKey], [field]: value },
        };
        if (field === 'customPoints') {
          next.customAirfoils = {
            ...(prev.customAirfoils || {}),
            [regionKey]: value,
          };
        } else if (field === 'airfoil' && value !== 'Custom') {
          if (next.customAirfoils && next.customAirfoils[regionKey]) {
            const nextCA = { ...next.customAirfoils };
            delete nextCA[regionKey];
            next.customAirfoils = nextCA;
          }
        }
        return next;
      });
    },
    [setBladeParams]
  );

  const handlePresetSelect = (presetKey) => {
    loadPreset(presetKey);
    showToast(`⚡ Loaded "${PRESETS[presetKey]?.label || presetKey}" (Ctrl+Z to undo)`);
  };

  const handleSaveProject = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(bladeParams, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `aeroblade_${(bladeParams.radiusMm / 1000).toFixed(1)}m.aeroblade`;
    a.click();
    showToast('💾 Project file saved to downloads!');
  };

  const handleLoadProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const loaded = JSON.parse(evt.target.result);
        if (loaded && loaded.radiusMm) {
          setBladeParams(loaded);
          showToast('📂 Design loaded successfully!');
        } else {
          alert('Invalid .aeroblade file.');
        }
      } catch {
        alert('Failed to parse file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const mp = bladeParams.midPosition ?? 0.5;
  const ml = bladeParams.midLength ?? 0.15;
  const midStart = Math.max(0.05, mp - ml / 2);
  const midEnd = Math.min(0.95, mp + ml / 2);
  const R_meters = bladeParams.radiusMm / 1000;

  const [jsonModalOpen, setJsonModalOpen] = useState(false);

  return (
    <div className="sidebar-scroll" style={{ padding: '12px 14px' }}>
      {/* ── Preset & Quick File Bar ── */}
      <div className="preset-bar" style={{ marginBottom: 10 }}>
        <label className="preset-label">
          Configuration Preset
          <HelpTooltip text="Pre-calibrated aerodynamic blade designs optimized for small, medium, and commercial wind classes." />
        </label>
        <select
          className="preset-select"
          value={activePreset}
          onChange={(e) => handlePresetSelect(e.target.value)}
        >
          {Object.entries(PRESETS).map(([key, p]) => (
            <option key={key} value={key}>
              {p.label}
            </option>
          ))}
        </select>

        <div className="preset-actions-row">
          <button className="panel-sub-btn" onClick={() => setJsonModalOpen(true)} title="Paste or Copy raw JSON code">
            📋 JSON Code
          </button>
          <button className="panel-sub-btn" onClick={handleSaveProject} title="Save project as JSON">
            💾 Save File
          </button>
          <label className="panel-sub-btn" title="Open saved .aeroblade file">
            📂 Load File
            <input type="file" accept=".aeroblade,.json" style={{ display: 'none' }} onChange={handleLoadProject} />
          </label>
        </div>
      </div>

      {/* ── 3D Viewport Render Mode Bar ── */}
      <div className="cp-viewmode-bar" style={{ marginBottom: 10 }}>
        <span className="cp-field-label">3D CAD View:</span>
        <div className="cp-viewmode-toggles">
          {[
            { id: 'solid', label: 'Solid' },
            { id: 'airflow', label: '💨 Flow' },
            { id: 'wireframe', label: 'Wire' },
            { id: 'ribs', label: 'Ribs' },
            { id: 'spar', label: 'Spar' },
          ].map((mode) => (
            <button
              key={mode.id}
              className={`cp-viewmode-btn ${viewMode === mode.id ? 'active' : ''}`}
              onClick={() => setViewMode(mode.id)}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2D Airfoil Cross-Section Slicer Launcher ── */}
      <button
        className="cp-slicer-launch-btn"
        style={{ marginBottom: 12 }}
        onClick={() => {
          setActiveSliceSpan(0.5);
          setSliceModalOpen(true);
        }}
      >
        <span style={{ fontSize: 16 }}>🔬</span> Inspect 2D Airfoil Cross-Section
      </button>

      {/* ── Accordion Toolbar (Expand All / Collapse All) ── */}
      <div className="accordion-toolbar">
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
          Parametric Settings
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="accordion-toggle-btn" onClick={expandAll}>
            Expand All
          </button>
          <button className="accordion-toggle-btn" onClick={collapseAll}>
            Collapse All
          </button>
        </div>
      </div>

      {/* ── 1. Accordion: Rotor Scale & Presets ── */}
      <div className={`cp-accordion ${openAccordions.scale ? 'expanded' : ''}`}>
        <div className="cp-accordion-header" onClick={() => toggleAccordion('scale')}>
          <div className="cp-accordion-title">
            <span className="cp-accordion-icon">📐</span>
            <span>Rotor Scale &amp; Operating</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cp-accordion-badge">{R_meters.toFixed(2)}m · {bladeParams.numBlades || 3}B</span>
            <span className="cp-accordion-chevron">▼</span>
          </div>
        </div>

        {openAccordions.scale && (
          <div className="cp-accordion-content animate-slideDown">
            {/* Rotor Radius */}
            <div className="cp-card">
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Blade Radius (R)
                  <HelpTooltip text="Total tip radius from rotor center in millimeters. Swept area grows with R²." />
                </span>
                <div className="cp-field-value">
                  <input
                    type="number"
                    className="cp-big-number-input"
                    value={bladeParams.radiusMm}
                    step="50"
                    min="100"
                    max="30000"
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        radiusMm: parseFloat(e.target.value) || 100,
                      }))
                    }
                  />
                  <span className="cp-unit">mm</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="200"
                max="10000"
                step="50"
                value={bladeParams.radiusMm}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    radiusMm: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="cp-hint">
                = {R_meters.toFixed(2)} m span &nbsp;|&nbsp; Swept Area: {(Math.PI * R_meters * R_meters).toFixed(2)} m²
              </div>
            </div>

            {/* Operating Wind Speed & TSR */}
            <div className="cp-card" style={{ marginTop: 8 }}>
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Rated Wind Speed
                  <HelpTooltip text="Annual mean or rated incoming wind velocity for optimal BEM design." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{designWindSpeed}</span>
                  <span className="cp-unit">m/s</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="2.5"
                max="20"
                step="0.5"
                value={designWindSpeed}
                onChange={(e) => setDesignWindSpeed(parseFloat(e.target.value))}
              />

              <div className="cp-field-row" style={{ marginTop: 6 }}>
                <span className="cp-field-label">
                  Design TSR (λ)
                  <HelpTooltip text="Tip Speed Ratio (ωR / V). Small DIY rotors typically target TSR 4–6; utility rotors target 7–9." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{designTsr}</span>
                  <span className="cp-unit">λ</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="3"
                max="12"
                step="0.2"
                value={designTsr}
                onChange={(e) => setDesignTsr(parseFloat(e.target.value))}
              />
            </div>

            {/* Blade Count & BEM Segments */}
            <div className="cp-card" style={{ marginTop: 8 }}>
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Blade Count (B)
                  <HelpTooltip text="3 blades provide aerodynamic and gyroscopic balance with high efficiency." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{bladeParams.numBlades || 3}</span>
                  <span className="cp-unit">blades</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="1"
                max="6"
                step="1"
                value={bladeParams.numBlades || 3}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    numBlades: parseInt(e.target.value),
                  }))
                }
              />

              <div className="cp-field-row" style={{ marginTop: 6 }}>
                <span className="cp-field-label">
                  BEM Segments
                  <HelpTooltip text="Radial slice resolution for Blade Element Momentum aerodynamic integration." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{bladeParams.numSegments ?? 16}</span>
                  <span className="cp-unit">nodes</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="8"
                max="32"
                step="2"
                value={bladeParams.numSegments ?? 16}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    numSegments: parseInt(e.target.value),
                  }))
                }
              />
            </div>
          </div>
        )}
      </div>

      {/* ── 2. Accordion: Regional Blade Geometry ── */}
      <div className={`cp-accordion ${openAccordions.regional ? 'expanded' : ''}`}>
        <div className="cp-accordion-header" onClick={() => toggleAccordion('regional')}>
          <div className="cp-accordion-title">
            <span className="cp-accordion-icon">🎐</span>
            <span>Regional Airfoil Geometry</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cp-accordion-badge">Root / Mid / Tip</span>
            <span className="cp-accordion-chevron">▼</span>
          </div>
        </div>

        {openAccordions.regional && (
          <div className="cp-accordion-content animate-slideDown">
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                type="button"
                className="cp-btn cp-btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(16, 185, 129, 0.15))',
                  border: '1px solid rgba(59, 130, 246, 0.4)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '8px 12px',
                  borderRadius: 6,
                }}
                onClick={() => {
                  const opt = calculateSchmitzOptimum(
                    bladeParams.radiusMm,
                    designTsr,
                    bladeParams.numBlades,
                    bladeParams.root.airfoil,
                    bladeParams.mid.airfoil,
                    bladeParams.tip.airfoil
                  );
                  setBladeParams((prev) => ({
                    ...prev,
                    root: { ...prev.root, chordMm: opt.root.chordMm, twistDeg: opt.root.twistDeg },
                    mid: { ...prev.mid, chordMm: opt.mid.chordMm, twistDeg: opt.mid.twistDeg },
                    tip: { ...prev.tip, chordMm: opt.tip.chordMm, twistDeg: opt.tip.twistDeg },
                  }));
                }}
              >
                <span>📐</span>
                <span>Auto-Compute Schmitz BEM Formula</span>
              </button>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4, textAlign: 'center' }}>
                Evaluates theoretical Schmitz equations: <code>c(r) = (16πr/BC_l)·sin²(φ/2)</code> &amp; <code>β = φ - α_opt</code>
              </div>
            </div>

            <RegionEditor
              title="🟤 Root Section (Structural / Hub Attachment)"
              regionKey="root"
              data={bladeParams.root}
              onChange={handleRegionChange}
            />
            <RegionEditor
              title="🔵 Mid-Span Section (Primary Power Production)"
              regionKey="mid"
              data={bladeParams.mid}
              onChange={handleRegionChange}
            />
            <RegionEditor
              title="🟢 Tip Section (Low Drag / Vortex Relief)"
              regionKey="tip"
              data={bladeParams.tip}
              onChange={handleRegionChange}
            />
          </div>
        )}
      </div>

      {/* ── 3. Accordion: Planform & Transitions ── */}
      <div className={`cp-accordion ${openAccordions.planform ? 'expanded' : ''}`}>
        <div className="cp-accordion-header" onClick={() => toggleAccordion('planform')}>
          <div className="cp-accordion-title">
            <span className="cp-accordion-icon">🌊</span>
            <span>Planform &amp; Span Transitions</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cp-accordion-badge">{bladeParams.planform || 'optimized'}</span>
            <span className="cp-accordion-chevron">▼</span>
          </div>
        </div>

        {openAccordions.planform && (
          <div className="cp-accordion-content animate-slideDown">
            <div className="cp-card">
              <div className="cp-field-row" style={{ marginBottom: 8 }}>
                <span className="cp-field-label">
                  Spanwise Planform Curve
                  <HelpTooltip text="Smooth cosine lofting produces continuous curvature and minimizes aerodynamic separation." />
                </span>
              </div>
              <div className="cp-planform-row">
                <button
                  className={`cp-planform-btn ${bladeParams.planform === 'linear' ? 'active' : ''}`}
                  onClick={() => setBladeParams((prev) => ({ ...prev, planform: 'linear' }))}
                >
                  Linear Taper
                </button>
                <button
                  className={`cp-planform-btn ${bladeParams.planform === 'optimized' ? 'active' : ''}`}
                  onClick={() => setBladeParams((prev) => ({ ...prev, planform: 'optimized' }))}
                >
                  Smooth Cosine
                </button>
              </div>

              {/* Mid-Span Center */}
              <div className="cp-field-row" style={{ marginTop: 12 }}>
                <span className="cp-field-label">
                  Mid-Span Center
                  <HelpTooltip text="Radial position of the primary high-lift power generating airfoil zone." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{((bladeParams.midPosition ?? 0.5) * 100).toFixed(0)}%</span>
                  <span className="cp-unit">of span</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0.15"
                max="0.85"
                step="0.05"
                value={bladeParams.midPosition ?? 0.5}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    midPosition: parseFloat(e.target.value),
                  }))
                }
              />

              {/* Mid-Span Width */}
              <div className="cp-field-row">
                <span className="cp-field-label">Mid-Span Plateau Width</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{((bladeParams.midLength ?? 0.15) * 100).toFixed(0)}%</span>
                  <span className="cp-unit">({((bladeParams.midLength ?? 0.15) * R_meters).toFixed(2)} m)</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0"
                max="0.5"
                step="0.02"
                value={bladeParams.midLength ?? 0.15}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    midLength: parseFloat(e.target.value),
                  }))
                }
              />

              {/* Span 3-Zone Visualizer */}
              <div className="cp-span-bar cp-span-bar-3zone" style={{ marginTop: 10 }}>
                <div className="cp-span-region cp-span-root" style={{ width: `${midStart * 100}%` }}>
                  {midStart > 0.12 && '🟤 Root'}
                </div>
                <div className="cp-span-region cp-span-mid" style={{ width: `${(midEnd - midStart) * 100}%` }}>
                  {midEnd - midStart > 0.08 && '🔵 Mid'}
                </div>
                <div className="cp-span-region cp-span-tip" style={{ width: `${(1 - midEnd) * 100}%` }}>
                  {1 - midEnd > 0.12 && '🟢 Tip'}
                </div>
              </div>
              <div className="cp-hint">
                Root: 0 – {(midStart * R_meters).toFixed(2)} m &nbsp;|&nbsp; Mid: {(midStart * R_meters).toFixed(2)} – {(midEnd * R_meters).toFixed(2)} m &nbsp;|&nbsp; Tip: {(midEnd * R_meters).toFixed(2)} – {R_meters.toFixed(2)} m
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 4. Accordion: Advanced Aero & Edge Modifiers ── */}
      <div className={`cp-accordion ${openAccordions.aero ? 'expanded' : ''}`}>
        <div className="cp-accordion-header" onClick={() => toggleAccordion('aero')}>
          <div className="cp-accordion-title">
            <span className="cp-accordion-icon">⚡</span>
            <span>Advanced Aero &amp; Modifiers</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cp-accordion-badge">Pre-Bend / Flap / Sweep</span>
            <span className="cp-accordion-chevron">▼</span>
          </div>
        </div>

        {openAccordions.aero && (
          <div className="cp-accordion-content animate-slideDown">
            <div className="cp-card">
              {/* LE Radius */}
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Leading Edge Bluntness
                  <HelpTooltip text="Modifies the leading-edge nose radius to soften stall characteristics in turbulent flow." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{(bladeParams.leRadiusMod || 1.0).toFixed(1)}x</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0.2"
                max="3.0"
                step="0.1"
                value={bladeParams.leRadiusMod ?? 1.0}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    leRadiusMod: parseFloat(e.target.value),
                  }))
                }
              />

              {/* TE Thickness */}
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Trailing Edge Thickness
                  <HelpTooltip text="Blunts trailing edge to ensure reliable 3D printing without knife-edge slicing artifacts." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{(bladeParams.teThicknessMm || 0.0).toFixed(1)}</span>
                  <span className="cp-unit">mm</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0"
                max="10"
                step="0.2"
                value={bladeParams.teThicknessMm ?? 0.0}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    teThicknessMm: parseFloat(e.target.value),
                  }))
                }
              />

              {/* TE Flap */}
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Trailing Edge Flap (Camber)
                  <HelpTooltip text="Deflects the aft 35% chord to increase maximum lift coefficient Cl." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{(bladeParams.teFlapDeg || 0.0).toFixed(1)}°</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="-15"
                max="15"
                step="0.5"
                value={bladeParams.teFlapDeg ?? 0}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    teFlapDeg: parseFloat(e.target.value),
                  }))
                }
              />

              {/* Pre-Bend */}
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Aeroelastic Pre-Bend
                  <HelpTooltip text="Pre-curves blade upwind so aerodynamic thrust deflection maintains safe tower clearance under gust loads." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{bladeParams.preBendMm || 0}</span>
                  <span className="cp-unit">mm</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0"
                max="500"
                step="10"
                value={bladeParams.preBendMm ?? 0}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    preBendMm: parseFloat(e.target.value),
                  }))
                }
              />

              {/* Sweep */}
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Tip Sweep Angle
                  <HelpTooltip text="Sweeps the tip backwards along the chord line to alleviate acoustic noise and tip vortex drag." />
                </span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{(bladeParams.sweepAngleDeg || 0).toFixed(1)}°</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0"
                max="15"
                step="0.5"
                value={bladeParams.sweepAngleDeg ?? 0}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    sweepAngleDeg: parseFloat(e.target.value),
                  }))
                }
              />

              {/* ── Hub Root Adapter ── */}
              <div className="cp-field-row" style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                <label className="cp-checkbox-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bladeParams.hubRootEnabled || false}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        hubRootEnabled: e.target.checked,
                      }))
                    }
                  />
                  <span>🔩 Cylindrical Hub Root Adapter</span>
                </label>
                <HelpTooltip text="Transitions the root from a circular cylinder (for hub/shaft bolt mounting) into the aerodynamic airfoil." />
              </div>

              {bladeParams.hubRootEnabled && (
                <div style={{ paddingLeft: 8, marginTop: 6, borderLeft: '2px solid var(--accent)' }}>
                  <div className="cp-field-row">
                    <span className="cp-field-label">Cylinder Diameter</span>
                    <div className="cp-field-value">
                      <span className="cp-value-highlight">{bladeParams.hubDiameterMm || 28}</span>
                      <span className="cp-unit">mm</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    className="cp-slider"
                    min="12"
                    max="120"
                    step="2"
                    value={bladeParams.hubDiameterMm ?? 28}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        hubDiameterMm: parseFloat(e.target.value),
                      }))
                    }
                  />

                  <div className="cp-field-row">
                    <span className="cp-field-label">Transition Length</span>
                    <div className="cp-field-value">
                      <span className="cp-value-highlight">{bladeParams.hubTransitionPct || 10}</span>
                      <span className="cp-unit">% span</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    className="cp-slider"
                    min="5"
                    max="25"
                    step="1"
                    value={bladeParams.hubTransitionPct ?? 10}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        hubTransitionPct: parseFloat(e.target.value),
                      }))
                    }
                  />
                </div>
              )}

              {/* ── Parametric Tip Winglet ── */}
              <div className="cp-field-row" style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid var(--border-subtle)' }}>
                <label className="cp-checkbox-label" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={bladeParams.wingletEnabled || false}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        wingletEnabled: e.target.checked,
                      }))
                    }
                  />
                  <span>🕊️ Aerodynamic Tip Winglet</span>
                </label>
                <HelpTooltip text="Up-turned winglet tip suppresses induced tip vortex shedding and attenuates aerodynamic noise." />
              </div>

              {bladeParams.wingletEnabled && (
                <div style={{ paddingLeft: 8, marginTop: 6, borderLeft: '2px solid #10b981' }}>
                  <div className="cp-field-row">
                    <span className="cp-field-label">Winglet Height</span>
                    <div className="cp-field-value">
                      <span className="cp-value-highlight">{bladeParams.wingletHeightMm || 25}</span>
                      <span className="cp-unit">mm</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    className="cp-slider"
                    min="5"
                    max="100"
                    step="5"
                    value={bladeParams.wingletHeightMm ?? 25}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        wingletHeightMm: parseFloat(e.target.value),
                      }))
                    }
                  />

                  <div className="cp-field-row">
                    <span className="cp-field-label">Cant Angle</span>
                    <div className="cp-field-value">
                      <span className="cp-value-highlight">{bladeParams.wingletAngleDeg || 75}</span>
                      <span className="cp-unit">°</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    className="cp-slider"
                    min="30"
                    max="90"
                    step="5"
                    value={bladeParams.wingletAngleDeg ?? 75}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        wingletAngleDeg: parseFloat(e.target.value),
                      }))
                    }
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── 5. Accordion: Structural Reinforcement ── */}
      <div className={`cp-accordion ${openAccordions.structural ? 'expanded' : ''}`}>
        <div className="cp-accordion-header" onClick={() => toggleAccordion('structural')}>
          <div className="cp-accordion-title">
            <span className="cp-accordion-icon">🏗️</span>
            <span>Internal Spar &amp; Carbon Rod</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="cp-accordion-badge">
              {bladeParams.carbonRodDia > 0 ? `Ø ${bladeParams.carbonRodDia}mm` : 'Hollow'}
            </span>
            <span className="cp-accordion-chevron">▼</span>
          </div>
        </div>

        {openAccordions.structural && (
          <div className="cp-accordion-content animate-slideDown">
            <div className="cp-card">
              <div className="cp-field-row">
                <span className="cp-field-label">
                  Carbon Rod Channel (Ø)
                  <HelpTooltip text="Cylindrical hollow core along quarter-chord for inserting pultruded carbon fiber rods for bending stiffness." />
                </span>
                <div className="cp-field-value">
                  <input
                    type="number"
                    className="cp-number-input"
                    value={bladeParams.carbonRodDia ?? 0}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        carbonRodDia: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <span className="cp-unit">mm</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0"
                max="60"
                step="1"
                value={bladeParams.carbonRodDia ?? 0}
                onChange={(e) =>
                  setBladeParams((prev) => ({
                    ...prev,
                    carbonRodDia: parseFloat(e.target.value),
                  }))
                }
              />

              {bladeParams.carbonRodDia > 0 && (
                <>
                  <div className="cp-field-row" style={{ marginTop: 8 }}>
                    <span className="cp-field-label">Channel Insertion Depth</span>
                    <div className="cp-field-value">
                      <span className="cp-value-highlight">{bladeParams.carbonRodDepthPct ?? 100}%</span>
                    </div>
                  </div>
                  <input
                    type="range"
                    className="cp-slider"
                    min="10"
                    max="100"
                    step="5"
                    value={bladeParams.carbonRodDepthPct ?? 100}
                    onChange={(e) =>
                      setBladeParams((prev) => ({
                        ...prev,
                        carbonRodDepthPct: parseFloat(e.target.value),
                      }))
                    }
                  />
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── App Toast Notification ── */}
      {toastMessage && (
        <div className="app-toast animate-fadeIn">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── JSON Code Import & Export Modal ── */}
      <JsonImportModal isOpen={jsonModalOpen} onClose={() => setJsonModalOpen(false)} />
    </div>
  );
}
