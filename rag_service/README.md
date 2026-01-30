# RAG Service

This is a FastAPI-based microservice that provides RAG (Retrieval-Augmented Generation) capabilities using FAISS and Sentence Transformers.

## Prerequisites

- Python 3.8 or higher
- pip (Python package installer)

## Setup

1.  Navigate to the `rag_service` directory:
    ```powershell
    cd rag_service
    ```

2.  (Optional) Create a virtual environment:
    ```powershell
    python -m venv venv
    .\venv\Scripts\activate
    ```

3.  Install dependencies:
    ```powershell
    pip install -r requirements.txt
    ```

## Running the Service

You can run the service in two ways:

### Option 1: Using Python directly
```powershell
python main.py
```

### Option 2: Using Uvicorn CLI (Recommended for development)
```powershell
uvicorn main:app --reload
```

The service will start at `http://localhost:8000`.

## Endpoints

-   **GET /health**: Check service status.
-   **POST /add**: Add a memory to the vector store.
-   **POST /search**: Search for relevant memories.
-   **POST /init**: Bulk load memories (clears existing).
