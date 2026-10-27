@echo off
TITLE VocalSync AI - Local Production Launcher
echo ========================================================
echo   Starting VocalSync AI (Backend + Frontend)
echo ========================================================

:: Check if Python virtual environment exists
if not exist "venv\Scripts\python.exe" (
    echo [!] Python virtual environment not found at .\venv.
    echo Please create one: python -m venv venv and run pip install -r backend/requirements.txt
    pause
    exit /b 1
)

:: Start Backend
echo [*] Launching FastAPI Backend on port 8000...
start "VocalSync Backend" cmd /k "cd backend && ..\venv\Scripts\python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

:: Start Frontend
echo [*] Launching React Vite Frontend on port 5173...
start "VocalSync Frontend" cmd /k "cd frontend && npm run dev -- --host 0.0.0.0"

echo ========================================================
echo   VocalSync AI is starting!
echo   Frontend: http://localhost:5173
echo   Backend:  http://localhost:8000
echo   Health:   http://localhost:8000/health
echo ========================================================
