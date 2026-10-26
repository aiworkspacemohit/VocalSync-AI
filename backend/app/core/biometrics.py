import os
import io
import glob
import logging
from typing import Dict, List, Tuple, Optional
import numpy as np
import torch
import soundfile as sf
import av
from speechbrain.inference.speaker import EncoderClassifier

from app.config import settings

logger = logging.getLogger(__name__)


def decode_audio_bytes_to_mono_16k(audio_bytes: bytes) -> np.ndarray:
    """
    Decodes audio bytes (WAV, WebM/Opus, OGG, MP3, PCM) to a 16kHz mono float32 numpy array.
    Prioritizes fast direct SoundFile WAV decoding, falling back to PyAV container demuxing.
    """
    if not audio_bytes or len(audio_bytes) < 44:
        return np.zeros(0, dtype=np.float32)

    # Fast path: Direct standard WAV decoding
    if audio_bytes[:4] == b'RIFF' or b'WAVE' in audio_bytes[:16]:
        try:
            data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
            if data.ndim > 1:
                data = np.mean(data, axis=1)
            if sr != 16000:
                import scipy.signal
                num_samples = int(len(data) * 16000 / sr)
                data = scipy.signal.resample(data, num_samples).astype(np.float32)
            return data.astype(np.float32)
        except Exception as e_wav:
            logger.debug(f"Direct WAV decode fallback: {e_wav}")

    # General SoundFile decoding (FLAC, OGG, etc.)
    try:
        data, sr = sf.read(io.BytesIO(audio_bytes), dtype="float32")
        if data.ndim > 1:
            data = np.mean(data, axis=1)
        if sr != 16000:
            import scipy.signal
            num_samples = int(len(data) * 16000 / sr)
            data = scipy.signal.resample(data, num_samples).astype(np.float32)
        return data.astype(np.float32)
    except Exception:
        pass

    # PyAV container decoding (WebM / Opus container slices)
    try:
        container = av.open(io.BytesIO(audio_bytes))
        resampler = av.AudioResampler(format="flt", layout="mono", rate=16000)
        frames_list = []
        for frame in container.decode(audio=0):
            resampled = resampler.resample(frame)
            if resampled:
                for rf in resampled:
                    frames_list.append(rf.to_ndarray()[0])
        container.close()
        if frames_list:
            return np.concatenate(frames_list).astype(np.float32)
    except Exception as e_av:
        logger.debug(f"PyAV container decode fallback: {e_av}")

    # Raw PCM int16 fallback
    try:
        pcm16 = np.frombuffer(audio_bytes, dtype=np.int16).astype(np.float32) / 32768.0
        return pcm16
    except Exception as e_raw:
        logger.error(f"Failed to decode audio bytes: {e_raw}")
        return np.zeros(0, dtype=np.float32)


def preprocess_audio_for_biometrics(audio: np.ndarray, sample_rate: int = 16000) -> np.ndarray:
    """
    Biometric pre-processing pipeline for ECAPA-TDNN:
    1. DC offset removal.
    2. Energy-based voice activity trimming (strips ambient silence blocks so
       room background noise does not dilute the 192-D speaker centroid embedding).
    3. Peak normalization to 0.90 headroom to standardize acoustic filterbank gains.
    """
    if len(audio) == 0:
        return audio

    # 1. DC offset removal
    audio = audio - np.mean(audio)

    # 2. Energy-based voice activity trimming
    frame_len = int(sample_rate * 0.02)  # 20ms frames (320 samples at 16kHz)
    if len(audio) >= frame_len * 4:
        num_frames = len(audio) // frame_len
        frames = audio[:num_frames * frame_len].reshape(num_frames, frame_len)
        frame_rms = np.sqrt(np.mean(frames ** 2, axis=1))
        max_rms = float(np.max(frame_rms)) if len(frame_rms) > 0 else 0.0

        if max_rms > 0.001:
            threshold = max(0.002, max_rms * 0.12)
            active_idx = np.where(frame_rms >= threshold)[0]
            if len(active_idx) >= 10:  # At least 200ms active speech
                pad_frames = int(sample_rate * 0.10 / frame_len)  # 100ms padding
                start_frame = max(0, active_idx[0] - pad_frames)
                end_frame = min(num_frames, active_idx[-1] + pad_frames + 1)
                audio = audio[start_frame * frame_len : end_frame * frame_len]

    # 3. Peak normalization
    peak = float(np.max(np.abs(audio))) if len(audio) > 0 else 0.0
    if peak > 0.0001:
        audio = audio * (0.90 / peak)

    return audio.astype(np.float32)


