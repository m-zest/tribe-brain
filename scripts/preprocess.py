#!/usr/bin/env python3
"""
Batch Preprocess Videos
=======================
Process all videos in the videos/ directory through TRIBE v2.
Run this to pre-compute all predictions and brain images so the
web app loads instantly.

Usage:
    python scripts/preprocess.py
    python scripts/preprocess.py --video-dir /path/to/videos
    python scripts/preprocess.py --no-render   # Skip brain image rendering
"""
import argparse
import sys
import time
import logging
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import config
from models.tribe_wrapper import TribeWrapper
from models.roi_extractor import ROIExtractor
from services.brain_renderer import BrainRenderer
from services.video_processor import VideoProcessor

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Batch preprocess videos with TRIBE v2")
    parser.add_argument("--video-dir", default=config.VIDEO_DIR, help="Directory containing videos")
    parser.add_argument("--no-render", action="store_true", help="Skip brain image pre-rendering")
    parser.add_argument("--device", default=config.TRIBE_DEVICE, choices=["cuda", "cpu"])
    parser.add_argument("--force", action="store_true", help="Reprocess already-processed videos")
    args = parser.parse_args()

    # Override config
    config.VIDEO_DIR = args.video_dir
    config.TRIBE_DEVICE = args.device

    # Initialize components
    logger.info("Initializing TRIBE v2...")
    tribe = TribeWrapper(
        model_id=config.TRIBE_MODEL_ID,
        cache_dir=config.TRIBE_CACHE_DIR,
        device=args.device,
    )
    roi_extractor = ROIExtractor()
    brain_renderer = BrainRenderer(
        image_size=config.BRAIN_IMAGE_SIZE,
        cmap=config.BRAIN_CMAP,
        clim=config.BRAIN_CLIM,
    )
    processor = VideoProcessor(tribe, roi_extractor, brain_renderer, config)

    # Find videos
    video_dir = Path(args.video_dir)
    video_dir.mkdir(parents=True, exist_ok=True)

    videos = []
    for f in sorted(video_dir.iterdir()):
        if f.suffix.lower() in config.SUPPORTED_VIDEO_FORMATS:
            videos.append(f)

    if not videos:
        logger.warning(f"No videos found in {video_dir}")
        logger.info(f"Supported formats: {', '.join(config.SUPPORTED_VIDEO_FORMATS)}")
        return

    logger.info(f"Found {len(videos)} videos to process:")
    for v in videos:
        vid = processor.get_video_id(str(v))
        results_file = Path(config.RESULTS_DIR) / f"{vid}_complete.json"
        status = "✓ ready" if results_file.exists() else "○ unprocessed"
        logger.info(f"  {status}  {v.name} ({vid})")

    # Process each video
    total_start = time.time()
    processed = 0
    skipped = 0
    errors = 0

    for i, video_path in enumerate(videos):
        vid = processor.get_video_id(str(video_path))
        results_file = Path(config.RESULTS_DIR) / f"{vid}_complete.json"

        if results_file.exists() and not args.force:
            logger.info(f"[{i+1}/{len(videos)}] Skipping {video_path.name} (already processed)")
            skipped += 1
            continue

        logger.info(f"\n{'='*60}")
        logger.info(f"[{i+1}/{len(videos)}] Processing: {video_path.name}")
        logger.info(f"{'='*60}")

        start = time.time()
        try:
            result = processor.process_video(
                str(video_path),
                prerender=not args.no_render,
            )
            elapsed = time.time() - start
            n_ts = result.get("metadata", {}).get("n_timesteps", 0)
            logger.info(f"✓ Done in {elapsed:.1f}s — {n_ts} timesteps")
            processed += 1

        except Exception as e:
            elapsed = time.time() - start
            logger.error(f"✗ Failed after {elapsed:.1f}s: {e}")
            errors += 1

    # Summary
    total_elapsed = time.time() - total_start
    logger.info(f"\n{'='*60}")
    logger.info(f"Batch processing complete in {total_elapsed:.1f}s")
    logger.info(f"  Processed: {processed}")
    logger.info(f"  Skipped:   {skipped}")
    logger.info(f"  Errors:    {errors}")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()
