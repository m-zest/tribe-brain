"""
Brain Activation Visualizer — FastAPI Backend
==============================================
REST API serving TRIBE v2 predictions, brain images, and ROI activations.
"""
import os
import logging
import asyncio
from pathlib import Path
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel

import config
from models.tribe_wrapper import TribeWrapper
from models.roi_extractor import ROIExtractor
from services.brain_renderer import BrainRenderer
from services.video_processor import VideoProcessor
from services.interpreter import BrainInterpreter

# Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(name)s] %(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Global instances
tribe = TribeWrapper(
    model_id=config.TRIBE_MODEL_ID,
    cache_dir=config.TRIBE_CACHE_DIR,
    device=config.TRIBE_DEVICE,
)
roi_extractor = ROIExtractor()
brain_renderer = BrainRenderer(
    image_size=config.BRAIN_IMAGE_SIZE,
    cmap=config.BRAIN_CMAP,
    clim=config.BRAIN_CLIM,
)
video_processor = VideoProcessor(tribe, roi_extractor, brain_renderer, config)
interpreter = BrainInterpreter(
    api_key=config.ANTHROPIC_API_KEY or config.OPENAI_API_KEY,
    model=config.INTERPRETATION_MODEL,
    provider="anthropic" if config.ANTHROPIC_API_KEY else "openai",
)

