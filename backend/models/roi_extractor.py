"""
ROI Network Extractor
Maps fsaverage5 cortical vertices to functional brain networks
using Yeo 7-network parcellation + custom ROI definitions.
"""
import numpy as np
import logging
from typing import Dict, List, Optional
from pathlib import Path

logger = logging.getLogger(__name__)


# Approximate vertex index ranges for custom ROIs on fsaverage5 (~10242 per hemisphere)
# These are derived from standard atlases and will be refined on first run
# using nilearn's actual parcellation data.
CUSTOM_ROI_TEMPLATES = {
    "auditory_cortex": {
        "description": "Primary and secondary auditory cortex (superior temporal gyrus)",
        "approximate_destrieux_labels": [
            "G_temp_sup-G_T_transv",   # Heschl's gyrus
            "G_temp_sup-Plan_tempo",    # Planum temporale
            "S_temporal_sup",           # Superior temporal sulcus
        ],
    },
    "language_network": {
        "description": "Broca's area + Wernicke's area + angular gyrus",
        "approximate_destrieux_labels": [
            "G_front_inf-Opercular",    # Broca's (pars opercularis)
            "G_front_inf-Triangul",     # Broca's (pars triangularis)
            "G_temp_sup-Plan_tempo",    # Wernicke's area
            "G_pariet_inf-Angular",     # Angular gyrus
            "S_temporal_sup",           # STS (language-relevant)
        ],
    },
    "limbic": {
        "description": "Limbic system: amygdala-adjacent cortex, hippocampal regions, insula",
        "approximate_destrieux_labels": [
            "G_cingul-Post-dorsal",     # Posterior cingulate
            "G_cingul-Post-ventral",    # Ventral posterior cingulate
            "S_cingul-Marginalis",      # Cingulate sulcus
            "G_temp_sup-Plan_polar",    # Temporal pole
            "S_intrapariet_and_P_trans", # Intraparietal (medial temporal overlap)
        ],
    },
}


