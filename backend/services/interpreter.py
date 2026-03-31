"""
AI Interpretation Agent
Uses an LLM to interpret brain activation patterns at each timestep,
providing human-readable summaries of what's happening neurally.
"""
import logging
from typing import Optional, Dict, List

logger = logging.getLogger(__name__)


class BrainInterpreter:
    """
    Generates natural language interpretations of brain activation patterns.
    Uses Claude or GPT-4 to analyze ROI activations + video context.
    """

    SYSTEM_PROMPT = """You are a neuroscience interpreter analyzing predicted brain activation patterns from Meta's TRIBE v2 model. Given activation values for 6 brain networks at a specific timestep in a video, provide a concise 2-3 sentence interpretation of what might be happening in the viewer's brain.

Brain networks and what they indicate:
- Attention (dorsal + ventral attention networks): Focused engagement, salience detection, orienting to stimuli
- Auditory (superior temporal cortex): Sound processing, speech perception, music
- Emotion/Memory (limbic system, default mode): Emotional response, memory encoding, self-referential processing
- Language (Broca's + Wernicke's areas): Speech comprehension, semantic processing, inner speech
- Motor (somatomotor cortex): Movement perception, action planning, mirror neuron activity
- Visual (occipital cortex): Visual processing, scene understanding, object recognition

Activation values are z-scored relative to baseline. Values > 0.05 indicate above-average activation; < -0.05 indicates suppression. Focus on the most notable patterns and what they suggest about the viewer's experience.

Be specific and insightful. Don't just list which regions are active — explain what the PATTERN means for the viewer's experience."""

    def __init__(self, api_key: str = "", model: str = "claude-sonnet-4-20250514", provider: str = "anthropic"):
        self.api_key = api_key
        self.model = model
        self.provider = provider

    def interpret_timestep(
        self,
        roi_values: Dict[str, float],
        timestep: int,
        video_context: Optional[str] = None,
    ) -> str:
        """
        Generate an interpretation for a single timestep.

        Args:
            roi_values: Dict of network_key → activation value at this timestep
            timestep: The timestep index (seconds into video)
            video_context: Optional description of what's happening in the video

        Returns:
            Human-readable interpretation string
        """
        if not self.api_key:
            return self._fallback_interpret(roi_values, timestep)

        # Build the prompt
        activation_str = "\n".join(
            f"  - {key}: {value:.4f}" for key, value in roi_values.items()
        )

        user_prompt = f"""Timestep: {timestep}s into the video

Network activations:
{activation_str}
"""
        if video_context:
            user_prompt += f"\nVideo context at this moment: {video_context}"

        user_prompt += "\n\nProvide a concise interpretation (2-3 sentences):"

        try:
            if self.provider == "anthropic":
                return self._call_anthropic(user_prompt)
            else:
                return self._call_openai(user_prompt)
        except Exception as e:
            logger.warning(f"LLM interpretation failed: {e}")
            return self._fallback_interpret(roi_values, timestep)

    def _call_anthropic(self, user_prompt: str) -> str:
        """Call Anthropic API."""
        import anthropic
        client = anthropic.Anthropic(api_key=self.api_key)
        message = client.messages.create(
            model=self.model,
            max_tokens=300,
            system=self.SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_prompt}],
        )
        return message.content[0].text

    def _call_openai(self, user_prompt: str) -> str:
        """Call OpenAI API."""
        import openai
        client = openai.OpenAI(api_key=self.api_key)
        response = client.chat.completions.create(
            model=self.model,
            max_tokens=300,
            messages=[
                {"role": "system", "content": self.SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content

    def interpret_batch(
        self,
        roi_activations: Dict[str, List[float]],
        timesteps: Optional[List[int]] = None,
        video_context: Optional[Dict[int, str]] = None,
    ) -> Dict[int, str]:
        """
        Batch interpret multiple timesteps.
        If timesteps is None, interprets every 5th second.
        """
        n_timesteps = len(next(iter(roi_activations.values())))

        if timesteps is None:
            timesteps = list(range(0, n_timesteps, 5))

        results = {}
        for t in timesteps:
            if t >= n_timesteps:
                continue
            roi_values = {key: vals[t] for key, vals in roi_activations.items()}
            context = video_context.get(t) if video_context else None
            results[t] = self.interpret_timestep(roi_values, t, context)

        return results

    def _fallback_interpret(self, roi_values: Dict[str, float], timestep: int) -> str:
        """Generate a basic rule-based interpretation when no LLM is available."""
        sorted_networks = sorted(roi_values.items(), key=lambda x: abs(x[1]), reverse=True)

        active = [(k, v) for k, v in sorted_networks if v > 0.03]
        suppressed = [(k, v) for k, v in sorted_networks if v < -0.03]

        parts = []
        if active:
            top = active[0]
            network_descriptions = {
                "attention": "heightened focused attention",
                "auditory": "active sound/speech processing",
                "emotion_memory": "emotional engagement or memory encoding",
                "language": "language comprehension or inner speech",
                "motor": "movement perception or action planning",
                "visual": "strong visual processing",
            }
            desc = network_descriptions.get(top[0], top[0])
            parts.append(f"At {timestep}s, the dominant pattern suggests {desc} "
                         f"(activation: {top[1]:.3f}).")

            if len(active) > 1:
                secondary = [network_descriptions.get(k, k) for k, _ in active[1:3]]
                parts.append(f"Secondary activation in {' and '.join(secondary)}.")

        if suppressed:
            supp_names = [k for k, _ in suppressed[:2]]
            parts.append(f"Suppressed: {', '.join(supp_names)}.")

        if not parts:
            parts.append(f"At {timestep}s, brain activation is near baseline across all networks.")

        return " ".join(parts)
