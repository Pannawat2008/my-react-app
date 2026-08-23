import { useState } from 'react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from 'recharts';
import { useBlade } from '../context/BladeContext';

function SegmentTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">
          Segment {label} (r = {data?.r} m)
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} className="chart-tooltip-item" style={{ color: entry.color }}>
            {entry.name}: <strong>{entry.value}</strong>
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function PowerTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">Wind Speed: {payload[0]?.payload?.windSpeed} m/s</div>
        {payload.map((entry, idx) => (
          <div key={idx} className="chart-tooltip-item" style={{ color: entry.color }}>
            {entry.name}: <strong>{entry.value}</strong> {entry.name.includes('Power') ? 'kW' : ''}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

export default function ChartsPanel() {
  const { designBemResults, powerCurve } = useBlade();
  const [activeTab, setActiveTab] = useState(0);

  const segData = (designBemResults.segments || []).map((seg, i) => ({
    name: `${i + 1}`,
    r: seg.r.toFixed(2),
    cl_cd: parseFloat((seg.liftToDrag || (seg.cd > 0 ? seg.cl / seg.cd : 0)).toFixed(2)),
    alpha: parseFloat(seg.alphaDeg.toFixed(1)),
    lift: parseFloat((seg.dT || 0).toFixed(1)),
    torque: parseFloat((seg.dQ || 0).toFixed(1)),
    a: parseFloat((seg.a || 0).toFixed(3)),
    aPrime: parseFloat((seg.aPrime || 0).toFixed(3)),
  }));

  const tabs = [
    'Efficiency (L/D & α)',
    'Forces & Torque',
    'Power Curve (Cp)',
    'Induction Factors (a, a\')',
  ];

  const axisStyle = { fontSize: 10, fill: 'var(--text-subtle)' };

  return (
    <div className="charts-container" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0 }}>
      {/* Tab Selector */}
      <div className="chart-tabs">
        {tabs.map((tab, i) => (
          <button
            key={i}
            className={`chart-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="chart-content" style={{ flex: 1, minWidth: 0, minHeight: 0, padding: '8px 12px 12px', position: 'relative' }}>
        {/* ── Tab 0: L/D & AoA ── */}
        {activeTab === 0 && (
          <div className="chart-wrapper animate-fadeIn" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="chart-axis-badges">
              <span className="chart-axis-badge left">📈 Lift-to-Drag Ratio (Cl/Cd)</span>
              <span className="chart-axis-badge right">📐 Angle of Attack (α deg)</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <LineChart data={segData} margin={{ top: 8, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-subtle)" tick={axisStyle} label={{ value: 'Segment (Root ➔ Tip)', position: 'insideBottom', offset: -2, style: axisStyle }} />
                  <YAxis yAxisId="left" stroke="var(--text-subtle)" tick={axisStyle} />
                  <YAxis yAxisId="right" orientation="right" stroke="var(--text-subtle)" tick={axisStyle} />
                  <Tooltip content={<SegmentTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cl_cd"
                    name="L/D Ratio (Cl/Cd)"
                    stroke="var(--accent)"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: 'var(--accent)' }}
                    activeDot={{ r: 5 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="alpha"
                    name="Angle of Attack (°)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f59e0b' }}
                    activeDot={{ r: 5 }}
                  />
                  {/* Stall threshold guide line */}
                  <ReferenceLine yAxisId="right" y={14} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Stall Limit (14°)', fill: '#ef4444', fontSize: 10 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Tab 1: Thrust & Torque Load ── */}
        {activeTab === 1 && (
          <div className="chart-wrapper animate-fadeIn" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="chart-axis-badges">
              <span className="chart-axis-badge left">💨 Axial Thrust (N/m)</span>
              <span className="chart-axis-badge right">⚡ Aero Torque (N·m/m)</span>
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
                <LineChart data={segData} margin={{ top: 8, right: 30, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="name" stroke="var(--text-subtle)" tick={axisStyle} label={{ value: 'Segment (Root ➔ Tip)', position: 'insideBottom', offset: -2, style: axisStyle }} />
                  <YAxis yAxisId="left" stroke="#38bdf8" tick={axisStyle} />
                  <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" tick={axisStyle} />
                  <Tooltip content={<SegmentTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="lift"
                    name="Axial Thrust (N/m)"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#38bdf8' }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="torque"
                    name="Tangential Torque (N·m/m)"
                    stroke="#f59e0b"
                    strokeWidth={2.5}
                    dot={{ r: 3, fill: '#f59e0b' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Tab 2: Power Curve & Cp ── */}
        {activeTab === 2 && (
          <div className="chart-wrapper animate-fadeIn" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <AreaChart data={powerCurve} margin={{ top: 12, right: 30, left: -10, bottom: 5 }}>
                <defs>
                  <linearGradient id="powerGradFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="cpGradFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="windSpeed" stroke="var(--text-subtle)" tick={axisStyle} label={{ value: 'Wind Speed (m/s)', position: 'insideBottom', offset: -2, style: axisStyle }} />
                <YAxis yAxisId="left" stroke="var(--text-subtle)" tick={axisStyle} />
                <YAxis yAxisId="right" orientation="right" stroke="var(--text-subtle)" tick={axisStyle} />
                <Tooltip content={<PowerTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <ReferenceLine
                  yAxisId="right"
                  y={0.593}
                  stroke="#ef4444"
                  strokeDasharray="6 4"
                  label={{ value: 'Betz Limit (0.593)', position: 'insideTopRight', fill: '#ef4444', fontSize: 10 }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="powerKw"
                  name="Electrical Power (kW)"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  fill="url(#powerGradFill)"
                  dot={{ r: 2 }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="cp"
                  name="Rotor Efficiency (Cp)"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#cpGradFill)"
                  dot={{ r: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Tab 3: Induction Factors ── */}
        {activeTab === 3 && (
          <div className="chart-wrapper animate-fadeIn" style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%" minWidth={100} minHeight={100}>
              <LineChart data={segData} margin={{ top: 12, right: 30, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-subtle)" tick={axisStyle} />
                <YAxis stroke="var(--text-subtle)" tick={axisStyle} domain={[0, 0.6]} />
                <Tooltip content={<SegmentTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />
                <ReferenceLine y={0.333} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'Ideal Betz Induction a = 1/3', fill: '#10b981', fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="a"
                  name="Axial Induction (a)"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: 'var(--accent)' }}
                />
                <Line
                  type="monotone"
                  dataKey="aPrime"
                  name="Tangential Induction (a')"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
