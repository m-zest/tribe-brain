import React, { useEffect, useRef, useMemo } from 'react'
import BrainViewer from './BrainViewer'
import RegionChart from './RegionChart'

const API_BASE = ''

const VIEW_LABELS = {
  lateral_left: 'L \u00b7 Lateral',
  medial_left: 'L \u00b7 Medial',
  medial_right: 'R \u00b7 Medial',
  lateral_right: 'R \u00b7 Lateral',
}
const VIEW_ORDER = ['lateral_left', 'medial_left', 'medial_right', 'lateral_right']

export default function VideoPanel({
  videoId,
  videoData,
  brainImages,
  brainLoading,
  currentTimestep,
  onTimestepChange,
  videoRef,
  isPlaying,
  onPlayPause,
  onTimeUpdate,
  onInterpret,
  interpretation,
  isCompare = false,
}) {
  const metadata = videoData?.metadata || {}
  const nTimesteps = metadata.n_timesteps || 0
  const roiActivations = videoData?.roi_activations || {}
  const roiConfig = videoData?.roi_config || {}
  const animFrameRef = useRef(null)
  const localVideoRef = useRef(null)
  const vRef = videoRef || localVideoRef

  useEffect(() => {
    if (isCompare || !vRef.current) return
    if (isPlaying) {
      vRef.current.play().catch(() => {})
    } else {
      vRef.current.pause()
    }
  }, [isPlaying, isCompare, vRef])

  useEffect(() => {
    if (isCompare || !isPlaying || !onTimeUpdate) return
    const tick = () => {
      if (vRef.current) onTimeUpdate(vRef.current.currentTime)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [isPlaying, isCompare, onTimeUpdate, vRef])

  const stats = useMemo(() => {
    if (!roiActivations || currentTimestep < 0) return null
    let maxVal = -Infinity, minVal = Infinity
    let sum = 0, count = 0

    for (const [, vals] of Object.entries(roiActivations)) {
      if (currentTimestep < vals.length) {
        const v = vals[currentTimestep]
        if (v > maxVal) maxVal = v
        if (v < minVal) minVal = v
        sum += v
        count++
      }
    }

    const mean = count > 0 ? sum / count : 0
    let variance = 0
    for (const [, vals] of Object.entries(roiActivations)) {
      if (currentTimestep < vals.length) {
        variance += Math.pow(vals[currentTimestep] - mean, 2)
      }
    }
    const stdDev = count > 0 ? Math.sqrt(variance / count) : 0

    return { maxVal, minVal, mean, stdDev }
  }, [roiActivations, currentTimestep])

  const videoSrc = metadata?.filename ? `/videos/${metadata.filename}` : null

  return (
    <div className="video-panel-card">
      <div className="video-panel-card-header">
        <div>
          <div className="video-label">{metadata.filename || videoId}</div>
          <div className="video-id">{videoId}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {nTimesteps > 0 && (
            <span className="video-tag">t={nTimesteps} TRs</span>
          )}
          {metadata.duration && (
            <span className="video-tag">
              {Math.floor(metadata.duration / 60)}:{String(Math.floor(metadata.duration % 60)).padStart(2, '0')}
            </span>
          )}
        </div>
      </div>

      <div className="video-panel-body">
        <div className="video-panel-left">
          <div className="panel-thumbnail">
            {!isCompare && videoSrc ? (
              <video
                ref={vRef}
                src={videoSrc}
                muted
                playsInline
                preload="auto"
              />
            ) : (
              <img
                src={`/api/videos/${videoId}/thumbnail`}
                alt={metadata.filename}
                onError={(e) => { e.target.style.display = 'none' }}
              />
            )}
            {!isCompare && onPlayPause && (
              <div className="play-overlay" onClick={onPlayPause}>
                <div className="play-icon">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#111">
                    {isPlaying
                      ? <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>
                      : <polygon points="5,3 19,12 5,21" />
                    }
                  </svg>
                </div>
              </div>
            )}
          </div>

          <div className="stats-grid">
            <div className="stat-box">
              <div className="value">{currentTimestep}</div>
              <div className="label">Timestep</div>
            </div>
            <div className="stat-box">
              <div className="value" style={{ fontSize: 13 }}>
                {stats ? stats.mean.toFixed(4) : '\u2014'}
              </div>
              <div className="label">Mean</div>
            </div>
            <div className="stat-box">
              <div className="value" style={{ fontSize: 13 }}>
                {stats ? stats.maxVal.toFixed(4) : '\u2014'}
              </div>
              <div className="label">Max</div>
            </div>
            <div className="stat-box">
              <div className="value" style={{ fontSize: 13 }}>
                {stats ? stats.stdDev.toFixed(4) : '\u2014'}
              </div>
              <div className="label">Std Dev</div>
            </div>
          </div>

          <div className="render-status">
            <span className="dot" />
            Brain images: {nTimesteps}/{nTimesteps} rendered ({nTimesteps > 0 ? Math.round((nTimesteps / nTimesteps) * 100) : 0}%)
          </div>
        </div>

        <div className="video-panel-right">
          <div className="brain-section">
            <div className="brain-views-row">
              {VIEW_ORDER.map(viewName => {
                const imgData = brainImages?.[viewName]
                return (
                  <div
                    key={viewName}
                    className={`brain-view ${brainLoading && !imgData ? 'loading' : ''}`}
                  >
                    {imgData ? (
                      <img
                        src={`data:image/png;base64,${imgData}`}
                        alt={VIEW_LABELS[viewName]}
                        draggable={false}
                      />
                    ) : (
                      <div style={{
                        display: 'flex', flexDirection: 'column',
                        alignItems: 'center', justifyContent: 'center',
                        gap: 4, opacity: 0.3,
                      }}>
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                          <path d="M12 2c-2.5 0-4.5 4.48-4.5 10s2 10 4.5 10 4.5-4.48 4.5-10-2-10-4.5-10z" />
                          <path d="M2 12h20" />
                        </svg>
                        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono)' }}>
                          {brainLoading ? 'Loading...' : 'No data'}
                        </span>
                      </div>
                    )}
                    <div className="view-label">{VIEW_LABELS[viewName]}</div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="timestep-slider-section">
            <span className="timestep-label">Timestep:</span>
            <input
              type="range"
              className="timestep-slider"
              min={0}
              max={Math.max(0, nTimesteps - 1)}
              value={currentTimestep}
              onChange={(e) => onTimestepChange(parseInt(e.target.value, 10))}
            />
            <span className="timestep-value">
              {currentTimestep} / {Math.max(0, nTimesteps - 1)} TR
            </span>
          </div>

          {!isCompare && interpretation && (
            <div className="interpretation-panel">
              <div className="header">AI Interpretation \u2014 {interpretation.timestep}s</div>
              <div className="content">{interpretation.interpretation}</div>
            </div>
          )}

          <div className="chart-section">
            <RegionChart
              title="Brain Region Activation"
              roiActivations={roiActivations}
              roiConfig={roiConfig}
              currentTimestep={currentTimestep}
              onTimestepClick={onTimestepChange}
              nTimesteps={nTimesteps}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
