"""
Brain Surface Renderer
Generates 4-view brain activation images using nilearn's surface plotting.
Pre-renders all timesteps for smooth scrubbing in the frontend.
"""
import numpy as np
import logging
import io
import base64
from pathlib import Path
from typing import Optional, Tuple, List
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class BrainRenderer:
    """
    Renders brain surface activation maps as PNG images.
    Uses nilearn for surface plotting on the fsaverage5 mesh.
    """

    VIEWS = {
        "lateral_left": {"hemi": "left", "view": "lateral"},
        "medial_left": {"hemi": "left", "view": "medial"},
        "medial_right": {"hemi": "right", "view": "medial"},
        "lateral_right": {"hemi": "right", "view": "lateral"},
    }

    def __init__(
        self,
        image_size: Tuple[int, int] = (400, 300),
        cmap: str = "cold_hot",
        clim: Tuple[float, float] = (-0.15, 0.15),
        bg_color: str = "#1a1a2e",
    ):
        self.image_size = image_size
        self.cmap = cmap
        self.clim = clim
        self.bg_color = bg_color
        self.fsaverage = None
        self._initialized = False

    def initialize(self):
        """Load fsaverage5 mesh data."""
        if self._initialized:
            return

        try:
            from nilearn import datasets
            self.fsaverage = datasets.fetch_surf_fsaverage(mesh="fsaverage5")
            self._initialized = True
            logger.info("Brain renderer initialized with fsaverage5 mesh.")
        except ImportError:
            logger.error("nilearn is required for brain rendering. Install with: pip install nilearn")
            raise

    def render_timestep(
        self,
        predictions: np.ndarray,
        timestep: int,
        views: Optional[List[str]] = None,
    ) -> dict:
        """
        Render brain surface images for a single timestep.

        Args:
            predictions: Full prediction array (n_timesteps, n_vertices)
            timestep: Which timestep to render
            views: Which views to render (default: all 4)

        Returns:
            Dict mapping view name → base64-encoded PNG string
        """
        self.initialize()

        if timestep >= predictions.shape[0]:
            timestep = predictions.shape[0] - 1

        frame = predictions[timestep]
        n_vertices = len(frame)
        n_per_hemi = n_vertices // 2

        # Split into hemispheres
        lh_data = frame[:n_per_hemi]
        rh_data = frame[n_per_hemi:]

        if views is None:
            views = list(self.VIEWS.keys())

        results = {}
        for view_name in views:
            if view_name not in self.VIEWS:
                continue
            view_config = self.VIEWS[view_name]
            img_b64 = self._render_single_view(
                lh_data, rh_data, view_config["hemi"], view_config["view"]
            )
            results[view_name] = img_b64

        return results

    def _render_single_view(
        self,
        lh_data: np.ndarray,
        rh_data: np.ndarray,
        hemi: str,
        view: str,
    ) -> str:
        """Render a single brain surface view and return as base64 PNG."""
        from nilearn import plotting, surface
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        # Select hemisphere data and mesh
        if hemi == "left":
            surf_data = lh_data
            surf_mesh = self.fsaverage["pial_left"]
            bg_map = self.fsaverage["sulc_left"]
        else:
            surf_data = rh_data
            surf_mesh = self.fsaverage["pial_right"]
            bg_map = self.fsaverage["sulc_right"]

        # Create figure
        fig = plt.figure(figsize=(self.image_size[0] / 100, self.image_size[1] / 100), dpi=100)
        fig.patch.set_facecolor(self.bg_color)

        try:
            # Use nilearn's plot_surf_stat_map
            display = plotting.plot_surf_stat_map(
                surf_mesh=surf_mesh,
                stat_map=surf_data,
                hemi=hemi,
                view=view,
                bg_map=bg_map,
                cmap=self.cmap,
                threshold=None,
                vmax=self.clim[1],
                symmetric_cbar=True,
                colorbar=False,
                figure=fig,
                bg_on_data=True,
                darkness=0.7,
            )

            # Save to buffer
            buf = io.BytesIO()
            fig.savefig(
                buf,
                format="png",
                facecolor=self.bg_color,
                bbox_inches="tight",
                pad_inches=0.02,
                dpi=100,
            )
            buf.seek(0)
            img_b64 = base64.b64encode(buf.read()).decode("utf-8")

        finally:
            plt.close(fig)

        return img_b64

    def prerender_all(
        self,
        predictions: np.ndarray,
        output_dir: str,
        video_id: str,
        max_workers: int = 4,
    ) -> dict:
        """
        Pre-render brain images for ALL timesteps and save to disk.
        Returns metadata about the rendered files.
        """
        self.initialize()

        n_timesteps = predictions.shape[0]
        out_path = Path(output_dir) / video_id
        out_path.mkdir(parents=True, exist_ok=True)

        # Check if already rendered
        manifest_file = out_path / "manifest.json"
        if manifest_file.exists():
            import json
            with open(manifest_file, "r") as f:
                manifest = json.load(f)
            if manifest.get("n_timesteps") == n_timesteps:
                logger.info(f"Brain images already pre-rendered for {video_id}")
                return manifest

        logger.info(f"Pre-rendering {n_timesteps} timesteps for {video_id}...")

        n_per_hemi = predictions.shape[1] // 2

        def render_and_save(t: int):
            frame = predictions[t]
            lh_data = frame[:n_per_hemi]
            rh_data = frame[n_per_hemi:]

            for view_name, view_config in self.VIEWS.items():
                img_b64 = self._render_single_view(
                    lh_data, rh_data, view_config["hemi"], view_config["view"]
                )
                # Save as PNG file
                img_bytes = base64.b64decode(img_b64)
                img_file = out_path / f"t{t:04d}_{view_name}.png"
                with open(img_file, "wb") as f:
                    f.write(img_bytes)

            if (t + 1) % 10 == 0:
                logger.info(f"  Rendered {t + 1}/{n_timesteps} timesteps")

        # Render in parallel
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            executor.map(render_and_save, range(n_timesteps))

        # Save manifest
        import json
        manifest = {
            "video_id": video_id,
            "n_timesteps": n_timesteps,
            "views": list(self.VIEWS.keys()),
            "image_size": list(self.image_size),
        }
        with open(manifest_file, "w") as f:
            json.dump(manifest, f)

        logger.info(f"Pre-rendering complete: {n_timesteps * 4} images saved.")
        return manifest

    def get_prerendered(self, render_dir: str, video_id: str, timestep: int) -> dict:
        """Load pre-rendered brain images for a timestep from disk."""
        base = Path(render_dir) / video_id
        results = {}

        for view_name in self.VIEWS:
            img_file = base / f"t{timestep:04d}_{view_name}.png"
            if img_file.exists():
                with open(img_file, "rb") as f:
                    results[view_name] = base64.b64encode(f.read()).decode("utf-8")
            else:
                results[view_name] = None

        return results
