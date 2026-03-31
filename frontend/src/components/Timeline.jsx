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
    const ratio = x / rect.width
    return Math.round(ratio * (nTimesteps - 1))
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
    const ts = getTimestepFromEvent(e)
    onTimestepChange(ts)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

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
        {/* Play/Pause */}
        <div className="timeline-controls">
          <button className="btn-control" onClick={onPlayPause} title={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>

          {/* Step backward */}
          <button
            className="btn-control"
            onClick={() => onTimestepChange(Math.max(0, currentTimestep - 1))}
            title="Previous timestep"
          >
            ◀
          </button>

          {/* Step forward */}
          <button
            className="btn-control"
            onClick={() => onTimestepChange(Math.min(nTimesteps - 1, currentTimestep + 1))}
            title="Next timestep"
          >
            ▶
          </button>
        </div>

        {/* Time display */}
        <div className="timeline-time">
          {formatTime(currentTimestep)} / {formatTime(nTimesteps - 1)}
        </div>

        {/* Scrubber */}
        <div
          className="timeline-scrubber"
          ref={trackRef}
          onMouseDown={handleMouseDown}
        >
          <div className="timeline-track">
            <div
              className="timeline-progress"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* B-roll markers */}
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

          {/* B-roll start marker (while marking) */}
          {markingBroll && brollStart !== null && (
            <div
              style={{
                position: 'absolute',
                left: `${(brollStart / (nTimesteps - 1)) * 100}%`,
                top: 0,
                height: '100%',
                width: 2,
                background: 'var(--accent-yellow)',
                zIndex: 3,
              }}
            />
          )}

          {/* Playhead handle */}
          <div
            className="timeline-handle"
            style={{ left: `${progress}%` }}
          />
        </div>

        {/* Timestep display */}
        <div className="timeline-time" style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
          TR {currentTimestep} / {nTimesteps - 1}
        </div>

        {/* Action buttons */}
        <div className="timeline-controls">
          <button
            className={`btn-control ${markingBroll ? 'active' : ''}`}
            onClick={() => {
              setMarkingBroll(!markingBroll)
              setBrollStart(null)
            }}
            title="Mark B-roll clip"
          >
            ✂️ B-roll
          </button>

          <button
            className="btn-control"
            onClick={onInterpret}
            title="Get AI interpretation of current timestep"
          >
            🧠 Interpret
          </button>
        </div>
      </div>

      {/* B-roll marking instructions */}
      {markingBroll && (
        <div style={{
          marginTop: 8,
          fontSize: 11,
          color: 'var(--accent-yellow)',
          fontFamily: 'var(--font-mono)',
          textAlign: 'center',
        }}>
          {brollStart === null
            ? '↑ Click on timeline to set B-roll start point'
            : `Start: TR ${brollStart} — Click again to set end point`
          }
        </div>
      )}
    </div>
  )
}
