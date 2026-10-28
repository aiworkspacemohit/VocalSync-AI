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
    High-precision ASR streaming engine using Faster-Whisper.
    Calibrated with strict hallucination suppression and beam search.
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
                compute_type=self.compute_type,
                cpu_threads=4
            )
        except Exception as e:
            logger.warning(f"[ASR] CUDA initialization warning: {e}. Falling back to CPU int8.")
            self.device = "cpu"
            self.compute_type = "int8"
            self.model = WhisperModel(
                settings.ASR_MODEL_SIZE,
                device="cpu",
                compute_type="int8",
                cpu_threads=4
            )

        # Calibrated Silero VAD parameters for conversational speech
        self.vad_params = dict(
            threshold=0.45,                 # Strict speech vs ambient noise threshold
            min_speech_duration_ms=250,     # Ignore sudden short pops/clicks under 250ms
            max_speech_duration_s=float("inf"),
            min_silence_duration_ms=400,    # Natural sentence pause tolerance
            speech_pad_ms=200               # 200ms padding preserves word beginnings and endings
        )

    def transcribe_chunk(
        self,
        audio_chunk: np.ndarray,
        beam_size: int = 5,
        language: str = "en"
    ) -> str:
        """
        Transcribes a 16kHz float32 audio chunk into clean, word-for-word text.
        Applies deterministic beam decoding and drops hallucinations.
        """
        if len(audio_chunk) == 0:
            return ""

        # Remove DC offset drift
        clean_chunk = audio_chunk - np.mean(audio_chunk)

        # 1. True Noise Floor Check (Prevents hallucinating on room hum)
        rms = float(np.sqrt(np.mean(clean_chunk ** 2)))
        if rms < 0.007:
            # Below practical mic noise floor; discard immediately
            return ""

        # 2. Safe Dynamic Range Scaling
        # Only normalize if signal has legitimate voice energy, without over-amplifying low noise
        peak = float(np.max(np.abs(clean_chunk)))
        if peak > 0.02:
            clean_chunk = clean_chunk / peak * 0.90

        try:
            # 3. High-Accuracy Deterministic Decoding Pass
            segments, info = self.model.transcribe(
                clean_chunk,
                beam_size=beam_size,                   # 5-beam search evaluates top phonetic paths
                best_of=5,
                temperature=0.0,                       # Deterministic greedy argmax (eliminates random words)
                condition_on_previous_text=False,      # Prevents prior turn hallucinations from bleeding over
                compression_ratio_threshold=2.4,       # Discards repetitive hallucination loops
                no_speech_threshold=0.6,               # Drops segments where no distinct speech exists
                log_prob_threshold=-1.0,               # Drops low-confidence token predictions
                vad_filter=True,                       # Cleans non-speech audio with Silero VAD
                vad_parameters=self.vad_params,
                language=language,
                without_timestamps=True
            )

            text_segments = [s.text.strip() for s in segments if s.text.strip()]
            result_text = " ".join(text_segments).strip()

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
