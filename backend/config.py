"""
Configuration for the Brain Activation Visualizer backend.
"""
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent
TRIBE_CACHE_DIR = os.getenv("TRIBE_CACHE", str(BASE_DIR / "cache"))
VIDEO_DIR = os.getenv("VIDEO_DIR", str(BASE_DIR / "videos"))
RENDER_DIR = os.getenv("RENDER_DIR", str(BASE_DIR / "renders"))
RESULTS_DIR = os.getenv("RESULTS_DIR", str(BASE_DIR / "results"))

# Server
HOST = "0.0.0.0"
PORT = 8080
CORS_ORIGINS = ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"]

# TRIBE v2 model
TRIBE_MODEL_ID = "facebook/tribev2"
TRIBE_DEVICE = "cuda"  # "cuda" or "cpu"

# Brain rendering
BRAIN_IMAGE_SIZE = (400, 300)  # Width x Height per view
BRAIN_VIEWS = ["lateral_left", "medial_left", "medial_right", "lateral_right"]
BRAIN_CMAP = "cold_hot"  # Colormap for activation (red = positive, blue = negative)
BRAIN_CLIM = (-0.15, 0.15)  # Color limits for activation values

# ROI / Network definitions
# These map fsaverage5 vertices to functional networks using Yeo 7-network parcellation
ROI_NETWORKS = {
    "attention": {
        "label": "Attention",
        "color": "#00CED1",  # Cyan
        "yeo_indices": [4, 5],  # Dorsal Attention + Ventral Attention
    },
    "auditory": {
        "label": "Auditory",
        "color": "#32CD32",  # Green
        "yeo_indices": None,  # Custom: superior temporal regions
        "custom_roi": "auditory_cortex",
    },
    "emotion_memory": {
        "label": "Emotion / Memory",
        "color": "#FF69B4",  # Pink
        "yeo_indices": [7],  # Default Mode Network (limbic overlap)
        "custom_roi": "limbic",
    },
    "language": {
        "label": "Language",
        "color": "#FFD700",  # Yellow
        "yeo_indices": None,
        "custom_roi": "language_network",
    },
    "motor": {
        "label": "Motor",
        "color": "#FF4444",  # Red
        "yeo_indices": [2],  # Somatomotor
    },
    "visual": {
        "label": "Visual",
        "color": "#4169E1",  # Blue
        "yeo_indices": [1],  # Visual
    },
}

# AI Interpretation Agent (optional)
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
INTERPRETATION_MODEL = "claude-sonnet-4-20250514"  # or "gpt-4o"

# Processing
MAX_VIDEO_DURATION_SECONDS = 600  # 10 minutes max
SUPPORTED_VIDEO_FORMATS = {".mp4", ".mov", ".avi", ".mkv", ".webm"}
