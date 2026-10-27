# VocalSync AI — Enterprise Biometric Meeting Intelligence & Video Conference

![VocalSync AI Kuro Design](https://img.shields.io/badge/UI-Kuro%20Minimalist-black?style=for-the-badge)
![Vercel](https://img.shields.io/badge/Frontend-Vercel-black?style=for-the-badge&logo=vercel&logoColor=white)
![Cloudflare](https://img.shields.io/badge/Backend-Cloudflare%20Tunnel-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-2.5+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![SpeechBrain](https://img.shields.io/badge/SpeechBrain-ECAPA--TDNN-blue?style=for-the-badge)
![Faster-Whisper](https://img.shields.io/badge/ASR-Faster--Whisper-412991?style=for-the-badge)
![Google Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-8E75C2?style=for-the-badge)
![React](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)

---

## 📌 Table of Contents
1. [Overview](#-overview)
2. [Key Capabilities & Architecture](#-key-capabilities--architecture)
3. [Live Production Deployment](#-live-production-deployment)
4. [Project Directory Structure](#-project-directory-structure)
5. [File-by-File Breakdown](#-file-by-file-breakdown)
6. [Local Development Setup](#-local-development-setup)
7. [Cloudflare Tunnel & Vercel Deployment Guide](#-cloudflare-tunnel--vercel-deployment-guide)
   - [Part 1: Running the Backend on Cloudflare Tunnel](#part-1-running-the-backend-on-cloudflare-tunnel)
   - [Part 2: Connecting to Vercel Frontend](#part-2-connecting-to-vercel-frontend)
   - [Part 3: Permanent Custom Subdomain (Optional)](#part-3-permanent-custom-subdomain-optional)
8. [WebSocket & API Specification](#-websocket--api-specification)
9. [Troubleshooting & FAQs](#-troubleshooting--faqs)

---

## 🌟 Overview

**VocalSync AI** is an enterprise-grade biometric meeting intelligence and video conferencing platform. It solves the critical problem of real-time multi-speaker diarization and executive documentation by combining:

- **SpeechBrain ECAPA-TDNN (192-dimensional acoustic embeddings)** to identify *who* is speaking with cosine similarity centroids and inertia smoothing.
- **Faster-Whisper (CUDA / Silero VAD)** to transcribe *what* is being said with sub-second streaming latency.
- **Google Gemini 2.5 Flash / 1.5** to summarize *why* it matters into structured executive debriefs, action item matrices, and downloadable Microsoft Word (`.docx`) reports.
- **Multi-party Google Meet-style Video Conferencing** supporting up to 20+ live attendees with active speaker glowing borders, screen sharing, hand raising, and in-call chat.
- **Kuro Minimalist Design Language**: High-contrast dark borders, crisp white canvas, solid black action blocks, and clean typographic micro-labels.

---

## 🏗️ Key Capabilities & Architecture

```
[ Microphone / Webcam / Screen ]
               │
               ▼
   [ React (Vite) on Vercel ]
   ├── Biometric Studio Mode (Audio streaming & debrief)
   └── Video Meeting Mode (Google Meet grid up to 20+ peers)
               │
      HTTPS / WSS Streams (via Cloudflare Edge)
               │
               ▼
   [ Cloudflare Zero Trust Tunnel ]
               │
               ▼
       [ FastAPI Backend ]
         ├── SpeechBrain (ECAPA-TDNN 192-D Embedding Extraction)
         ├── Cosine Distance Centroid Matcher (Enrolled Voiceprints)
         ├── Faster-Whisper (CTranslate2 CUDA / VAD Transcription)
         ├── Google Gemini LLM (Intent Analysis & Decision Matrix)
         └── python-docx (Executive Word Document Generation)
```

1. **Acoustic Centroid Registration**: 3-prompt voice calibration registering prosody, query inflection, and numeric articulation into 192-D normalized vector fingerprints stored in `backend/voice_profiles/*.npy`.
2. **Streaming Continuous Diarization**: Slices incoming PCM/WebM audio into 3-second analysis chunks, computing cosine similarity against enrolled speaker centroids with temporal inertia to maintain conversational continuity.
3. **Adaptive Video Grid**: Dynamically arranges webcam feeds for 1 to 20+ attendees, highlighting the verified active speaker with a colored glowing border and mini equalizer bars.
4. **Instant Executive Intelligence**: One-click generation of meeting objectives, synthesis, speaker intent attribution matrix, key decisions checklist, and downloadable DOCX report.

---

## 🚀 Live Production Deployment

- **Production Frontend**: [https://vocal-sync-ai.vercel.app/](https://vocal-sync-ai.vercel.app/) (Deployed on Vercel)
- **Backend Gateway**: Exposed securely via **Cloudflare Tunnel** (`cloudflared`) with zero port forwarding, automatic SSL (`https://` and `wss://`), and DDoS protection.

---

## 📂 Project Directory Structure

```text
NLP_Meeting_recording/
│
├── .env                              # Root environment configuration (API keys, ports)
├── .env.example                      # Template for environment configuration
├── .gitignore                        # Git ignore rules (virtualenvs, node_modules, binaries)
├── README.md                         # Documentation and deployment manual
├── cloudflared.exe                   # Cloudflare Tunnel client binary for Windows
├── run_local.bat                     # One-click local development launcher (Backend + Frontend)
├── start_backend_tunnel.bat          # One-click Cloudflare Tunnel launcher for port 8000
│
├── backend/                          # FastAPI Python Server
│   ├── requirements.txt              # Pinned Python package dependencies
│   ├── __init__.py
│   ├── voice_profiles/               # Persistent biometric speaker centroids (.npy)
│   │   ├── ayush_yadav.npy
│   │   ├── hardeep.npy
│   │   ├── mohit.npy
│   │   ├── rahul.npy
│   │   ├── sachin.npy
│   │   ├── stanlee.npy
│   │   └── vishesh.npy
│   └── app/
│       ├── __init__.py
│       ├── main.py                   # FastAPI application, CORS, REST & WebSockets
│       ├── config.py                 # Pydantic Settings loading environment variables
│       ├── core/
│       │   ├── biometrics.py         # SpeechBrain ECAPA-TDNN & cosine centroid identification
│       │   ├── asr.py                # Faster-Whisper CUDA / Silero VAD transcription engine
│       │   ├── nlp_summarizer.py     # Google Gemini strategic debrief & intent analysis
│       │   └── room_manager.py       # Multi-room WebRTC signaling & attendee state manager
│       ├── services/
│       │   ├── docx_generator.py     # Microsoft Word (.docx) executive report builder
│       │   └── enrollment.py         # 3-prompt acoustic calibration & centroid persistence
│       └── schemas/
│           └── meeting.py            # Pydantic models for REST/WebSocket payloads
│
└── frontend/                         # Vite + React Client Application (Deployed on Vercel)
    ├── package.json                  # NPM scripts & dependencies (Lucide, Tailwind, Vite)
    ├── package-lock.json             # Pinned package lock
    ├── vite.config.js                # Vite development and proxy configuration
    ├── tailwind.config.js            # TailwindCSS utility and theme extensions
    ├── postcss.config.js             # PostCSS plugins
    ├── vercel.json                   # Vercel SPA routing and rewrite rules
    ├── index.html                    # Root HTML document
    └── src/
        ├── main.jsx                  # Application entry point
        ├── App.jsx                   # Multipage route controller (Studio vs Video Meeting)
        ├── config/
        │   └── api.js                # Centralized API & WebSocket URL resolution gateway
        ├── styles/
        │   └── globals.css           # Kuro design system tokens, dark borders & scrollbar
        ├── hooks/
        │   ├── useMeetingSocket.js   # WebSocket stream controller for Biometric Studio
        │   ├── useAudioRecorder.js   # MediaRecorder & Web Audio API audio slicer
        │   └── useVideoCall.js       # Video conference room, WebRTC, chat & 20-peer simulator
        ├── pages/
        │   ├── BiometricStudio.jsx   # Studio dashboard (streaming transcript + debrief viewer)
        │   └── VideoMeeting.jsx      # Video conferencing page (lobby + 20-peer grid + dock)
        └── components/
            ├── AudioVisualizer.jsx   # Waveform equalizer bar & sensor standby card
            ├── LiveTranscriptFeed.jsx# Real-time biometric transcript feed with speaker dots
            ├── MeetingControls.jsx   # Bottom studio dock (Hardware info, Voiceprints, Start/End)
            ├── ReportViewer.jsx      # Executive debrief viewer (Summary, Intents, Decisions, DOCX)
            ├── EnrollmentModal.jsx   # 3-prompt voiceprint registration modal
            └── video/
                ├── LobbyScreen.jsx       # Google Meet-style pre-call camera preview & name entry
                ├── VideoGrid.jsx         # Responsive video grid (1 to 20+ attendees, screen share)
                ├── VideoCard.jsx         # Individual attendee card with active speaker glowing border
                ├── MeetingBottomBar.jsx  # Google Meet bottom dock (Mic, Cam, Hand, Share, End)
                └── MeetingSideDrawer.jsx # Tabbed side drawer (Transcript, People, Chat, Debrief)
```

---

## 🔍 File-by-File Breakdown

### Backend (`backend/`)

| File Path | Description |
| :--- | :--- |
| [backend/app/main.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/main.py) | **Central Gateway**: Configures FastAPI, CORS for Vercel, WebSocket routers (`/ws/meeting` for studio, `/ws/room/{id}/{peer}` for video meetings), and REST endpoints (`/health`, `/api/meeting/summarize`, `/api/meeting/export-docx`, `/api/rooms/create`, `/api/enroll`). |
| [backend/app/config.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/config.py) | **Configuration Manager**: Uses Pydantic `BaseSettings` to load environment variables (`GEMINI_API_KEY`, `PORT`, `HOST`, `VOICE_PROFILES_DIR`, `ASR_MODEL_SIZE`) from `.env`. |
| [backend/app/core/biometrics.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/core/biometrics.py) | **Biometric Engine**: Loads the pre-trained `speechbrain/spkrec-ecapa-voxceleb` model. Computes 192-D L2-normalized embeddings, calculates cosine distance against enrolled speaker centroids, and applies dual-threshold temporal inertia. |
| [backend/app/core/asr.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/core/asr.py) | **Speech-to-Text Engine**: Wraps `faster-whisper` (CTranslate2) with automatic CUDA acceleration and Silero VAD voice activity detection. Decodes audio chunks in memory via `av` (PyAV). |
| [backend/app/core/nlp_summarizer.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/core/nlp_summarizer.py) | **AI Debrief Synthesizer**: Queries Google Gemini (`gemini-2.5-flash` with `gemini-1.5-flash` fallback) to extract structured strategic intelligence: executive objective, synthesis, speaker intent matrix, key decisions, and deliverables. |
| [backend/app/core/room_manager.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/core/room_manager.py) | **Room Manager**: Manages multi-party video call sessions, WebRTC signaling relay, participant state (mic, camera, hand raise, screen share), and audio slicing per peer. |
| [backend/app/services/docx_generator.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/services/docx_generator.py) | **Executive Document Builder**: Generates styled Microsoft Word documents (`.docx`) complete with document header, metadata block, decisions checklist, and action items table. |
| [backend/app/services/enrollment.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/services/enrollment.py) | **Voice Registration Service**: Processes 3 audio calibration prompts (statement, query, numeric), averages the vectors into a single 192-D centroid, and saves it to disk (`.npy`). |
| [backend/app/schemas/meeting.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/schemas/meeting.py) | **Data Models**: Pydantic schemas validating client requests and responses (`TranscriptChunk`, `MeetingDebrief`, `EnrollmentResponse`, `SpeakerProfileList`). |
| [backend/voice_profiles/](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/voice_profiles) | **Profile Storage**: Directory where enrolled speaker `.npy` centroid embeddings are persistently stored. |
| [backend/requirements.txt](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/requirements.txt) | **Python Dependencies**: Pinned package versions including `fastapi`, `uvicorn`, `speechbrain`, `faster-whisper`, `torch`, `torchaudio`, `google-genai`, and `python-docx`. |

---

### Frontend (`frontend/src/`)

| File Path | Description |
| :--- | :--- |
| [frontend/src/main.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/main.jsx) | **Entry Point**: Initializes React DOM root and loads global styles. |
| [frontend/src/App.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/App.jsx) | **Router Controller**: Manages page switching between the Biometric Studio (`studio`) and Video Conference (`meet`). |
| [frontend/src/config/api.js](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/config/api.js) | **Gateway Config**: Centralized resolver for REST API and WebSocket URLs across localhost, Cloudflare tunnels, and Vercel. Handles automatic trailing slash stripping and WebSockets root preservation. |
| [frontend/src/styles/globals.css](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/styles/globals.css) | **Design System**: Defines Tailwind utilities, custom scrollbars, and Kuro tokens with dark visible borders (`border-zinc-800`, `border-zinc-700`). |
| [frontend/src/pages/BiometricStudio.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/pages/BiometricStudio.jsx) | **Biometric Studio Page**: Displays the live streaming audio visualizer, real-time transcript stream, enrolled profiles roster, and executive report viewer. |
| [frontend/src/pages/VideoMeeting.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/pages/VideoMeeting.jsx) | **Video Meeting Page**: Coordinates the pre-join lobby screen, in-call responsive 20-attendee grid, Google Meet bottom bar, and tabbed side drawer. |
| [frontend/src/hooks/useMeetingSocket.js](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/hooks/useMeetingSocket.js) | **Studio WebSocket Hook**: Sends raw audio chunks to `/ws/meeting` and receives live transcribed turns with speaker attribution and confidence scores. |
| [frontend/src/hooks/useAudioRecorder.js](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/hooks/useAudioRecorder.js) | **Audio Recorder Hook**: Uses browser `MediaRecorder` to capture microphone audio and emit 3.0-second slices while calculating real-time RMS audio energy. |
| [frontend/src/hooks/useVideoCall.js](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/hooks/useVideoCall.js) | **Video Call Hook**: Manages WebSocket room signaling, participant roster, mute/camera state, screen sharing streams, chat messaging, and simulated 20-person attendees. |
| [frontend/src/components/AudioVisualizer.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/AudioVisualizer.jsx) | **Waveform Component**: Renders dynamic animated equalizer bars based on audio energy with biometric sensor state badges. |
| [frontend/src/components/LiveTranscriptFeed.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/LiveTranscriptFeed.jsx) | **Transcript Feed**: Displays real-time spoken utterances with unique colored speaker dots, confidence verification pills, timestamps, and auto-scroll. |
| [frontend/src/components/MeetingControls.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/MeetingControls.jsx) | **Studio Dock**: Bottom control dock showing GPU/CUDA acceleration badges, voiceprint count, and session start/pause/debrief buttons. |
| [frontend/src/components/ReportViewer.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/ReportViewer.jsx) | **Debrief Viewer**: Multi-tab view for Executive Brief, Speaker Intent Matrix, Key Decisions Checklist, and one-click DOCX download. |
| [frontend/src/components/EnrollmentModal.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/EnrollmentModal.jsx) | **Voice Calibration Modal**: Interactive 3-step modal capturing speech samples to register new speaker centroids with the server. |
| [frontend/src/components/video/LobbyScreen.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/video/LobbyScreen.jsx) | **Meet Lobby Screen**: Clean 2-column card with live webcam preview, mic/camera toggles, display name field, instant meeting creation, and code entry. |
| [frontend/src/components/video/VideoGrid.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/video/VideoGrid.jsx) | **Responsive Video Grid**: Dynamically arranges participant cards for 1 to 20+ attendees, with side-strip layouts for screen sharing and pinned spotlighting. |
| [frontend/src/components/video/VideoCard.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/video/VideoCard.jsx) | **Video Tile**: Renders video stream (or avatar with colored initial), glowing active speaker border with animated equalizer bars, hand raise badge, and status pill. |
| [frontend/src/components/video/MeetingBottomBar.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/video/MeetingBottomBar.jsx) | **Google Meet Bottom Dock**: Contains controls for mic, camera, screen presentation, hand raising, live captions, end call, and drawer toggles. |
| [frontend/src/components/video/MeetingSideDrawer.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/components/video/MeetingSideDrawer.jsx) | **Side Panel**: Right drawer with segmented tabs for Live Transcript, People (with speech simulation test buttons), In-Call Chat, and Executive AI Debrief. |

---

## 💻 Local Development Setup

To run VocalSync AI locally from source:

### 1. Prerequisites
- **Python 3.10 or 3.11** installed.
- **Node.js 18+ or 20+** installed.
- **FFmpeg** installed on your system PATH (required for audio decoding).
- A valid **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).

### 2. Fast Launch (Windows)
Double-click [run_local.bat](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/run_local.bat) in the project root. It will:
1. Boot the FastAPI backend on `http://localhost:8000`
2. Boot the React Vite frontend on `http://localhost:5173`

### 3. Manual Launch

#### Terminal 1 — Backend
```bash
# 1. Navigate to backend directory
cd backend

# 2. Activate virtual environment
# Windows:
..\venv\Scripts\activate
# Linux/macOS:
source ../venv/bin/activate

# 3. Ensure dependencies are installed
pip install -r requirements.txt

# 4. Start FastAPI server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 2 — Frontend
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install dependencies
npm install

# 3. Start Vite dev server
npm run dev
```
Open `http://localhost:5173` in Chrome or Edge.

---

## 🌐 Cloudflare Tunnel & Vercel Deployment Guide

Because the backend relies on heavy ML runtimes (PyTorch, CTranslate2, SpeechBrain) and long-lived WebSockets, it runs with hardware acceleration while **Cloudflare Tunnel** exposes it globally over encrypted HTTPS & WSS. The React frontend is deployed globally on **Vercel**.

### Part 1: Running the Backend on Cloudflare Tunnel

1. Open PowerShell in the project root:
   ```powershell
   # 1. Launch FastAPI Backend on port 8000
   cd backend
   ..\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
   ```
2. In a second terminal, launch the Cloudflare Tunnel:
   ```powershell
   # 2. Launch Cloudflare Tunnel
   cd c:\Users\ACER\Desktop\NLP_Meeting_recording
   .\cloudflared.exe tunnel --url http://localhost:8000
   ```
   *(Alternatively, just double-click `start_backend_tunnel.bat` to do both in one click).*

3. Cloudflare will output an active public HTTPS tunnel URL ending with `.trycloudflare.com`:
   ```text
   +--------------------------------------------------------------------------------------------+
   |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
   |  https://whispering-ocean-abc123.trycloudflare.com                                         |
   +--------------------------------------------------------------------------------------------+
   ```
4. Test the health endpoint in your browser:
   `https://whispering-ocean-abc123.trycloudflare.com/health`

---

### Part 2: Connecting to Vercel Frontend

1. Go to your **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Select your project **`vocal-sync-ai`** (or import the repo if setting up for the first time).
3. Navigate to **Settings** → **Environment Variables**.
4. Configure the two variables pointing to your Cloudflare Tunnel:

   | Variable Key | Example Value | Description |
   | :--- | :--- | :--- |
   | `VITE_API_BASE_URL` | `https://whispering-ocean-abc123.trycloudflare.com` | Base URL for REST endpoints |
   | `VITE_WS_URL` | `wss://whispering-ocean-abc123.trycloudflare.com/ws/meeting` | Base URL for WebSockets |

5. **Redeploy**:
   - Go to the **Deployments** tab.
   - Click the **`...`** (three dots) next to your latest production deployment.
   - Click **Redeploy**. *(Vite bakes environment variables into the static bundle during build).*
6. Your live frontend at [https://vocal-sync-ai.vercel.app/](https://vocal-sync-ai.vercel.app/) is now securely connected to your backend!

---

### Part 3: Permanent Custom Subdomain (Optional)

If you own a domain connected to Cloudflare (e.g. `yourdomain.com`), you can bind the backend to a permanent subdomain like `https://api.yourdomain.com`:

```powershell
# 1. Login to Cloudflare Zero Trust
.\cloudflared.exe tunnel login

# 2. Create a named tunnel
.\cloudflared.exe tunnel create vocalsync-api

# 3. Route your subdomain DNS
.\cloudflared.exe tunnel route dns vocalsync-api api.yourdomain.com

# 4. Start the tunnel
.\cloudflared.exe tunnel run --url http://localhost:8000 vocalsync-api
```
Set `VITE_API_BASE_URL` in Vercel to `https://api.yourdomain.com` and it will never change across restarts.

---

## 📡 WebSocket & API Specification

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check returning device status (`cuda` or `cpu`) and list of enrolled voiceprints. |
| `GET` | `/api/speakers` | Returns list of all active registered speaker profiles with dimensions. |
| `GET` | `/api/enrollment/prompts` | Returns the 3 structured speech calibration prompts for voice registration. |
| `POST` | `/api/enroll` | Multipart upload registering voice samples for a participant name, creating `{name}.npy`. |
| `POST` | `/api/meeting/summarize` | Sends transcript turns to Google Gemini and returns the structured executive debrief. |
| `POST` | `/api/meeting/export-docx` | Generates and streams the executive report as a styled Microsoft Word `.docx` file. |
| `POST` | `/api/rooms/create` | Generates a new meeting room code (e.g. `vcl-842-mpt`). |
| `GET` | `/api/rooms/{id}` | Checks if a meeting room exists and returns attendee metadata. |
| `GET` | `/api/rooms` | Lists active video call meeting rooms. |

### WebSocket Gateways

- **Biometric Studio Gateway**: `wss://<host>/ws/meeting`
  - *Client sends:* Raw binary audio slices (PCM / WebM audio chunks).
  - *Server sends:* Real-time JSON transcript chunk:
    ```json
    {
      "type": "TRANSCRIPT_CHUNK",
      "speaker": "Mohit",
      "confidence": 94,
      "text": "Let's review the architectural deliverables.",
      "timestamp": "17:35:12",
      "is_continuity": false
    }
    ```
- **Video Call Signaling & Diarization**: `wss://<host>/ws/room/{room_id}/{peer_id}?user_name=Mohit`
  - Handles WebRTC signaling (offers, answers, ICE candidates), live attendee state updates (mic, camera, hand raise, screen share), in-call chat, and real-time active speaker broadcasts.

---

## ❓ Troubleshooting & FAQs

#### 1. Why use Cloudflare Tunnel instead of Cloudflare Workers for the backend?
Cloudflare Workers are lightweight V8/JavaScript serverless isolates with a strict ~128MB RAM limit. They cannot execute native C++ machine learning binaries like PyTorch, SpeechBrain, and Faster-Whisper. Cloudflare Tunnel gives you the best of both worlds: full hardware acceleration on your server/PC with Cloudflare's global edge network, free SSL certificates, DDoS protection, and WebSocket support.

#### 2. Microphone or camera permission is blocked in the browser.
Modern browsers (Chrome, Edge, Safari) strictly require **HTTPS** (or `localhost`) to grant microphone and camera access. When deploying remotely, accessing your app via `https://vocal-sync-ai.vercel.app` and your backend via `https://*.trycloudflare.com` ensures that media permissions work smoothly across all devices.

#### 3. How do I verify if my GPU is being used?
Send a `GET` request to `/health` on your backend. The response will include:
```json
"hardware": {
  "device": "cuda",
  "device_name": "NVIDIA GeForce RTX ...",
  "cuda_available": true
}
```
If no GPU is present, VocalSync AI automatically falls back to multi-threaded CPU mode without breaking.

#### 4. Where are enrolled voiceprints saved?
Voiceprints are saved as 192-dimensional NumPy float32 embedding arrays (`.npy`) inside `backend/voice_profiles/`. They persist permanently on disk and are reloaded automatically into memory whenever the server boots.

---

## 📄 License
This project is proprietary software developed for multi-speaker enterprise meeting intelligence and biometric video conferencing.
