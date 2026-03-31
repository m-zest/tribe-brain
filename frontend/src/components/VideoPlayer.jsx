import React, { useEffect, useRef } from 'react'

export default function VideoPlayer({
  videoId,
  metadata,
  isPlaying,
  onTimeUpdate,
  videoRef,
  currentTimestep,
  nTimesteps,
  roiActivations,
}) {
  const animFrameRef = useRef(null)

  // Sync playback
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.play().catch(() => {})
    } else {
      video.pause()
    }
  }, [isPlaying, videoRef])

  // Poll video time during playback
  useEffect(() => {
    if (!isPlaying) return

    const tick = () => {
      if (videoRef.current) {
        onTimeUpdate(videoRef.current.currentTime)
      }
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current)
      }
    }
  }, [isPlaying, onTimeUpdate, videoRef])

  // Compute current stats from ROI data
  const getCurrentStats = () => {
    if (!roiActivations || currentTimestep < 0) return null

    let maxVal = -Infinity
    let minVal = Infinity
    let maxNet = ''

    for (const [key, vals] of Object.entries(roiActivations)) {
      if (currentTimestep < vals.length) {
        const v = vals[currentTimestep]
        if (v > maxVal) { maxVal = v; maxNet = key }
        if (v < minVal) minVal = v
      }
    }

    return { maxVal, minVal, maxNet }
  }

  const stats = getCurrentStats()

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  // Video source URL — served from backend static files
  const videoSrc = metadata?.filename ? `/videos/${metadata.filename}` : null

  return (
    <div className="video-panel">
      <div className="video-player-wrapper">
        {videoSrc ? (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            preload="auto"
            style={{ background: '#000' }}
          />
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: '100%', color: 'var(--text-muted)', fontSize: 13,
          }}>
            No video source
          </div>
        )}
      </div>

      <div className="video-stats">
        <div className="stat-box">
          <div className="value">{currentTimestep}</div>
          <div className="label">Timestep</div>
        </div>
        <div className="stat-box">
          <div className="value" style={{ fontSize: 14 }}>
            {stats ? stats.maxVal.toFixed(4) : '—'}
          </div>
          <div className="label">Peak Activation</div>
        </div>
        <div className="stat-box">
          <div className="value" style={{ fontSize: 14 }}>
            {stats ? stats.minVal.toFixed(4) : '—'}
          </div>
          <div className="label">Min Activation</div>
        </div>
        <div className="stat-box">
          <div className="value" style={{ fontSize: 11, letterSpacing: '0.02em' }}>
            {nTimesteps}
          </div>
          <div className="label">
            Brain images · {metadata?.n_vertices?.toLocaleString() || '20,484'} vertices
          </div>
        </div>
      </div>
    </div>
  )
}
