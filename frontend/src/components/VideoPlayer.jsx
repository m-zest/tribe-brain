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

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) video.play().catch(() => {})
    else video.pause()
  }, [isPlaying, videoRef])

  useEffect(() => {
    if (!isPlaying) return
    const tick = () => {
      if (videoRef.current) onTimeUpdate(videoRef.current.currentTime)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current) }
  }, [isPlaying, onTimeUpdate, videoRef])

  const getCurrentStats = () => {
    if (!roiActivations || currentTimestep < 0) return null
    let maxVal = -Infinity, minVal = Infinity, maxNet = ''
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
  const videoSrc = metadata?.filename ? `/videos/${metadata.filename}` : null

  return (
    <>
      <div className="video-player-wrapper">
        {videoSrc ? (
          <video ref={videoRef} src={videoSrc} muted playsInline preload="auto" />
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
          <div className="value" style={{ fontSize: 13 }}>
            {stats ? stats.maxVal.toFixed(4) : '\u2014'}
          </div>
          <div className="label">Peak</div>
        </div>
        <div className="stat-box">
          <div className="value" style={{ fontSize: 13 }}>
            {stats ? stats.minVal.toFixed(4) : '\u2014'}
          </div>
          <div className="label">Min</div>
        </div>
        <div className="stat-box">
          <div className="value" style={{ fontSize: 12 }}>
            {nTimesteps}
          </div>
          <div className="label">
            {metadata?.n_vertices?.toLocaleString() || '20,484'} verts
          </div>
        </div>
      </div>
    </>
  )
}
