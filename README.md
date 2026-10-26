# VocalSync AI — Enterprise Biometric Meeting Intelligence & Video Conference

![VocalSync AI Kuro Design](https://img.shields.io/badge/UI-Kuro%20Minimalist-black?style=for-the-badge)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![PyTorch](https://img.shields.io/badge/PyTorch-2.4+-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white)
![SpeechBrain](https://img.shields.io/badge/SpeechBrain-ECAPA--TDNN-blue?style=for-the-badge)
![Faster-Whisper](https://img.shields.io/badge/ASR-Faster--Whisper-412991?style=for-the-badge)
![Google Gemini](https://img.shields.io/badge/LLM-Google%20Gemini-8E75C2?style=for-the-badge)
![React](https://img.shields.io/badge/Frontend-React%20%7C%20Vite-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![Docker](https://img.shields.io/badge/Deploy-Docker%20Compose-2496ED?style=for-the-badge&logo=docker&logoColor=white)

---

## 📌 Table of Contents
1. [Overview](#-overview)
2. [Key Capabilities & Architecture](#-key-capabilities--architecture)
3. [Project Directory Structure](#-project-directory-structure)
4. [File-by-File Breakdown](#-file-by-file-breakdown)
5. [Local Development Setup](#-local-development-setup)
6. [Production Deployment Guide](#-production-deployment-guide)
   - [Method 1: Docker Compose (Recommended)](#method-1-docker-compose-fastest--recommended)
   - [Method 2: Cloud Virtual Machine (AWS / DigitalOcean / GCP with SSL)](#method-2-cloud-virtual-machine-aws--digitalocean--gcp-with-nginx--ssl)
   - [Method 3: Cloud PaaS (Vercel + Render)](#method-3-cloud-paas-frontend-on-vercel--backend-on-render)
7. [WebSocket & API Specification](#-websocket--api-specification)
8. [Troubleshooting & Common Questions](#-troubleshooting--common-questions)

---

## 🌟 Overview

**VocalSync AI** is an enterprise-grade biometric meeting intelligence and video conferencing platform. It solves the critical problem of multi-speaker diarization and meeting documentation by combining:
- **SpeechBrain ECAPA-TDNN (192-dimensional acoustic embeddings)** to identify *who* is speaking with cosine similarity centroids.
- **Faster-Whisper (CUDA / VAD)** to transcribe *what* is being said with sub-second latency.
- **Google Gemini 2.5 Flash / 1.5** to summarize *why* it matters into structured executive debriefs and Microsoft Word (`.docx`) reports.
- **Multi-party Google Meet-style Video Conferencing** supporting up to 20+ live attendees with active speaker glowing borders, screen sharing, hand raising, and in-call chat.
- **Kuro Minimalist Design Language**: High-contrast dark borders, crisp white canvas, solid black action blocks, and clean typographic micro-labels.

---

## 🏗️ Key Capabilities & Architecture

```
[ Microphone / Webcam / Screen ]
               │
               ▼
   [ React (Vite) + WebRTC ]
   ├── Biometric Studio Mode (Audio streaming & debrief)
   └── Video Meeting Mode (Google Meet grid up to 20+ peers)
               │
      WebSocket Streams (Audio Slices + Signaling)
               │
               ▼
       [ FastAPI Gateway ]
         ├── SpeechBrain (ECAPA-TDNN 192-D Embedding Extraction)
         ├── Cosine Distance Centroid Matcher (Enrolled Voiceprints)
         ├── Faster-Whisper (CTranslate2 CUDA / VAD Transcription)
         ├── Google Gemini LLM (Intent Analysis & Decision Matrix)
         └── python-docx (Executive Word Document Generation)
```

1. **Acoustic Centroid Registration**: 3-prompt voice calibration registering prosody, query inflection, and numeric articulation into 192-D normalized vector fingerprints stored in `backend/voice_profiles/`.
2. **Streaming Continuous Diarization**: Slices incoming PCM/WebM audio into 3-second analysis chunks, computing cosine similarity against enrolled speaker centroids with inertia smoothing to maintain conversational continuity.
3. **Adaptive Video Grid**: Dynamically tiles webcam feeds for 1 to 20+ attendees, highlighting the currently verified active speaker with a colored glowing border and mini equalizer bars.
4. **Instant Executive Intelligence**: One-click generation of meeting objectives, synthesis, speaker intent attribution matrix, key decisions, and downloadable DOCX report.

---

## 📂 Project Directory Structure

```text
NLP_Meeting_recording/
│
├── .env                              # Active environment configuration (API keys, ports)
├── .env.example                      # Reference template for production deployment
├── docker-compose.yml                # Multi-container orchestration (Backend + Frontend)
├── README.md                         # Project documentation and deployment guide
│
├── backend/                          # FastAPI Python Server
│   ├── Dockerfile.backend            # Production Docker image with FFmpeg & audio libs
│   ├── requirements.txt              # Pinned Python package dependencies
│   ├── .env.example                  # Backend-specific environment reference
│   ├── voice_profiles/               # Persistent storage for registered speaker centroids (.pt)
│   │   ├── Mohit.pt
│   │   ├── Vishesh.pt
│   │   ├── Sachin.pt
│   │   ├── Hardeep.pt
│   │   └── ...
│   └── app/
│       ├── __init__.py
│       ├── main.py                   # FastAPI application, REST endpoints & WebSockets
│       ├── config.py                 # Pydantic BaseSettings loading environment variables
│       ├── core/
│       │   ├── biometrics.py         # SpeechBrain ECAPA-TDNN & cosine centroid identification
│       │   ├── asr.py                # Faster-Whisper CUDA / Silero VAD transcription engine
│       │   └── nlp_summarizer.py     # Google Gemini strategic debrief & intent analysis
│       ├── services/
│       │   ├── docx_generator.py     # Microsoft Word (.docx) executive report builder
│       │   └── enrollment.py         # 3-prompt acoustic calibration & centroid persistence
│       └── schemas/
│           └── meeting.py            # Pydantic models for REST/WebSocket payloads
│
└── frontend/                         # Vite + React Client Application
    ├── package.json                  # NPM scripts & dependencies (Lucide, Tailwind, Vite)
    ├── vite.config.js                # Vite development and bundle configuration
    ├── tailwind.config.js            # TailwindCSS utility and theme extensions
    ├── postcss.config.js             # PostCSS plugins
    ├── nginx.conf                    # Production Nginx SPA routing & asset caching
    ├── Dockerfile.frontend           # Multi-stage production Docker build (Node + Nginx)
    ├── index.html                    # Root HTML document
    └── src/
        ├── main.jsx                  # Application entry point
        ├── App.jsx                   # Multipage route controller (Studio vs Video Meeting)
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
| [backend/app/main.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/main.py) | **Central Gateway**: Configures FastAPI, CORS, WebSocket routers (`/ws/meeting` for studio, `/ws/room/{id}/{peer}` for video meetings), REST endpoints (`/health`, `/api/meeting/summarize`, `/api/meeting/export-docx`, `/api/rooms/create`, `/api/enroll`). |
| [backend/app/config.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/config.py) | **Configuration Manager**: Uses Pydantic `BaseSettings` to safely load and validate environment variables (`GEMINI_API_KEY`, `PORT`, `HOST`, `VOICE_PROFILES_DIR`, `ASR_MODEL_SIZE`). |
| [backend/app/core/biometrics.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/core/biometrics.py) | **Biometric Engine**: Loads the pre-trained `speechbrain/spkrec-ecapa-voxceleb` neural model. Computes 192-D L2-normalized embeddings, calculates cosine distance against enrolled speaker centroids, and applies temporal inertia smoothing. |
| [backend/app/core/asr.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/core/asr.py) | **Speech-to-Text Engine**: Wraps `faster-whisper` (CTranslate2) with automatic CUDA DLL injection and Silero VAD voice activity detection. Decodes audio chunks in memory via `av` (PyAV). |
| [backend/app/core/nlp_summarizer.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/core/nlp_summarizer.py) | **AI Debrief Synthesizer**: Calls Google Gemini (`gemini-2.5-flash` with `gemini-1.5-flash` fallback) to extract structured strategic intelligence: executive objective, synthesis, speaker intent attribution matrix, key decisions, and action deliverables. |
| [backend/app/services/docx_generator.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/services/docx_generator.py) | **Executive Document Builder**: Generates styled Microsoft Word documents (`.docx`) complete with document header, metadata block, decisions checklist, and action items table. |
| [backend/app/services/enrollment.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/services/enrollment.py) | **Voice Registration Service**: Processes 3 audio calibration prompts (statement, query, numeric), averages the resulting vectors into a single 192-D centroid, and saves it to disk (`.pt`). |
| [backend/app/schemas/meeting.py](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/app/schemas/meeting.py) | **Data Models**: Pydantic schemas validating client requests and responses (`TranscriptTurn`, `DebriefResponse`, `EnrollmentRequest`, `RoomInfo`). |
| [backend/voice_profiles/](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/voice_profiles) | **Profile Storage**: Directory where enrolled speaker `.pt` tensor centroids are stored persistently. |
| [backend/requirements.txt](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/requirements.txt) | **Python Dependencies**: Pinned package versions including `fastapi`, `uvicorn`, `speechbrain`, `faster-whisper`, `torch`, `google-genai`, and `python-docx`. |
| [backend/Dockerfile.backend](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/backend/Dockerfile.backend) | **Backend Container**: Base Python 3.11-slim image with FFmpeg, libsndfile, PyAV libraries, and Uvicorn runtime. |

---

### Frontend (`frontend/src/`)

| File Path | Description |
| :--- | :--- |
| [frontend/src/main.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/main.jsx) | **Entry Point**: Initializes React DOM root and loads global styles. |
| [frontend/src/App.jsx](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/src/App.jsx) | **Router Controller**: Manages page switching between the Biometric Studio (`studio`) and Video Conference (`meet`). |
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
| [frontend/nginx.conf](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/nginx.conf) | **Nginx Config**: Configures SPA routing (`try_files $uri /index.html`) and static asset caching for production Docker builds. |
| [frontend/Dockerfile.frontend](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/frontend/Dockerfile.frontend) | **Frontend Container**: Multi-stage Dockerfile building the Vite bundle and serving it via Nginx Alpine on port 5173. |

---

## 💻 Local Development Setup

To run VocalSync AI locally from source on Windows, macOS, or Linux:

### 1. Prerequisites
- **Python 3.10 or 3.11** installed.
- **Node.js 18+ or 20+** installed.
- **FFmpeg** installed on your system PATH (required for audio decoding).
- A valid **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).

### 2. Backend Setup
```bash
# 1. Navigate to backend directory
cd backend

# 2. Create and activate a Python virtual environment
python -m venv venv

# Windows PowerShell:
.\venv\Scripts\Activate.ps1
# Linux/macOS:
source venv/bin/activate

# 3. Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# 4. Configure .env file
# Create a .env file inside backend/ (or in project root):
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=8000
HOST=0.0.0.0

# 5. Start the backend development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend will start at: `http://localhost:8000` (API documentation at `http://localhost:8000/docs`).

### 3. Frontend Setup
In a new terminal:
```bash
# 1. Navigate to frontend directory
cd frontend

# 2. Install Node dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
The frontend will start at: `http://localhost:5173`. Open this URL in Chrome, Edge, or Firefox.

---

## 🚀 Production Deployment Guide

### Method 1: Docker Compose (Fastest & Recommended)

This runs both the backend and frontend in isolated, production-grade Docker containers with a single command.

#### Step 1: Configure Environment
Edit the [.env](file:///c:/Users/ACER/Desktop/NLP_Meeting_recording/.env) file in the root directory:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
PORT=8000
HOST=0.0.0.0
```

#### Step 2: Build & Start Containers
```bash
# From the project root directory:
docker compose up --build -d
```

#### Step 3: Verify Running Services
```bash
docker compose ps
```
- **Web Interface:** `http://localhost:5173`
- **Backend API:** `http://localhost:8000`
- **Persistent Profiles:** Stored in `./backend/voice_profiles` on the host, so registered voices are never lost when containers restart.

To stop the containers:
```bash
docker compose down
```

---

### Method 2: Cloud Virtual Machine (AWS / DigitalOcean / GCP with Nginx & SSL)

Use this method to host VocalSync AI on an Ubuntu 22.04 or 24.04 cloud VM with your own domain name and free SSL certificates (mandatory for remote microphone/camera access).

#### Step 1: Provision Cloud Server
- Recommended specs: 4 vCPU, 8 GB RAM (e.g., AWS `c6i.xlarge` or DigitalOcean Droplet).
- Open firewall ports: `22` (SSH), `80` (HTTP), `443` (HTTPS).

#### Step 2: Install System Packages & Docker
```bash
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y git curl ffmpeg libsndfile1 nginx certbot python3-certbot-nginx

# Install Docker Engine
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
```

#### Step 3: Clone Code & Configure `.env`
```bash
git clone <your-repo-url> /opt/vocalsync
cd /opt/vocalsync

cp .env.example .env
nano .env
```
Set your domain variables:
```env
GEMINI_API_KEY=your_gemini_key_here
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com/ws/meeting
```

#### Step 4: Launch Docker Containers
```bash
docker compose up --build -d
```

#### Step 5: Configure Nginx Reverse Proxy with WebSocket Support
Create `/etc/nginx/sites-available/vocalsync`:
```nginx
# 1. FRONTEND APP
server {
    server_name meet.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# 2. BACKEND API & WEBSOCKETS
server {
    server_name api.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

Enable the configuration and issue SSL:
```bash
sudo ln -s /etc/nginx/sites-available/vocalsync /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue free Let's Encrypt SSL certificates:
sudo certbot --nginx -d meet.yourdomain.com -d api.yourdomain.com
```

Now access `https://meet.yourdomain.com`. The browser will grant full webcam and microphone access with secure WebSockets (`wss://`).

---

### Method 3: Cloud PaaS (Frontend on Vercel + Backend on Render)

#### A. Backend on Render.com (Docker Web Service)
1. Fork or push this repository to GitHub.
2. Sign in to [Render.com](https://render.com) and click **New +** -> **Web Service**.
3. Select your repository:
   - **Runtime:** `Docker`
   - **Docker Context Path:** `./backend`
   - **Dockerfile Path:** `Dockerfile.backend`
   - **Instance Type:** Standard (at least 2GB RAM)
4. Add **Environment Variables**:
   - `GEMINI_API_KEY`: `<your_api_key>`
   - `PORT`: `8000`
5. Add a **Persistent Disk**:
   - Mount Path: `/app/voice_profiles` (1 GB)
6. Click **Create Web Service**. Render will give you a URL like: `https://vocalsync-api.onrender.com`.

#### B. Frontend on Vercel
1. Sign in to [Vercel](https://vercel.com) and click **Add New** -> **Project**.
2. Select your repository.
3. Configure the build settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** `Vite`
4. In **Environment Variables**, add:
   - `VITE_API_BASE_URL` = `https://vocalsync-api.onrender.com`
   - `VITE_WS_URL` = `wss://vocalsync-api.onrender.com/ws/meeting`
5. Click **Deploy**. Vercel will build and host the app with free global CDN and SSL.

---

## 📡 WebSocket & API Specification

### REST Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check returning device status (`cuda` or `cpu`) and enrolled voiceprints. |
| `POST` | `/api/enroll` | Multipart upload registering 3 voice sample WAVs for a participant name. |
| `GET` | `/api/speakers` | Returns list of all active registered speaker profiles. |
| `POST` | `/api/rooms/create` | Generates a new meeting room code (e.g. `vcl-842-mpt`). |
| `GET` | `/api/rooms/{id}` | Checks if a meeting room exists and returns attendee metadata. |
| `POST` | `/api/meeting/summarize` | Sends transcript turns to Google Gemini and returns the executive debrief. |
| `POST` | `/api/meeting/export-docx` | Generates and downloads the executive report as a styled `.docx` file. |

### WebSocket Streams

- **Studio Stream**: `ws://<host>:8000/ws/meeting`
  - *Client sends:* Raw binary audio slices (PCM / WebM blobs every 3 seconds).
  - *Server sends:* JSON turn events:
    ```json
    {
      "type": "transcript_turn",
      "speaker": "Mohit",
      "confidence": 88,
      "text": "Let's review the architectural deliverables.",
      "timestamp": "21:30:15"
    }
    ```
- **Video Call Signaling & Diarization**: `ws://<host>:8000/ws/room/{room_id}/{peer_id}`
  - Broadcasts peer join/leave events, active speaker status, WebRTC SDP signaling, in-call chat, and live transcript history across all attendees.

---

## ❓ Troubleshooting & Common Questions

#### 1. Microphone or camera permission is blocked in the browser.
- Modern browsers only permit microphone and camera on `localhost` or via `https://`.
- If testing across your local network (e.g. `http://192.168.x.x`), Chrome blocks media access. To bypass this for local IP testing, open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`, add your local IP URL, and relaunch Chrome. For production, always use an SSL certificate (`https://`).

#### 2. How do I verify if my GPU is being used?
- Make a `GET` request to `http://localhost:8000/health`.
- If PyTorch and CUDA are detected, the response will show:
  ```json
  "hardware": { "device": "cuda", "device_name": "NVIDIA GeForce RTX ...", "cuda_available": true }
  ```
- If running on a machine without a dedicated GPU, VocalSync AI automatically falls back to CPU mode seamlessly.

#### 3. Where are enrolled voiceprints saved?
- Voiceprints are saved as PyTorch embedding vectors (`.pt`) in `backend/voice_profiles/`. When deploying with Docker, this folder is mounted as a persistent volume, ensuring profiles persist across rebuilds.

---

## 📄 License
This project is proprietary software developed for multi-speaker enterprise meeting intelligence and biometric video conferencing.
