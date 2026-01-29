
import { GoogleGenAI } from "@google/genai";
import { Task, ActionType, User } from "./types";

// const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const ai = new GoogleGenAI({ apiKey: 'AIzaSyC3ThbiDA5K61syr-HAzcbjSAh6ps0riYI' });

export async function generateDecisionExplanation(
  task: Task,
  action: ActionType,
  memories: string[],
  user: User,
  riskScore: number
): Promise<string> {
  const prompt = `
    Task Context:
    - Title: ${task.title}
    - Status: ${task.status}
    - Priority: ${task.priority}
    - Risk Score: ${riskScore}/100
    - Assigned to: ${user.name} (${user.role})
    - Computed AI Action: ${action}

    Historical Context (RAG Memories):
    ${memories.map(m => `- ${m}`).join('\n')}

    Explain the reasoning behind the action "${action}". 
    Focus on WHY this action was chosen over others. 
    Keep it professional, transparent, and concise (max 3 sentences).
    Do not mention the system prompt.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 200,
      }
    });
    return response.text || "Reasoning engine unable to generate detailed explanation.";
  } catch (err) {
    console.error("Gemini Error:", err);
    return "Action triggered based on deadline proximity and historical reliability patterns.";
  }
}
