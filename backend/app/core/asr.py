import os
import sys
import logging
from pathlib import Path
import torch
import numpy as np

# Ensure CTranslate2 finds cublas64_12.dll and cudnn64_9.dll in PyTorch lib on Windows
if sys.platform == "win32":
    torch_lib_dir = Path(sys.executable).parent.parent / "Lib" / "site-packages" / "torch" / "lib"
    if torch_lib_dir.exists():
        try:
            os.add_dll_directory(str(torch_lib_dir))
        except Exception:
            pass
        os.environ["PATH"] = str(torch_lib_dir) + os.pathsep + os.environ.get("PATH", "")

from faster_whisper import WhisperModel
from app.config import settings

logger = logging.getLogger(__name__)


class ASREngine:
    """
    High-performance ASR streaming engine using Faster-Whisper.
    Runs on CUDA with float16 precision and active VAD filtering.
    """

    def __init__(self):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.compute_type = "float16" if self.device == "cuda" else "int8"
        self.device_name = torch.cuda.get_device_name(0) if self.device == "cuda" else "CPU"
        
        logger.info(
            f"[*] Initializing Faster-Whisper ({settings.ASR_MODEL_SIZE}) on "
            f"{self.device.upper()} ({self.compute_type}) [{self.device_name}]"
        )
        
        try:
            self.model = WhisperModel(
                settings.ASR_MODEL_SIZE,
                device=self.device,
                device_index=0 if self.device == "cuda" else 0,
                compute_type=self.compute_type
            )
        except Exception as e:
            logger.warning(f"[ASR] CUDA initialization warning: {e}. Falling back to CPU int8.")
            self.device = "cpu"
            self.compute_type = "int8"
            self.model = WhisperModel(
                settings.ASR_MODEL_SIZE,
                device="cpu",
                compute_type="int8"
            )

    def transcribe_chunk(
        self,
        audio_chunk: np.ndarray,
        beam_size: int = 1,
        language: str = "en"
    ) -> str:
        """
        Transcribes a 16kHz float32 audio chunk into clean text.
        Uses calibrated Silero VAD parameters with acoustic fallback
        to prevent valid speech from being dropped.
        """
        if len(audio_chunk) == 0:
            return ""

        # Pre-filter absolute dead silence
        rms = float(np.sqrt(np.mean(audio_chunk ** 2)))
        if rms < 0.00005:
            return ""

        # Normalization for dynamic range
        clean_chunk = audio_chunk - np.mean(audio_chunk)
        peak = float(np.max(np.abs(clean_chunk)))
        if peak > 0.0001:
            clean_chunk = clean_chunk * (0.90 / peak)

        vad_params = dict(
            threshold=0.30,
            min_speech_duration_ms=100,
            min_silence_duration_ms=400,
            speech_pad_ms=250
        )

        try:
            # 1. Primary pass with calibrated VAD
            segments, _ = self.model.transcribe(
                clean_chunk,
                beam_size=beam_size,
                language=language,
                vad_filter=True,
                vad_parameters=vad_params,
                without_timestamps=True
            )
            text_segments = [s.text.strip() for s in segments if s.text.strip()]
            result_text = " ".join(text_segments).strip()

            # 2. Acoustic Fallback: If VAD pruned the utterance but RMS indicates clear speech, retry without VAD
            if not result_text and rms >= 0.001:
                logger.debug(f"[ASR] VAD returned empty on RMS={rms:.4f}. Attempting direct ASR pass.")
                fallback_segs, _ = self.model.transcribe(
                    clean_chunk,
                    beam_size=beam_size,
                    language=language,
                    vad_filter=False,
                    without_timestamps=True
                )
                fb_text_list = [s.text.strip() for s in fallback_segs if s.text.strip()]
                result_text = " ".join(fb_text_list).strip()

            if result_text:
                logger.info(f"[ASR Whisper] (RMS={rms:.4f}) Transcribed: '{result_text}'")
            return result_text
        except Exception as e:
            logger.error(f"ASR transcription error: {e}")
            return ""

    def get_hardware_info(self) -> dict:
        return {
            "device": self.device,
            "device_name": self.device_name,
            "compute_type": self.compute_type,
            "model_size": settings.ASR_MODEL_SIZE
        }


# Singleton instance
asr_engine = ASREngine()
