import os
import sys
from pathlib import Path

# Ensure backend directory is in sys.path for direct invocation
backend_dir = str(Path(__file__).resolve().parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

import io
import time
import datetime
import logging
import warnings
from typing import List, Optional
from contextlib import asynccontextmanager
import numpy as np

warnings.filterwarnings("ignore", category=FutureWarning)
warnings.filterwarnings("ignore", category=UserWarning)

from fastapi import (
    FastAPI,
    WebSocket,
    WebSocketDisconnect,
    UploadFile,
    File,
    Form,
    HTTPException,
    Query
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

from app.config import settings
from app.core.biometrics import biometrics_engine, decode_audio_bytes_to_mono_16k
from app.core.asr import asr_engine
from app.core.nlp_summarizer import nlp_summarizer
from app.services.enrollment import enrollment_service
from app.services.docx_generator import generate_executive_docx
from app.core.room_manager import room_manager
from app.schemas.meeting import (
    TranscriptChunk,
    SpeakerProfileList,
    EnrollmentResponse,
    SummarizeRequest,
    MeetingDebrief,
    ExportDocxRequest
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("VocalSync_API")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("[*] Booting VocalSync AI Platform...")
    hw = asr_engine.get_hardware_info()
    count = biometrics_engine.reload_profiles()
    logger.info(f"[+] Biometrics loaded {count} profile(s). ASR Engine hardware: {hw['device'].upper()} ({hw['device_name']})")
    yield
    logger.info("[*] Shutting down VocalSync AI Platform...")


app = FastAPI(
    title="VocalSync AI — Enterprise Biometric Meeting Intelligence",
    description="Real-time multi-speaker voice biometrics, streaming ASR, and executive debrief generation.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
raw_origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
clean_origins = [o for o in raw_origins if o != "*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=clean_origins if clean_origins else ["*"],
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    """System health check and hardware acceleration info."""
    return {
        "status": "healthy",
        "service": "VocalSync AI",
        "timestamp": datetime.datetime.now().isoformat(),
        "hardware": asr_engine.get_hardware_info(),
        "enrolled_speakers_count": len(biometrics_engine.enrolled_profiles),
        "enrolled_speakers": biometrics_engine.list_enrolled_speakers()
    }


@app.get("/api/speakers", response_model=SpeakerProfileList)
def get_speakers():
    """Lists all registered speaker profiles."""
    speakers = [
        {"name": s["name"], "filename": s["filename"], "dimension": 192}
        for s in biometrics_engine.list_enrolled_speakers()
    ]
    return {"count": len(speakers), "speakers": speakers}


@app.delete("/api/speakers/{speaker_name}")
def delete_speaker(speaker_name: str):
    """Deletes an enrolled speaker profile by name or filename."""
    clean_name = speaker_name.removesuffix(".npy").strip()
    success = biometrics_engine.delete_speaker(clean_name)
    if not success:
        raise HTTPException(status_code=404, detail=f"Voice profile '{clean_name}' not found.")
    return {
        "status": "success",
        "message": f"Successfully deleted voice profile for '{clean_name}'",
        "count": len(biometrics_engine.enrolled_profiles),
        "speakers": biometrics_engine.list_enrolled_speakers()
    }


@app.delete("/api/speakers")
def clear_all_speakers():
    """Clears all enrolled speaker profiles."""
    removed = biometrics_engine.clear_all_speakers()
    return {
        "status": "success",
        "message": f"Successfully cleared {removed} voice profile(s).",
        "count": len(biometrics_engine.enrolled_profiles),
        "speakers": []
    }


@app.get("/api/enrollment/prompts")
def get_enrollment_prompts():
    """Returns the 3 structured speech prompts for biometric enrollment."""
    return enrollment_service.get_enrollment_prompts()


@app.post("/api/enroll", response_model=EnrollmentResponse)
async def enroll_speaker(
    speaker_name: str = Form(...),
    sample1: UploadFile = File(...),
    sample2: Optional[UploadFile] = File(None),
    sample3: Optional[UploadFile] = File(None)
):
    """
    3-prompt voice registration endpoint.
    Accepts audio files (WebM, WAV, OGG), computes ECAPA centroid, and persists {name}.npy.
    """
    try:
        samples_bytes = []
        for upload in [sample1, sample2, sample3]:
            if upload is not None:
                content = await upload.read()
                if len(content) > 0:
                    samples_bytes.append(content)

        if not samples_bytes:
            raise HTTPException(status_code=400, detail="No audio data received.")

        result = enrollment_service.enroll_from_audio_bytes(
            speaker_name=speaker_name,
            audio_samples=samples_bytes
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Enrollment failure: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Enrollment error: {str(e)}")


@app.post("/api/meeting/summarize", response_model=MeetingDebrief)
def summarize_meeting(request: SummarizeRequest):
    """
    Aggregates transcript and queries Google Gemini (with dynamic fallback)
    for intent motives, decisions, and action items.
    """
    try:
        debrief = nlp_summarizer.summarize(
            transcript=request.transcript,
            meeting_title=request.meeting_title or "Executive Meeting Intelligence Brief"
        )
        return debrief
    except Exception as e:
        logger.error(f"Summarization error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to generate summary: {str(e)}")


@app.post("/api/meeting/export-docx")
def export_docx(request: ExportDocxRequest):
    """
    Constructs an executive corporate .docx document and returns it as a streaming binary download.
    """
    try:
        doc_stream = generate_executive_docx(
            debrief=request.debrief,
            transcript_history=request.transcript_history
        )
        filename = f"VocalSync_Executive_Debrief_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.docx"
        return StreamingResponse(
            doc_stream,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
    except Exception as e:
        logger.error(f"DOCX export error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to export report: {str(e)}")


# ==========================================
# MULTI-PARTICIPANT VIDEO ROOM ENDPOINTS
# ==========================================

@app.post("/api/rooms/create")
def create_meeting_room(request_data: Optional[dict] = None):
    """Generates a new Google Meet style meeting code and room session."""
    title = (request_data or {}).get("title", "Executive Video Conference")
    room = room_manager.create_room(title=title)
    return {
        "room_id": room.room_id,
        "title": room.title,
        "created_at": room.created_at,
        "join_url": f"/meet/{room.room_id}"
    }


@app.get("/api/rooms/{room_id}")
def get_meeting_room(room_id: str):
    """Retrieves metadata and active participants for a meeting room."""
    room = room_manager.get_room(room_id)
    if not room:
        # Auto-create if valid format for convenience
        room = room_manager.get_or_create_room(room_id)
    return {
        "room_id": room.room_id,
        "title": room.title,
        "created_at": room.created_at,
        "participants_count": len(room.participants),
        "participants": [p.to_dict() for p in room.participants.values()],
        "transcript_count": len(room.transcript_history)
    }


@app.get("/api/rooms")
def list_active_rooms():
    """Lists all active video call meeting rooms."""
    return {"rooms": room_manager.list_active_rooms()}


@app.websocket("/ws/room/{room_id}/{peer_id}")
async def room_websocket_endpoint(
    websocket: WebSocket,
    room_id: str,
    peer_id: str,
    user_name: str = Query("Guest")
):
    """
    Multi-Party Video Call Room Gateway:
    - Handles WebRTC signaling (offers, answers, ICE candidates)
    - Receives participant audio slices and performs real-time ECAPA biometrics & ASR
    - Broadcasts real-time active speaker events with unique color highlights
    - Relays in-call chat, hand raises, and participant state updates
    """
    await websocket.accept()
    room = room_manager.get_or_create_room(room_id)
    participant = await room.add_participant(peer_id, user_name, websocket)

    try:
        while True:
            message = await websocket.receive()

            # Binary audio stream from participant's microphone
            if "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                await room.handle_audio_slice(peer_id, raw_bytes)

            # JSON signaling or room control messages
            elif "text" in message and message["text"]:
                import json
                try:
                    data = json.loads(message["text"])
                    msg_type = data.get("type", "")

                    if msg_type == "WEBRTC_SIGNAL":
                        # Relay WebRTC signal to target peer
                        target_peer_id = data.get("to_peer_id")
                        target_part = room.participants.get(target_peer_id)
                        if target_part:
                            await target_part.ws.send_json({
                                "type": "WEBRTC_SIGNAL",
                                "from_peer_id": peer_id,
                                "signal": data.get("signal")
                            })

                    elif msg_type == "TOGGLE_MIC":
                        participant.is_muted = data.get("is_muted", False)
                        await room.broadcast({
                            "type": "PARTICIPANT_UPDATE",
                            "peer_id": peer_id,
                            "updates": {"is_muted": participant.is_muted}
                        })

                    elif msg_type == "TOGGLE_CAM":
                        participant.is_camera_off = data.get("is_camera_off", False)
                        await room.broadcast({
                            "type": "PARTICIPANT_UPDATE",
                            "peer_id": peer_id,
                            "updates": {"is_camera_off": participant.is_camera_off}
                        })

                    elif msg_type == "TOGGLE_HAND":
                        participant.is_hand_raised = data.get("is_hand_raised", False)
                        await room.broadcast({
                            "type": "PARTICIPANT_UPDATE",
                            "peer_id": peer_id,
                            "updates": {"is_hand_raised": participant.is_hand_raised}
                        })

                    elif msg_type == "TOGGLE_SCREEN":
                        participant.is_screen_sharing = data.get("is_screen_sharing", False)
                        await room.broadcast({
                            "type": "PARTICIPANT_UPDATE",
                            "peer_id": peer_id,
                            "updates": {"is_screen_sharing": participant.is_screen_sharing}
                        })

                    elif msg_type == "CHAT_MESSAGE":
                        chat_entry = {
                            "id": f"msg_{int(datetime.datetime.now().timestamp()*1000)}",
                            "peer_id": peer_id,
                            "user_name": participant.user_name,
                            "text": data.get("text", "").strip(),
                            "timestamp": datetime.datetime.now().strftime("%H:%M")
                        }
                        room.chat_messages.append(chat_entry)
                        await room.broadcast({
                            "type": "CHAT_MESSAGE",
                            "message": chat_entry
                        })

                    elif msg_type == "SIMULATE_SPEECH":
                        # Injects a spoken utterance from any participant for testing
                        speaker_name = data.get("speaker", participant.user_name)
                        spoken_text = data.get("text", "I agree with this proposal, let's proceed.")
                        now_str = datetime.datetime.now().strftime("%H:%M:%S")
                        chunk = {
                            "id": f"chunk_{int(datetime.datetime.now().timestamp() * 1000)}",
                            "type": "TRANSCRIPT_CHUNK",
                            "speaker": speaker_name,
                            "peer_id": data.get("peer_id", peer_id),
                            "user_name": speaker_name,
                            "confidence": 94,
                            "text": spoken_text,
                            "timestamp": now_str,
                            "is_continuity": False,
                            "speaker_color": participant.color_style
                        }
                        room.transcript_history.append(chunk)
                        await room.broadcast({
                            "type": "TRANSCRIPT_CHUNK",
                            "chunk": chunk,
                            "active_speaker": {
                                "peer_id": data.get("peer_id", peer_id),
                                "user_name": speaker_name,
                                "speaker": speaker_name,
                                "color": participant.color_style,
                                "confidence": 94
                            }
                        })

                except Exception as ex:
                    logger.debug(f"Error handling room text message from {peer_id}: {ex}")

    except WebSocketDisconnect:
        await room.remove_participant(peer_id)
    except Exception as e:
        logger.error(f"Room WebSocket exception {peer_id}: {e}")
        await room.remove_participant(peer_id)


@app.websocket("/ws/meeting")
async def meeting_websocket_endpoint(websocket: WebSocket):
    """
    Bi-directional WebSocket Gateway:
    - Ingests binary audio slices (every 3.0-3.5s) from browser MediaRecorder / Web Audio API.
    - Decodes to 16kHz float32.
    - Runs ECAPA-TDNN dual-threshold speaker identification.
    - Runs Faster-Whisper ASR with VAD.
    - Emits real-time JSON transcript chunks with speaker identity, confidence, and timestamp.
    """
    await websocket.accept()
    client_host = websocket.client.host if websocket.client else "unknown"
    logger.info(f"[+] WebSocket client connected: {client_host}")

    last_active_speaker = "Guest"
    rolling_audio_buffer = []
    chunk_samples_target = int(settings.SAMPLE_RATE * settings.CHUNK_DURATION)

    try:
        while True:
            # Receive either binary audio slice or text command
            message = await websocket.receive()
            
            if "bytes" in message and message["bytes"]:
                raw_bytes = message["bytes"]
                
                # Decode audio bytes (handles WebM/Opus, WAV, OGG, PCM)
                audio_array = decode_audio_bytes_to_mono_16k(raw_bytes)
                if len(audio_array) == 0:
                    logger.debug(f"[WS] Failed to decode incoming audio chunk ({len(raw_bytes)} bytes)")
                    continue

                rolling_audio_buffer.extend(audio_array.tolist())

                # Process when buffer reaches target conversational window (or when slice is >= 2.0s)
                if len(rolling_audio_buffer) >= chunk_samples_target:
                    process_slice = np.array(rolling_audio_buffer[:chunk_samples_target], dtype=np.float32)
                    rolling_audio_buffer = rolling_audio_buffer[chunk_samples_target:]
                elif len(audio_array) >= int(settings.SAMPLE_RATE * 2.0):
                    process_slice = audio_array
                    rolling_audio_buffer.clear()
                else:
                    # Buffer still accumulating
                    continue

                # 1. Silence Gate via RMS
                rms = float(np.sqrt(np.mean(process_slice ** 2)))
                logger.info(f"[WS Audio] Processing slice: {len(process_slice)} samples ({len(process_slice)/settings.SAMPLE_RATE:.2f}s, RMS={rms:.5f})")
                if rms < 0.00005:
                    logger.debug(f"[WS Audio] Skipped dead silence (RMS {rms:.5f} < 0.00005)")
                    continue

                # 2. Speaker Biometric Identification (Dual-Threshold Inertia)
                speaker_name, confidence, is_continuity = biometrics_engine.identify_speaker(
                    process_slice,
                    last_active_speaker=last_active_speaker
                )

                # 3. Transcribe speech using Faster-Whisper
                text = asr_engine.transcribe_chunk(process_slice)

                if text:
                    # Update active speaker state if solid match
                    if speaker_name not in ("Guest", "Unknown Guest") or is_continuity:
                        last_active_speaker = speaker_name
                    elif confidence < 20:
                        last_active_speaker = "Guest"

                    now_str = datetime.datetime.now().strftime("%H:%M:%S")

                    payload = {
                        "type": "TRANSCRIPT_CHUNK",
                        "speaker": speaker_name,
                        "confidence": confidence,
                        "text": text,
                        "timestamp": now_str,
                        "is_continuity": is_continuity
                    }
                    
                    logger.info(f"[{speaker_name} ({confidence}%)]: {text}")
                    await websocket.send_json(payload)

            elif "text" in message and message["text"]:
                text_cmd = message["text"]
                logger.debug(f"Received WebSocket control text: {text_cmd}")
                if "ping" in text_cmd.lower():
                    await websocket.send_json({"type": "PONG", "timestamp": datetime.datetime.now().isoformat()})
                elif "reset" in text_cmd.lower():
                    last_active_speaker = "Guest"
                    rolling_audio_buffer.clear()
                    await websocket.send_json({"type": "RESET_ACK"})

    except WebSocketDisconnect:
        logger.info(f"[-] WebSocket client disconnected: {client_host}")
    except Exception as e:
        if "disconnect" in str(e).lower():
            logger.info(f"[-] WebSocket client disconnected: {client_host}")
        else:
            logger.error(f"[!] WebSocket error: {e}", exc_info=True)
        try:
            await websocket.close()
        except Exception:
            pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=False
    )
