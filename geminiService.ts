import { GoogleGenAI } from "@google/genai";
import { Task, ActionType, User } from "./types";

const apiKey = "AIzaSyBrpY2HxWct283pWc6jB-jllW88MdjWMmU"; // hardcoded

if (!apiKey) {
  console.warn("GEMINI_API_KEY not found. LLM explanations will use fallback.");
}

const ai = apiKey ? new GoogleGenAI({ apiKey }) : null;

// Simple in-memory rate limiter
let lastRequestTime = 0;
const MIN_REQ_INTERVAL = 4000; // 4 seconds between requests (safe for 15 RPM free tier)

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

  if (!ai) {
    return "Action triggered based on deadline proximity and historical reliability patterns. (LLM service unavailable - check API key configuration)";
  }

  // Rate Limiting Strategy
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQ_INTERVAL) {
    const waitTime = MIN_REQ_INTERVAL - timeSinceLastRequest;
    // console.log(`⏳ Rate limiting: Waiting ${waitTime}ms before calling Gemini...`);
    await new Promise(resolve => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
        maxOutputTokens: 200,
      }
    });
    return response.text || "Reasoning engine unable to generate detailed explanation.";
  } catch (err: any) {
    // Graceful handling for 429s to avoid clearing the console with red errors
    if (err.toString().includes('429') || err.message?.includes('429')) {
      console.warn("⚠️ Gemini Rate Limit (429) hit. Returning fallback.");
    } else {
      console.error("Gemini Error:", err);
    }
    return "Action triggered based on deadline proximity and historical reliability patterns.";
  }
}
