import { useState } from 'react';
import { useBlade } from '../context/BladeContext';
import JsonImportModal from './JsonImportModal';
import {
  exportCSV,
  exportFusionCSV,
  exportSTL,
  exportOBJ,
  exportASC,
  exportJSON,
  exportAirfoilDAT,
  exportCompleteBladePackage,
} from '../utils/exporters';
import { exportPDF } from '../utils/pdfReport';

export default function ExportPanel() {
  const {
    bladeParams,
    setBladeParams,
    designWindSpeed,
    designTsr,
    designBemResults,
    powerCurve,
    segments,
    optimizing,
    optimizeProgress,
    optimizeBestCp,
    optimizeBestTorque,
    optimizeObjective,
    setOptimizeObjective,
    handleOptimize,
    sliceEnabled,
    setSliceEnabled,
    maxZHeight,
    setMaxZHeight,
    jointParams,
    setJointParams,
  } = useBlade();

  const [jsonModalOpen, setJsonModalOpen] = useState(false);
  const [exportingPackage, setExportingPackage] = useState(false);

  const safeParams = bladeParams || {};
  const safeJointParams = {
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
    ...(jointParams || {}),
  };

  const R_mm = safeParams.radiusMm || 500;
  const numBlades = safeParams.numBlades || 3;
  const holeR_mm = (safeParams.carbonRodDia || 0) / 2;

  // Approximate solid blade volume in cm^3
  const volumeCm3 = (segments || []).reduce((acc, seg, i) => {
    let drMm;
    if (segments.length === 1) {
      drMm = R_mm;
    } else if (i === 0) {
      drMm = (segments[1].r - seg.r) * 1000;
    } else if (i === segments.length - 1) {
      drMm = (seg.r - segments[i - 1].r) * 1000;
    } else {
      drMm = ((segments[i + 1].r - segments[i - 1].r) / 2) * 1000;
    }
    const chordMm = (seg?.chord || 0.05) * 1000;
    const thickRatio = seg?.thicknessRatio || 0.12;
    const airfoilAreaMm2 = 0.68 * chordMm * (chordMm * thickRatio);
    const holeAreaMm2 = Math.PI * holeR_mm * holeR_mm;
    const netAreaMm2 = Math.max(0, airfoilAreaMm2 - holeAreaMm2);
    return acc + (netAreaMm2 * Math.max(1, drMm)) / 1000;
  }, 0);

  // Estimates assuming standard 25% infill + 3 perimeters (~45% effective solid density)
  const plaSingleGrams = Math.max(1, Math.round(volumeCm3 * 1.24 * 0.45));
  const plaRotorGrams = plaSingleGrams * numBlades;
  const petgSingleGrams = Math.max(1, Math.round(volumeCm3 * 1.27 * 0.45));
  const estimatedPrintParts = sliceEnabled && maxZHeight > 0 ? Math.ceil(R_mm / maxZHeight) : 1;

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.aeroblade';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const data = JSON.parse(evt.target.result);
          const newParams = data.bladeParams || (data.radiusMm ? data : null);
          if (newParams) {
            setBladeParams((prev) => ({
              ...prev,
              ...newParams,
              root: { ...prev.root, ...(newParams.root || {}) },
              mid: { ...prev.mid, ...(newParams.mid || {}) },
              tip: { ...prev.tip, ...(newParams.tip || {}) },
              carbonRodPosPct: newParams.carbonRodPosPct ?? prev.carbonRodPosPct ?? 30,
              carbonRodYOffsetMm: newParams.carbonRodYOffsetMm ?? prev.carbonRodYOffsetMm ?? 0,
            }));
            if (data.windSpeed) setDesignWindSpeed(parseFloat(data.windSpeed));
            if (data.tsr) setDesignTsr(parseFloat(data.tsr));
          }
        } catch {
          alert('Invalid JSON file');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const updateJointParam = (key, value) => {
    setJointParams(prev => ({ ...(prev || {}), [key]: value }));
  };

  const sliceHeightForExport = sliceEnabled ? maxZHeight : 0;

  return (
    <div className="sidebar-scroll" style={{ padding: '16px' }}>
      {/* ── 1. Parametric Auto-Optimizer ── */}
      <div className="export-section">
        <div className="export-title">🤖 AI Parametric Auto-Optimizer</div>
        <div className="cp-card" style={{ marginBottom: 12 }}>
          <div className="cp-field-row" style={{ marginBottom: 6 }}>
            <span className="cp-field-label">Optimization Goal</span>
          </div>
          <select
            className="cp-select"
            value={optimizeObjective}
            onChange={(e) => setOptimizeObjective(e.target.value)}
            disabled={optimizing}
          >
            <option value="maxCp">⚡ Maximize Aerodynamic Power (Cp)</option>
            <option value="highTorque">🌪️ Maximize Low-Wind Startup Torque</option>
            <option value="balanced">⚖️ Balanced (Aero Efficiency + Low Root Load)</option>
          </select>

          <button
            className="optimize-btn"
            onClick={handleOptimize}
            disabled={optimizing}
          >
            {optimizing ? (
              <>
                <span className="optimize-spinner" />
                Optimizing… {((optimizeProgress || 0) * 100).toFixed(0)}%
              </>
            ) : (
              <>
                <span className="export-icon">🚀</span>
                Run Parametric Optimizer
              </>
            )}
          </button>

          {optimizeBestCp > 0 && !optimizing && (
            <div className="optimize-result animate-fadeIn" style={{ marginTop: 10, padding: 8, background: 'var(--accent-bg)', borderRadius: 6, border: '1px solid var(--accent-border)', fontSize: 12, color: 'var(--text-primary)' }}>
              ✨ Optimized Solution: <strong>Cp = {(optimizeBestCp || 0).toFixed(3)}</strong> (Torque: {(optimizeBestTorque || 0).toFixed(1)} N·m)
            </div>
          )}
        </div>
      </div>

      <div className="export-divider" />

      {/* ── 2. CAD & 3D Manufacturing Export ── */}
      <div className="export-section">
        <div className="export-title">📦 CAD &amp; 3D Manufacturing</div>

        {/* Multi-Piece Slicing for 3D Printers */}
        <div className="cp-card" style={{ marginBottom: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input
              type="checkbox"
              className="cp-checkbox"
              checked={sliceEnabled || false}
              onChange={(e) => setSliceEnabled(e.target.checked)}
            />
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              Split Blade for 3D Printing Beds
            </span>
          </label>

          {sliceEnabled && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span className="cp-field-label">Max Bed Height (Z mm):</span>
              <input
                type="number"
                value={maxZHeight || 200}
                onChange={(e) => setMaxZHeight(parseFloat(e.target.value) || 200)}
                className="cp-number-input"
                style={{ width: '100%', textAlign: 'left' }}
              />
            </div>
          )}
        </div>

        {/* ── Interlocking Joint Controls ── */}
        {sliceEnabled && (
          <div className="joint-params-card">
            <div className="joint-params-header">
              <span className="joint-params-title">🔗 Interlocking Joint</span>
              <label className="joint-toggle-label">
                <input
                  type="checkbox"
                  className="cp-checkbox"
                  checked={safeJointParams.enabled}
                  onChange={(e) => updateJointParam('enabled', e.target.checked)}
                />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Enabled</span>
              </label>
            </div>

            {safeJointParams.enabled && (
              <div className="joint-sliders-container">
                {/* Wall Offset */}
                <div className="joint-slider-row">
                  <span className="joint-slider-label">Wall Offset</span>
                  <input
                    type="range" min="0.6" max="10.0" step="0.1"
                    value={safeJointParams.wallOffset}
                    onChange={(e) => updateJointParam('wallOffset', parseFloat(e.target.value))}
                    className="joint-slider"
                  />
                  <span className="joint-slider-value">{(safeJointParams.wallOffset ?? 3.0).toFixed(1)} mm</span>
                </div>

                {/* Front Cut (Leading Edge) */}
                <div className="joint-slider-row">
                  <span className="joint-slider-label">Front Cut (LE)</span>
                  <input
                    type="range" min="0.0" max="25.0" step="0.5"
                    value={safeJointParams.frontCut}
                    onChange={(e) => updateJointParam('frontCut', parseFloat(e.target.value))}
                    className="joint-slider"
                  />
                  <span className="joint-slider-value">{(safeJointParams.frontCut ?? 5.0).toFixed(1)} mm</span>
                </div>

                {/* Back Cut (Trailing Edge) */}
                <div className="joint-slider-row">
                  <span className="joint-slider-label">Back Cut (TE)</span>
                  <input
                    type="range" min="0.0" max="40.0" step="0.5"
                    value={safeJointParams.backCut}
                    onChange={(e) => updateJointParam('backCut', parseFloat(e.target.value))}
                    className="joint-slider"
                  />
                  <span className="joint-slider-value">{(safeJointParams.backCut ?? 10.0).toFixed(1)} mm</span>
                </div>

                {/* Tongue Depth */}
                <div className="joint-slider-row">
                  <span className="joint-slider-label">Tongue Depth</span>
                  <input
                    type="range" min="4" max="15" step="0.5"
                    value={safeJointParams.extrusionDepth}
                    onChange={(e) => updateJointParam('extrusionDepth', parseFloat(e.target.value))}
                    className="joint-slider"
                  />
                  <span className="joint-slider-value">{(safeJointParams.extrusionDepth ?? 8).toFixed(1)} mm</span>
                </div>

                {/* Print Clearance */}
                <div className="joint-slider-row">
                  <span className="joint-slider-label">Print Clearance</span>
                  <input
                    type="range" min="0.05" max="0.40" step="0.01"
                    value={safeJointParams.clearance}
                    onChange={(e) => updateJointParam('clearance', parseFloat(e.target.value))}
                    className="joint-slider"
                  />
                  <span className="joint-slider-value">{(safeJointParams.clearance ?? 0.15).toFixed(2)} mm</span>
                </div>

                {/* Glue Channel Toggle */}
                <div className="joint-slider-row">
                  <span className="joint-slider-label">Glue Channel</span>
                  <label className="joint-toggle-label" style={{ flex: 1 }}>
                    <input
                      type="checkbox"
                      className="cp-checkbox"
                      checked={safeJointParams.glueChannel}
                      onChange={(e) => updateJointParam('glueChannel', e.target.checked)}
                    />
                    <span style={{ fontSize: 11, color: safeJointParams.glueChannel ? '#34d399' : 'var(--text-subtle)' }}>
                      {safeJointParams.glueChannel ? '0.5×0.3 mm groove' : 'Off'}
                    </span>
                  </label>
                </div>

                {/* Exploded Preview */}
                <div className="joint-slider-row">
                  <span className="joint-slider-label">Exploded View</span>
                  <input
                    type="range" min="0" max="50" step="1"
                    value={safeJointParams.explodedDistance}
                    onChange={(e) => updateJointParam('explodedDistance', parseFloat(e.target.value))}
                    className="joint-slider"
                  />
                  <span className="joint-slider-value">{(safeJointParams.explodedDistance ?? 0).toFixed(0)} mm</span>
                </div>

                {/* Joint Info */}
                <div className="joint-info-strip">
                  <span>🧩 Parts: {estimatedPrintParts}</span>
                  <span>📐 Joints: {Math.max(0, estimatedPrintParts - 1)}</span>
                  <span>🔩 Gap: {((safeJointParams.clearance ?? 0.15) * 2).toFixed(2)} mm total</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── 3D Print Material & Filament Estimator ── */}
        <div className="filament-estimator-card">
          <div className="estimator-header">
            <span className="estimator-title">🧵 3D Print Material Estimator</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-subtle)' }}>~25% Infill</span>
          </div>
          <div className="estimator-grid">
            <div className="estimator-stat">
              <div className="estimator-stat-label">Single Blade PLA</div>
              <div className="estimator-stat-val">{plaSingleGrams} g</div>
            </div>
            <div className="estimator-stat">
              <div className="estimator-stat-label">Full Rotor ({numBlades}B PLA)</div>
              <div className="estimator-stat-val">{plaRotorGrams} g</div>
            </div>
            <div className="estimator-stat">
              <div className="estimator-stat-label">Single Blade PETG</div>
              <div className="estimator-stat-val">{petgSingleGrams} g</div>
            </div>
            <div className="estimator-stat">
              <div className="estimator-stat-label">Print Segments</div>
              <div className="estimator-stat-val">{estimatedPrintParts} part{estimatedPrintParts > 1 ? 's' : ''}</div>
            </div>
          </div>
        </div>

        <button
          className="export-btn"
          onClick={() =>
            exportSTL(
              segments,
              safeParams.carbonRodDia || 0,
              safeParams.carbonRodDepthPct || 100,
              safeParams.leRadiusMod || 1.0,
              safeParams.teThicknessMm || 0.0,
              safeParams.teFlapDeg || 0.0,
              sliceHeightForExport,
              sliceEnabled && safeJointParams.enabled ? safeJointParams : null
            )
          }
        >
          <span className="export-icon">🖨️</span>
          3D Print STL (.stl){sliceEnabled && safeJointParams.enabled ? ' + Joints' : ''}
        </button>

        <button
          className="export-btn"
          onClick={() =>
            exportOBJ(
              segments,
              safeParams.carbonRodDia || 0,
              safeParams.carbonRodDepthPct || 100,
              safeParams.leRadiusMod || 1.0,
              safeParams.teThicknessMm || 0.0,
              safeParams.teFlapDeg || 0.0,
              sliceHeightForExport
            )
          }
        >
          <span className="export-icon">📐</span>
          3D Mesh Model (.obj)
        </button>

        <button
          className="export-btn"
          onClick={() =>
            exportFusionCSV(
              segments,
              safeParams.leRadiusMod || 1.0,
              safeParams.teThicknessMm || 0.0,
              safeParams.teFlapDeg || 0.0
            )
          }
        >
          <span className="export-icon">🔗</span>
          Autodesk Fusion 360 Splines (.csv)
        </button>

        <button
          className="export-btn"
          onClick={() =>
            exportAirfoilDAT(
              segments,
              safeParams.leRadiusMod || 1.0,
              safeParams.teThicknessMm || 0.0,
              safeParams.teFlapDeg || 0.0
            )
          }
        >
          <span className="export-icon">📈</span>
          Airfoil Coordinates (.dat)
        </button>

        <button
          className="export-btn"
          onClick={() =>
            exportASC(
              segments,
              safeParams.carbonRodDia || 0,
              safeParams.carbonRodDepthPct || 100,
              safeParams.leRadiusMod || 1.0,
              safeParams.teThicknessMm || 0.0,
              safeParams.teFlapDeg || 0.0,
              sliceHeightForExport
            )
          }
        >
          <span className="export-icon">☁️</span>
          Point Cloud Coordinates (.asc)
        </button>
      </div>

      <div className="export-divider" />

      {/* ── 3. Engineering Reports & Data ── */}
      <div className="export-section">
        <div className="export-title">📑 Engineering Reports &amp; Data Package</div>
        <button
          className="export-btn export-btn-accent"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.25), rgba(56, 189, 248, 0.25))',
            border: '1px solid rgba(16, 185, 129, 0.5)',
            fontWeight: 700,
            padding: '12px 14px',
            marginBottom: '10px',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.15)',
          }}
          disabled={exportingPackage}
          onClick={async () => {
            setExportingPackage(true);
            try {
              await exportCompleteBladePackage({
                bladeParams: safeParams,
                windSpeed: designWindSpeed,
                tsr: designTsr,
                bemResults: designBemResults,
                powerCurve,
                segments,
                sliceEnabled,
                maxZHeight,
                jointParams: safeJointParams,
              });
            } catch (e) {
              console.error('Export all failed:', e);
            } finally {
              setExportingPackage(false);
            }
          }}
        >
          <span className="export-icon">{exportingPackage ? '⏳' : '📦'}</span>
          {exportingPackage ? 'Generating Complete Package...' : 'Export All Reports & CAD Package (.ZIP)'}
        </button>
        <button
          className="export-btn"
          onClick={() =>
            exportPDF(bladeParams, designWindSpeed, designTsr, designBemResults, powerCurve)
          }
        >
          <span className="export-icon">📄</span>
          Generate Engineering PDF Report
        </button>
        <button className="export-btn" onClick={() => exportCSV(designBemResults)}>
          <span className="export-icon">📊</span>
          Export BEM Data Matrix (.csv)
        </button>
      </div>

      <div className="export-divider" />

      {/* ── 4. Project File Persistence ── */}
      <div className="export-section">
        <div className="export-title">💾 Project Backup &amp; Transfer</div>
        <button
          className="export-btn export-btn-accent"
          style={{ background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(16, 185, 129, 0.2))', border: '1px solid rgba(59, 130, 246, 0.4)' }}
          onClick={() => setJsonModalOpen(true)}
        >
          <span className="export-icon">📋</span>
          Paste &amp; Import JSON Code
        </button>
        <button className="export-btn" onClick={() => exportJSON(bladeParams, designWindSpeed, designTsr)}>
          <span className="export-icon">💾</span>
          Save Design Project (.json)
        </button>
        <button className="export-btn" onClick={handleImportJSON}>
          <span className="export-icon">📂</span>
          Import Design Project (.json)
        </button>
      </div>

      {/* Interactive JSON Code Modal */}
      <JsonImportModal isOpen={jsonModalOpen} onClose={() => setJsonModalOpen(false)} />
    </div>
  );
}
