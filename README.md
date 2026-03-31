#  Brain Activation Visualizer

A full-stack application that uses **Meta's TRIBE v2** model to predict and visualize how the human brain responds to video content in real-time. Load any video, scrub through the timeline, and see which brain regions activate — with 3D brain surface maps and per-region time-series charts.

Built for **video editors and content creators** who want to understand the neural impact of their content.

![Architecture](./docs/architecture.png)

---

## Features

- **Video-synced brain visualization** — 4-view brain surface maps (lateral/medial, left/right hemisphere) update as you scrub through video
- **Region activation charts** — Real-time time-series for 6 brain networks: Attention, Auditory, Emotion/Memory, Language, Motor, Visual
- **Compare mode** — Load multiple videos side-by-side to compare neural engagement patterns
- **B-roll marker** — Mark high-activation segments for clipping as B-roll footage
- **AI interpretation agent** — (Optional) LLM-powered summaries of what's happening neurally at each timestep

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Frontend (React)                   │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │  Video    │ │  Brain 3D    │ │  Region Charts   │ │
│  │  Player   │ │  Surface     │ │  (Recharts)      │ │
│  │  + Sync   │ │  Viewer      │ │                  │ │
│  └──────────┘ └──────────────┘ └──────────────────┘ │
│  ┌──────────────────────────────────────────────────┐│
│  │              Timeline Scrubber                    ││
│  └──────────────────────────────────────────────────┘│
└──────────────────┬──────────────────────────────────┘
                   │ REST API + WebSocket
┌──────────────────▼──────────────────────────────────┐
│                  Backend (FastAPI)                    │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────────┐ │
│  │  TRIBE   │ │  Brain Image │ │  ROI Extraction  │ │
│  │  v2      │ │  Renderer    │ │  (6 networks)    │ │
│  │  Model   │ │  (nilearn)   │ │                  │ │
│  └──────────┘ └──────────────┘ └──────────────────┘ │
└─────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **CUDA-capable GPU** (8GB+ VRAM recommended)
- **HuggingFace account** with access to [LLaMA 3.2-3B](https://huggingface.co/meta-llama/Llama-3.2-3B) (gated model)
- **FFmpeg** installed system-wide

---

## Quick Start

### 1. Clone and install backend

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install TRIBE v2
pip install "tribev2[plotting] @ git+https://github.com/facebookresearch/tribev2.git"

# Install backend dependencies
pip install -r requirements.txt

# Login to HuggingFace (needed for LLaMA 3.2)
huggingface-cli login
```

### 2. Install frontend

```bash
cd frontend
npm install
```

### 3. Run the app

```bash
# Terminal 1: Start backend
cd backend
python -m uvicorn app:app --host 0.0.0.0 --port 8080 --reload

# Terminal 2: Start frontend
cd frontend
npm run dev
```

Open **http://localhost:5173** (or http://localhost:8080 if serving frontend from backend).

---

## Adding Videos

Drop video files into the `backend/videos/` directory, or use the upload button in the UI. Supported formats: MP4, MOV, AVI, MKV, WebM.

The first time a video is loaded, TRIBE v2 will:
1. Extract audio and transcribe speech (WhisperX)
2. Extract visual features (DINOv2 + V-JEPA2)
3. Extract audio features (Wav2Vec-BERT)
4. Predict fMRI activity at each 1-second timestep
5. Pre-render brain surface images for all timesteps
6. Cache everything for instant subsequent loads

**Initial processing takes ~2-5 minutes per minute of video** depending on GPU.

---

## Configuration

Edit `backend/config.py`:

```python
TRIBE_CACHE_DIR = "./cache"          # Model weights cache
VIDEO_DIR = "./videos"                # Video input directory
RENDER_DIR = "./renders"              # Pre-rendered brain images
RESULTS_DIR = "./results"             # Prediction results cache
OPENAI_API_KEY = ""                   # For AI interpretation agent (optional)
```

---

## Brain Regions / Networks

The 6 tracked networks correspond to standard neuroscience functional parcellations:

| Network | Color | What it indicates |
|---------|-------|-------------------|
| **Attention** | Cyan | Focused engagement, salience detection |
| **Auditory** | Green | Sound processing, speech perception |
| **Emotion/Memory** | Pink/Magenta | Emotional response, memory encoding |
| **Language** | Yellow | Speech comprehension, semantic processing |
| **Motor** | Red | Movement perception, action planning |
| **Visual** | Blue | Visual processing, scene understanding |

---

## Project Structure

```
brain-viz/
├── backend/
│   ├── app.py                 # FastAPI application
│   ├── config.py              # Configuration
│   ├── requirements.txt       # Python dependencies
│   ├── models/
│   │   ├── tribe_wrapper.py   # TRIBE v2 model wrapper
│   │   └── roi_extractor.py   # ROI network extraction
│   ├── services/
│   │   ├── video_processor.py # Video processing pipeline
│   │   ├── brain_renderer.py  # Brain surface image rendering
│   │   └── interpreter.py     # AI interpretation agent
│   ├── videos/                # Input videos
│   ├── renders/               # Cached brain images
│   └── results/               # Cached predictions
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   └── src/
│       ├── App.jsx
│       ├── main.jsx
│       ├── components/
│       │   ├── BrainViewer.jsx
│       │   ├── VideoPlayer.jsx
│       │   ├── RegionChart.jsx
│       │   ├── Timeline.jsx
│       │   ├── VideoCompare.jsx
│       │   └── Sidebar.jsx
│       └── styles/
│           └── globals.css
├── scripts/
│   ├── preprocess.py          # Batch preprocess videos
│   └── export_clips.py        # Export marked B-roll clips
└── README.md
```

---

## License

This project uses Meta's TRIBE v2 under **CC-BY-NC-4.0** (non-commercial use only).
