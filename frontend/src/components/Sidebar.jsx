import React, { useRef } from 'react'

export default function Sidebar({
  videos,
  activeVideoId,
  onSelectVideo,
  onProcessVideo,
  onUploadVideo,
  processingIds,
}) {
  const fileInputRef = useRef(null)

  const handleUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    await onUploadVideo(file)
    e.target.value = ''
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0:00'
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>
          <span className="icon">🧠</span>
          BrainViz
        </h1>
        <div className="subtitle">TRIBE v2 · Meta FAIR</div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-section-title">Videos</div>
      </div>

      <div className="video-list">
        {videos.length === 0 && (
          <div style={{ padding: '16px 12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
            No videos yet. Upload one below.
          </div>
        )}

        {videos.map(video => {
          const isActive = video.video_id === activeVideoId
          const isProcessing = processingIds.has(video.video_id) || video.status === 'processing'
          const isReady = video.status === 'ready'

          return (
            <div
              key={video.video_id}
              className={`video-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectVideo(video.video_id)}
            >
              <div className="thumb">
                {video.thumbnail ? (
                  <img src={`/api/videos/${video.video_id}/thumbnail`} alt="" />
                ) : (
                  <span style={{ fontSize: 18, opacity: 0.3 }}>🎬</span>
                )}
              </div>
              <div className="info">
                <div className="name">{video.filename}</div>
                <div className="meta">
                  {formatDuration(video.duration)} · {video.size_mb}MB
                  {video.n_timesteps ? ` · ${video.n_timesteps} TR` : ''}
                </div>
              </div>
              <div className={`status-dot ${isProcessing ? 'processing' : video.status}`} />
            </div>
          )
        })}
      </div>

      {/* Process button for selected unprocessed video */}
      {activeVideoId && (() => {
        const v = videos.find(v => v.video_id === activeVideoId)
        if (v && v.status !== 'ready' && !processingIds.has(activeVideoId)) {
          return (
            <div style={{ padding: '8px 12px' }}>
              <button
                className="btn-process"
                onClick={() => onProcessVideo(activeVideoId)}
              >
                ▶ Process with TRIBE v2
              </button>
            </div>
          )
        }
        if (processingIds.has(activeVideoId)) {
          return (
            <div style={{ padding: '8px 12px' }}>
              <button className="btn-process" disabled>
                ⏳ Processing...
              </button>
            </div>
          )
        }
        return null
      })()}

      {/* Upload */}
      <div className="upload-area">
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
        <div
          className="upload-dropzone"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
          onDrop={(e) => {
            e.preventDefault()
            const file = e.dataTransfer.files?.[0]
            if (file) onUploadVideo(file)
          }}
        >
          <div className="icon">📁</div>
          <div className="text">Drop video or click to upload</div>
        </div>
      </div>
    </div>
  )
}