# Processing queue
processing_tasks = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: ensure directories exist."""
    for d in [config.VIDEO_DIR, config.RENDER_DIR, config.RESULTS_DIR, config.TRIBE_CACHE_DIR]:
        Path(d).mkdir(parents=True, exist_ok=True)
    logger.info("Brain Activation Visualizer backend started.")
    logger.info(f"Video directory: {config.VIDEO_DIR}")
    logger.info(f"Place video files in {config.VIDEO_DIR} to get started.")
    yield
    logger.info("Backend shutting down.")


app = FastAPI(
    title="Brain Activation Visualizer",
    description="Visualize brain responses to video content using Meta's TRIBE v2",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve pre-rendered brain images as static files
Path(config.RENDER_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/renders", StaticFiles(directory=config.RENDER_DIR), name="renders")

# Serve videos as static files
Path(config.VIDEO_DIR).mkdir(parents=True, exist_ok=True)
app.mount("/videos", StaticFiles(directory=config.VIDEO_DIR), name="videos")


# ---------- Models ----------

class ProcessRequest(BaseModel):
    prerender: bool = True


class InterpretRequest(BaseModel):
    timestep: int
    video_context: Optional[str] = None


class BrollMarker(BaseModel):
    video_id: str
    start_time: float
    end_time: float
    label: Optional[str] = None


# ---------- Endpoints ----------

@app.get("/")
async def root():
    return {"status": "ok", "app": "Brain Activation Visualizer", "model": "TRIBE v2"}


@app.get("/api/videos")
async def list_videos():
    """List all available videos and their processing status."""
    videos = video_processor.list_videos()
    return {"videos": videos}


@app.post("/api/videos/upload")
async def upload_video(file: UploadFile = File(...)):
    """Upload a new video file."""
    if not file.filename:
        raise HTTPException(400, "No filename provided")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in config.SUPPORTED_VIDEO_FORMATS:
        raise HTTPException(400, f"Unsupported format: {suffix}")

    save_path = Path(config.VIDEO_DIR) / file.filename
    with open(save_path, "wb") as f:
        content = await file.read()
        f.write(content)

    video_id = video_processor.get_video_id(str(save_path))
    return {"video_id": video_id, "filename": file.filename, "status": "uploaded"}


@app.post("/api/videos/{video_id}/process")
async def process_video(video_id: str, req: ProcessRequest, background_tasks: BackgroundTasks):
    """
    Trigger full processing pipeline for a video.
    Runs in background — poll /api/videos/{video_id}/status for progress.
    """
    # Find the video file
    video_path = _find_video_by_id(video_id)
    if not video_path:
        raise HTTPException(404, f"Video {video_id} not found")

    if video_id in processing_tasks and processing_tasks[video_id] == "processing":
        return {"video_id": video_id, "status": "already_processing"}

    processing_tasks[video_id] = "processing"

    def run_processing():
        try:
            video_processor.process_video(video_path, prerender=req.prerender)
            processing_tasks[video_id] = "ready"
        except Exception as e:
            logger.error(f"Processing failed for {video_id}: {e}")
            processing_tasks[video_id] = f"error: {str(e)}"

    background_tasks.add_task(run_processing)
    return {"video_id": video_id, "status": "processing"}


@app.get("/api/videos/{video_id}/status")
async def video_status(video_id: str):
    """Check processing status of a video."""
    results_file = Path(config.RESULTS_DIR) / f"{video_id}_complete.json"
    if results_file.exists():
        return {"video_id": video_id, "status": "ready"}
    if video_id in processing_tasks:
        return {"video_id": video_id, "status": processing_tasks[video_id]}
    return {"video_id": video_id, "status": "unprocessed"}


@app.get("/api/videos/{video_id}/data")
async def get_video_data(video_id: str):
    """
    Get full processed data for a video:
    ROI activations, metadata, brain render manifest.
    """
    results_file = Path(config.RESULTS_DIR) / f"{video_id}_complete.json"
    if not results_file.exists():
        raise HTTPException(404, f"Video {video_id} not processed yet")

    import json
    with open(results_file, "r") as f:
        data = json.load(f)

    return data


@app.get("/api/videos/{video_id}/roi")
async def get_roi_activations(video_id: str):
    """Get ROI network activation time series for a video."""
    results_file = Path(config.RESULTS_DIR) / f"{video_id}_complete.json"
    if not results_file.exists():
        raise HTTPException(404, "Video not processed")

    import json
    with open(results_file, "r") as f:
        data = json.load(f)

    return {
        "video_id": video_id,
        "roi_activations": data["roi_activations"],
        "roi_config": data["roi_config"],
        "n_timesteps": data["metadata"]["n_timesteps"],
    }


@app.get("/api/videos/{video_id}/brain/{timestep}")
async def get_brain_images(video_id: str, timestep: int):
    """
    Get brain surface images for a specific timestep.
    Returns base64-encoded PNGs for all 4 views.
    """
    # Try pre-rendered first
    images = brain_renderer.get_prerendered(config.RENDER_DIR, video_id, timestep)
    if all(v is not None for v in images.values()):
        return {"video_id": video_id, "timestep": timestep, "images": images}

    # Fall back to on-the-fly rendering
    predictions = video_processor.get_predictions(video_id)
    if predictions is None:
        raise HTTPException(404, "Video not processed")

    if timestep >= predictions.shape[0]:
        raise HTTPException(400, f"Timestep {timestep} out of range (max: {predictions.shape[0] - 1})")

    images = brain_renderer.render_timestep(predictions, timestep)
    return {"video_id": video_id, "timestep": timestep, "images": images}


@app.get("/api/videos/{video_id}/brain-image/{timestep}/{view}")
async def get_brain_image_file(video_id: str, timestep: int, view: str):
    """Get a single pre-rendered brain image as a PNG file."""
    img_path = Path(config.RENDER_DIR) / video_id / f"t{timestep:04d}_{view}.png"
    if not img_path.exists():
        raise HTTPException(404, "Brain image not found")
    return FileResponse(img_path, media_type="image/png")


@app.get("/api/videos/{video_id}/stats/{timestep}")
async def get_timestep_stats(video_id: str, timestep: int):
    """Get detailed statistics for a specific timestep."""
    predictions = video_processor.get_predictions(video_id)
    if predictions is None:
        raise HTTPException(404, "Video not processed")

    stats = roi_extractor.get_stats(predictions, timestep)
    return stats


@app.post("/api/videos/{video_id}/interpret")
async def interpret_timestep(video_id: str, req: InterpretRequest):
    """Get AI interpretation of brain activation at a specific timestep."""
    results_file = Path(config.RESULTS_DIR) / f"{video_id}_complete.json"
    if not results_file.exists():
        raise HTTPException(404, "Video not processed")

    import json
    with open(results_file, "r") as f:
        data = json.load(f)

    roi_activations = data["roi_activations"]
    t = req.timestep
    n_timesteps = len(next(iter(roi_activations.values())))

    if t >= n_timesteps:
        raise HTTPException(400, f"Timestep {t} out of range")

    roi_values = {key: vals[t] for key, vals in roi_activations.items()}
    interpretation = interpreter.interpret_timestep(roi_values, t, req.video_context)

    return {
        "video_id": video_id,
        "timestep": t,
        "interpretation": interpretation,
        "roi_values": roi_values,
    }


@app.get("/api/videos/{video_id}/thumbnail")
async def get_thumbnail(video_id: str):
    """Get video thumbnail."""
    thumb_path = Path(config.RENDER_DIR) / video_id / "thumbnail.jpg"
    if thumb_path.exists():
        return FileResponse(thumb_path, media_type="image/jpeg")
    raise HTTPException(404, "Thumbnail not found")


# ---------- Compare Mode ----------

@app.get("/api/compare")
async def compare_videos(video_ids: str):
    """
    Compare multiple videos. Pass comma-separated video IDs.
    Returns ROI activations for all videos.
    """
    ids = [v.strip() for v in video_ids.split(",")]
    results = {}

    for vid in ids:
        results_file = Path(config.RESULTS_DIR) / f"{vid}_complete.json"
        if results_file.exists():
            import json
            with open(results_file, "r") as f:
                data = json.load(f)
            results[vid] = {
                "metadata": data["metadata"],
                "roi_activations": data["roi_activations"],
                "roi_config": data["roi_config"],
            }
        else:
            results[vid] = {"error": "not processed"}

    return {"videos": results}


# ---------- Helpers ----------

def _find_video_by_id(video_id: str) -> Optional[str]:
    """Find a video file by its ID."""
    video_dir = Path(config.VIDEO_DIR)
    for f in video_dir.iterdir():
        if f.suffix.lower() in config.SUPPORTED_VIDEO_FORMATS:
            if video_processor.get_video_id(str(f)) == video_id:
                return str(f)
    return None


# ---------- Serve Frontend (production) ----------

frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=frontend_dist / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve the React frontend (catch-all for SPA routing)."""
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(frontend_dist / "index.html")
