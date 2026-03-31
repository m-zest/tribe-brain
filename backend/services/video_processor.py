"""
Video Processing Pipeline
Orchestrates TRIBE v2 inference, ROI extraction, and brain rendering for each video.
"""
import os
import json
import hashlib
import logging
import subprocess
from pathlib import Path
from typing import Optional, Dict, List
import numpy as np

logger = logging.getLogger(__name__)


class VideoProcessor:
    """
    Full pipeline for processing a video:
    1. Validate and extract metadata (duration, resolution, thumbnail)
    2. Run TRIBE v2 inference
    3. Extract ROI network activations
    4. Pre-render brain surface images
    5. Cache everything for instant loading
    """

    def __init__(self, tribe_wrapper, roi_extractor, brain_renderer, config):
        self.tribe = tribe_wrapper
        self.roi = roi_extractor
        self.renderer = brain_renderer
        self.config = config
        self._video_cache: Dict[str, dict] = {}

    def get_video_id(self, video_path: str) -> str:
        """Generate a unique ID for a video file."""
        p = Path(video_path)
        stat = p.stat()
        key = f"{p.name}_{stat.st_size}_{stat.st_mtime}"
        return hashlib.md5(key.encode()).hexdigest()[:12]

    def get_video_metadata(self, video_path: str) -> dict:
        """Extract video metadata using ffprobe."""
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "quiet",
                    "-print_format", "json",
                    "-show_format", "-show_streams",
                    str(video_path)
                ],
                capture_output=True, text=True, timeout=30
            )
            probe = json.loads(result.stdout)

            # Find video stream
            video_stream = None
            for stream in probe.get("streams", []):
                if stream.get("codec_type") == "video":
                    video_stream = stream
                    break

            duration = float(probe.get("format", {}).get("duration", 0))
            width = int(video_stream.get("width", 0)) if video_stream else 0
            height = int(video_stream.get("height", 0)) if video_stream else 0
            fps = eval(video_stream.get("r_frame_rate", "30/1")) if video_stream else 30

            return {
                "duration": duration,
                "width": width,
                "height": height,
                "fps": round(fps, 2),
                "filename": Path(video_path).name,
                "size_mb": round(os.path.getsize(video_path) / (1024 * 1024), 2),
            }

        except Exception as e:
            logger.warning(f"ffprobe failed for {video_path}: {e}")
            return {
                "duration": 0,
                "width": 0,
                "height": 0,
                "fps": 30,
                "filename": Path(video_path).name,
                "size_mb": round(os.path.getsize(video_path) / (1024 * 1024), 2),
            }

    def generate_thumbnail(self, video_path: str, output_dir: str, video_id: str) -> Optional[str]:
        """Generate a thumbnail image from the video."""
        thumb_path = Path(output_dir) / video_id / "thumbnail.jpg"
        thumb_path.parent.mkdir(parents=True, exist_ok=True)

        if thumb_path.exists():
            return str(thumb_path)

        try:
            subprocess.run(
                [
                    "ffmpeg", "-y", "-i", str(video_path),
                    "-ss", "00:00:02",
                    "-frames:v", "1",
                    "-q:v", "5",
                    "-vf", "scale=320:-1",
                    str(thumb_path)
                ],
                capture_output=True, timeout=30
            )
            if thumb_path.exists():
                return str(thumb_path)
        except Exception as e:
            logger.warning(f"Thumbnail generation failed: {e}")

        return None

    def process_video(self, video_path: str, prerender: bool = True) -> dict:
        """
        Full processing pipeline for a video.

        Returns a dict with all data needed by the frontend:
        - video_id, metadata, thumbnail
        - predictions (cached path)
        - roi_activations: per-network time series
        - brain_images: pre-rendered (if prerender=True)
        """
        video_path = str(video_path)
        video_id = self.get_video_id(video_path)

        # Check if already fully processed
        results_file = Path(self.config.RESULTS_DIR) / f"{video_id}_complete.json"
        if results_file.exists():
            with open(results_file, "r") as f:
                cached = json.load(f)
            # Also load predictions into memory cache
            pred_file = Path(self.config.RESULTS_DIR) / f"{video_id}_predictions.npz"
            if pred_file.exists():
                data = np.load(pred_file)
                self._video_cache[video_id] = {
                    "predictions": data["predictions"],
                    "metadata": cached["metadata"],
                }
            logger.info(f"Video {video_id} already processed, loaded from cache.")
            return cached

        logger.info(f"Processing video: {video_path} (id: {video_id})")

        # Step 1: Metadata
        metadata = self.get_video_metadata(video_path)
        metadata["video_id"] = video_id
        metadata["video_path"] = video_path

        # Step 2: Thumbnail
        thumbnail = self.generate_thumbnail(video_path, self.config.RENDER_DIR, video_id)
        metadata["thumbnail"] = thumbnail

        # Step 3: TRIBE v2 inference
        logger.info("Running TRIBE v2 inference...")
        tribe_result = self.tribe.predict_video(
            video_path, cache_dir=self.config.RESULTS_DIR
        )
        predictions = tribe_result["predictions"]
        metadata["n_timesteps"] = int(predictions.shape[0])
        metadata["n_vertices"] = int(predictions.shape[1])

        # Cache predictions
        self._video_cache[video_id] = {
            "predictions": predictions,
            "metadata": metadata,
        }

        # Save predictions
        pred_file = Path(self.config.RESULTS_DIR) / f"{video_id}_predictions.npz"
        np.savez_compressed(pred_file, predictions=predictions)

        # Step 4: ROI extraction
        logger.info("Extracting ROI activations...")
        roi_activations = self.roi.extract(predictions)

        # Step 5: Pre-render brain images
        brain_manifest = None
        if prerender:
            logger.info("Pre-rendering brain surface images...")
            brain_manifest = self.renderer.prerender_all(
                predictions,
                output_dir=self.config.RENDER_DIR,
                video_id=video_id,
            )

        # Compile result
        from config import ROI_NETWORKS
        result = {
            "video_id": video_id,
            "metadata": metadata,
            "roi_activations": roi_activations,
            "roi_config": {
                key: {"label": net["label"], "color": net["color"]}
                for key, net in ROI_NETWORKS.items()
            },
            "brain_manifest": brain_manifest,
            "status": "ready",
        }

        # Save complete result (without raw predictions)
        Path(self.config.RESULTS_DIR).mkdir(parents=True, exist_ok=True)
        with open(results_file, "w") as f:
            json.dump(result, f)

        logger.info(f"Video processing complete: {video_id}")
        return result

    def get_predictions(self, video_id: str) -> Optional[np.ndarray]:
        """Get raw predictions array for a video (from memory cache or disk)."""
        if video_id in self._video_cache:
            return self._video_cache[video_id]["predictions"]

        pred_file = Path(self.config.RESULTS_DIR) / f"{video_id}_predictions.npz"
        if pred_file.exists():
            data = np.load(pred_file)
            preds = data["predictions"]
            self._video_cache[video_id] = {"predictions": preds}
            return preds

        return None

    def list_videos(self) -> List[dict]:
        """List all videos in the video directory with their processing status."""
        from config import SUPPORTED_VIDEO_FORMATS

        videos = []
        video_dir = Path(self.config.VIDEO_DIR)
        video_dir.mkdir(parents=True, exist_ok=True)

        for f in sorted(video_dir.iterdir()):
            if f.suffix.lower() in SUPPORTED_VIDEO_FORMATS:
                video_id = self.get_video_id(str(f))
                results_file = Path(self.config.RESULTS_DIR) / f"{video_id}_complete.json"

                status = "ready" if results_file.exists() else "unprocessed"
                metadata = self.get_video_metadata(str(f))
                metadata["video_id"] = video_id
                metadata["status"] = status
                metadata["video_path"] = str(f)

                # Load cached ROI data if available
                if results_file.exists():
                    try:
                        with open(results_file, "r") as rf:
                            cached = json.load(rf)
                        metadata["n_timesteps"] = cached.get("metadata", {}).get("n_timesteps", 0)
                    except Exception:
                        pass

                videos.append(metadata)

        return videos
