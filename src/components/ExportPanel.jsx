import React, { useState } from 'react';
import { exportCSV, exportFusionCSV, exportSTL, exportOBJ, exportASC, exportJSON, exportAirfoilDAT } from '../utils/exporters';
import { exportPDF } from '../utils/pdfReport';

export default function ExportPanel({
  bemResults,
  segments,
  bladeParams,
  windSpeed,
  tsr,
  powerCurve,
  optimizing,
  optimizeProgress,
  optimizeBestCp,
  handleOptimize,
  handleImportJSON
}) {
  const [sliceEnabled, setSliceEnabled] = useState(false);
  const [maxZHeight, setMaxZHeight] = useState(200);

  return (
    <div className="sidebar-scroll" style={{ padding: '16px' }}>
      <div className="export-section">
        <div className="export-title">Export Design</div>
        <button className="export-btn" onClick={() => exportCSV(bemResults)}>
          <span className="export-icon">📊</span>
          CSV (2D Data)
        </button>
        <button className="export-btn" onClick={() => exportFusionCSV(segments, bladeParams.leRadiusMod, bladeParams.teThicknessMm, bladeParams.teFlapDeg)}>
          <span className="export-icon">🔗</span>
          Fusion 360 Splines (CSV)
        </button>
        <button className="export-btn" onClick={() => exportAirfoilDAT(segments, bladeParams.leRadiusMod, bladeParams.teThicknessMm, bladeParams.teFlapDeg)}>
          <span className="export-icon">📈</span>
          Airfoils (.dat)
        </button>

        {/* ── 3D Slicing Settings ── */}
        <div style={{ marginBottom: 16, padding: '12px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid var(--border)' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: sliceEnabled ? 8 : 0 }}>
            <input type="checkbox" checked={sliceEnabled} onChange={(e) => setSliceEnabled(e.target.checked)} />
            <span style={{ fontSize: '0.9em', color: 'var(--text-primary)' }}>Split into Printable Pieces</span>
          </label>
          
          {sliceEnabled && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: '0.85em', color: 'var(--text-secondary)' }}>Max Z-Height (mm):</span>
              <input 
                type="number" 
                value={maxZHeight}
                onChange={(e) => setMaxZHeight(parseFloat(e.target.value) || 0)}
                style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: 4 }}
              />
            </div>
          )}
        </div>

        <button className="export-btn" onClick={() => exportSTL(segments, bladeParams.carbonRodDia, bladeParams.carbonRodDepthPct, bladeParams.leRadiusMod, bladeParams.teThicknessMm, bladeParams.teFlapDeg, sliceEnabled ? maxZHeight : 0)}>
          <span className="export-icon">🖨️</span>
          STL (3D Print)
        </button>
        <button className="export-btn" onClick={() => exportOBJ(segments, bladeParams.carbonRodDia, bladeParams.carbonRodDepthPct, bladeParams.leRadiusMod, bladeParams.teThicknessMm, bladeParams.teFlapDeg, sliceEnabled ? maxZHeight : 0)}>
          <span className="export-icon">📐</span>
          OBJ (3D Mesh)
        </button>
        <button className="export-btn" onClick={() => exportASC(segments, bladeParams.carbonRodDia, bladeParams.carbonRodDepthPct, bladeParams.leRadiusMod, bladeParams.teThicknessMm, bladeParams.teFlapDeg, sliceEnabled ? maxZHeight : 0)}>
          <span className="export-icon">☁️</span>
          ASC (Point Cloud)
        </button>
        <button className="export-btn export-btn-accent" onClick={() => exportPDF(bladeParams, windSpeed, tsr, bemResults, powerCurve)}>
          <span className="export-icon">📄</span>
          PDF Report
        </button>
      </div>

      <div className="export-divider" />

      <div className="export-section">
        <div className="export-title">Save &amp; Load</div>
        <button className="export-btn" onClick={() => exportJSON(bladeParams, windSpeed, tsr)}>
          <span className="export-icon">💾</span>
          Save Design (JSON)
        </button>
        <button className="export-btn" onClick={handleImportJSON}>
          <span className="export-icon">📂</span>
          Load Design (JSON)
        </button>
      </div>

      <div className="export-divider" />

      <div className="export-section">
        <div className="export-title">Optimization</div>
        <button className="optimize-btn" onClick={handleOptimize} disabled={optimizing}>
          {optimizing ? (
            <>
              <span className="optimize-spinner" />
              Optimizing… {(optimizeProgress * 100).toFixed(0)}%
            </>
          ) : (
            <>
              <span className="export-icon">🤖</span>
              Run Auto-Optimizer
            </>
          )}
        </button>
        {optimizeBestCp > 0 && !optimizing && (
          <div className="optimize-result">
            Found improved design (Cp: {optimizeBestCp.toFixed(3)})
          </div>
        )}
      </div>
    </div>
  );
}
