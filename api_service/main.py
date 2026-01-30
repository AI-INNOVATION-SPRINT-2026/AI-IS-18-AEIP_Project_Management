"""
FastAPI Main Application - MongoDB Backend for AEIP
Replaces localStorage with permanent database storage
"""
from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from typing import List, Optional
import bcrypt
import time
from datetime import datetime

from database import (
    connect_to_mongo, close_mongo_connection, get_database,
    USERS_COLLECTION, PROJECTS_COLLECTION, TASKS_COLLECTION,
    USER_ACTIONS_COLLECTION, ESCALATIONS_COLLECTION
)
from models import (
    UserCreate, UserLogin, UserResponse,
    ProjectCreate, ProjectUpdate, ProjectResponse,
    TaskCreate, TaskUpdate, TaskResponse,
    UserActionCreate, UserActionResponse,
    PerformanceMetrics, TaskStatus, ActionType
)

# Lifecycle management
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await connect_to_mongo()
    yield
    # Shutdown
    await close_mongo_connection()

# Initialize FastAPI app
app = FastAPI(
    title="AEIP API Service",
    description="MongoDB Backend for Agentic Execution Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify exact origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== UTILITY FUNCTIONS ====================

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def generate_id(prefix: str) -> str:
    """Generate unique ID"""
    return f"{prefix}-{int(time.time() * 1000)}"

# ==================== HEALTH CHECK ====================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "ok", "service": "AEIP API", "timestamp": int(time.time() * 1000)}

# ==================== AUTHENTICATION ENDPOINTS ====================

@app.post("/api/auth/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register_user(user_data: UserCreate, db=Depends(get_database)):
    """Register a new user"""
    users_collection = db[USERS_COLLECTION]
    
    # Check if user already exists
    existing_user = await users_collection.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create new user
    user_dict = {
        "id": generate_id("USER"),
        "name": user_data.name,
        "email": user_data.email,
        "password": hash_password(user_data.password),
        "role": user_data.role.value,
        "teamId": "UNASSIGNED",
        "deptId": "UNASSIGNED",
        "reliabilityScore": 0.5,
        "createdAt": int(time.time() * 1000)
    }
    
    await users_collection.insert_one(user_dict)
    
    # Return user without password
    user_response = {k: v for k, v in user_dict.items() if k != "password" and k != "_id"}
    return UserResponse(**user_response)

@app.post("/api/auth/login", response_model=UserResponse)
async def login_user(credentials: UserLogin, db=Depends(get_database)):
    """Login user"""
    users_collection = db[USERS_COLLECTION]
    
    # Find user by email
    user = await users_collection.find_one({"email": credentials.email})
    
    if not user or not verify_password(credentials.password, user.get("password", "")):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Log login action
    actions_collection = db[USER_ACTIONS_COLLECTION]
    await actions_collection.insert_one({
        "id": generate_id("ACTION"),
        "userId": user["id"],
        "actionType": "login",
        "timestamp": int(time.time() * 1000),
        "details": {}
    })
    
    # Return user without password
    user_response = {k: v for k, v in user.items() if k != "password" and k != "_id"}
    return UserResponse(**user_response)

# ==================== USER ENDPOINTS ====================

@app.get("/api/users", response_model=List[UserResponse])
async def get_users(db=Depends(get_database)):
    """Get all users"""
    users_collection = db[USERS_COLLECTION]
    users = []
    
    async for user in users_collection.find():
        user_dict = {k: v for k, v in user.items() if k != "password" and k != "_id"}
        users.append(UserResponse(**user_dict))
    
    return users

@app.get("/api/users/{user_id}", response_model=UserResponse)
async def get_user(user_id: str, db=Depends(get_database)):
    """Get user by ID"""
    users_collection = db[USERS_COLLECTION]
    user = await users_collection.find_one({"id": user_id})
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user_dict = {k: v for k, v in user.items() if k != "password" and k != "_id"}
    return UserResponse(**user_dict)

# ==================== PROJECT ENDPOINTS ====================

@app.post("/api/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(project_data: ProjectCreate, db=Depends(get_database)):
    """Create a new project"""
    projects_collection = db[PROJECTS_COLLECTION]
    
    project_dict = {
        "id": generate_id("PROJ"),
        "name": project_data.name,
        "description": project_data.description,
        "orgId": "ORG-001",  # Default org for now
        "leadId": project_data.leadId,
        "memberIds": [],
        "status": "ACTIVE",
        "createdAt": int(time.time() * 1000)
    }
    
    await projects_collection.insert_one(project_dict)
    
    response = {k: v for k, v in project_dict.items() if k != "_id"}
    return ProjectResponse(**response)

@app.get("/api/projects", response_model=List[ProjectResponse])
async def get_projects(user_role: Optional[str] = None, user_id: Optional[str] = None, db=Depends(get_database)):
    """Get projects (filtered by role if specified)"""
    projects_collection = db[PROJECTS_COLLECTION]
    projects = []
    
    async for project in projects_collection.find():
        project_dict = {k: v for k, v in project.items() if k != "_id"}
        projects.append(ProjectResponse(**project_dict))
    
    return projects

@app.put("/api/projects/{project_id}/assign-lead")
async def assign_lead(project_id: str, lead_id: str, db=Depends(get_database)):
    """Assign team lead to project"""
    projects_collection = db[PROJECTS_COLLECTION]
    
    result = await projects_collection.update_one(
        {"id": project_id},
        {"$set": {"leadId": lead_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"status": "success", "message": "Lead assigned"}

@app.put("/api/projects/{project_id}/add-member")
async def add_member(project_id: str, member_id: str, db=Depends(get_database)):
    """Add employee to project"""
    projects_collection = db[PROJECTS_COLLECTION]
    
    result = await projects_collection.update_one(
        {"id": project_id},
        {"$addToSet": {"memberIds": member_id}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"status": "success", "message": "Member added"}

# ==================== TASK ENDPOINTS ====================

@app.post("/api/tasks", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(task_data: TaskCreate, db=Depends(get_database)):
    """Create a new task"""
    tasks_collection = db[TASKS_COLLECTION]
    users_collection = db[USERS_COLLECTION]
    
    # Get assignee info for teamId and deptId
    assignee = await users_collection.find_one({"id": task_data.assigneeId})
    if not assignee:
        raise HTTPException(status_code=404, detail="Assignee not found")
    
    task_dict = {
        "id": generate_id("TASK"),
        "title": task_data.title,
        "description": task_data.description,
        "status": TaskStatus.CREATED.value,
        "priority": task_data.priority.value,
        "deadline": task_data.deadline,
        "assigneeId": task_data.assigneeId,
        "teamId": assignee.get("teamId", "UNASSIGNED"),
        "deptId": assignee.get("deptId", "UNASSIGNED"),
        "orgId": "ORG-001",
        "projectId": task_data.projectId,
        "riskScore": 0,
        "lastAction": ActionType.NONE.value,
        "updatedAt": int(time.time() * 1000)
    }
    
    await tasks_collection.insert_one(task_dict)
    
    # Log task creation action
    actions_collection = db[USER_ACTIONS_COLLECTION]
    await actions_collection.insert_one({
        "id": generate_id("ACTION"),
        "userId": task_data.assigneeId,
        "actionType": "task_created",
        "taskId": task_dict["id"],
        "timestamp": int(time.time() * 1000),
        "details": {"deadline": task_data.deadline}
    })
    
    response = {k: v for k, v in task_dict.items() if k != "_id"}
    return TaskResponse(**response)

@app.get("/api/tasks", response_model=List[TaskResponse])
async def get_tasks(
    user_id: Optional[str] = None,
    team_id: Optional[str] = None,
    project_id: Optional[str] = None,
    db=Depends(get_database)
):
    """Get tasks with optional filtering"""
    tasks_collection = db[TASKS_COLLECTION]
    
    # Build query
    query = {}
    if user_id:
        query["assigneeId"] = user_id
    if team_id:
        query["teamId"] = team_id
    if project_id:
        query["projectId"] = project_id
    
    tasks = []
    async for task in tasks_collection.find(query):
        task_dict = {k: v for k, v in task.items() if k != "_id"}
        tasks.append(TaskResponse(**task_dict))
    
    return tasks

@app.put("/api/tasks/{task_id}", response_model=TaskResponse)
async def update_task(task_id: str, task_update: TaskUpdate, db=Depends(get_database)):
    """Update task"""
    tasks_collection = db[TASKS_COLLECTION]
    
    # Build update dict
    update_data = {k: v for k, v in task_update.dict(exclude_unset=True).items()}
    if update_data:
        update_data["updatedAt"] = int(time.time() * 1000)
        
        result = await tasks_collection.update_one(
            {"id": task_id},
            {"$set": update_data}
        )
        
        if result.matched_count == 0:
            raise HTTPException(status_code=404, detail="Task not found")
        
        # Log update action if status changed
        if "status" in update_data:
            actions_collection = db[USER_ACTIONS_COLLECTION]
            task = await tasks_collection.find_one({"id": task_id})
            await actions_collection.insert_one({
                "id": generate_id("ACTION"),
                "userId": task["assigneeId"],
                "actionType": f"task_status_changed",
                "taskId": task_id,
                "timestamp": int(time.time() * 1000),
                "details": {"new_status": update_data["status"]}
            })
    
    # Return updated task
    task = await tasks_collection.find_one({"id": task_id})
    task_dict = {k: v for k, v in task.items() if k != "_id"}
    return TaskResponse(**task_dict)

# ==================== USER ACTIONS ENDPOINTS ====================

@app.post("/api/actions/log", response_model=UserActionResponse)
async def log_action(action_data: UserActionCreate, db=Depends(get_database)):
    """Log a user action"""
    actions_collection = db[USER_ACTIONS_COLLECTION]
    
    action_dict = {
        "id": generate_id("ACTION"),
        "userId": action_data.userId,
        "actionType": action_data.actionType,
        "taskId": action_data.taskId,
        "timestamp": int(time.time() * 1000),
        "details": action_data.details or {}
    }
    
    await actions_collection.insert_one(action_dict)
    
    response = {k: v for k, v in action_dict.items() if k != "_id"}
    return UserActionResponse(**response)

@app.get("/api/actions/{user_id}", response_model=List[UserActionResponse])
async def get_user_actions(user_id: str, limit: int = 100, db=Depends(get_database)):
    """Get user actions"""
    actions_collection = db[USER_ACTIONS_COLLECTION]
    
    actions = []
    async for action in actions_collection.find({"userId": user_id}).sort("timestamp", -1).limit(limit):
        action_dict = {k: v for k, v in action.items() if k != "_id"}
        actions.append(UserActionResponse(**action_dict))
    
    return actions

# ==================== PERFORMANCE ENDPOINTS ====================

@app.get("/api/performance/{user_id}", response_model=PerformanceMetrics)
async def get_performance_metrics(user_id: str, db=Depends(get_database)):
    """Get user performance metrics"""
    tasks_collection = db[TASKS_COLLECTION]
    
    # Get all tasks for user
    all_tasks = await tasks_collection.count_documents({"assigneeId": user_id})
    completed = await tasks_collection.count_documents({
        "assigneeId": user_id,
        "status": TaskStatus.COMPLETED.value
    })
    
    # Calculate on-time vs late completions (simplified)
    on_time = 0
    late = 0
    
    async for task in tasks_collection.find({
        "assigneeId": user_id,
        "status": TaskStatus.COMPLETED.value
    }):
        if task.get("updatedAt", 0) <= task.get("deadline", 0):
            on_time += 1
        else:
            late += 1
    
    # Calculate reliability score
    if all_tasks > 0:
        reliability = (completed / all_tasks) * 0.7 + (on_time / max(completed, 1)) * 0.3
    else:
        reliability = 0.5
    
    # Update user's reliability score
    users_collection = db[USERS_COLLECTION]
    await users_collection.update_one(
        {"id": user_id},
        {"$set": {"reliabilityScore": reliability}}
    )
    
    return PerformanceMetrics(
        userId=user_id,
        totalTasksAssigned=all_tasks,
        tasksCompleted=completed,
        tasksCompletedOnTime=on_time,
        tasksCompletedLate=late,
        reliabilityScore=reliability
    )

# ==================== MAIN ====================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001, reload=True)
