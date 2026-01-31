"""
Pydantic models for API request/response validation
"""
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import datetime
from enum import Enum

class UserRole(str, Enum):
    ASSIGNEE = "ASSIGNEE"
    TEAM_LEAD = "TEAM_LEAD"
    MANAGER = "MANAGER"
    ADMIN = "ADMIN"

class TaskStatus(str, Enum):
    CREATED = "CREATED"
    IN_PROGRESS = "IN_PROGRESS"
    SUBMITTED = "SUBMITTED"
    COMPLETED = "COMPLETED"
    AT_RISK = "AT_RISK"
    OVERDUE = "OVERDUE"
    ESCALATED = "ESCALATED"

class TaskPriority(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"

class ActionType(str, Enum):
    REMIND = "REMIND"
    RISK_ALERT = "RISK_ALERT"
    ESCALATE = "ESCALATE"
    CRITICAL_ESCALATE = "CRITICAL_ESCALATE"
    NONE = "NONE"

# User Models
class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.ASSIGNEE

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    role: UserRole
    teamId: str = "UNASSIGNED"
    deptId: str = "UNASSIGNED"
    reliabilityScore: float = 0.5
    
    class Config:
        from_attributes = True

# Project Models
class ProjectCreate(BaseModel):
    name: str
    description: str
    leadId: Optional[str] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    leadId: Optional[str] = None
    status: Optional[str] = None

class ProjectResponse(BaseModel):
    id: str
    name: str
    description: str
    orgId: str
    leadId: Optional[str] = None
    memberIds: List[str] = []
    status: str = "ACTIVE"
    createdAt: int
    
    class Config:
        from_attributes = True

# Task Models
class TaskCreate(BaseModel):
    title: str
    description: str = ""
    priority: TaskPriority = TaskPriority.MEDIUM
    deadline: int  # timestamp in milliseconds
    assigneeId: str
    projectId: Optional[str] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[TaskStatus] = None
    priority: Optional[TaskPriority] = None
    deadline: Optional[int] = None
    assigneeId: Optional[str] = None

class TaskResponse(BaseModel):
    id: str
    title: str
    description: str
    status: TaskStatus
    priority: TaskPriority
    deadline: int
    assigneeId: str
    teamId: str
    deptId: str
    orgId: str
    projectId: Optional[str] = None
    riskScore: int = 0
    lastAction: ActionType = ActionType.NONE
    updatedAt: int
    
    class Config:
        from_attributes = True

# User Action Models
class UserActionCreate(BaseModel):
    userId: str
    actionType: str  # "login", "logout", "task_created", "task_updated", "task_completed"
    taskId: Optional[str] = None
    details: Optional[dict] = {}

class UserActionResponse(BaseModel):
    id: str
    userId: str
    actionType: str
    taskId: Optional[str] = None
    timestamp: int
    details: dict = {}
    
    class Config:
        from_attributes = True

# Performance Models
class PerformanceMetrics(BaseModel):
    userId: str
    totalTasksAssigned: int = 0
    tasksCompleted: int = 0
    tasksCompletedOnTime: int = 0
    tasksCompletedLate: int = 0
    averageCompletionTime: float = 0.0
    reliabilityScore: float = 0.5
    
    class Config:
        from_attributes = True

# Escalation Models
class EscalationCreate(BaseModel):
    taskId: str
    userId: str
    leadId: str
    reason: str
    aiAnalysis: str
    riskScore: int

class EscalationResponse(BaseModel):
    id: str
    taskId: str
    userId: str
    leadId: str
    reason: str
    aiAnalysis: str
    riskScore: int
    timestamp: int
    resolved: bool = False
    
    class Config:
        from_attributes = True
