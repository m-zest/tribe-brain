import React, { useRef, useState, useCallback } from 'react'

export default function Timeline({
  currentTimestep,
  nTimesteps,
  isPlaying,
  onTimestepChange,
  onPlayPause,
  onInterpret,
  brollMarkers,
  onAddBrollMarker,
  duration,
}) {
  const trackRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const [markingBroll, setMarkingBroll] = useState(false)
  const [brollStart, setBrollStart] = useState(null)

  const progress = nTimesteps > 0 ? (currentTimestep / (nTimesteps - 1)) * 100 : 0

  const getTimestepFromEvent = useCallback((e) => {
    const track = trackRef.current
    if (!track) return 0
    const rect = track.getBoundingClientRect()
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    return Math.round((x / rect.width) * (nTimesteps - 1))
  }, [nTimesteps])

  const handleMouseDown = (e) => {
    setIsDragging(true)
    const ts = getTimestepFromEvent(e)
    if (markingBroll) {
      if (brollStart === null) {
        setBrollStart(ts)
      } else {
        onAddBrollMarker(Math.min(brollStart, ts), Math.max(brollStart, ts))
        setBrollStart(null)
        setMarkingBroll(false)
      }
    } else {
      onTimestepChange(ts)
    }
  }

  const handleMouseMove = (e) => {
    if (!isDragging || markingBroll) return
    onTimestepChange(getTimestepFromEvent(e))
  }

  const handleMouseUp = () => setIsDragging(false)

  const formatTime = (timestep) => {
    const totalSeconds = duration > 0 ? (timestep / nTimesteps) * duration : timestep
    const m = Math.floor(totalSeconds / 60)
    const s = Math.floor(totalSeconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div
      className="timeline-section"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <div className="timeline-bar">
        <div className="timeline-controls">
          <button className="btn-control" onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              {isPlaying
                ? <><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></>
                : <polygon points="5,3 19,12 5,21" />
              }
            </svg>
          </button>
          <button
            className="btn-control"
            onClick={() => onTimestepChange(Math.max(0, currentTimestep - 1))}
            title="Previous"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="19,20 9,12 19,4" /><rect x="5" y="4" width="3" height="16" />
            </svg>
          </button>
          <button
            className="btn-control"
            onClick={() => onTimestepChange(Math.min(nTimesteps - 1, currentTimestep + 1))}
            title="Next"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5,4 15,12 5,20" /><rect x="16" y="4" width="3" height="16" />
            </svg>
          </button>
        </div>

        <div className="timeline-time">{formatTime(currentTimestep)} / {formatTime(nTimesteps - 1)}</div>

        <div className="timeline-scrubber" ref={trackRef} onMouseDown={handleMouseDown}>
          <div className="timeline-track">
            <div className="timeline-progress" style={{ width: `${progress}%` }} />
          </div>
          {brollMarkers.map(marker => {
            const startPct = (marker.start / (nTimesteps - 1)) * 100
            const widthPct = ((marker.end - marker.start) / (nTimesteps - 1)) * 100
            return (
              <div
                key={marker.id}
                className="broll-marker"
                style={{ left: `${startPct}%`, width: `${widthPct}%` }}
                title={marker.label}
              />
            )
          })}
          {markingBroll && brollStart !== null && (
            <div style={{
              position: 'absolute',
              left: `${(brollStart / (nTimesteps - 1)) * 100}%`,
              top: 0, height: '100%', width: 2,
              background: 'var(--accent-yellow)', zIndex: 3,
            }} />
          )}
          <div className="timeline-handle" style={{ left: `${progress}%` }} />
        </div>

        <div className="timeline-time" style={{ fontSize: 11 }}>
          TR {currentTimestep} / {nTimesteps - 1}
        </div>

        <div className="timeline-controls">
          <button
            className={`btn-control ${markingBroll ? 'active' : ''}`}
            onClick={() => { setMarkingBroll(!markingBroll); setBrollStart(null) }}
            title="Mark B-roll"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 9l6 6 6-6" />
            </svg>
            B-roll
          </button>
          <button className="btn-control" onClick={onInterpret} title="AI Interpretation">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v-4M12 8h.01" />
            </svg>
            Interpret
          </button>
        </div>
      </div>

      {markingBroll && (
        <div style={{
          marginTop: 8, fontSize: 11,
          color: 'var(--accent-yellow)',
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
        }}>
          {brollStart === null
            ? 'Click on timeline to set B-roll start point'
            : `Start: TR ${brollStart} \u2014 Click again to set end point`
          }
        </div>
      )}
    </div>
  )
}
