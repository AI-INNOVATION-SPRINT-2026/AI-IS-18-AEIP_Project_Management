from fastapi import APIRouter, HTTPException, status
from typing import List
from datetime import datetime
from models import Task, TaskCreate, TaskUpdate, TaskComplete, MessageResponse
from database import get_database

router = APIRouter(prefix="/api/tasks", tags=["tasks"])

@router.get("/", response_model=List[Task])
async def get_all_tasks(user_id: str = None, project_id: str = None):
    """Get all tasks, optionally filtered by user or project"""
    db = get_database()
    
    query = {}
    if user_id:
        query["assigneeId"] = user_id
    if project_id:
        query["projectId"] = project_id
    
    tasks = await db.tasks.find(query).to_list(1000)
    return tasks

@router.get("/{task_id}", response_model=Task)
async def get_task(task_id: str):
    """Get task by ID"""
    db = get_database()
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@router.post("/", response_model=Task, status_code=status.HTTP_201_CREATED)
async def create_task(task_data: TaskCreate):
    """Create a new task"""
    db = get_database()
    
    # Auto-assign if no assignee provided and skills are specified
    assignee_id = task_data.assigneeId
    if not assignee_id and task_data.requiredSkills:
        # Get eligible users (all roles except ADMIN) - Broaden search to ignore dept restrictions
        users = await db.users.find({
            "role": {"$ne": "ADMIN"}
        }).to_list(1000)
        
        if users:
            print(f"🤖 AI Auto-Assign: Analyzing {len(users)} candidates for task '{task_data.title}'")
            
            from services.agentic_assignment import autonomous_assignment_inference
            
            # Convert users (dicts) to list of dicts if needed (already dicts from Mongo)
            # Run AI Inference
            ai_assignment = await autonomous_assignment_inference(task_data.model_dump(), users)
            
            if ai_assignment and ai_assignment.get("selected_user_id"):
                assignee_id = ai_assignment["selected_user_id"]
                print(f"✅ AI Selected: {assignee_id} (Reason: {ai_assignment.get('reasoning')})")
            else:
                 print("⚠️ AI Assignment returned no result, falling back.")
    
    # If still no assignee, assign to task creator (fallback)
    if not assignee_id:
        # Use the teamId or deptId to find a default assignee
        # For now, we'll require manual assignment or skills
        raise HTTPException(
            status_code=400, 
            detail="No suitable assignee found. Please specify skills or manually assign a user."
        )
    
    # Create new task
    task_id = f"TASK-{int(datetime.utcnow().timestamp() * 1000)}"
    new_task = Task(
        id=task_id,
        title=task_data.title,
        description=task_data.description,
        status="CREATED",
        priority=task_data.priority,
        deadline=task_data.deadline,
        assigneeId=assignee_id,
        teamId=task_data.teamId,
        deptId=task_data.deptId,
        orgId=task_data.orgId,
        projectId=task_data.projectId,
        requiredSkills=task_data.requiredSkills,
        riskScore=0,
        lastAction="NONE"
    )
    
    await db.tasks.insert_one(new_task.model_dump())
    return new_task

@router.put("/{task_id}", response_model=Task)
async def update_task(task_id: str, task_update: TaskUpdate):
    """Update task information"""
    db = get_database()
    
    # Check if task exists
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update fields
    update_data = {k: v for k, v in task_update.model_dump().items() if v is not None}
    update_data["updatedAt"] = datetime.utcnow()
    
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": update_data}
    )
    
    # Return updated task
    updated_task = await db.tasks.find_one({"id": task_id})
    return updated_task

@router.put("/{task_id}/status", response_model=Task)
async def update_task_status(task_id: str, new_status: str):
    """Update task status"""
    db = get_database()
    
    # Check if task exists
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Update status
    await db.tasks.update_one(
        {"id": task_id},
        {"$set": {"status": new_status, "updatedAt": datetime.utcnow()}}
    )
    
    # Return updated task
    updated_task = await db.tasks.find_one({"id": task_id})
    return updated_task

@router.delete("/{task_id}", response_model=MessageResponse)
async def delete_task(task_id: str):
    """Delete task"""
    db = get_database()
    
    result = await db.tasks.delete_one({"id": task_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    
    return MessageResponse(message="Task deleted successfully")

@router.post("/{task_id}/complete", response_model=Task)
async def complete_task(task_id: str, completion_data: TaskComplete):
    """
    Mark task as completed.
    Triggers AEIP-Core Autonomous Execution intelligence.
    INFERs quality and effort instead of asking user.
    """
    db = get_database()
    
    # Check if task exists
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    # If user provided manual data (legacy), use it? 
    # The requirement is "No human should enter ratings". 
    # So we prefer the Agentic approach unless explicitly blocked (task.md constraints).
    # We will ALWAYS run the autonomous inference to generate the narrative/learning.
    
    from services.agentic_completion import process_task_completion
    
    try:
        # Run Autonomous Phase 3
        result = await process_task_completion(task_id, db)
        
        updated_task = result["task"]
        ai_narrative = result["ai_result"]["narrative"]
        
        # Determine if we should add to Vector Memory
        # In a real microservice, we would emit an event. 
        # Here we can print it for the logs or handle it.
        print(f"✅ AEIP Memory Generated: {result['new_memory_text']}")
        
        # Note: To persist this into FAISS, we would call the /add endpoint.
        # For this prototype, we log the intent. 
        # Ideally: await add_memory_internal(result['new_memory_text'])
        
        return updated_task
        
    except Exception as e:
        print(f"⚠️ Autonomous Completion Failed: {e}")
        # Fallback to simple completion
        update_data = {
            "status": "COMPLETED",
            "completedAt": int(datetime.utcnow().timestamp() * 1000),
            "lastAction": "MANUAL_COMPLETE_FALLBACK"
        }
        await db.tasks.update_one({"id": task_id}, {"$set": update_data})
        return await db.tasks.find_one({"id": task_id})
