import React, { useState, useCallback, memo } from 'react';

/* ── Memoized Region Editor ── */
const RegionEditor = memo(function RegionEditor({ title, regionKey, data, onChange }) {
  const update = (field, value) => onChange(regionKey, field, value);

  return (
    <div className="cp-card">
      <div className="cp-card-title">{title}</div>

      <div className="cp-field-row">
        <span className="cp-field-label">Airfoil</span>
      </div>
      <select
        className="cp-select"
        value={data.airfoil}
        onChange={(e) => update('airfoil', e.target.value)}
      >
        <optgroup label="── Thick / Root ──">
          <option value="DU91W2250">DU 91-W2-250 (25%)</option>
          <option value="FFAW3241">FFA-W3-241 (24%)</option>
        </optgroup>
        <optgroup label="── Standard / Mid ──">
          <option value="S809">NREL S809 (21%)</option>
          <option value="S822">NREL S822 (16%)</option>
          <option value="NACA63215">NACA 63-215 (15%)</option>
        </optgroup>
        <optgroup label="── Thin / Tip ──">
          <option value="NACA4412">NACA 4412 (12%)</option>
          <option value="NACA0012">NACA 0012 Symmetric (12%)</option>
          <option value="S833">NREL S833 (10%)</option>
        </optgroup>
        <optgroup label="── Custom ──">
          <option value="Custom">Custom Airfoil (.dat)</option>
        </optgroup>
      </select>

      {data.airfoil === 'Custom' && (
        <div className="cp-field-row" style={{ marginTop: 8 }}>
          <label 
            style={{ flex: 1, padding: '6px', background: 'var(--bg-panel)', border: '1px dashed var(--border)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer', textAlign: 'center', fontSize: '0.85em' }}
          >
            {data.customPoints ? '✅ Loaded' : 'Upload .dat file'}
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

      <div className="cp-field-row" style={{ marginTop: data.airfoil === 'Custom' ? 8 : 16 }}>
        <span className="cp-field-label">Chord Length</span>
        <div className="cp-field-value">
          <input
            type="number"
            className="cp-number-input"
            value={data.chordMm}
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

      <div className="cp-field-row">
        <span className="cp-field-label">Twist Angle</span>
        <div className="cp-field-value">
          <input
            type="number"
            className="cp-number-input"
            value={data.twistDeg}
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

      <div className="cp-field-row">
        <span className="cp-field-label">Thickness</span>
        <div className="cp-field-value">
          <input
            type="number"
            className="cp-number-input"
            value={data.thicknessPct}
            onChange={(e) => update('thicknessPct', parseFloat(e.target.value) || 0)}
          />
          <span className="cp-unit">%</span>
        </div>
      </div>
      <input
        type="range"
        className="cp-slider"
        min="8"
        max="50"
        step="1"
        value={data.thicknessPct}
        onChange={(e) => update('thicknessPct', parseFloat(e.target.value))}
      />
    </div>
  );
});

/* ──────────────────────────────────────────── */
/*             CONTROLS PANEL                   */
/* ──────────────────────────────────────────── */
export default function ControlsPanel({
  params,
  setParams,
  windSpeed,
  setWindSpeed,
  tsr,
  setTsr,
  showSpar,
  setShowSpar,
}) {
  // Collapsible section state
  const [openSections, setOpenSections] = useState({
    geometry: true,
    regional: true,
    operating: true,
    structural: true,
  });

  const toggleSection = (key) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Stable callback for region changes
  const handleRegionChange = useCallback(
    (regionKey, field, value) => {
      setParams((prev) => ({
        ...prev,
        [regionKey]: { ...prev[regionKey], [field]: value },
      }));
    },
    [setParams]
  );

  // Save / Load Handlers
  const handleSaveProject = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(params, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = "my_blade.aeroblade";
    a.click();
  };

  const handleLoadProject = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const loadedParams = JSON.parse(evt.target.result);
        if (loadedParams && loadedParams.radiusMm) {
          setParams(loadedParams);
        } else {
          alert('Invalid .aeroblade file format.');
        }
      } catch (err) {
        alert('Failed to parse file.');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  return (
    <div>
      {/* ── Project Management ── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', padding: '0 12px' }}>
        <button 
          onClick={handleSaveProject}
          style={{ flex: 1, padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          💾 Save
        </button>
        <label 
          style={{ flex: 1, padding: '8px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          📁 Load
          <input type="file" accept=".aeroblade,.json" style={{ display: 'none' }} onChange={handleLoadProject} />
        </label>
      </div>

      {/* ── Global Geometry ── */}
      <div className="cp-section">
        <button className="cp-section-header" onClick={() => toggleSection('geometry')}>
          <span className="cp-section-title">
            <span className="cp-title-icon">📐</span> Global Geometry
          </span>
          <span className={`cp-chevron ${openSections.geometry ? 'open' : ''}`}>▸</span>
        </button>

        {openSections.geometry && (
          <div className="cp-section-body animate-slideDown">
            <div className="cp-card">
              <div className="cp-field-row">
                <span className="cp-field-label">Blade Length (R)</span>
                <div className="cp-field-value">
                  <input
                    type="number"
                    className="cp-big-number-input"
                    value={params.radiusMm}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        radiusMm: parseFloat(e.target.value) || 0,
                      }))
                    }
                  />
                  <span className="cp-unit">mm</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="100"
                max="20000"
                step="100"
                value={params.radiusMm}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    radiusMm: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="cp-hint">
                = {(params.radiusMm / 1000).toFixed(1)} m &nbsp;|&nbsp; Ø{' '}
                {((params.radiusMm * 2) / 1000).toFixed(1)} m
              </div>
            </div>

            <div className="cp-card">
              <div className="cp-field-row" style={{ marginBottom: 8 }}>
                <span className="cp-field-label">Planform Shape</span>
              </div>
              <div className="cp-planform-row">
                <button
                  className={`cp-planform-btn ${params.planform === 'linear' ? 'active' : ''}`}
                  onClick={() =>
                    setParams((prev) => ({ ...prev, planform: 'linear' }))
                  }
                >
                  Linear Taper
                </button>
                <button
                  className={`cp-planform-btn ${params.planform === 'optimized' ? 'active' : ''}`}
                  onClick={() =>
                    setParams((prev) => ({ ...prev, planform: 'optimized' }))
                  }
                >
                  Optimized Curve
                </button>
              </div>
            </div>

            {/* Mid-Span Position & Length */}
            <div className="cp-card">
              <div className="cp-card-title">🔵 Mid-Span Region</div>

              <div className="cp-field-row">
                <span className="cp-field-label">Center Position</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">
                    {((params.midPosition ?? 0.5) * 100).toFixed(0)}%
                  </span>
                  <span className="cp-unit">of span</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0.15"
                max="0.85"
                step="0.05"
                value={params.midPosition ?? 0.5}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    midPosition: parseFloat(e.target.value),
                  }))
                }
              />

              <div className="cp-field-row">
                <span className="cp-field-label">Mid-Span Length</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">
                    {((params.midLength ?? 0) * 100).toFixed(0)}%
                  </span>
                  <span className="cp-unit">
                    ({((params.midLength ?? 0) * (params.radiusMm / 1000)).toFixed(2)} m)
                  </span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0"
                max="0.5"
                step="0.05"
                value={params.midLength ?? 0}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    midLength: parseFloat(e.target.value),
                  }))
                }
              />

              {/* Visual span bar — 3 zones */}
              {(() => {
                const mp = params.midPosition ?? 0.5;
                const ml = params.midLength ?? 0;
                const midStart = Math.max(0.05, mp - ml / 2);
                const midEnd = Math.min(0.95, mp + ml / 2);
                const R = params.radiusMm / 1000;
                return (
                  <>
                    <div className="cp-span-bar cp-span-bar-3zone">
                      <div
                        className="cp-span-region cp-span-root"
                        style={{ width: `${midStart * 100}%` }}
                      >
                        {midStart > 0.12 && '🟤 Root'}
                      </div>
                      <div
                        className="cp-span-region cp-span-mid"
                        style={{ width: `${(midEnd - midStart) * 100}%` }}
                      >
                        {(midEnd - midStart) > 0.08 && '🔵 Mid'}
                      </div>
                      <div
                        className="cp-span-region cp-span-tip"
                        style={{ width: `${(1 - midEnd) * 100}%` }}
                      >
                        {(1 - midEnd) > 0.12 && '🟢 Tip'}
                      </div>
                    </div>
                    <div className="cp-hint">
                      Root: 0 – {(midStart * R).toFixed(2)} m
                      &nbsp;|&nbsp;
                      Mid: {(midStart * R).toFixed(2)} – {(midEnd * R).toFixed(2)} m
                      &nbsp;|&nbsp;
                      Tip: {(midEnd * R).toFixed(2)} – {R.toFixed(2)} m
                    </div>
                  </>
                );
              })()}
            </div>

            {/* Number of Segments */}
            <div className="cp-card">
              <div className="cp-field-row">
                <span className="cp-field-label">Blade Segments</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{params.numSegments ?? 15}</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="5"
                max="30"
                step="1"
                value={params.numSegments ?? 15}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    numSegments: parseInt(e.target.value),
                  }))
                }
              />
              <div className="cp-hint">
                More segments = higher accuracy, slower computation
              </div>
            </div>

            {/* Carbon Rod Hole */}
            <div className="cp-card">
              <div className="cp-field-row">
                <span className="cp-field-label">Carbon Rod Hole (Ø)</span>
                <div className="cp-field-value">
                  <input
                    type="number"
                    className="cp-number-input"
                    value={params.carbonRodDia ?? 0}
                    onChange={(e) =>
                      setParams((prev) => ({
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
                max="50"
                step="1"
                value={params.carbonRodDia ?? 0}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    carbonRodDia: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="cp-hint" style={{ marginBottom: 12 }}>
                {params.carbonRodDia > 0 ? `Hollow channel cut through the pitch axis` : 'Solid blade (no hole)'}
              </div>

              {params.carbonRodDia > 0 && (
                <>
                  <div className="cp-field-row">
                    <span className="cp-field-label">Carbon Rod Depth</span>
                    <div className="cp-field-value">
                      <span className="cp-value-highlight">
                        {params.carbonRodDepthPct ?? 100}%
                      </span>
                    </div>
                  </div>
                  <input
                    type="range"
                    className="cp-slider"
                    min="10"
                    max="100"
                    step="5"
                    value={params.carbonRodDepthPct ?? 100}
                    onChange={(e) =>
                      setParams((prev) => ({
                        ...prev,
                        carbonRodDepthPct: parseFloat(e.target.value),
                      }))
                    }
                  />
                  <div className="cp-hint">
                    Depth into blade span (100% = straight through)
                  </div>
                </>
              )}

              <div className="cp-divider" />

              <div className="cp-group-title">Edge Modifiers</div>
              <div className="cp-field-row">
                <span className="cp-field-label">Leading Edge Radius</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">
                    {params.leRadiusMod?.toFixed(1) || '1.0'}x
                  </span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0.1"
                max="3.0"
                step="0.1"
                value={params.leRadiusMod ?? 1.0}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    leRadiusMod: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="cp-hint" style={{ marginBottom: 12 }}>
                1.0x is standard NACA. &gt;1.0x is blunter.
              </div>

              <div className="cp-field-row">
                <span className="cp-field-label">Trailing Edge Thickness</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">
                    {params.teThicknessMm?.toFixed(1) || '0.0'} mm
                  </span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="0"
                max="10"
                step="0.1"
                value={params.teThicknessMm ?? 0.0}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    teThicknessMm: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="cp-hint" style={{ marginBottom: 12 }}>
                Flat blunt edge at the rear (good for 3D printing).
              </div>

              <div className="cp-field-row">
                <span className="cp-field-label">Trailing Edge Flap</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">
                    {params.teFlapDeg?.toFixed(1) || '0.0'}°
                  </span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="-15"
                max="15"
                step="0.5"
                value={params.teFlapDeg ?? 0}
                onChange={(e) =>
                  setParams((prev) => ({
                    ...prev,
                    teFlapDeg: parseFloat(e.target.value),
                  }))
                }
              />
              <div className="cp-hint">
                Bend trailing edge up (reflex) or down (camber).
              </div>
            </div>
          </div>
        )}
      </div>

      <hr className="cp-divider" />

      {/* ── Regional Design ── */}
      <div className="cp-section">
        <button className="cp-section-header" onClick={() => toggleSection('regional')}>
          <span className="cp-section-title">
            <span className="cp-title-icon">🔧</span> Regional Design
          </span>
          <span className={`cp-chevron ${openSections.regional ? 'open' : ''}`}>▸</span>
        </button>

        {openSections.regional && (
          <div className="cp-section-body animate-slideDown">
            <RegionEditor
              title="🟤 Root Region (Structural)"
              regionKey="root"
              data={params.root}
              onChange={handleRegionChange}
            />
            <RegionEditor
              title="🔵 Mid-Span (Power Focus)"
              regionKey="mid"
              data={params.mid}
              onChange={handleRegionChange}
            />
            <RegionEditor
              title="🟢 Tip Region (Low Loss)"
              regionKey="tip"
              data={params.tip}
              onChange={handleRegionChange}
            />
          </div>
        )}
      </div>

      <hr className="cp-divider" />

      {/* ── Operating Conditions ── */}
      <div className="cp-section">
        <button className="cp-section-header" onClick={() => toggleSection('operating')}>
          <span className="cp-section-title">
            <span className="cp-title-icon">💨</span> Operating Conditions
          </span>
          <span className={`cp-chevron ${openSections.operating ? 'open' : ''}`}>▸</span>
        </button>

        {openSections.operating && (
          <div className="cp-section-body animate-slideDown">
            <div className="cp-card">
              <div className="cp-field-row">
                <span className="cp-field-label">Wind Speed</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{windSpeed}</span>
                  <span className="cp-unit">m/s</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="3"
                max="25"
                step="0.5"
                value={windSpeed}
                onChange={(e) => setWindSpeed(parseFloat(e.target.value))}
              />

              <div className="cp-field-row">
                <span className="cp-field-label" title="Used to calculate the Power Curve. Live RPM is physically simulated.">Design TSR (For Power Curve)</span>
                <div className="cp-field-value">
                  <span className="cp-value-highlight">{tsr}</span>
                </div>
              </div>
              <input
                type="range"
                className="cp-slider"
                min="3"
                max="12"
                step="0.5"
                value={tsr}
                onChange={(e) => setTsr(parseFloat(e.target.value))}
              />
            </div>
          </div>
        )}
      </div>

      <hr className="cp-divider" />

      {/* ── Structural ── */}
      <div className="cp-section">
        <button className="cp-section-header" onClick={() => toggleSection('structural')}>
          <span className="cp-section-title">
            <span className="cp-title-icon">🏗️</span> Structural
          </span>
          <span className={`cp-chevron ${openSections.structural ? 'open' : ''}`}>▸</span>
        </button>

        {openSections.structural && (
          <div className="cp-section-body animate-slideDown">
            <label className="cp-toggle-row">
              <input
                type="checkbox"
                className="cp-checkbox"
                checked={showSpar}
                onChange={(e) => setShowSpar(e.target.checked)}
              />
              <span className="cp-toggle-label">Show Spar Caps &amp; Web</span>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
