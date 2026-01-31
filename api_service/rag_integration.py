"""
RAG Integration Service - Connects MongoDB backend with RAG AI service
Analyzes user performance patterns and triggers escalations
"""
import requests
import asyncio
from typing import List, Dict, Optional
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

RAG_SERVICE_URL = os.getenv("RAG_SERVICE_URL", "http://localhost:8000")

class RAGIntegrationService:
    """Service to integrate with RAG for performance analysis"""
    
    def __init__(self, rag_url: str = RAG_SERVICE_URL):
        self.rag_url = rag_url
    
    async def analyze_user_performance(self, user_id: str, user_actions: List[Dict], current_task: Dict) -> Dict:
        """
        Analyze user performance using RAG service
        Returns escalation decision and AI reasoning
        """
        try:
            # Build context from user actions
            action_summaries = []
            for action in user_actions[:10]:  # Last 10 actions
                action_type = action.get("actionType", "")
                timestamp = action.get("timestamp", 0)
                task_id = action.get("taskId", "")
                
                summary = f"User {user_id} {action_type}"
                if task_id:
                    summary += f" for task {task_id}"
                summary += f" at {datetime.fromtimestamp(timestamp/1000).strftime('%Y-%m-%d %H:%M')}"
                
                if "details" in action and action["details"]:
                    summary += f" - {action['details']}"
                
                action_summaries.append(summary)
            
            # Add current task context
            task_summary = f"Current task: {current_task.get('title')} - Deadline: {datetime.fromtimestamp(current_task.get('deadline', 0)/1000).strftime('%Y-%m-%d %H:%M')} - Priority: {current_task.get('priority')}"
            
            # Query RAG service for similar patterns
            query_text = f"User performance history: {'. '.join(action_summaries)}. {task_summary}. Should we escalate?"
            
            response = requests.post(
                f"{self.rag_url}/search",
                json={
                    "text": query_text,
                    "top_k": 5,
                    "filter_user_id": user_id
                },
                timeout=5
            )
            
            if response.status_code == 200:
                results = response.json()
                
                # Analyze retrieved memories
                escalation_needed = self._analyze_escalation_need(
                    user_actions, current_task, results
                )
                
                return {
                    "should_escalate": escalation_needed["should_escalate"],
                    "risk_score": escalation_needed["risk_score"],
                    "reason": escalation_needed["reason"],
                    "ai_analysis": escalation_needed["ai_analysis"],
                    "retrieved_memories": [r["text"] for r in results]
                }
            else:
                # RAG service unavailable, use fallback heuristics
                return self._fallback_analysis(user_actions, current_task)
                
        except Exception as e:
            print(f"Error in RAG analysis: {e}")
            return self._fallback_analysis(user_actions, current_task)
    
    def _analyze_escalation_need(self, user_actions: List[Dict], current_task: Dict, rag_results: List[Dict]) -> Dict:
        """Analyze if escalation is needed based on RAG results and current context"""
        
        # Calculate risk factors
        risk_score = 0
        reasons = []
        
        # Factor 1: Time to deadline
        deadline = current_task.get("deadline", 0)
        current_time = datetime.now().timestamp() * 1000
        time_remaining = (deadline - current_time) / (1000 * 60 * 60)  # hours
        
        if time_remaining < 2:
            risk_score += 30
            reasons.append(f"Only {time_remaining:.1f} hours until deadline")
        elif time_remaining < 6:
            risk_score += 15
            reasons.append(f"Approaching deadline ({time_remaining:.1f} hours remaining)")
        
        # Factor 2: Priority
        priority = current_task.get("priority", "MEDIUM")
        if priority == "HIGH":
            risk_score += 20
            reasons.append("High priority task")
        
        # Factor 3: Historical patterns from RAG
        late_pattern_count = sum(1 for r in rag_results if "late" in r.get("text", "").lower() or "delay" in r.get("text", "").lower())
        if late_pattern_count >= 2:
            risk_score += 25
            reasons.append(f"Historical pattern of delays ({late_pattern_count} similar cases)")
        
        # Factor 4: Task status
        status = current_task.get("status", "CREATED")
        if status == "CREATED" and time_remaining < 4:
            risk_score += 15
            reasons.append("Task not started yet")
        
        # Decision: Escalate if risk score > 50
        should_escalate = risk_score > 50
        
        ai_analysis = f"AI Risk Assessment: {risk_score}/100. "
        if should_escalate:
            ai_analysis += f"ESCALATION RECOMMENDED. Factors: {'; '.join(reasons)}."
        else:
            ai_analysis += f"No immediate escalation needed. Monitoring factors: {'; '.join(reasons) if reasons else 'Task on track'}."
        
        return {
            "should_escalate": should_escalate,
            "risk_score": risk_score,
            "reason": "; ".join(reasons) if reasons else "Task monitoring",
            "ai_analysis": ai_analysis
        }
    
    def _fallback_analysis(self, user_actions: List[Dict], current_task: Dict) -> Dict:
        """Fallback analysis when RAG service is unavailable"""
        deadline = current_task.get("deadline", 0)
        current_time = datetime.now().timestamp() * 1000
        time_remaining = (deadline - current_time) / (1000 * 60 * 60)
        
        risk_score = 0
        if time_remaining < 2:
            risk_score = 70
        elif time_remaining < 6:
            risk_score = 40
        else:
            risk_score = 20
        
        should_escalate = risk_score > 50
        
        return {
            "should_escalate": should_escalate,
            "risk_score": risk_score,
            "reason": f"{time_remaining:.1f} hours to deadline",
            "ai_analysis": f"Fallback heuristic analysis (RAG unavailable). Risk: {risk_score}/100",
            "retrieved_memories": []
        }
    
    async def store_user_action_in_rag(self, user_id: str, action_summary: str, task_type: str = None):
        """Store user action in RAG for future pattern matching"""
        try:
            response = requests.post(
                f"{self.rag_url}/add",
                json={
                    "id": f"ACTION-{user_id}-{int(datetime.now().timestamp() * 1000)}",
                    "text": action_summary,
                    "metadata": {
                        "user_id": user_id,
                        "task_type": task_type,
                        "timestamp": int(datetime.now().timestamp() * 1000)
                    }
                },
                timeout=5
            )
            
            if response.status_code == 200:
                print(f"✅ Stored action in RAG: {action_summary[:50]}...")
            else:
                print(f"⚠️ Failed to store in RAG: {response.status_code}")
                
        except Exception as e:
            print(f"⚠️ Error storing in RAG: {e}")

# Global instance
rag_service = RAGIntegrationService()
