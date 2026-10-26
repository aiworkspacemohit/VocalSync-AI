import datetime
import logging
import random
import string
from typing import Dict, List, Optional, Any
from fastapi import WebSocket
import numpy as np

from app.config import settings
from app.core.biometrics import biometrics_engine, decode_audio_bytes_to_mono_16k
from app.core.asr import asr_engine

logger = logging.getLogger("RoomManager")

# Palette of distinct vibrant colors for up to 20+ video call participants
SPEAKER_PALETTE = [
    {"name": "Emerald", "border": "#10b981", "bg": "rgba(16, 185, 129, 0.15)", "glow": "rgba(16, 185, 129, 0.4)"},
    {"name": "Cyan", "border": "#06b6d4", "bg": "rgba(6, 182, 212, 0.15)", "glow": "rgba(6, 182, 212, 0.4)"},
    {"name": "Indigo", "border": "#6366f1", "bg": "rgba(99, 102, 241, 0.15)", "glow": "rgba(99, 102, 241, 0.4)"},
    {"name": "Purple", "border": "#a855f7", "bg": "rgba(168, 85, 247, 0.15)", "glow": "rgba(168, 85, 247, 0.4)"},
    {"name": "Amber", "border": "#f59e0b", "bg": "rgba(245, 158, 11, 0.15)", "glow": "rgba(245, 158, 11, 0.4)"},
    {"name": "Rose", "border": "#f43f5e", "bg": "rgba(244, 63, 94, 0.15)", "glow": "rgba(244, 63, 94, 0.4)"},
    {"name": "Teal", "border": "#14b8a6", "bg": "rgba(20, 184, 166, 0.15)", "glow": "rgba(20, 184, 166, 0.4)"},
    {"name": "Sky", "border": "#0ea5e9", "bg": "rgba(14, 165, 233, 0.15)", "glow": "rgba(14, 165, 233, 0.4)"},
    {"name": "Fuchsia", "border": "#d946ef", "bg": "rgba(217, 70, 239, 0.15)", "glow": "rgba(217, 70, 239, 0.4)"},
    {"name": "Lime", "border": "#84cc16", "bg": "rgba(132, 204, 22, 0.15)", "glow": "rgba(132, 204, 22, 0.4)"},
    {"name": "Orange", "border": "#f97316", "bg": "rgba(249, 115, 22, 0.15)", "glow": "rgba(249, 115, 22, 0.4)"},
    {"name": "Blue", "border": "#3b82f6", "bg": "rgba(59, 130, 246, 0.15)", "glow": "rgba(59, 130, 246, 0.4)"},
    {"name": "Pink", "border": "#ec4899", "bg": "rgba(236, 72, 153, 0.15)", "glow": "rgba(236, 72, 153, 0.4)"},
    {"name": "Violet", "border": "#8b5cf6", "bg": "rgba(139, 92, 246, 0.15)", "glow": "rgba(139, 92, 246, 0.4)"},
    {"name": "Yellow", "border": "#eab308", "bg": "rgba(234, 179, 8, 0.15)", "glow": "rgba(234, 179, 8, 0.4)"},
    {"name": "Red", "border": "#ef4444", "bg": "rgba(239, 68, 68, 0.15)", "glow": "rgba(239, 68, 68, 0.4)"},
    {"name": "Green", "border": "#22c55e", "bg": "rgba(34, 197, 94, 0.15)", "glow": "rgba(34, 197, 94, 0.4)"},
    {"name": "Cyan-Light", "border": "#22d3ee", "bg": "rgba(34, 211, 238, 0.15)", "glow": "rgba(34, 211, 238, 0.4)"},
    {"name": "Indigo-Light", "border": "#818cf8", "bg": "rgba(129, 140, 248, 0.15)", "glow": "rgba(129, 140, 248, 0.4)"},
    {"name": "Rose-Light", "border": "#fb7185", "bg": "rgba(251, 113, 133, 0.15)", "glow": "rgba(251, 113, 133, 0.4)"}
]


def generate_meeting_code() -> str:
    """Generates a Google Meet style 3-3-3 code, e.g. 'vcl-842-mpt'."""
    p1 = "vcl"
    p2 = "".join(random.choices(string.digits, k=3))
    p3 = "".join(random.choices(string.ascii_lowercase, k=3))
    return f"{p1}-{p2}-{p3}"


class Participant:
    def __init__(self, peer_id: str, user_name: str, ws: WebSocket, color_idx: int):
        self.peer_id = peer_id
        self.user_name = user_name
        self.ws = ws
        self.color_style = SPEAKER_PALETTE[color_idx % len(SPEAKER_PALETTE)]
        self.is_muted = False
        self.is_camera_off = False
        self.is_hand_raised = False
        self.is_screen_sharing = False
        self.joined_at = datetime.datetime.now().isoformat()
        self.audio_buffer: List[float] = []

    def to_dict(self) -> dict:
        return {
            "peer_id": self.peer_id,
            "user_name": self.user_name,
            "color": self.color_style,
            "is_muted": self.is_muted,
            "is_camera_off": self.is_camera_off,
            "is_hand_raised": self.is_hand_raised,
            "is_screen_sharing": self.is_screen_sharing,
            "joined_at": self.joined_at
        }


