
import os
import json
import google.generativeai as genai
from typing import List, Dict, Any, Optional

# Initialize Gemini
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
model = genai.GenerativeModel('gemini-pro')

async def autonomous_assignment_inference(
    task: dict,
    candidates: List[dict]
) -> Dict[str, Any]:
    """
    Decides which candidate to assign the task to using LLM reasoning.
    """
    
    # 1. Format Candidates
    candidates_text = ""
    for c in candidates:
        candidates_text += f"- ID: {c['id']}, Name: {c['name']}, Role: {c['role']}, Reliability: {c.get('reliabilityScore', 0.5):.2f}, Skills: {', '.join(c.get('skills', []))}\n"

    # 2. Construct Prompt
    prompt = f"""
    You are AEIP-Core, an Autonomous Execution Intelligence.
    Your goal is to assign a new task to the best available employee based on context, skills, and historical reliability.
    
    TASK TO ASSIGN:
    Title: {task.get('title')}
    Description: {task.get('description')}
    Priority: {task.get('priority')}
    Required Skills: {', '.join(task.get('requiredSkills', []))}
    
    CANDIDATE POOL:
    {candidates_text}
    
    ASSIGNMENT RULES (soft constraints, interpret contextually):
    - Prioritize matching skills first.
    - If high priority, favor high reliability.
    - If low priority/learning opportunity, you might favor someone with partial skills to help them grow (if reliability permits).
    - Avoid overloading (though you don't have live load data here, use role/reliability as proxy).
    
    DECISION:
    Select the best User ID. Provide a reason.
    
    OUTPUT FORMAT (JSON ONLY):
    {{
        "selected_user_id": "string",
        "reasoning": "string"
    }}
    """
    
    try:
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        result = json.loads(text)
        return result
    except Exception as e:
        print(f"❌ AI Assignment Failed: {e}")
        # Fallback to first candidate or logic handled by caller
        return None