def calculate_calibrated_confidence(
    best_score: float,
    second_score: float = -1.0,
    is_continuity: bool = False
) -> int:
    """
    Calibrates raw ECAPA-TDNN cosine similarity (range ~0.20-0.85) to an intuitive,
    probabilistic confidence percentage (60%-99%) for enterprise reporting.
    """
    if best_score >= 0.70:
        base = 96.0 + min(3.0, (best_score - 0.70) * 15.0)
    elif best_score >= 0.55:
        base = 90.0 + ((best_score - 0.55) / 0.15) * 6.0
    elif best_score >= 0.45:
        base = 80.0 + ((best_score - 0.45) / 0.10) * 10.0
    elif best_score >= 0.38:
        base = 68.0 + ((best_score - 0.38) / 0.07) * 12.0
    elif best_score >= 0.30:
        base = 50.0 + ((best_score - 0.30) / 0.08) * 18.0
    else:
        base = max(15.0, best_score * 100.0)

    # Margin modifier
    if second_score > 0:
        margin = best_score - second_score
        if margin >= 0.08:
            base += 3.0
        elif margin < 0.02 and not is_continuity:
            base -= 4.0

    # Continuity inertia bonus
    if is_continuity:
        base = max(78.0, base + 2.0)

    return max(15, min(99, int(round(base))))


