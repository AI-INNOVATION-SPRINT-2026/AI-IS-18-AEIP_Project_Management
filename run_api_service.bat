@echo off
echo ==========================================
echo   AEIP API Service Startup
echo   MongoDB Backend with RAG Integration
echo ==========================================
echo.

REM Check if MongoDB is running
echo [1/4] Checking MongoDB...
tasklist /FI "IMAGENAME eq mongod.exe" 2>NUL | find /I /N "mongod.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo ✓ MongoDB is running
) else (
    echo ✗ MongoDB is not running!
    echo Please start MongoDB first:
    echo   - Download from: https://www.mongodb.com/try/download/community
    echo   - Or run: mongod --dbpath C:\data\db
    echo.
    pause
    exit /b 1
)

echo.
echo [2/4] Activating Python virtual environment...
if exist .venv\Scripts\activate.bat (
    call .venv\Scripts\activate.bat
    echo ✓ Virtual environment activated
) else (
    echo ✗ Virtual environment not found at .venv
    echo Creating virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo ✓ Virtual environment created and activated
)

echo.
echo [3/4] Installing dependencies...
pip install -r api_service\requirements.txt -q
if %ERRORLEVEL% EQU 0 (
    echo ✓ Dependencies installed
) else (
    echo ✗ Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo [4/4] Starting API service...
echo ==========================================
echo   API will be available at:
echo   http://localhost:8001
echo   
echo   API Documentation (Swagger):
echo   http://localhost:8001/docs
echo ==========================================
echo.

cd api_service
python main.py
