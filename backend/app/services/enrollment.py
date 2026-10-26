import logging
from typing import List
import numpy as np

from app.core.biometrics import (
    biometrics_engine,
    decode_audio_bytes_to_mono_16k,
    preprocess_audio_for_biometrics
)
from app.schemas.meeting import EnrollmentResponse

logger = logging.getLogger(__name__)

STANDARD_PROMPTS = [
    "Good morning everyone, let's review the project updates and deadlines today.",
    "Could you clarify the technical requirements for the next release schedule?",
    "One, two, three, four, five, six, seven, eight, nine, ten."
]


class EnrollmentService:
    """
    Handles 3-step high-accuracy voice registration.
    Extracts ECAPA embeddings from three vocal styles (statement, query, count),
    computes the normalized centroid profile, and registers the speaker.
    """

    @staticmethod
    def get_enrollment_prompts() -> List[dict]:
        return [
            {"step": 1, "type": "Statement", "prompt": STANDARD_PROMPTS[0]},
            {"step": 2, "type": "Query", "prompt": STANDARD_PROMPTS[1]},
            {"step": 3, "type": "Cadence & Numbers", "prompt": STANDARD_PROMPTS[2]}
        ]

    @staticmethod
    def enroll_from_audio_bytes(speaker_name: str, audio_samples: List[bytes]) -> EnrollmentResponse:
        clean_name = speaker_name.strip()
        if not clean_name:
            raise ValueError("Speaker name cannot be empty.")

        if len(audio_samples) < 1:
            raise ValueError("At least one audio sample is required for enrollment.")

        embeddings: List[np.ndarray] = []
        valid_samples_count = 0

        for idx, sample_bytes in enumerate(audio_samples, start=1):
            raw_data = decode_audio_bytes_to_mono_16k(sample_bytes)
            if len(raw_data) == 0:
                logger.warning(f"Audio sample {idx} for {clean_name} was empty or could not be decoded.")
                continue

            # Preprocess and clean the enrollment utterance
            clean_audio = preprocess_audio_for_biometrics(raw_data)
            rms = float(np.sqrt(np.mean(clean_audio ** 2))) if len(clean_audio) > 0 else 0.0

            if rms < 0.003:
                logger.warning(f"Audio sample {idx} for {clean_name} has low energy (RMS: {rms:.4f}).")

            emb = biometrics_engine.extract_embedding(clean_audio, preprocess=False)
            if emb is not None:
                embeddings.append(emb)
                valid_samples_count += 1
                logger.info(f"[Enrollment] Sample {idx}/3 processed for '{clean_name}': {len(clean_audio)/16000:.2f}s active voice")

        if not embeddings:
            return EnrollmentResponse(
                success=False,
                speaker_name=clean_name,
                message="Failed to extract valid voice embeddings. Ensure your microphone is active and clear.",
                samples_processed=0
            )

        save_path = biometrics_engine.enroll_speaker(clean_name, embeddings)

        return EnrollmentResponse(
            success=True,
            speaker_name=clean_name,
            message=f"Voice profile for '{clean_name}' successfully created and activated.",
            samples_processed=valid_samples_count,
            profile_path=save_path
        )


enrollment_service = EnrollmentService()
