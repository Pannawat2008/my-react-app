import { useMemo } from 'react';
import { useBlade } from '../context/BladeContext';
import { sliceBladeSection } from '../utils/airfoilSlicer';

export default function AirfoilSlicerModal() {
  const {
    bladeParams,
    setBladeParams,
    sliceModalOpen,
    setSliceModalOpen,
    activeSliceSpan,
    setActiveSliceSpan,
    parsedCustomAirfoils,
  } = useBlade();

  const sliceData = useMemo(() => {
    if (!sliceModalOpen) return null;
    return sliceBladeSection(bladeParams, activeSliceSpan, parsedCustomAirfoils);
  }, [sliceModalOpen, bladeParams, activeSliceSpan, parsedCustomAirfoils]);

  if (!sliceModalOpen || !sliceData) return null;

  // Build SVG path strings
  const svgWidth = 640;
  const svgHeight = 280;
  const padding = 50;

  const points = sliceData.upperSurface.concat([...sliceData.lowerSurface].reverse());

  // Find bounding box for scaling
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  points.forEach((pt) => {
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  });

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 0.3;
  const scale = Math.min((svgWidth - padding * 2) / rangeX, (svgHeight - padding * 2) / (rangeY * 2.2));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const mapX = (x) => svgWidth / 2 + (x - centerX) * scale;
  const mapY = (y) => svgHeight / 2 - (y - centerY) * scale;

  // SVG path for airfoil outline
  const airfoilPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.x).toFixed(1)} ${mapY(p.y).toFixed(1)}`)
    .join(' ') + ' Z';

  // SVG path for camber line
  const camberPath = sliceData.camberLine
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${mapX(p.x).toFixed(1)} ${mapY(p.y).toFixed(1)}`)
    .join(' ');

  return (
    <div className="slicer-modal-backdrop" onClick={() => setSliceModalOpen(false)}>
      <div className="slicer-modal-card glass" onClick={(e) => e.stopPropagation()}>
        <div className="slicer-header">
          <div className="slicer-title">
            <span className="slicer-icon">🔬</span>
            <div>
              <h3>Parametric 2D Airfoil Inspector</h3>
              <p>Cross-section slice at {(activeSliceSpan * 100).toFixed(1)}% Span ({sliceData.r_meters.toFixed(2)} m)</p>
            </div>
          </div>
          <button className="slicer-close-btn" onClick={() => setSliceModalOpen(false)}>✕</button>
        </div>

        {/* Span Slider Bar */}
        <div className="slicer-span-control">
          <div className="slicer-span-header">
            <span>Span Station (r/R):</span>
            <strong>{(activeSliceSpan * 100).toFixed(0)}%</strong>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={activeSliceSpan}
            onChange={(e) => setActiveSliceSpan(parseFloat(e.target.value))}
            className="cp-slider"
          />
        </div>

        {/* 2D SVG Section Canvas */}
        <div className="slicer-canvas-container">
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="slicer-svg">
            <defs>
              <linearGradient id="airfoilFillGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.08" />
              </linearGradient>
            </defs>

            {/* Grid & Reference Lines */}
            <line x1={padding} y1={svgHeight / 2} x2={svgWidth - padding} y2={svgHeight / 2} stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" />
            
            {/* Airfoil Skin */}
            <path d={airfoilPath} fill="url(#airfoilFillGrad)" stroke="var(--accent)" strokeWidth="2.5" />

            {/* Mean Camber Line */}
            <path d={camberPath} fill="none" stroke="#f59e0b" strokeWidth="1.8" strokeDasharray="3 3" />

            {/* Quarter-Chord / Pitch Axis Marker */}
            <circle cx={mapX(0)} cy={mapY(0)} r="4" fill="#ef4444" />
            <text x={mapX(0)} y={mapY(0) - 10} textAnchor="middle" fill="#ef4444" fontSize="10" fontWeight="bold">Pitch Axis (0.25c)</text>

            {/* Carbon Fiber Spar Rod Circle */}
            {sliceData.hasRod && (
              <g>
                <circle
                  cx={mapX(sliceData.rodCenter?.x ?? 0)}
                  cy={mapY(sliceData.rodCenter?.y ?? 0)}
                  r={Math.max(3, (sliceData.rodRadius_m || 0.002) * scale)}
                  fill="#0f172a"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="2 1"
                />
                <circle
                  cx={mapX(sliceData.rodCenter?.x ?? 0)}
                  cy={mapY(sliceData.rodCenter?.y ?? 0)}
                  r="2.5"
                  fill="#38bdf8"
                />
                <text
                  x={mapX(sliceData.rodCenter?.x ?? 0)}
                  y={mapY(sliceData.rodCenter?.y ?? 0) - (sliceData.rodRadius_m || 0.002) * scale - 6}
                  textAnchor="middle"
                  fill="#38bdf8"
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  Carbon Spar (Ø{sliceData.rodDia_mm}mm @ {sliceData.rodPosPct}%c)
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* Spar Rod Relative Position Interactive Controls */}
        {bladeParams.carbonRodDia > 0 && (
          <div style={{ marginTop: 10, padding: '10px 14px', background: 'rgba(15, 23, 42, 0.65)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>
                🏗️ Spar Relative Position &amp; Skin Alignment
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', border: '1px solid #38bdf8', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => setBladeParams(prev => ({ ...prev, carbonRodPosPct: 30, carbonRodYOffsetMm: 0 }))}
                  title="Reset to 30% x/c and 0mm vertical camber offset"
                >
                  🎯 Auto-Center
                </button>
                <button
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
                  onClick={() => setBladeParams(prev => ({ ...prev, carbonRodYOffsetMm: Math.min(6, (prev.carbonRodYOffsetMm || 0) + 0.5) }))}
                  title="Shift rod +0.5mm towards upper surface"
                >
                  ⬆️ +0.5mm
                </button>
                <button
                  style={{ fontSize: 10.5, padding: '3px 8px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', color: 'var(--text)', cursor: 'pointer' }}
                  onClick={() => setBladeParams(prev => ({ ...prev, carbonRodYOffsetMm: Math.max(-6, (prev.carbonRodYOffsetMm || 0) - 0.5) }))}
                  title="Shift rod -0.5mm towards lower surface"
                >
                  ⬇️ -0.5mm
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                  <span>Chordwise Position (X/c):</span>
                  <strong style={{ color: '#38bdf8' }}>{bladeParams.carbonRodPosPct ?? 30}%</strong>
                </div>
                <input
                  type="range"
                  min="15"
                  max="65"
                  step="1"
                  value={bladeParams.carbonRodPosPct ?? 30}
                  onChange={(e) => setBladeParams(prev => ({ ...prev, carbonRodPosPct: parseFloat(e.target.value) }))}
                  className="cp-slider"
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>
                  <span>Vertical Camber Offset (ΔY):</span>
                  <strong style={{ color: (bladeParams.carbonRodYOffsetMm || 0) === 0 ? 'var(--text)' : (bladeParams.carbonRodYOffsetMm || 0) > 0 ? '#38bdf8' : '#f59e0b' }}>
                    {(bladeParams.carbonRodYOffsetMm || 0) > 0 ? `+${(bladeParams.carbonRodYOffsetMm || 0).toFixed(1)}` : (bladeParams.carbonRodYOffsetMm || 0).toFixed(1)} mm
                  </strong>
                </div>
                <input
                  type="range"
                  min="-6"
                  max="6"
                  step="0.2"
                  value={bladeParams.carbonRodYOffsetMm ?? 0}
                  onChange={(e) => setBladeParams(prev => ({ ...prev, carbonRodYOffsetMm: parseFloat(e.target.value) }))}
                  className="cp-slider"
                />
              </div>
            </div>
          </div>
        )}

        {/* Telemetry Badges */}
        <div className="slicer-stats-grid" style={{ marginTop: 10 }}>
          <div className="slicer-stat-card">
            <span className="slicer-stat-label">Airfoil Family</span>
            <span className="slicer-stat-val">{sliceData.airfoil}</span>
          </div>
          <div className="slicer-stat-card">
            <span className="slicer-stat-label">Chord Length</span>
            <span className="slicer-stat-val">{sliceData.chord_mm.toFixed(0)} mm</span>
          </div>
          <div className="slicer-stat-card">
            <span className="slicer-stat-label">Twist Angle</span>
            <span className="slicer-stat-val">{sliceData.twistDeg.toFixed(1)}°</span>
          </div>
          <div className="slicer-stat-card">
            <span className="slicer-stat-label">Max Thickness</span>
            <span className="slicer-stat-val">{sliceData.maxThickness_mm.toFixed(1)} mm</span>
          </div>
          <div className="slicer-stat-card">
            <span className="slicer-stat-label">Top Wall Clearance</span>
            <span
              className="slicer-stat-val"
              style={{
                color: !sliceData.hasRod
                  ? 'var(--text-muted)'
                  : sliceData.topClearance_mm < 0.8
                  ? '#ef4444'
                  : sliceData.topClearance_mm < 1.4
                  ? '#f59e0b'
                  : '#34d399',
              }}
            >
              {sliceData.hasRod ? `${sliceData.topClearance_mm.toFixed(1)} mm` : 'No Spar'}
            </span>
          </div>
          <div className="slicer-stat-card">
            <span className="slicer-stat-label">Bottom Wall Clearance</span>
            <span
              className="slicer-stat-val"
              style={{
                color: !sliceData.hasRod
                  ? 'var(--text-muted)'
                  : sliceData.bottomClearance_mm < 0.8
                  ? '#ef4444'
                  : sliceData.bottomClearance_mm < 1.4
                  ? '#f59e0b'
                  : '#34d399',
              }}
            >
              {sliceData.hasRod ? `${sliceData.bottomClearance_mm.toFixed(1)} mm` : 'No Spar'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
