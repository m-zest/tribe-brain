<div align="center">


# Neural Content Analyzer

### See How Content Affects Your Brain

**Predict and visualize real-time brain activation patterns from any video using Meta's TRIBE v2 model**

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Meta TRIBE v2](https://img.shields.io/badge/Meta-TRIBE_v2-0668E1?style=for-the-badge&logo=meta&logoColor=white)](https://github.com/facebookresearch/tribev2)
[![License](https://img.shields.io/badge/License-CC_BY--NC_4.0-EF9421?style=for-the-badge)](LICENSE)

<br />

<img src="docs/hero-screenshot.png" alt="Neural Content Analyzer — Compare View" width="100%" />

<br />

*Load any video — TRIBE v2 predicts fMRI brain responses at 1-second resolution — Explore activation patterns across 6 neural networks in real-time*

---

[**Getting Started**](#getting-started) · [**Features**](#features) · [**How It Works**](#how-it-works) · [**Brain Networks**](#brain-networks) · [**API Reference**](#api-reference) · [**Architecture**](#architecture)

</div>

<br />

## Features

<table>
<tr>
<td width="50%">

### Compare Mode
Stack multiple videos side-by-side to compare brain activation patterns. See which content drives more engagement, emotion, or attention — with per-network delta metrics.

### Monitor Mode
Real-time video playback synced with brain surface maps. Scrub through any moment and instantly see the neural response.

### 4-View Brain Surface Maps
Lateral and medial views of both hemispheres, rendered with nilearn's `cold_hot` colormap on fsaverage5 surface. Updates in real-time as you scrub.

</td>
<td width="50%">

### 6-Network Activation Charts
Interactive time-series for Attention, Auditory, Emotion/Memory, Language, Motor, and Visual networks. Click anywhere to jump to that timestep.

### B-Roll Marker System
Mark high-activation segments directly on the timeline. Export clips for use as background footage in your edits.

### AI Interpretation Agent
Optional LLM-powered analysis at each timestep — explains which brain regions are active, what's happening in the video, and what it might mean.

</td>
</tr>
</table>

<br />

## Screenshots

<div align="center">

| Compare View | Monitor View |
|:---:|:---:|
| <img src="docs/compare-view.png" width="100%" /> | <img src="docs/monitor-view.png" width="100%" /> |

| Brain Surface Maps | Region Activation Charts |
|:---:|:---:|
| <img src="docs/brain-views.png" width="100%" /> | <img src="docs/activation-charts.png" width="100%" /> |

</div>

<br />

## Getting Started

### Prerequisites

| Requirement | Version | Notes |
|:---|:---|:---|
| **Python** | 3.10+ | 3.11 recommended |
| **Node.js** | 18+ | For frontend dev server |
| **CUDA GPU** | 8GB+ VRAM | RTX 3070+ recommended |
| **FFmpeg** | Latest | System-wide installation |
| **HuggingFace** | Account | Access to [LLaMA 3.2-3B](https://huggingface.co/meta-llama/Llama-3.2-3B) (gated) |

### 1. Clone the repository

```bash
git clone https://github.com/m-zest/neural-content-analyzer.git
cd neural-content-analyzer
```

### 2. Install backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install TRIBE v2 (Meta's model)
pip install "tribev2[plotting] @ git+https://github.com/facebookresearch/tribev2.git"

# Install dependencies
pip install -r requirements.txt

# Login to HuggingFace (required for LLaMA 3.2 backbone)
huggingface-cli login
```

### 3. Install frontend

```bash
cd frontend
npm install
```

### 4. Start the application

```bash
# Terminal 1 — Backend (FastAPI)
cd backend
python -m uvicorn app:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2 — Frontend (Vite + React)
cd frontend
npm run dev
```

### 5. Open in browser

```
http://localhost:5173
```

> **Production:** Build the frontend with `npm run build` and let FastAPI serve it from port `8080`.

<br />

## How It Works

```
                         ┌──────────────────────────┐
                         │     Upload Video          │
                         │   (.mp4 .mov .avi .mkv)   │
                         └────────────┬─────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
             ┌────────────┐   ┌────────────┐   ┌────────────────┐
             │  WhisperX   │   │  DINOv2 +   │   │  Wav2Vec-BERT  │
             │  Transcribe │   │  V-JEPA2    │   │  Audio Feats   │
             └──────┬─────┘   └──────┬─────┘   └───────┬────────┘
                    │                │                   │
                    └────────────────┼───────────────────┘
                                     ▼
                         ┌──────────────────────┐
                         │     TRIBE v2 Model    │
                         │  (facebook/tribev2)   │
                         │                       │
                         │  Predicts vertex-wise │
                         │  fMRI activations at  │
                         │  1-second resolution  │
                         └───────────┬──────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                 ▼
          ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
          │  Brain Image  │  │    ROI        │  │  AI Interpreter  │
          │  Renderer     │  │  Extraction   │  │  (Claude/GPT)    │
          │  (nilearn)    │  │  (6 networks) │  │                  │
          └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘
                 │                 │                     │
                 └─────────────────┼─────────────────────┘
                                   ▼
                       ┌───────────────────────┐
                       │   React Frontend       │
                       │                        │
                       │  • 4-view brain maps   │
                       │  • Activation charts   │
                       │  • Video sync          │
                       │  • Compare mode        │
                       │  • B-roll markers      │
                       └───────────────────────┘
```

### Processing Pipeline

1. **Audio Extraction** — FFmpeg extracts audio track, WhisperX transcribes speech
2. **Visual Features** — DINOv2 + V-JEPA2 extract frame-level visual representations
3. **Audio Features** — Wav2Vec-BERT processes the audio signal
4. **TRIBE v2 Inference** — All features are fused and passed through Meta's brain encoding model, producing vertex-wise predictions on the fsaverage5 cortical surface (~20,484 vertices) at each 1-second timestep (TR)
5. **ROI Extraction** — Vertex-level predictions are aggregated into 6 functional brain networks using Yeo 7-network parcellation + Destrieux atlas
6. **Brain Rendering** — nilearn generates 4-view surface map PNGs (lateral/medial x left/right) for every timestep
7. **Caching** — All results cached to disk for instant subsequent loads

> **Performance:** ~2-5 minutes per minute of video on a modern GPU. Results are cached permanently.

<br />

## Brain Networks

The analyzer tracks 6 functional brain networks derived from standard neuroscience parcellations:

| Network | Color | Brain Regions | What It Indicates |
|:--------|:------|:-------------|:-----------------|
| **Attention** | Cyan | Dorsal/ventral attention networks (Yeo 4, 5) | Focused engagement, salience detection, sustained attention |
| **Auditory** | Green | Superior temporal gyrus, auditory cortex | Sound processing, speech perception, music |
| **Emotion / Memory** | Pink | Default mode + limbic networks | Emotional response, autobiographical memory, self-referential thought |
| **Language** | Yellow | Broca's area, Wernicke's area, angular gyrus | Speech comprehension, semantic processing, reading |
| **Motor** | Red | Somatomotor cortex, premotor areas | Movement perception, action planning, motor simulation |
| **Visual** | Blue | Occipital cortex, fusiform gyrus | Visual processing, object recognition, scene understanding |

<br />

## API Reference

The backend exposes a RESTful API via FastAPI:

### Videos

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `GET` | `/api/videos` | List all videos with status |
| `POST` | `/api/videos/upload` | Upload a new video file |
| `POST` | `/api/videos/{id}/process` | Start TRIBE v2 processing |
| `GET` | `/api/videos/{id}/status` | Check processing progress |
| `GET` | `/api/videos/{id}/data` | Get full processed data (ROI activations + metadata) |
| `GET` | `/api/videos/{id}/brain/{timestep}` | Get brain images for a specific timestep |
| `GET` | `/api/videos/{id}/thumbnail` | Get video thumbnail |

### Analysis

| Method | Endpoint | Description |
|:-------|:---------|:------------|
| `POST` | `/api/videos/{id}/interpret` | Get AI interpretation at a timestep |
| `GET` | `/api/compare?video_ids=a,b` | Compare brain activations across videos |

### Example

```bash
# List all videos
curl http://localhost:8080/api/videos

# Process a video
curl -X POST http://localhost:8080/api/videos/abc123/process \
  -H "Content-Type: application/json" \
  -d '{"prerender": true}'

# Get brain images at timestep 42
curl http://localhost:8080/api/videos/abc123/brain/42

# Compare two videos
curl "http://localhost:8080/api/compare?video_ids=abc123,def456"
```

<br />

## Architecture

```
neural-content-analyzer/
│
├── backend/
│   ├── app.py                     # FastAPI application & routes
│   ├── config.py                  # Configuration & constants
│   ├── requirements.txt           # Python dependencies
│   │
│   ├── models/
│   │   ├── tribe_wrapper.py       # Meta TRIBE v2 model wrapper
│   │   └── roi_extractor.py       # Brain region network extraction
│   │
│   ├── services/
│   │   ├── video_processor.py     # Full processing pipeline
│   │   ├── brain_renderer.py      # Brain surface image rendering (nilearn)
│   │   └── interpreter.py         # AI interpretation agent (Claude / GPT-4)
│   │
│   ├── videos/                    # Input video files
│   ├── renders/                   # Pre-rendered brain surface PNGs
│   └── results/                   # Cached predictions & metadata
│
├── frontend/
│   ├── index.html                 # Entry point
│   ├── package.json               # Node dependencies
│   ├── vite.config.js             # Vite configuration
│   └── src/
│       ├── App.jsx                # Main app (Monitor/Compare views)
│       ├── main.jsx               # React entry
│       ├── components/
│       │   ├── VideoPanel.jsx     # Combined video+brain+chart card
│       │   ├── BrainViewer.jsx    # 4-view brain surface display
│       │   ├── VideoPlayer.jsx    # HTML5 video with time sync
│       │   ├── RegionChart.jsx    # Interactive activation charts
│       │   ├── Timeline.jsx       # Playback scrubber + B-roll markers
│       │   ├── Sidebar.jsx        # Video list, sort, upload
│       │   └── VideoCompare.jsx   # Comparison utilities
│       └── styles/
│           └── globals.css        # Design system & dark theme
│
└── scripts/
    ├── preprocess.py              # Batch process all videos
    └── export_clips.py            # Export B-roll clips via FFmpeg
```

<br />

## Configuration

Edit `backend/config.py` to customize:

```python
# Directories
VIDEO_DIR = "./videos"              # Input video directory
RENDER_DIR = "./renders"            # Pre-rendered brain images
RESULTS_DIR = "./results"           # Prediction cache

# TRIBE v2
TRIBE_MODEL_ID = "facebook/tribev2" # HuggingFace model ID
TRIBE_DEVICE = "cuda"               # "cuda" or "cpu"

# Brain Rendering
BRAIN_IMAGE_SIZE = (400, 300)       # Output image dimensions
BRAIN_CMAP = "cold_hot"             # Colormap for activations
BRAIN_CLIM = (-0.15, 0.15)         # Color range limits

# AI Interpretation (optional)
INTERPRETATION_MODEL = "claude-sonnet-4-20250514"
ANTHROPIC_API_KEY = ""              # Set via env var
```

<br />

## Tech Stack

<table>
<tr>
<td align="center" width="33%">

**Frontend**

React 18 · Vite 5<br/>
Recharts · Lucide Icons<br/>
Inter + JetBrains Mono

</td>
<td align="center" width="33%">

**Backend**

FastAPI · Uvicorn<br/>
TRIBE v2 · nilearn<br/>
NumPy · SciPy · Pillow

</td>
<td align="center" width="33%">

**ML Pipeline**

Meta TRIBE v2<br/>
WhisperX · DINOv2 · V-JEPA2<br/>
Wav2Vec-BERT · LLaMA 3.2

</td>
</tr>
</table>

<br />

## Scripts

### Batch Processing

```bash
# Process all videos in the videos directory
python scripts/preprocess.py --video-dir ./backend/videos --device cuda

# Force re-process (ignore cache)
python scripts/preprocess.py --force
```

### B-Roll Export

```bash
# Export specific time ranges
python scripts/export_clips.py --video-id abc123 --clips "10-25,45-60"

# Export from JSON markers file (saved from UI)
python scripts/export_clips.py --markers markers.json
```

<br />

## Contributing

Contributions are welcome. Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

<br />

## License

This project uses Meta's TRIBE v2 under **CC-BY-NC-4.0** (non-commercial use only).

The application code is available under the MIT License.

---

<div align="center">

**Built by [Mohammad Zeeshan](https://github.com/m-zest)**

*Using Meta FAIR's TRIBE v2 · Powered by open-source neuroscience*

</div>
