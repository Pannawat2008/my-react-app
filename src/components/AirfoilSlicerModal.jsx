import { useMemo } from 'react';
import { useBlade } from '../context/BladeContext';
import { sliceBladeSection } from '../utils/airfoilSlicer';

export default function AirfoilSlicerModal() {
  const {
    bladeParams,
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
          </svg>
        </div>

        {/* Telemetry Badges */}
        <div className="slicer-stats-grid">
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
            <span className="slicer-stat-label">Thickness (t/c)</span>
            <span className="slicer-stat-val">{sliceData.thicknessPct.toFixed(1)}%</span>
          </div>
          <div className="slicer-stat-card">
            <span className="slicer-stat-label">Max Thickness</span>
            <span className="slicer-stat-val">{sliceData.maxThickness_mm.toFixed(1)} mm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
