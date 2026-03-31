import React, { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts'

export default function RegionChart({
  title,
  roiActivations,
  roiConfig,
  currentTimestep,
  onTimestepClick,
  nTimesteps,
}) {
  const [disabledNetworks, setDisabledNetworks] = useState(new Set())

  // Transform data for Recharts
  const chartData = useMemo(() => {
    if (!roiActivations) return []

    const data = []
    for (let t = 0; t < nTimesteps; t++) {
      const point = { time: t }
      for (const [key, vals] of Object.entries(roiActivations)) {
        if (t < vals.length) {
          point[key] = vals[t]
        }
      }
      data.push(point)
    }
    return data
  }, [roiActivations, nTimesteps])

  const toggleNetwork = (key) => {
    setDisabledNetworks(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const handleChartClick = (e) => {
    if (e?.activeLabel !== undefined && onTimestepClick) {
      onTimestepClick(e.activeLabel)
    }
  }

  const networks = roiConfig ? Object.entries(roiConfig) : []

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius)',
        padding: '8px 12px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>
          t={label}s
        </div>
        {payload
          .filter(p => !disabledNetworks.has(p.dataKey))
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .map(p => (
            <div key={p.dataKey} style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 2,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: p.color, display: 'inline-block',
              }} />
              <span style={{ color: 'var(--text-secondary)', minWidth: 90 }}>
                {roiConfig?.[p.dataKey]?.label || p.dataKey}
              </span>
              <span style={{
                color: p.value > 0.03 ? 'var(--accent-green)' :
                       p.value < -0.03 ? 'var(--accent-red)' : 'var(--text-muted)',
                fontWeight: 600,
              }}>
                {p.value.toFixed(4)}
              </span>
            </div>
          ))}
      </div>
    )
  }

  return (
    <div className="chart-panel">
      <div className="chart-header">
        <h3>{title}</h3>
        <div className="chart-legend">
          {networks.map(([key, cfg]) => (
            <div
              key={key}
              className={`legend-item ${disabledNetworks.has(key) ? 'disabled' : ''}`}
              onClick={() => toggleNetwork(key)}
            >
              <span className="legend-dot" style={{ background: cfg.color }} />
              <span>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="chart-body">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            onClick={handleChartClick}
            margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="var(--text-muted)"
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              interval="preserveStartEnd"
              tickFormatter={(v) => {
                if (nTimesteps <= 60) return `${v}s`
                const m = Math.floor(v / 60)
                const s = v % 60
                return `${m}:${s.toString().padStart(2, '0')}`
              }}
            />
            <YAxis
              stroke="var(--text-muted)"
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border)' }}
              width={40}
              tickFormatter={(v) => v.toFixed(2)}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Current timestep indicator */}
            <ReferenceLine
              x={currentTimestep}
              stroke="var(--accent-red)"
              strokeWidth={2}
              strokeDasharray="none"
            />

            {/* Zero line */}
            <ReferenceLine y={0} stroke="var(--border-bright)" strokeDasharray="4 4" />

            {/* Network lines */}
            {networks.map(([key, cfg]) => (
              <Line
                key={key}
                type="monotone"
                dataKey={key}
                stroke={cfg.color}
                strokeWidth={1.5}
                dot={false}
                activeDot={{ r: 3, stroke: cfg.color, strokeWidth: 2, fill: 'var(--bg-primary)' }}
                hide={disabledNetworks.has(key)}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
