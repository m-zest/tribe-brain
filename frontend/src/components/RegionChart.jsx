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
  tall = false,
}) {
  const [disabledNetworks, setDisabledNetworks] = useState(new Set())

  const chartData = useMemo(() => {
    if (!roiActivations) return []
    const data = []
    for (let t = 0; t < nTimesteps; t++) {
      const point = { time: t }
      for (const [key, vals] of Object.entries(roiActivations)) {
        if (t < vals.length) point[key] = vals[t]
      }
      data.push(point)
    }
    return data
  }, [roiActivations, nTimesteps])

  const toggleNetwork = (key) => {
    setDisabledNetworks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleChartClick = (e) => {
    if (e?.activeLabel !== undefined && onTimestepClick) {
      onTimestepClick(e.activeLabel)
    }
  }

  const networks = roiConfig ? Object.entries(roiConfig) : []

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null
    return (
      <div style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-bright)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: 11,
        fontFamily: 'var(--font-mono)',
        boxShadow: 'var(--shadow-lg)',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600 }}>
          t = {label}s
        </div>
        {payload
          .filter(p => !disabledNetworks.has(p.dataKey))
          .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
          .map(p => (
            <div key={p.dataKey} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 3,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: 2,
                background: p.color, display: 'inline-block', flexShrink: 0,
              }} />
              <span style={{ color: 'var(--text-secondary)', minWidth: 95, fontSize: 10 }}>
                {roiConfig?.[p.dataKey]?.label || p.dataKey}
              </span>
              <span style={{
                color: p.value > 0.03 ? 'var(--accent-green)' :
                       p.value < -0.03 ? 'var(--accent-red)' : 'var(--text-muted)',
                fontWeight: 700,
                fontSize: 11,
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
      </div>
      <div className={`chart-body ${tall ? 'tall' : ''}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={chartData}
            onClick={handleChartClick}
            margin={{ top: 4, right: 12, bottom: 4, left: 8 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="time"
              stroke="var(--text-muted)"
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-default)' }}
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
              tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={{ stroke: 'var(--border-default)' }}
              width={40}
              tickFormatter={(v) => v.toFixed(1)}
            />
            <Tooltip content={<CustomTooltip />} />

            <ReferenceLine
              x={currentTimestep}
              stroke="var(--accent-red)"
              strokeWidth={2}
              strokeDasharray="none"
            />

            <ReferenceLine y={0} stroke="var(--border-bright)" strokeDasharray="4 4" />

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
  )
}
