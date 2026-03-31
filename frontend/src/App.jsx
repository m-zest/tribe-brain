import React, { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import VideoPlayer from './components/VideoPlayer'
import BrainViewer from './components/BrainViewer'
import RegionChart from './components/RegionChart'
import Timeline from './components/Timeline'

const API_BASE = ''

export default function App() {
  // State
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
  const [brollMarkers, setBrollMarkers] = useState([])
  const [processingIds, setProcessingIds] = useState(new Set())

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

    // Prefetch next few timesteps
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

  // Upload a video
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

  // Get interpretation
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

  // Sync video playback with timestep
  const handleVideoTimeUpdate = useCallback((currentTime) => {
    const ts = Math.floor(currentTime)
    if (ts !== currentTimestep) {
      setCurrentTimestep(ts)
    }
  }, [currentTimestep])

  const handleTimestepChange = useCallback((ts) => {
    setCurrentTimestep(ts)
    if (videoRef.current) {
      videoRef.current.currentTime = ts
    }
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

  const activeVideo = videos.find(v => v.video_id === activeVideoId)
  const nTimesteps = videoData?.metadata?.n_timesteps || 0

  return (
    <div className={`app-layout ${compareVideoId ? 'compare-mode' : ''}`}>
      <Sidebar
        videos={videos}
        activeVideoId={activeVideoId}
        onSelectVideo={setActiveVideoId}
        onProcessVideo={processVideo}
        onUploadVideo={uploadVideo}
        processingIds={processingIds}
      />

      <div className="main-content">
        {!activeVideoId || !videoData ? (
          <div className="empty-state">
            <div className="icon">🧠</div>
            <h2>Brain Activation Visualizer</h2>
            <p>
              Select a video from the sidebar and process it with TRIBE v2 to see how content activates different brain regions over time.
            </p>
          </div>
        ) : (
          <>
            {/* Top: Video + Brain views */}
            <div className="top-section">
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
              <BrainViewer
                images={brainImages}
                loading={brainLoading}
                timestep={currentTimestep}
              />
            </div>

            {/* Middle: Charts */}
            <div className="charts-section">
              {interpretation && (
                <div className="interpretation-panel">
                  <div className="header">AI Interpretation — {interpretation.timestep}s</div>
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

              {compareData && (
                <RegionChart
                  title={`Compare: ${compareData.metadata?.filename || 'Video 2'}`}
                  roiActivations={compareData.roi_activations}
                  roiConfig={compareData.roi_config}
                  currentTimestep={currentTimestep}
                  onTimestepClick={handleTimestepChange}
                  nTimesteps={compareData.metadata?.n_timesteps || 0}
                />
              )}
            </div>

            {/* Bottom: Timeline */}
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
          </>
        )}
      </div>
    </div>
  )
}
