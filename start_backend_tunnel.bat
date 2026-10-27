@echo off
TITLE VocalSync AI - Backend Cloudflare Tunnel
echo ======================================================================
echo   VocalSync AI — Backend Cloudflare Tunnel Gateway
echo ======================================================================
echo.

:: 1. Verify Backend is Running on Port 8000
echo [*] Checking FastAPI backend on port 8000...
powershell -Command "$c = Test-NetConnection -ComputerName 127.0.0.1 -Port 8000; if (-not $c.TcpTestSucceeded) { exit 1 }" >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Backend is not running on port 8000. Launching backend in a new window...
    start "VocalSync FastAPI Backend" cmd /k "cd backend && ..\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000"
    echo [*] Waiting 5 seconds for backend models and ASR engine to initialize...
    timeout /t 5 /nobreak >nul
) else (
    echo [+] Backend is already online on http://localhost:8000
)

:: 2. Launch Cloudflare Tunnel directly for Backend (Port 8000)
echo.
echo ======================================================================
echo   Starting Cloudflare Tunnel to expose Backend Port 8000
echo.
echo   Look for the URL ending with '.trycloudflare.com' below!
echo   Example: https://xxxx-xxxx-xxxx.trycloudflare.com
echo.
echo   Copy that URL and add it to your Vercel Environment Variables:
echo     - VITE_API_BASE_URL = https://your-tunnel-url.trycloudflare.com
echo     - VITE_WS_URL       = wss://your-tunnel-url.trycloudflare.com/ws/meeting
echo ======================================================================
echo.

if exist "cloudflared.exe" (
    .\cloudflared.exe tunnel --url http://localhost:8000
) else (
    echo [!] cloudflared.exe not found! Please ensure cloudflared.exe is in the project root.
    pause
)
