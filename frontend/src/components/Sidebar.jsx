import React, { useRef } from 'react'

export default function Sidebar({
  videos,
  activeVideoId,
  compareVideoId,
  onSelectVideo,
  onSelectCompare,
  onProcessVideo,
  onUploadVideo,
  processingIds,
  sortBy,
  onSortChange,
  viewMode,
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

  const handleVideoClick = (videoId) => {
    if (viewMode === 'compare' && activeVideoId && activeVideoId !== videoId) {
      const video = videos.find(v => v.video_id === videoId)
      if (video?.status === 'ready' && activeVideoId) {
        onSelectCompare(videoId)
        return
      }
    }
    onSelectVideo(videoId)
  }

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h1>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--accent-purple)" strokeWidth="2" strokeLinecap="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
            <path d="M10 21h4"/>
            <path d="M12 17v4"/>
          </svg>
          Neural Analyzer
        </h1>
        <div className="subtitle">TRIBE v2 \u00b7 Meta FAIR</div>
      </div>

      <div className="sidebar-toolbar">
        <div className="sort-control">
          <span>Sort by:</span>
          <select value={sortBy} onChange={(e) => onSortChange(e.target.value)}>
            <option value="name">Name</option>
            <option value="date">Date</option>
            <option value="duration">Duration</option>
            <option value="status">Status</option>
          </select>
        </div>
        <button
          className="btn-add-video"
          onClick={() => fileInputRef.current?.click()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Video
        </button>
      </div>

      <div className="video-list">
        {videos.length === 0 && (
          <div style={{
            padding: '24px 12px',
            fontSize: 12,
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            No videos yet.<br />Upload one to get started.
          </div>
        )}

        {videos.map(video => {
          const isActive = video.video_id === activeVideoId
          const isCompare = video.video_id === compareVideoId
          const isProcessing = processingIds.has(video.video_id) || video.status === 'processing'
          const isReady = video.status === 'ready'

          return (
            <div
              key={video.video_id}
              className={`video-item ${isActive ? 'active' : ''} ${isCompare ? 'active' : ''}`}
              onClick={() => handleVideoClick(video.video_id)}
            >
              <div className="thumb">
                {video.thumbnail ? (
                  <img src={`/api/videos/${video.video_id}/thumbnail`} alt="" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" opacity="0.4">
                    <rect x="2" y="2" width="20" height="20" rx="2" />
                    <polygon points="10,8 16,12 10,16" fill="var(--text-muted)" />
                  </svg>
                )}
              </div>
              <div className="info">
                <div className="name">{video.filename}</div>
                <div className="meta">
                  {formatDuration(video.duration)} \u00b7 {video.size_mb}MB
                  {video.n_timesteps ? ` \u00b7 ${video.n_timesteps} TR` : ''}
                </div>
              </div>
              <div className={`status-dot ${isProcessing ? 'processing' : video.status}`} />
            </div>
          )
        })}
      </div>

      {activeVideoId && (() => {
        const v = videos.find(v => v.video_id === activeVideoId)
        if (v && v.status !== 'ready' && !processingIds.has(activeVideoId)) {
          return (
            <div className="sidebar-process">
              <button
                className="btn-process"
                onClick={() => onProcessVideo(activeVideoId)}
              >
                Process with TRIBE v2
              </button>
            </div>
          )
        }
        if (processingIds.has(activeVideoId)) {
          return (
            <div className="sidebar-process">
              <button className="btn-process" disabled>
                Processing...
              </button>
            </div>
          )
        }
        return null
      })()}

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
          <div className="icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </div>
          <div className="text">Drop video or click to upload</div>
        </div>
      </div>
    </div>
  )
}
