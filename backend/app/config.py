import os
import json
from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    GEMINI_API_KEY: str = ""
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "https://vocal-sync-ai.vercel.app",
        "*"
    ]
    VOICE_PROFILES_DIR: str = str(BASE_DIR / "voice_profiles")
    ASR_MODEL_SIZE: str = "small.en"
    SIMILARITY_THRESHOLD: float = 0.39
    CONFIDENCE_MARGIN: float = 0.02
    CONTINUITY_THRESHOLD: float = 0.30
    HIGH_CONFIDENCE_THRESHOLD: float = 0.47
    SAMPLE_RATE: int = 16000
    CHUNK_DURATION: float = 3.5

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return parsed
            except Exception:
                return [s.strip() for s in v.split(",") if s.strip()]
        return v

    model_config = SettingsConfigDict(
        env_file=(
            str(BASE_DIR / ".env"),
            str(BASE_DIR.parent / ".env"),
            ".env"
        ),
        env_file_encoding="utf-8",
        extra="ignore"
    )


settings = Settings()

# Ensure profile directory exists
os.makedirs(settings.VOICE_PROFILES_DIR, exist_ok=True)
