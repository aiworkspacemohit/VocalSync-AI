#!/usr/bin/env bash
# ==============================================================================
# VocalSync AI — Production Deployment Script for Linux Cloud VMs (Ubuntu/Debian)
# ==============================================================================
set -e

echo "=========================================================="
echo "  VocalSync AI — Automated Production Deployment Setup   "
echo "=========================================================="

# Check root or sudo
if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root or with sudo: sudo bash deploy.sh"
  exit 1
fi

echo "[1/5] Updating system and installing base dependencies..."
apt-get update && apt-get upgrade -y
apt-get install -y git curl ffmpeg libsndfile1 nginx certbot python3-certbot-nginx

echo "[2/5] Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    echo "[*] Installing Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    rm -f get-docker.sh
else
    echo "[+] Docker is already installed."
fi

# Ensure docker compose plugin is available
if ! docker compose version &> /dev/null; then
    apt-get install -y docker-compose-plugin
fi

echo "[3/5] Verifying environment files..."
if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        echo "[!] Created .env from .env.example. Please update your GEMINI_API_KEY in .env!"
    else
        touch .env
    fi
fi

# Ensure voice_profiles directory exists
mkdir -p backend/voice_profiles

echo "[4/5] Building and starting VocalSync AI containers..."
# Check if NVIDIA GPU and nvidia-container-toolkit are present
if command -v nvidia-smi &> /dev/null && docker info 2>/dev/null | grep -i nvidia &> /dev/null; then
    echo "[+] NVIDIA GPU detected with container toolkit! Launching with GPU acceleration..."
    docker compose -f docker-compose.yml -f docker-compose.gpu.yml up --build -d
else
    echo "[*] Launching standard containers (CPU mode)..."
    docker compose up --build -d
fi

echo "[5/5] Checking container status..."
docker compose ps

echo "=========================================================="
echo "  VocalSync AI is now running!"
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo "  Health:   http://localhost:8000/health"
echo "=========================================================="
