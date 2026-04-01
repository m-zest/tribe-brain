import React, { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import VideoPanel from './components/VideoPanel'
import VideoPlayer from './components/VideoPlayer'
import BrainViewer from './components/BrainViewer'
import RegionChart from './components/RegionChart'
import Timeline from './components/Timeline'

const API_BASE = ''

export default function App() {
  const [videos, setVideos] = useState([])
  const [activeVideoId, setActiveVideoId] = useState(null)
  const [videoData, setVideoData] = useState(null)
  const [currentTimestep, setCurrentTimestep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [brainImages, setBrainImages] = useState(null)
  const [brainLoading, setBrainLoading] = useState(false)
  const [interpretation, setInterpretation] = useState(null)
  const [compareVideoId, setCompareVideoId] = useState(null)
  const [compareData, setCompareData] = useState(null)
  const [compareBrainImages, setCompareBrainImages] = useState(null)
  const [brollMarkers, setBrollMarkers] = useState([])
  const [processingIds, setProcessingIds] = useState(new Set())
  const [viewMode, setViewMode] = useState('compare') // 'monitor' | 'compare'
  const [sortBy, setSortBy] = useState('name')

  const videoRef = useRef(null)
  const brainCacheRef = useRef({})

  // Fetch video list
  const fetchVideos = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/videos`)
      const data = await res.json()
      setVideos(data.videos || [])
    } catch (err) {
      console.error('Failed to fetch videos:', err)
    }
  }, [])

  useEffect(() => {
    fetchVideos()
    const interval = setInterval(fetchVideos, 5000)
    return () => clearInterval(interval)
  }, [fetchVideos])

  // Sort videos
  const sortedVideos = [...videos].sort((a, b) => {
    if (sortBy === 'name') return (a.filename || '').localeCompare(b.filename || '')
    if (sortBy === 'date') return (b.created_at || 0) - (a.created_at || 0)
    if (sortBy === 'duration') return (b.duration || 0) - (a.duration || 0)
    if (sortBy === 'status') return (a.status || '').localeCompare(b.status || '')
    return 0
  })

  // Load video data when active video changes
  useEffect(() => {
    if (!activeVideoId) return
    const video = videos.find(v => v.video_id === activeVideoId)
    if (!video || video.status !== 'ready') return

    const loadData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/videos/${activeVideoId}/data`)
        const data = await res.json()
        setVideoData(data)
        setCurrentTimestep(0)
        setBrainImages(null)
        brainCacheRef.current = {}
      } catch (err) {
        console.error('Failed to load video data:', err)
      }
    }
    loadData()
  }, [activeVideoId, videos])

  // Load compare video data
  useEffect(() => {
    if (!compareVideoId) { setCompareData(null); return }
    const video = videos.find(v => v.video_id === compareVideoId)
    if (!video || video.status !== 'ready') return

    const loadData = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/videos/${compareVideoId}/data`)
        const data = await res.json()
        setCompareData(data)
      } catch (err) {
        console.error('Failed to load compare data:', err)
      }
    }
    loadData()
  }, [compareVideoId, videos])

  // Fetch brain images for current timestep
  useEffect(() => {
    if (!activeVideoId || !videoData) return

    const cacheKey = `${activeVideoId}_${currentTimestep}`
    if (brainCacheRef.current[cacheKey]) {
      setBrainImages(brainCacheRef.current[cacheKey])
      return
    }

    setBrainLoading(true)
    const fetchBrain = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/videos/${activeVideoId}/brain/${currentTimestep}`)
        const data = await res.json()
        brainCacheRef.current[cacheKey] = data.images
        setBrainImages(data.images)
      } catch (err) {
        console.error('Failed to fetch brain images:', err)
      } finally {
        setBrainLoading(false)
      }
    }
    fetchBrain()

    // Prefetch next timesteps
    for (let i = 1; i <= 3; i++) {
      const nextT = currentTimestep + i
      const nextKey = `${activeVideoId}_${nextT}`
      if (!brainCacheRef.current[nextKey] && nextT < (videoData?.metadata?.n_timesteps || 0)) {
        fetch(`${API_BASE}/api/videos/${activeVideoId}/brain/${nextT}`)
          .then(r => r.json())
          .then(d => { brainCacheRef.current[nextKey] = d.images })
          .catch(() => {})
      }
    }
  }, [activeVideoId, currentTimestep, videoData])

  // Fetch compare brain images
  useEffect(() => {
    if (!compareVideoId || !compareData) return
    const cacheKey = `${compareVideoId}_${currentTimestep}`
    if (brainCacheRef.current[cacheKey]) {
      setCompareBrainImages(brainCacheRef.current[cacheKey])
      return
    }
    fetch(`${API_BASE}/api/videos/${compareVideoId}/brain/${currentTimestep}`)
      .then(r => r.json())
      .then(d => {
        brainCacheRef.current[cacheKey] = d.images
        setCompareBrainImages(d.images)
      })
      .catch(() => {})
  }, [compareVideoId, currentTimestep, compareData])

  // Process a video
  const processVideo = async (videoId) => {
    setProcessingIds(prev => new Set([...prev, videoId]))
    try {
      await fetch(`${API_BASE}/api/videos/${videoId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prerender: true }),
      })
    } catch (err) {
      console.error('Failed to start processing:', err)
    }
  }

  // Upload
  const uploadVideo = async (file) => {
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch(`${API_BASE}/api/videos/upload`, {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      fetchVideos()
      return data
    } catch (err) {
      console.error('Upload failed:', err)
    }
  }

  // Interpretation
  const fetchInterpretation = async (timestep) => {
    if (!activeVideoId) return
    try {
      const res = await fetch(`${API_BASE}/api/videos/${activeVideoId}/interpret`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timestep }),
      })
      const data = await res.json()
      setInterpretation(data)
    } catch (err) {
      console.error('Interpretation failed:', err)
    }
  }

  // Video time sync
  const handleVideoTimeUpdate = useCallback((currentTime) => {
    const ts = Math.floor(currentTime)
    if (ts !== currentTimestep) setCurrentTimestep(ts)
  }, [currentTimestep])

  const handleTimestepChange = useCallback((ts) => {
    setCurrentTimestep(ts)
    if (videoRef.current) videoRef.current.currentTime = ts
  }, [])

  // B-roll markers
  const addBrollMarker = (start, end) => {
    setBrollMarkers(prev => [...prev, {
      id: Date.now(),
      videoId: activeVideoId,
      start,
      end,
      label: `Clip ${prev.length + 1}`,
    }])
  }

  // Select compare video
  const handleSelectCompare = (videoId) => {
    if (videoId === activeVideoId) return
    setCompareVideoId(videoId)
  }

  const activeVideo = videos.find(v => v.video_id === activeVideoId)
  const nTimesteps = videoData?.metadata?.n_timesteps || 0
  const readyVideos = videos.filter(v => v.status === 'ready')

  return (
    <div className="app-root">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="top-nav-left">
          <div className="nav-tabs">
            <button
              className={`nav-tab ${viewMode === 'monitor' ? 'active' : ''}`}
              onClick={() => setViewMode('monitor')}
            >
              Monitor
            </button>
            <button
              className={`nav-tab ${viewMode === 'compare' ? 'active' : ''}`}
              onClick={() => setViewMode('compare')}
            >
              Compare Results
            </button>
          </div>
          <div className="top-nav-title">
            <span>TRIBE v2</span> \u2014 Content Brain Activation {viewMode === 'compare' ? 'Comparison' : 'Monitor'}
          </div>
        </div>
        <div className="top-nav-right">
          <div className="top-nav-badge">Meta FAIR \u00b7 facebook/tribev2</div>
          <div className="top-nav-badge">{readyVideos.length} processed</div>
        </div>
      </nav>

      {/* Main Layout */}
      <div className="main-area">
        <Sidebar
          videos={sortedVideos}
          activeVideoId={activeVideoId}
          compareVideoId={compareVideoId}
          onSelectVideo={setActiveVideoId}
          onSelectCompare={handleSelectCompare}
          onProcessVideo={processVideo}
          onUploadVideo={uploadVideo}
          processingIds={processingIds}
          sortBy={sortBy}
          onSortChange={setSortBy}
          viewMode={viewMode}
        />

        <div className="content-area">
          {viewMode === 'compare' ? (
            <>
              {!activeVideoId ? (
                <div className="empty-state">
                  <div className="icon">\ud83e\udde0</div>
                  <h2>Content Brain Activation Comparison</h2>
                  <p>
                    Select a video from the sidebar to visualize how content activates different brain regions over time using Meta's TRIBE v2 model.
                  </p>
                </div>
              ) : (
                <>
                  {videoData && (
                    <VideoPanel
                      videoId={activeVideoId}
                      videoData={videoData}
                      brainImages={brainImages}
                      brainLoading={brainLoading}
                      currentTimestep={currentTimestep}
                      onTimestepChange={handleTimestepChange}
                      videoRef={videoRef}
                      isPlaying={isPlaying}
                      onPlayPause={() => setIsPlaying(!isPlaying)}
                      onTimeUpdate={handleVideoTimeUpdate}
                      onInterpret={() => fetchInterpretation(currentTimestep)}
                      interpretation={interpretation}
                    />
                  )}

                  {compareVideoId && compareData && (
                    <VideoPanel
                      videoId={compareVideoId}
                      videoData={compareData}
                      brainImages={compareBrainImages}
                      brainLoading={false}
                      currentTimestep={currentTimestep}
                      onTimestepChange={handleTimestepChange}
                      isCompare
                    />
                  )}

                  {compareVideoId && compareData && videoData && (
                    <SummarySection
                      dataA={videoData}
                      dataB={compareData}
                      videoIdA={activeVideoId}
                      videoIdB={compareVideoId}
                    />
                  )}

                  {!compareVideoId && readyVideos.length > 1 && (
                    <div style={{
                      textAlign: 'center',
                      padding: '24px',
                      color: 'var(--text-muted)',
                      fontSize: 13,
                      fontFamily: 'var(--font-sans)',
                    }}>
                      Select a second video in the sidebar to compare brain activations
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {!activeVideoId || !videoData ? (
                <div className="empty-state">
                  <div className="icon">\ud83e\udde0</div>
                  <h2>Brain Activation Visualizer</h2>
                  <p>
                    Select a video from the sidebar and process it with TRIBE v2 to see how content activates different brain regions over time.
                  </p>
                </div>
              ) : (
                <div className="monitor-content">
                  <div className="monitor-top">
                    <div className="monitor-video-panel">
                      <VideoPlayer
                        videoId={activeVideoId}
                        metadata={videoData.metadata}
                        isPlaying={isPlaying}
                        onTimeUpdate={handleVideoTimeUpdate}
                        videoRef={videoRef}
                        currentTimestep={currentTimestep}
                        nTimesteps={nTimesteps}
                        roiActivations={videoData.roi_activations}
                      />
                    </div>
                    <div className="monitor-brain-panel">
                      <BrainViewer
                        images={brainImages}
                        loading={brainLoading}
                        timestep={currentTimestep}
                      />
                    </div>
                  </div>

                  <div className="monitor-charts">
                    {interpretation && (
                      <div className="interpretation-panel">
                        <div className="header">AI Interpretation \u2014 {interpretation.timestep}s</div>
                        <div className="content">{interpretation.interpretation}</div>
                      </div>
                    )}

                    <RegionChart
                      title="Brain Region Activation"
                      roiActivations={videoData.roi_activations}
                      roiConfig={videoData.roi_config}
                      currentTimestep={currentTimestep}
                      onTimestepClick={handleTimestepChange}
                      nTimesteps={nTimesteps}
                    />
                  </div>

                  <Timeline
                    currentTimestep={currentTimestep}
                    nTimesteps={nTimesteps}
                    isPlaying={isPlaying}
                    onTimestepChange={handleTimestepChange}
                    onPlayPause={() => setIsPlaying(!isPlaying)}
                    onInterpret={() => fetchInterpretation(currentTimestep)}
                    brollMarkers={brollMarkers.filter(m => m.videoId === activeVideoId)}
                    onAddBrollMarker={addBrollMarker}
                    duration={videoData.metadata?.duration || 0}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function SummarySection({ dataA, dataB, videoIdA, videoIdB }) {
  if (!dataA?.roi_activations || !dataB?.roi_activations) return null

  const networks = Object.keys(dataA.roi_activations)
  const config = dataA.roi_config || {}

  const computeMean = (vals) => {
    if (!vals || !vals.length) return 0
    return vals.reduce((s, v) => s + v, 0) / vals.length
  }

  return (
    <div className="summary-section">
      <h3>Summary</h3>
      <div className="summary-grid">
        {networks.map(key => {
          const meanA = computeMean(dataA.roi_activations[key])
          const meanB = computeMean(dataB.roi_activations[key])
          const diff = meanA - meanB
          const cfg = config[key] || {}

          return (
            <div
              key={key}
              className="summary-card"
              style={{ borderLeftColor: cfg.color || '#888' }}
            >
              <div className="network-label">{cfg.label || key}</div>
              <div className="values-row">
                <span className="value">{meanA.toFixed(4)}</span>
                <span className="vs">vs</span>
                <span className="value">{meanB.toFixed(4)}</span>
              </div>
              <div className={`delta ${diff >= 0 ? 'positive' : 'negative'}`}>
                {'\u0394'} {diff >= 0 ? '+' : ''}{diff.toFixed(4)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
