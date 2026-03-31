#!/usr/bin/env python3
"""
Export B-Roll Clips
===================
Exports marked B-roll segments from processed videos using ffmpeg.

Usage:
    python scripts/export_clips.py --video-id abc123 --clips "10-25,45-60"
    python scripts/export_clips.py --markers markers.json
"""
import argparse
import json
import subprocess
import sys
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))
import config

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)


def find_video_path(video_id: str) -> str:
    """Find the video file for a given video_id."""
    import hashlib
    video_dir = Path(config.VIDEO_DIR)
    for f in video_dir.iterdir():
        if f.suffix.lower() in config.SUPPORTED_VIDEO_FORMATS:
            stat = f.stat()
            key = f"{f.name}_{stat.st_size}_{stat.st_mtime}"
            vid = hashlib.md5(key.encode()).hexdigest()[:12]
            if vid == video_id:
                return str(f)
    return None


def export_clip(video_path: str, start_sec: float, end_sec: float, output_path: str):
    """Export a clip from a video using ffmpeg."""
    duration = end_sec - start_sec
    cmd = [
        "ffmpeg", "-y",
        "-ss", str(start_sec),
        "-i", video_path,
        "-t", str(duration),
        "-c:v", "libx264",
        "-c:a", "aac",
        "-preset", "fast",
        "-crf", "18",
        output_path,
    ]
    logger.info(f"Exporting clip: {start_sec}s → {end_sec}s → {output_path}")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    if result.returncode != 0:
        logger.error(f"ffmpeg error: {result.stderr[-500:]}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(description="Export B-roll clips from processed videos")
    parser.add_argument("--video-id", help="Video ID to export from")
    parser.add_argument("--video-path", help="Direct path to video file")
    parser.add_argument("--clips", help="Comma-separated clip ranges, e.g., '10-25,45-60'")
    parser.add_argument("--markers", help="Path to JSON markers file")
    parser.add_argument("--output-dir", default="./exports", help="Output directory")
    parser.add_argument("--prefix", default="broll", help="Output filename prefix")
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # Determine video path
    video_path = args.video_path
    if not video_path and args.video_id:
        video_path = find_video_path(args.video_id)
        if not video_path:
            logger.error(f"Video not found for ID: {args.video_id}")
            sys.exit(1)

    if not video_path:
        logger.error("Provide --video-id or --video-path")
        sys.exit(1)

    # Parse clips
    clips = []
    if args.clips:
        for segment in args.clips.split(","):
            parts = segment.strip().split("-")
            if len(parts) == 2:
                clips.append((float(parts[0]), float(parts[1])))

    if args.markers:
        with open(args.markers, "r") as f:
            markers = json.load(f)
        for m in markers:
            clips.append((m["start"], m["end"]))

    if not clips:
        logger.error("No clips specified. Use --clips or --markers")
        sys.exit(1)

    logger.info(f"Exporting {len(clips)} clips from {video_path}")

    success = 0
    for i, (start, end) in enumerate(clips):
        out_file = output_dir / f"{args.prefix}_{i+1:03d}_{int(start)}s-{int(end)}s.mp4"
        if export_clip(video_path, start, end, str(out_file)):
            success += 1
        else:
            logger.warning(f"Failed to export clip {i+1}")

    logger.info(f"Exported {success}/{len(clips)} clips to {output_dir}")


if __name__ == "__main__":
    main()