class RoomSession:
    def __init__(self, room_id: str, title: str = "Video Call Conference"):
        self.room_id = room_id
        self.title = title
        self.created_at = datetime.datetime.now().isoformat()
        self.participants: Dict[str, Participant] = {}
        self.transcript_history: List[dict] = []
        self.chat_messages: List[dict] = []
        self.last_active_speaker: str = "Guest"

    async def add_participant(self, peer_id: str, user_name: str, ws: WebSocket) -> Participant:
        color_idx = len(self.participants)
        participant = Participant(peer_id, user_name, ws, color_idx)
        self.participants[peer_id] = participant
        logger.info(f"[Room {self.room_id}] + Participant joined: {user_name} ({peer_id}). Total: {len(self.participants)}")
        
        # Broadcast user joined to other peers
        await self.broadcast({
            "type": "USER_JOINED",
            "participant": participant.to_dict(),
            "participants": [p.to_dict() for p in self.participants.values()],
            "room_id": self.room_id
        }, exclude=peer_id)
        
        # Send room state to newly joined user
        await ws.send_json({
            "type": "ROOM_STATE",
            "room_id": self.room_id,
            "title": self.title,
            "self": participant.to_dict(),
            "participants": [p.to_dict() for p in self.participants.values()],
            "transcript_history": self.transcript_history,
            "chat_messages": self.chat_messages
        })
        return participant

    async def remove_participant(self, peer_id: str):
        if peer_id in self.participants:
            part = self.participants.pop(peer_id)
            logger.info(f"[Room {self.room_id}] - Participant left: {part.user_name} ({peer_id}). Remaining: {len(self.participants)}")
            await self.broadcast({
                "type": "USER_LEFT",
                "peer_id": peer_id,
                "user_name": part.user_name,
                "participants": [p.to_dict() for p in self.participants.values()]
            })

    async def broadcast(self, message: dict, exclude: Optional[str] = None):
        dead_peers = []
        for pid, part in self.participants.items():
            if exclude and pid == exclude:
                continue
            try:
                await part.ws.send_json(message)
            except Exception as e:
                logger.debug(f"[Room {self.room_id}] Error broadcasting to {pid}: {e}")
                dead_peers.append(pid)
        for dp in dead_peers:
            await self.remove_participant(dp)

    async def handle_audio_slice(self, peer_id: str, audio_bytes: bytes):
        part = self.participants.get(peer_id)
        if not part or part.is_muted:
            return

        audio_array = decode_audio_bytes_to_mono_16k(audio_bytes)
        if len(audio_array) == 0:
            return

        part.audio_buffer.extend(audio_array.tolist())
        target_len = int(settings.SAMPLE_RATE * 3.0)

        # Process when at least 2.5s of speech or full slice received
        if len(part.audio_buffer) >= target_len:
            process_slice = np.array(part.audio_buffer[:target_len], dtype=np.float32)
            part.audio_buffer = part.audio_buffer[target_len:]
        elif len(audio_array) >= int(settings.SAMPLE_RATE * 2.0):
            process_slice = audio_array
            part.audio_buffer.clear()
        else:
            return

        rms = float(np.sqrt(np.mean(process_slice ** 2)))
        if rms < 0.00008:
            return

        # 1. Biometric Identification
        identified_speaker, confidence, is_continuity = biometrics_engine.identify_speaker(
            process_slice,
            last_active_speaker=self.last_active_speaker
        )

        # If identified as guest, or participant's name is known, prefer participant identity with match info
        display_speaker = identified_speaker
        if identified_speaker in ("Guest", "Unknown Guest"):
            display_speaker = part.user_name

        self.last_active_speaker = display_speaker

        # 2. Faster-Whisper ASR Transcription
        text = asr_engine.transcribe_chunk(process_slice)
        if not text:
            return

        now_str = datetime.datetime.now().strftime("%H:%M:%S")
        chunk_id = f"chunk_{int(datetime.datetime.now().timestamp() * 1000)}"

        transcript_chunk = {
            "id": chunk_id,
            "type": "TRANSCRIPT_CHUNK",
            "speaker": display_speaker,
            "peer_id": peer_id,
            "user_name": part.user_name,
            "confidence": confidence,
            "text": text,
            "timestamp": now_str,
            "is_continuity": is_continuity,
            "speaker_color": part.color_style
        }

        self.transcript_history.append(transcript_chunk)
        logger.info(f"[Room {self.room_id}] [{display_speaker} ({confidence}%)]: {text}")

        # Broadcast transcript + active speaker highlight event
        await self.broadcast({
            "type": "TRANSCRIPT_CHUNK",
            "chunk": transcript_chunk,
            "active_speaker": {
                "peer_id": peer_id,
                "user_name": part.user_name,
                "speaker": display_speaker,
                "color": part.color_style,
                "confidence": confidence
            }
        })


class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, RoomSession] = {}

    def create_room(self, title: Optional[str] = None) -> RoomSession:
        code = generate_meeting_code()
        # Ensure uniqueness
        while code in self.rooms:
            code = generate_meeting_code()
        
        session = RoomSession(room_id=code, title=title or "VocalSync Video Conference")
        self.rooms[code] = session
        logger.info(f"[+] Created Video Meeting Room: {code}")
        return session

    def get_or_create_room(self, room_id: str, title: Optional[str] = None) -> RoomSession:
        clean_id = room_id.strip().lower()
        if clean_id not in self.rooms:
            self.rooms[clean_id] = RoomSession(room_id=clean_id, title=title or "VocalSync Video Conference")
            logger.info(f"[+] Initialized Room Session on join: {clean_id}")
        return self.rooms[clean_id]

    def get_room(self, room_id: str) -> Optional[RoomSession]:
        return self.rooms.get(room_id.strip().lower())

    def list_active_rooms(self) -> List[dict]:
        return [
            {
                "room_id": r.room_id,
                "title": r.title,
                "participant_count": len(r.participants),
                "created_at": r.created_at
            }
            for r in self.rooms.values()
        ]


room_manager = RoomManager()