class ROIExtractor:
    """
    Extracts region-of-interest (ROI) activation values from full-brain predictions.

    Maps the ~20k fsaverage5 vertices to 6 functional networks and returns
    mean activation per network at each timestep.
    """

    def __init__(self):
        self.network_masks: Optional[Dict[str, np.ndarray]] = None
        self._initialized = False

    def initialize(self):
        """
        Build network masks using nilearn's Yeo parcellation + Destrieux atlas.
        Must be called once before extract().
        """
        if self._initialized:
            return

        try:
            from nilearn import datasets, surface
            import nibabel as nib

            logger.info("Loading Yeo 7-network parcellation for fsaverage5...")

            # Load fsaverage5 mesh
            fsaverage = datasets.fetch_surf_fsaverage(mesh="fsaverage5")

            # Load Yeo 7-network parcellation
            yeo = datasets.fetch_atlas_surf_yeo(n_networks=7)
            yeo_labels_lh = surface.load_surf_data(yeo["map_left"])
            yeo_labels_rh = surface.load_surf_data(yeo["map_right"])

            # Concatenate hemispheres (left then right)
            yeo_labels = np.concatenate([yeo_labels_lh, yeo_labels_rh])
            n_vertices = len(yeo_labels)

            logger.info(f"Parcellation loaded: {n_vertices} vertices, "
                        f"networks: {np.unique(yeo_labels)}")

            # Load Destrieux atlas for custom ROIs
            destrieux = datasets.fetch_atlas_surf_destrieux()
            destrieux_lh = surface.load_surf_data(destrieux["map_left"])
            destrieux_rh = surface.load_surf_data(destrieux["map_right"])
            destrieux_labels = np.concatenate([destrieux_lh, destrieux_rh])
            destrieux_label_names = destrieux.get("labels", [])

            # Build label name → index mapping
            label_to_idx = {}
            if hasattr(destrieux_label_names, '__iter__'):
                for i, name in enumerate(destrieux_label_names):
                    if isinstance(name, bytes):
                        name = name.decode()
                    label_to_idx[name] = i

            # Build network masks
            from config import ROI_NETWORKS
            self.network_masks = {}

            for key, net_config in ROI_NETWORKS.items():
                mask = np.zeros(n_vertices, dtype=bool)

                # Yeo-based networks
                if net_config.get("yeo_indices"):
                    for yeo_idx in net_config["yeo_indices"]:
                        mask |= (yeo_labels == yeo_idx)

                # Custom ROI-based networks
                if net_config.get("custom_roi") and net_config["custom_roi"] in CUSTOM_ROI_TEMPLATES:
                    template = CUSTOM_ROI_TEMPLATES[net_config["custom_roi"]]
                    for label_name in template["approximate_destrieux_labels"]:
                        if label_name in label_to_idx:
                            idx = label_to_idx[label_name]
                            mask |= (destrieux_labels == idx)

                self.network_masks[key] = mask
                n_verts = mask.sum()
                logger.info(f"  Network '{key}': {n_verts} vertices")

            self._initialized = True
            logger.info("ROI extraction initialized.")

        except ImportError as e:
            logger.warning(f"nilearn not available, using approximate ROI masks: {e}")
            self._build_approximate_masks()
            self._initialized = True

    def _build_approximate_masks(self):
        """
        Fallback: build approximate masks based on vertex index ranges.
        Used when nilearn is not installed.
        """
        # fsaverage5 has ~10242 vertices per hemisphere = ~20484 total
        n_vertices = 20484
        n_per_hemi = n_vertices // 2

        self.network_masks = {}

        # Approximate vertex ranges for each network (based on standard cortical organization)
        # These are rough approximations — use nilearn parcellations for accuracy
        network_ranges = {
            "visual": {
                # Occipital cortex: posterior ~15% of each hemisphere
                "lh": (int(n_per_hemi * 0.0), int(n_per_hemi * 0.15)),
                "rh": (n_per_hemi + int(n_per_hemi * 0.0), n_per_hemi + int(n_per_hemi * 0.15)),
            },
            "motor": {
                # Precentral / central: ~15-30% range
                "lh": (int(n_per_hemi * 0.30), int(n_per_hemi * 0.42)),
                "rh": (n_per_hemi + int(n_per_hemi * 0.30), n_per_hemi + int(n_per_hemi * 0.42)),
            },
            "auditory": {
                # Superior temporal: ~50-62%
                "lh": (int(n_per_hemi * 0.50), int(n_per_hemi * 0.60)),
                "rh": (n_per_hemi + int(n_per_hemi * 0.50), n_per_hemi + int(n_per_hemi * 0.60)),
            },
            "language": {
                # Left-lateralized: inferior frontal + posterior temporal
                "lh": (int(n_per_hemi * 0.42), int(n_per_hemi * 0.52)),
                "rh": (n_per_hemi + int(n_per_hemi * 0.45), n_per_hemi + int(n_per_hemi * 0.50)),
            },
            "attention": {
                # Parietal: dorsal attention
                "lh": (int(n_per_hemi * 0.60), int(n_per_hemi * 0.75)),
                "rh": (n_per_hemi + int(n_per_hemi * 0.60), n_per_hemi + int(n_per_hemi * 0.75)),
            },
            "emotion_memory": {
                # Medial temporal + cingulate
                "lh": (int(n_per_hemi * 0.75), int(n_per_hemi * 0.90)),
                "rh": (n_per_hemi + int(n_per_hemi * 0.75), n_per_hemi + int(n_per_hemi * 0.90)),
            },
        }

        for key, ranges in network_ranges.items():
            mask = np.zeros(n_vertices, dtype=bool)
            for hemi_key in ["lh", "rh"]:
                start, end = ranges[hemi_key]
                mask[start:end] = True
            self.network_masks[key] = mask

        logger.info("Approximate ROI masks built (use nilearn for accurate parcellations).")

    def extract(self, predictions: np.ndarray) -> Dict[str, List[float]]:
        """
        Extract per-network mean activation time series from full-brain predictions.

        Args:
            predictions: np.ndarray of shape (n_timesteps, n_vertices)

        Returns:
            Dict mapping network key → list of mean activation values per timestep
        """
        self.initialize()

        n_timesteps, n_vertices = predictions.shape
        result = {}

        for key, mask in self.network_masks.items():
            # Ensure mask matches prediction dimensions
            if len(mask) != n_vertices:
                # Truncate or pad mask
                if len(mask) > n_vertices:
                    mask = mask[:n_vertices]
                else:
                    padded = np.zeros(n_vertices, dtype=bool)
                    padded[:len(mask)] = mask
                    mask = padded

            if mask.sum() == 0:
                result[key] = [0.0] * n_timesteps
                continue

            # Mean activation across vertices in this network
            network_activation = predictions[:, mask].mean(axis=1)
            result[key] = network_activation.tolist()

        return result

    def get_stats(self, predictions: np.ndarray, timestep: int) -> dict:
        """
        Get summary statistics for a single timestep.

        Returns:
            dict with global stats (mean, std, min, max) and per-network values.
        """
        self.initialize()

        if timestep >= predictions.shape[0]:
            timestep = predictions.shape[0] - 1

        frame = predictions[timestep]

        stats = {
            "timestep": timestep,
            "global": {
                "mean": float(np.mean(frame)),
                "std": float(np.std(frame)),
                "min": float(np.min(frame)),
                "max": float(np.max(frame)),
                "n_vertices": int(len(frame)),
            },
            "networks": {},
        }

        for key, mask in self.network_masks.items():
            if len(mask) != len(frame):
                continue
            if mask.sum() == 0:
                continue
            net_vals = frame[mask]
            stats["networks"][key] = {
                "mean": float(np.mean(net_vals)),
                "std": float(np.std(net_vals)),
                "min": float(np.min(net_vals)),
                "max": float(np.max(net_vals)),
            }

        return stats
