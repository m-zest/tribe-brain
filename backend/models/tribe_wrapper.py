"""
TRIBE v2 Model Wrapper
Handles loading the pretrained model and running inference on video/audio/text.
"""
import torch
import numpy as np
import logging
from pathlib import Path
from typing import Optional
import json
import hashlib

logger = logging.getLogger(__name__)


class TribeWrapper:
    """Wraps Meta's TRIBE v2 model for brain activation prediction."""

    def __init__(self, model_id: str = "facebook/tribev2", cache_dir: str = "./cache", device: str = "cuda"):
        self.model_id = model_id
        self.cache_dir = cache_dir
        self.device = device
        self.model = None
        self._loaded = False

    def load(self):
        """Load the pretrained TRIBE v2 model from HuggingFace."""
        if self._loaded:
            return

        logger.info(f"Loading TRIBE v2 model from {self.model_id}...")
        try:
            from tribev2 import TribeModel
            self.model = TribeModel.from_pretrained(
                self.model_id,
                cache_folder=self.cache_dir
            )
            self._loaded = True
            logger.info("TRIBE v2 model loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load TRIBE v2: {e}")
            raise

    def predict_video(self, video_path: str, cache_dir: Optional[str] = None) -> dict:
        """
        Run TRIBE v2 prediction on a video file.

        Returns:
            dict with keys:
                - predictions: np.ndarray of shape (n_timesteps, n_vertices)
                - segments: list of segment info from the model
                - n_timesteps: int
                - n_vertices: int
                - video_path: str
        """
        self.load()

        video_path = str(video_path)
        cache_key = self._cache_key(video_path)

        # Check cache
        if cache_dir:
            cache_file = Path(cache_dir) / f"{cache_key}.npz"
            meta_file = Path(cache_dir) / f"{cache_key}_meta.json"
            if cache_file.exists() and meta_file.exists():
                logger.info(f"Loading cached predictions for {video_path}")
                data = np.load(cache_file)
                with open(meta_file, "r") as f:
                    meta = json.load(f)
                return {
                    "predictions": data["predictions"],
                    "n_timesteps": int(data["predictions"].shape[0]),
                    "n_vertices": int(data["predictions"].shape[1]),
                    "video_path": video_path,
                    "meta": meta,
                }

        logger.info(f"Running TRIBE v2 inference on {video_path}...")

        # Step 1: Extract events (audio transcription, visual features, etc.)
        df = self.model.get_events_dataframe(video_path=video_path)

        # Step 2: Predict brain responses
        # preds shape: (n_timesteps, n_vertices) where n_vertices ~ 20484 for fsaverage5
        # Each timestep = 1 TR = 1 second
        preds, segments = self.model.predict(events=df)

        # Convert to numpy if tensor
        if isinstance(preds, torch.Tensor):
            preds = preds.cpu().numpy()

        result = {
            "predictions": preds,
            "n_timesteps": preds.shape[0],
            "n_vertices": preds.shape[1],
            "video_path": video_path,
            "meta": {
                "n_timesteps": int(preds.shape[0]),
                "n_vertices": int(preds.shape[1]),
                "video_path": video_path,
                "cache_key": cache_key,
            },
        }

        # Save to cache
        if cache_dir:
            Path(cache_dir).mkdir(parents=True, exist_ok=True)
            np.savez_compressed(cache_file, predictions=preds)
            with open(meta_file, "w") as f:
                json.dump(result["meta"], f)
            logger.info(f"Cached predictions to {cache_file}")

        return result

    def predict_audio(self, audio_path: str, cache_dir: Optional[str] = None) -> dict:
        """Run TRIBE v2 prediction on an audio file."""
        self.load()
        audio_path = str(audio_path)

        logger.info(f"Running TRIBE v2 inference on audio: {audio_path}...")
        df = self.model.get_events_dataframe(audio_path=audio_path)
        preds, segments = self.model.predict(events=df)

        if isinstance(preds, torch.Tensor):
            preds = preds.cpu().numpy()

        return {
            "predictions": preds,
            "n_timesteps": preds.shape[0],
            "n_vertices": preds.shape[1],
            "audio_path": audio_path,
        }

    def predict_text(self, text_path: str, cache_dir: Optional[str] = None) -> dict:
        """Run TRIBE v2 prediction on a text file."""
        self.load()
        text_path = str(text_path)

        logger.info(f"Running TRIBE v2 inference on text: {text_path}...")
        df = self.model.get_events_dataframe(text_path=text_path)
        preds, segments = self.model.predict(events=df)

        if isinstance(preds, torch.Tensor):
            preds = preds.cpu().numpy()

        return {
            "predictions": preds,
            "n_timesteps": preds.shape[0],
            "n_vertices": preds.shape[1],
            "text_path": text_path,
        }

    @staticmethod
    def _cache_key(file_path: str) -> str:
        """Generate a cache key from file path + modification time."""
        p = Path(file_path)
        stat = p.stat()
        key_str = f"{p.name}_{stat.st_size}_{stat.st_mtime}"
        return hashlib.md5(key_str.encode()).hexdigest()