class BiometricsEngine:
    """
    SOTA ECAPA-TDNN Speaker Biometrics Engine using SpeechBrain.
    Supports dynamic multi-prompt enrollment, unit vector centroid calculation,
    and live speaker identification with dual-threshold continuity smoothing.
    """

    def __init__(self):
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        logger.info(f"[*] Initializing ECAPA-TDNN Biometrics Engine on hardware: {self.device.upper()}")
        
        self.classifier = EncoderClassifier.from_hparams(
            source="speechbrain/spkrec-ecapa-voxceleb",
            run_opts={"device": self.device}
        )
        self.enrolled_profiles: Dict[str, np.ndarray] = {}
        self.reload_profiles()

    def reload_profiles(self) -> int:
        """Loads and normalizes all enrolled .npy voiceprints from storage."""
        self.enrolled_profiles.clear()
        search_path = os.path.join(settings.VOICE_PROFILES_DIR, "*.npy")
        npy_files = glob.glob(search_path)
        
        for file_path in npy_files:
            raw_name = os.path.splitext(os.path.basename(file_path))[0]
            display_name = raw_name.replace("_", " ").title()
            try:
                vec = np.load(file_path).flatten()
                norm = np.linalg.norm(vec)
                if norm > 0:
                    vec = vec / norm
                self.enrolled_profiles[display_name] = vec
            except Exception as e:
                logger.error(f"Error loading voice profile {file_path}: {e}")

        logger.info(f"[*] Enrolled profiles loaded ({len(self.enrolled_profiles)}): {list(self.enrolled_profiles.keys())}")
        return len(self.enrolled_profiles)

    def extract_embedding(self, audio_chunk: np.ndarray, preprocess: bool = True) -> Optional[np.ndarray]:
        """
        Extracts 192-D unit-normalized embedding vector from audio chunk.
        Input audio must be float32 at 16kHz.
        """
        if len(audio_chunk) == 0:
            return None

        if preprocess:
            audio_chunk = preprocess_audio_for_biometrics(audio_chunk)
            if len(audio_chunk) < int(settings.SAMPLE_RATE * 0.2):  # less than 200ms of audio
                return None

        # Convert to tensor: shape (batch=1, time)
        wav_tensor = torch.from_numpy(audio_chunk).unsqueeze(0).to(self.device)
        with torch.no_grad():
            emb = self.classifier.encode_batch(wav_tensor).squeeze().cpu().numpy()

        norm = np.linalg.norm(emb)
        if norm > 0:
            return (emb / norm).astype(np.float32)
        return None

    def identify_speaker(
        self,
        audio_chunk: np.ndarray,
        last_active_speaker: str = "Guest"
    ) -> Tuple[str, int, bool]:
        """
        Multi-Rule Precision Biometric Identification:
        - Rule 1: High Confidence Threshold Bypass (best_score >= HIGH_CONFIDENCE_THRESHOLD)
        - Rule 2: Primary Verified Match (best_score >= SIMILARITY_THRESHOLD and margin >= CONFIDENCE_MARGIN)
        - Rule 3: Speaker Continuity Inertia (best_name == last_active_speaker and best_score >= CONTINUITY_THRESHOLD)
        - Rule 4: Runner-up Continuity Tie-Break
        - Rule 5: Fallback to Unknown Guest
        
        Returns:
            Tuple[speaker_name, calibrated_confidence_pct, is_continuity]
        """
        if not self.enrolled_profiles:
            return "Unknown Guest", 0, False

        live_vec = self.extract_embedding(audio_chunk, preprocess=True)
        if live_vec is None:
            fallback = last_active_speaker if last_active_speaker not in ("Guest", "Unknown Guest") else "Unknown Guest"
            return fallback, 0, False

        ranked_matches: List[Tuple[str, float]] = []
        for name, enrolled_vec in self.enrolled_profiles.items():
            # Unit vector dot product = Cosine Similarity
            sim = float(np.dot(live_vec, enrolled_vec))
            ranked_matches.append((name, sim))

        ranked_matches.sort(key=lambda x: x[1], reverse=True)
        best_name, best_score = ranked_matches[0]
        second_name, second_score = ranked_matches[1] if len(ranked_matches) > 1 else ("None", -1.0)
        third_name, third_score = ranked_matches[2] if len(ranked_matches) > 2 else ("None", -1.0)

        logger.info(
            f"[Biometrics] Matches: 1st={best_name} ({best_score:.4f}), "
            f"2nd={second_name} ({second_score:.4f}), "
            f"3rd={third_name} ({third_score:.4f}) | LastActive={last_active_speaker}"
        )

        # 1. Absolute High-Confidence Match (accepts even when runner-up has high acoustic baseline)
        if best_score >= settings.HIGH_CONFIDENCE_THRESHOLD:
            conf = calculate_calibrated_confidence(best_score, second_score, is_continuity=False)
            return best_name, conf, False

        # 2. Primary Verified Match with Margin
        if best_score >= settings.SIMILARITY_THRESHOLD and (best_score - second_score >= settings.CONFIDENCE_MARGIN):
            conf = calculate_calibrated_confidence(best_score, second_score, is_continuity=False)
            return best_name, conf, False

        # 3. Active Speaker Continuity (Inertia for conversational turns / short phrases)
        if best_name == last_active_speaker and best_score >= settings.CONTINUITY_THRESHOLD:
            conf = calculate_calibrated_confidence(best_score, second_score, is_continuity=True)
            return best_name, conf, True

        # 4. Runner-up Continuity Tie-Break (active speaker continues speaking close to runner-up)
        if (
            second_name == last_active_speaker
            and second_score >= settings.CONTINUITY_THRESHOLD
            and (best_score - second_score < 0.015)
        ):
            conf = calculate_calibrated_confidence(second_score, best_score, is_continuity=True)
            return last_active_speaker, conf, True

        # 5. Fallback to Unknown Guest
        guest_conf = max(15, min(45, int(best_score * 50)))
        return "Unknown Guest", guest_conf, False

    def enroll_speaker(
        self,
        speaker_name: str,
        sample_embeddings: List[np.ndarray]
    ) -> str:
        """
        Computes the average unit vector (Centroid) across distinct voice samples
        and saves it to disk as {speaker_name}.npy.
        """
        if not sample_embeddings:
            raise ValueError("No embeddings provided for enrollment.")

        # Calculate average centroid vector
        centroid = np.mean(sample_embeddings, axis=0)
        norm = np.linalg.norm(centroid)
        if norm > 0:
            centroid = centroid / norm

        sanitized_name = speaker_name.lower().strip().replace(" ", "_")
        filename = f"{sanitized_name}.npy"
        save_path = os.path.join(settings.VOICE_PROFILES_DIR, filename)

        np.save(save_path, centroid)
        self.reload_profiles()
        logger.info(f"[+] Successfully enrolled {speaker_name}! Saved centroid to {save_path}")
        return save_path

    def list_enrolled_speakers(self) -> List[Dict[str, str]]:
        """Returns list of registered participants."""
        return [
            {"name": name, "filename": f"{name.lower().replace(' ', '_')}.npy"}
            for name in sorted(self.enrolled_profiles.keys())
        ]


# Singleton instance
biometrics_engine = BiometricsEngine()
