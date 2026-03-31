import React, { useState, useEffect } from 'react'
import RegionChart from './RegionChart'

const API_BASE = ''

export default function VideoCompare({ videoIds, currentTimestep, onTimestepChange }) {
  const [compareData, setCompareData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!videoIds || videoIds.length < 2) return

    const fetchCompare = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${API_BASE}/api/compare?video_ids=${videoIds.join(',')}`)
        const data = await res.json()
        setCompareData(data.videos)
      } catch (err) {
        console.error('Compare fetch failed:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchCompare()
  }, [videoIds])

  if (!compareData || loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: 200, color: 'var(--text-muted)', fontSize: 13,
      }}>
        {loading ? 'Loading comparison data...' : 'Select two videos to compare'}
      </div>
    )
  }

  // Compute difference metrics
  const computeDifference = (activationsA, activationsB) => {
    if (!activationsA || !activationsB) return null

    const diff = {}
    for (const key of Object.keys(activationsA)) {
      const valsA = activationsA[key] || []
      const valsB = activationsB[key] || []
      const maxLen = Math.min(valsA.length, valsB.length)

      const meanA = valsA.slice(0, maxLen).reduce((s, v) => s + v, 0) / maxLen
      const meanB = valsB.slice(0, maxLen).reduce((s, v) => s + v, 0) / maxLen

      diff[key] = {
        meanA: meanA,
        meanB: meanB,
        difference: meanA - meanB,
        absChange: Math.abs(meanA - meanB),
      }
    }
    return diff
  }

  const entries = Object.entries(compareData)
  const [idA, dataA] = entries[0] || []
  const [idB, dataB] = entries[1] || []

  if (!dataA?.roi_activations || !dataB?.roi_activations) {
    return (
      <div style={{ padding: 16, color: 'var(--text-muted)', fontSize: 13 }}>
        One or both videos have not been processed yet.
      </div>
    )
  }

  const diff = computeDifference(dataA.roi_activations, dataB.roi_activations)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary comparison */}
      <div className="chart-panel" style={{ padding: 16 }}>
        <h3 style={{ fontSize: 13, marginBottom: 12 }}>Network Comparison Summary</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}>
          {diff && Object.entries(diff).map(([key, d]) => {
            const config = dataA.roi_config?.[key] || {}
            return (
              <div key={key} style={{
                background: 'var(--bg-card)',
                borderRadius: 'var(--radius)',
                padding: '10px 12px',
                borderLeft: `3px solid ${config.color || '#888'}`,
              }}>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)', marginBottom: 4,
                }}>
                  {config.label || key}
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)',
                  }}>
                    {d.meanA.toFixed(4)}
                  </span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>vs</span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-primary)',
                  }}>
                    {d.meanB.toFixed(4)}
                  </span>
                </div>
                <div style={{
                  fontSize: 10, marginTop: 4,
                  color: d.difference > 0 ? 'var(--accent-green)' : 'var(--accent-red)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  Δ {d.difference > 0 ? '+' : ''}{d.difference.toFixed(4)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Side-by-side charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <RegionChart
          title={dataA.metadata?.filename || `Video ${idA}`}
          roiActivations={dataA.roi_activations}
          roiConfig={dataA.roi_config}
          currentTimestep={currentTimestep}
          onTimestepClick={onTimestepChange}
          nTimesteps={dataA.metadata?.n_timesteps || 0}
        />
        <RegionChart
          title={dataB.metadata?.filename || `Video ${idB}`}
          roiActivations={dataB.roi_activations}
          roiConfig={dataB.roi_config}
          currentTimestep={currentTimestep}
          onTimestepClick={onTimestepChange}
          nTimesteps={dataB.metadata?.n_timesteps || 0}
        />
      </div>
    </div>
  )
}
