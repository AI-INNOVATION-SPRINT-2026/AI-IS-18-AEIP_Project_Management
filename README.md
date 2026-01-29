# AEIC – Agentic Execution Intelligence Coordinator

## 1. Project Title
**AEIC – Agentic Execution Intelligence Coordinator**  
(Registered project for AI & Innovation Sprint 2026)

---

## 2. Abstract
AEIC (Agentic Execution Intelligence Coordinator) is an AI‑driven execution intelligence platform designed for universities and enterprises to autonomously manage deadline‑driven workflows. Unlike traditional task management systems that only track tasks, AEIC actively monitors execution, predicts risks, and takes accountable actions such as reminders and hierarchical escalations.

The system is built using an **Agentic RAG architecture**, combining **Small Language Model (SLM)‑first reasoning**, **Retrieval‑Augmented Generation (RAG)** using embeddings and a vector database, and **Large Language Models (LLMs)** for explainable decision reasoning. Historical execution summaries are stored as contextual memory, enabling the system to make informed, non‑rule‑based decisions.

AEIC emphasizes **cost optimization, data privacy, and explainability**, ensuring that AI is used only where it adds value.

---

## 3. Problem Statement
Modern universities and organizations operate with complex, deadline‑driven workflows involving multiple stakeholders. Existing tools mainly act as passive task trackers, requiring continuous manual monitoring, reminders, and escalations by faculty or managers.

These systems lack contextual understanding, behavioral memory, and autonomous decision‑making, leading to missed deadlines, increased coordination effort, and execution failures. There is a need for an intelligent system that can **own execution**, proactively manage risks, and intervene autonomously while remaining transparent and accountable.

---

## 4. Objectives
- Design an agentic AI system for autonomous workflow execution  
- Reduce manual coordination and follow‑ups  
- Enable context‑aware decisions using RAG and vector memory  
- Ensure cost‑optimized AI usage using SLM‑first reasoning  
- Provide explainable and auditable AI decisions  

---

## 5. Technologies & Concepts Used

### Compulsory AI Concepts
- **Large Language Models (LLMs)** – Used selectively for explanation and reasoning  
- **Embeddings & Vector Databases** – Execution memories stored as embeddings  
- **Retrieval‑Augmented Generation (RAG)** – Context retrieval during decision‑making  
- **Agentic RAG** – Multi‑step agent loop (Observe → Retrieve → Decide → Act → Learn)  
- **Model Context Protocol (MCP)** – Structured context passed to models  

### Tech Stack
- Frontend: React 19, TypeScript, Vite, TailwindCSS  
- AI Reasoning: Deterministic SLM logic + Gemini LLM  
- Vector Database: FAISS (Python microservice)  
- Persistence (MVP): Browser localStorage  

---

## 6. System Architecture / Workflow

### High‑Level Workflow
**Input → Processing → Output**

1. Task creation with deadline, priority, and role hierarchy  
2. Autonomous agent monitors task state  
3. RAG retrieves historical execution memory  
4. SLM evaluates risk and selects action  
5. LLM generates explanation (only if required)  
6. System triggers reminder or escalation  

---

## 7. Implementation Details

### Key Modules
- **Agent Loop** – Periodic autonomous monitoring  
- **Reasoning Engine (SLM)** – Risk scoring and action selection  
- **RAG Layer** – FAISS‑based semantic retrieval  
- **LLM Explanation Layer** – Human‑readable reasoning  
- **Decision Trace Panel** – Full transparency of AI actions  

---

## 8. Features
- Autonomous task monitoring  
- Context‑aware escalation  
- Hierarchical responsibility routing  
- Explainable AI decisions  
- Cost‑optimized AI execution  
- Privacy‑safe synthetic data  

---

## 9. Usage Instructions
1. Clone the repository  
2. Install dependencies  
3. Start the React application  
4. Create tasks from the dashboard  
5. Observe AI decisions in the Decision Trace panel  

---

## 10. Capstone / Mini Build Description
As part of the AI Sprint, a working MVP was built demonstrating:
- Agentic AI loop  
- RAG‑based memory retrieval  
- SLM‑first decision gating  
- LLM‑based explainability  

The system uses synthetic data to simulate real organizational workflows while fully integrating compulsory AI concepts.

---

## 11. Future Scope
- Integration with LMS and enterprise tools  
- Event‑driven architecture for large‑scale deployment  
- Advanced predictive risk models  
- Multi‑workflow support (approvals, audits, reviews)  

---

## 12. Contributors
- **Janvi Kishor Patil** – AI Architecture, RAG, Documentation  
- **Sanika** – Product Design & Workflow Modeling  
- **Faijal Shaikh** – Frontend Engineering & Agent Loop  

---

## 13. References
- FAISS Documentation  
- Agentic AI Research Papers  
- RAG Architecture References  
- Google Gemini API Documentation
