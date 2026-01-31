
import os
import json
import time
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from models import Task, User, TaskComplete
from database import get_database

# Initialize Gemini
# Assumes GOOGLE_API_KEY is in environment variables (loaded by main.py dotenv)
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-pro')

async def autonomous_completion_inference(
    task: dict,
    user: dict,
    similar_memories: List[Dict],
    context_signals: Dict
) -> Dict[str, Any]:
    """
    Core reasoning loop for Task Completion.
    Infers Quality, Effort, and Learning autonomously.
    """
    
    # 1. Structure the Context including RAG memories
    memory_text = "\n".join([
        f"- [Past Task] '{m['text']}' (Score: {m['score']:.2f})" 
        for m in similar_memories
    ])
    
    # 2. Construct Prompt
    prompt = f"""
    You are AEIP-Core, an Autonomous Execution Intelligence.
    Your goal is to infer the outcome of a completed task without asking the human for input.
    
    CURRENT TASK:
    Title: {task.get('title')}
    Description: {task.get('description')}
    Priority: {task.get('priority')}
    Estimated Duration: {task.get('estimatedDuration')} minutes
    Actual Duration (Wall Clock): {context_signals.get('wall_clock_duration_minutes')} minutes
    Deadline Status: {context_signals.get('deadline_status')}
    
    EMPLOYEE PROFILE:
    Name: {user.get('name')}
    Function: {user.get('role')}
    Current Reliability Score: {user.get('reliabilityScore')}
    Skills: {', '.join(user.get('skills', []))}
    
    RETRIEVED MEMORIES (Context from similar past tasks):
    {memory_text if similar_memories else "No similar past tasks found."}
    
    ANALYSIS INSTRUCTIONS:
    1. Infer QUALITY (0.0 to 1.0) and Confidence.
       - If completely on time/early and similar to past successes -> High Quality.
       - If late but complex -> Acceptable.
       - If fast but history suggests skimping -> Risky.
    2. Infer EFFORT (Effective Hours).
       - Wall clock time includes breaks/sleep. Estimate actual focused work hours based on task complexity and user skill.
    3. Generate a NARRATIVE.
       - Explain WHY you decided this. Be transparent.
       - E.g., "Completed 20% faster than historical average for API tasks..."
       
    OUTPUT FORMAT (JSON ONLY):
    {{
        "inferred_quality_score": float,  // 0.0 to 1.0
        "quality_label": "Strong" | "Acceptable" | "Risky" | "Uncertain",
        "confidence_score": float, // 0.0 to 1.0
        "implied_effort_hours": float,
        "narrative": "string",
        "skill_update_suggestion": ["string"] // e.g. "Increased confidence in Python"]
    }}
    """
    
    try:
        # 3. Call LLM
        response = model.generate_content(prompt)
        # Clean potential markdown backticks
        text = response.text.replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"❌ AI Inference Failed: {e}")
        # Fallback safe defaults
        return {
            "inferred_quality_score": 0.8,
            "quality_label": "Uncertain",
            "confidence_score": 0.1,
            "implied_effort_hours": (context_signals.get('wall_clock_duration_minutes', 60) / 60) * 0.5, # Assume 50% efficiency
            "narrative": "AI reasoning failed, using fallback estimates.",
            "skill_update_suggestion": []
        }

async def process_task_completion(task_id: str, db):
    """
    Orchestrator for the Autonomous Completion Phase.
    """
    print(f"🧠 AEIP-Core: Starting Autonomous Completion for {task_id}")
    
    # 1. Fetch Context
    task = await db.tasks.find_one({"id": task_id})
    if not task:
        raise ValueError("Task not found")
        
    user = await db.users.find_one({"id": task["assigneeId"]})
    if not user:
        raise ValueError("Assignee not found")

    # 2. Derive Signals
    now = int(time.time() * 1000)
    start_time = task.get('actualStartDate') or task.get('createdAt')
    wall_clock_ms = now - start_time
    wall_clock_minutes = wall_clock_ms / (1000 * 60)
    
    deadline_status = "On Time"
    if task.get('deadline') and now > task.get('deadline'):
        deadline_status = "Overdue"
    elif task.get('deadline') and (task.get('deadline') - now) > (24 * 60 * 60 * 1000):
        deadline_status = "Early"

    context_signals = {
        "wall_clock_duration_minutes": wall_clock_minutes,
        "deadline_status": deadline_status
    }

    # 3. RAG Retrieval (Call the local RAG search if possible, or internal logic)
    # We can import search logic from main.py if we restructure, but for now we'll hit the Search endpoint internally or logic
    # To keep it clean, let's assume we can access the embedding logic.
    # Since this is a service, maybe we should call the microservice endpoint or use shared logic?
    # For simplicity in this file, we will focus on the Logic. 
    # NOTE: In a real app we'd import the vector store. Here I'll mock the specific retrieval call or adding a helper in main
    
    # For now, let's assume no history retrieval inside this function directly to avoid circular imports with main.py
    # Ideally, main.py should pass the retrieval function or this service should be independent.
    # I will implement a basic retrieval via DB scan for now as "Memory" until I wire up the FAISS shared instance properly.
    similar_memories = [] 
    
    # 4. Agentic Inference
    ai_result = await autonomous_completion_inference(task, user, similar_memories, context_signals)
    
    # 5. Commit Results
    update_data = {
        "status": "COMPLETED",
        "completedAt": now,
        "completionQuality": ai_result["inferred_quality_score"],
        "actualHours": ai_result["implied_effort_hours"],
        "wasOnTime": deadline_status != "Overdue",
        # Store the narrative in a new field or description? Ideally we need a 'completionReport' field.
        # For now, we'll append to description or log.
        "lastAction": f"AUTO_COMPLETE: {ai_result['quality_label']}"
    }
    
    await db.tasks.update_one({"id": task_id}, {"$set": update_data})
    
    # 6. Learning (Update User Reliability)
    # Simple Bayesian update: New = Old * (1-alpha) + Observation * alpha
    # Alpha depends on confidence
    alpha = 0.1 * ai_result['confidence_score']
    new_reliability = user.get('reliabilityScore', 0.5) * (1 - alpha) + ai_result['inferred_quality_score'] * alpha
    
    await db.users.update_one(
        {"id": user["id"]}, 
        {"$set": {"reliabilityScore": new_reliability}}
    )

    # 7. Generate Memory Record (To be added to Vector DB)
    memory_text = f"Task '{task['title']}' completed by {user['name']}. Result: {ai_result['quality_label']} ({ai_result['inferred_quality_score']:.2f}). {ai_result['narrative']}"
    
    # We return the memory object so the caller (router) can add it to FAISS
    return {
        "task": {**task, **update_data},
        "ai_result": ai_result,
        "new_memory_text": memory_text
    }
