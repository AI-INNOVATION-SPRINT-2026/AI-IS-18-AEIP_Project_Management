# MongoDB Backend Setup Guide

## Overview

This project now uses **MongoDB** as the permanent database instead of localStorage. The system includes:
- **MongoDB** - Permanent database storage
- **FastAPI Backend** (`api_service/`) - REST API on port 8001
- **RAG AI Service** (`rag_service/`) - Vector search on port 8000
- **React Frontend** - UI on port 5173 (Vite)

---

## Prerequisites

### 1. Install MongoDB

**Windows:**
1. Download MongoDB Community Server: https://www.mongodb.com/try/download/community
2. Run the installer (choose "Complete" installation)
3. Install as a Windows Service (recommended)
4. MongoDB Compass (GUI) will be installed automatically

**Or use MongoDB Atlas (Cloud):**
- Sign up at https://www.mongodb.com/cloud/atlas
- Create a free cluster
- Update `.env` with your connection string

### 2. Verify MongoDB is Running

```bash
# Check if MongoDB service is running
tasklist | findstr mongod

# Or start MongoDB manually
mongod --dbpath C:\data\db
```

---

## Quick Start

### 1. Start All Services

Open **3 terminals** in the project directory:

```bash
# Terminal 1: RAG Service
.\run_rag_service.bat

# Terminal 2: API Service (MongoDB Backend)
.\run_api_service.bat

# Terminal 3: React Frontend
npm run dev
```

### 2. Access the Application

- **Frontend**: http://localhost:5173
- **API Docs**: http://localhost:8001/docs (Swagger UI)
- **RAG Service**: http://localhost:8000/health

---

## How It Works

### Data Flow

```
React Frontend (port 5173)
    ↓ HTTP API calls
FastAPI Backend (port 8001)
    ↓ Reads/Writes
MongoDB (port 27017)
    +
    ↓ AI Analysis
RAG Service (port 8000)
```

### Key Features

1. **Permanence Storage**: All user data, projects, and tasks stored in MongoDB
2. **User Authentication**: Bcrypt password hashing
3. **Performance Tracking**: User action history logged to database
4. **AI Analysis**: RAG service analyzes user patterns for escalation
5. **Real-time Updates**: All changes immediately saved to database

---

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Users
- `GET /api/users` - List all users
- `GET /api/users/{id}` - Get specific user

### Projects
- `POST /api/projects` - Create project
- `GET /api/projects` - List projects
- `PUT /api/projects/{id}/assign-lead` - Assign team lead
- `PUT /api/projects/{id}/add-member` - Add employee

### Tasks
- `POST /api/tasks` - Create task
- `GET /api/tasks` - List tasks (with filters)
- `PUT /api/tasks/{id}` - Update task

### Performance
- `GET /api/performance/{user_id}` - Get user metrics
- `POST /api/actions/log` - Log user action

Full API documentation: http://localhost:8001/docs

---

## Configuration

### Environment Variables (`api_service/.env`)

```env
# MongoDB
MONGODB_URL=mongodb://localhost:27017
DATABASE_NAME=aeip_db

# API
API_PORT=8001
API_HOST=0.0.0.0

# RAG Service
RAG_SERVICE_URL=http://localhost:8000

# Security
SECRET_KEY=your-secret-key-change-in-production
```

---

## Database Collections

MongoDB automatically creates these collections:

| Collection | Purpose |
|------------|---------|
| `users` | User accounts and profiles |
| `projects` | Organization projects |
| `tasks` | Tasks with deadlines |
| `user_actions` | Action history for AI analysis |
| `escalations` | Escalation events |

### View Data with MongoDB Compass

1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Database: `aeip_db`
4. Browse collections

---

## Troubleshooting

### MongoDB Not Running

```bash
# Start MongoDB as Windows Service
net start MongoDB

# Or run manually
mongod --dbpath C:\data\db
```

### Port Already in Use

```bash
# Find process using port 8001
netstat -ano | findstr :8001

# Kill process (replace PID)
taskkill /PID <process_id> /F
```

### Dependencies Not Installing

```bash
# Create fresh virtual environment
python -m venv .venv
.\.venv\Scripts\activate
pip install -r api_service\requirements.txt
```

---

## Next Steps

1. **Start All Services** (see Quick Start above)
2. **Register** as an admin user
3. **Create Projects** and assign team leads
4. **Assign Tasks** to employees
5. **Monitor** AI-powered escalations

Your data will now persist in MongoDB permanently! 🎉
