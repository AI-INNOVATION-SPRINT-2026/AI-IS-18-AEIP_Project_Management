@echo off
echo Starting AEIP RAG Service...

cd rag_service

if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

echo Activating virtual environment...
call venv\Scripts\activate

echo Installing dependencies...
pip install -r requirements.txt

echo Starting server...
python main.py

pause
