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

  const computeMean = (vals) => {
    if (!vals?.length) return 0
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }

  const diff = {}
  for (const key of Object.keys(dataA.roi_activations)) {
    const meanA = computeMean(dataA.roi_activations[key])
    const meanB = computeMean(dataB.roi_activations[key])
    diff[key] = { meanA, meanB, difference: meanA - meanB }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="summary-section" style={{ margin: 0 }}>
        <h3>Network Comparison Summary</h3>
        <div className="summary-grid">
          {Object.entries(diff).map(([key, d]) => {
            const config = dataA.roi_config?.[key] || {}
            return (
              <div key={key} className="summary-card" style={{ borderLeftColor: config.color || '#888' }}>
                <div className="network-label">{config.label || key}</div>
                <div className="values-row">
                  <span className="value">{d.meanA.toFixed(4)}</span>
                  <span className="vs">vs</span>
                  <span className="value">{d.meanB.toFixed(4)}</span>
                </div>
                <div className={`delta ${d.difference >= 0 ? 'positive' : 'negative'}`}>
                  {'\u0394'} {d.difference >= 0 ? '+' : ''}{d.difference.toFixed(4)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
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
