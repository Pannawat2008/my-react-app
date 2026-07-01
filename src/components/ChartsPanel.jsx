import React, { useState } from 'react';
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

/* ── Shared Tooltip ── */
function SegmentTooltip({ active, payload, label }) {
  if (active && payload && payload.length) {
    return (
      <div className="chart-tooltip">
        <div className="chart-tooltip-title">
          Seg {label} (r = {payload[0]?.payload?.r} m)
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} className="chart-tooltip-item" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
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
        <div className="chart-tooltip-title">
          Wind Speed: {payload[0]?.payload?.windSpeed} m/s
        </div>
        {payload.map((entry, idx) => (
          <div key={idx} className="chart-tooltip-item" style={{ color: entry.color }}>
            {entry.name}: {entry.value}
            {entry.name === 'Power' ? ' kW' : ''}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

/* ──────────────────────────────────────────── */
/*              CHARTS PANEL                    */
/* ──────────────────────────────────────────── */
export default function ChartsPanel({ results, powerCurve }) {
  const [activeTab, setActiveTab] = useState(0);

  const segData = results.segments.map((seg, i) => ({
    name: `${i + 1}`,
    r: seg.r.toFixed(2),
    cl_cd: seg.cd > 0 ? parseFloat((seg.cl / seg.cd).toFixed(2)) : 0,
    alpha: parseFloat(seg.alphaDeg.toFixed(1)),
    lift: parseFloat(seg.dT.toFixed(1)),
    torque: parseFloat(seg.dQ.toFixed(1)),
  }));

  const tabs = ['Efficiency (L/D & α)', 'Load Distribution', 'Power Curve'];

  const axisStyle = { fontSize: 11, fill: '#64748b' };

  return (
    <>
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

      <div className="chart-content">
        {/* ── Tab 0: Aerodynamic Efficiency ── */}
        {activeTab === 0 && (
          <div className="chart-wrapper animate-fadeIn">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={segData}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={axisStyle}
                  label={{
                    value: 'Segment',
                    position: 'insideBottom',
                    offset: -2,
                    style: { fontSize: 11, fill: '#94a3b8' },
                  }}
                />
                <YAxis yAxisId="left" stroke="#94a3b8" tick={axisStyle} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={axisStyle} />
                <Tooltip content={<SegmentTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="cl_cd"
                  name="L/D Ratio"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#0284c7', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="alpha"
                  name="AoA (deg)"
                  stroke="#f59e0b"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Tab 1: Load Distribution ── */}
        {activeTab === 1 && (
          <div className="chart-wrapper animate-fadeIn">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={segData}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="name"
                  stroke="#94a3b8"
                  tick={axisStyle}
                  label={{
                    value: 'Segment',
                    position: 'insideBottom',
                    offset: -2,
                    style: { fontSize: 11, fill: '#94a3b8' },
                  }}
                />
                <YAxis stroke="#94a3b8" tick={axisStyle} />
                <Tooltip content={<SegmentTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line
                  type="monotone"
                  dataKey="lift"
                  name="Axial (Thrust)"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#e11d48', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
                <Line
                  type="monotone"
                  dataKey="torque"
                  name="Tangential (Torque)"
                  stroke="#7c3aed"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: '#7c3aed', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── Tab 2: Power Curve ── */}
        {activeTab === 2 && (
          <div className="chart-wrapper animate-fadeIn">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={powerCurve}
                margin={{ top: 10, right: 30, left: 0, bottom: 5 }}
              >
                <defs>
                  <linearGradient id="powerGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284c7" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0284c7" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="cpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis
                  dataKey="windSpeed"
                  stroke="#94a3b8"
                  tick={axisStyle}
                  label={{
                    value: 'Wind Speed (m/s)',
                    position: 'insideBottom',
                    offset: -2,
                    style: { fontSize: 11, fill: '#94a3b8' },
                  }}
                />
                <YAxis yAxisId="left" stroke="#94a3b8" tick={axisStyle} />
                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" tick={axisStyle} />
                <Tooltip content={<PowerTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                {/* Betz limit reference */}
                <ReferenceLine
                  yAxisId="right"
                  y={0.593}
                  stroke="#94a3b8"
                  strokeDasharray="6 4"
                  label={{
                    value: 'Betz Limit (0.593)',
                    position: 'insideTopRight',
                    style: { fontSize: 10, fill: '#94a3b8' },
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="power"
                  name="Power (kW)"
                  stroke="#0284c7"
                  strokeWidth={2.5}
                  fill="url(#powerGrad)"
                  dot={{ r: 3, fill: '#0284c7', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="cp"
                  name="Cp"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fill="url(#cpGrad)"
                  dot={{ r: 3, fill: '#10b981', strokeWidth: 0 }}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </>
  );
}
