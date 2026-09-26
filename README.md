# SAGE — Personal Context & Action Agent

> **"Listen. Remember. Reason. Act."**

An autonomous Personal Context & Action Agent combining ambient wearable voice (Omi) and web voice with persistent semantic vector memory (Qdrant), high-speed local embeddings (FastEmbed), cognitive reasoning & tool contracts (Lyzr AI), and deterministic safety verification.

---

## 🌐 Live Public Website
👉 **`https://translation-summary-intent-draft.trycloudflare.com`**

- **Zero Client Setup**: A judge or user can open the single public URL and immediately experience the full SAGE Command Center.
- **Single Public Origin**: The web UI and all API endpoints (`/orchestrator/*`, `/demo/*`, `/omi/*`, `/tasks/*`, `/health`) are served from the same unified domain.
- **Live Vector Memory & Actions**: Backed by persistent Qdrant Cloud vector storage, FastEmbed embeddings (`BAAI/bge-small-en-v1.5`), and verified action execution.

---

## Table of Contents
1. [Overview](#overview)
2. [Problem](#problem)
3. [Solution](#solution)
4. [Core Features](#core-features)
5. [System Architecture](#system-architecture)
6. [Architecture Diagram](#architecture-diagram)
7. [Technology Stack](#technology-stack)
8. [Single Public Website Architecture](#single-public-website-architecture)
9. [Omi Integration](#omi-integration)
10. [Qdrant Vector Memory Integration](#qdrant-vector-memory-integration)
11. [FastEmbed Microservice Integration](#fastembed-microservice-integration)
12. [Lyzr Agent & Tool Integration](#lyzr-agent--tool-integration)
13. [Memory Architecture](#memory-architecture)
14. [Task & Action Architecture](#task--action-architecture)
15. [Safety & Confirmation Gates](#safety--confirmation-gates)
16. [User-Facing Command Center](#user-facing-command-center)
17. [The Agentic Loop Explained](#the-agentic-loop-explained)
18. [Local Development Setup](#local-development-setup)
19. [Production Deployment (Render Blueprint)](#production-deployment-render-blueprint)
20. [Environment Variables](#environment-variables)
21. [Example Commands & Prompts](#example-commands--prompts)
22. [Testing & Verification](#testing--verification)
23. [4-to-5 Minute Hackathon Demo Workflow](#4-to-5-minute-hackathon-demo-workflow)
24. [Known Non-Blocking Limitations](#known-non-blocking-limitations)
25. [Future Scope](#future-scope)

---

## Overview

Most AI assistants and chat interfaces treat every session as a blank slate. They forget who you are, what you prefer, what tasks you have pending, and how your habits should inform your actions.

**SAGE** changes this fundamentally. By maintaining a continuous semantic memory of user preferences and active tasks, SAGE synthesizes multi-entity context before choosing and verifying every tool execution. When you speak to SAGE, it doesn't just return generic text—it grounds its reasoning in your real life, executes verified state transitions, and reports verifiable outcomes.

---

## Problem

Modern voice assistants and generic chatbots suffer from three fundamental architectural flaws:

1. **Context Blindness**: Every session starts with zero recollection of user habits, preferences, and deadlines.
2. **Action Disconnect & Hallucination**: LLMs generate plausible text claiming tasks were created, emails were sent, or items were scheduled, when nothing actually occurred.
3. **Passive Context Regurgitation**: Standard RAG simply dumps retrieved chunks into prompt templates without verifying whether the retrieved items are genuinely relevant to the user's immediate intent.

---

## Solution

SAGE introduces an active, closed-loop agentic architecture:
- **Ambient & Browser Voice**: Captures spoken commands seamlessly via Omi Wearable or Browser Web Speech API.
- **Context Relevance Gate**: Enforces the principle that **Retrieved Context $\ne$ Relevant Context**, pruning cross-domain memory leakage before reasoning occurs.
- **Multi-Entity Context Fusion**: Synthesizes preferences, active tasks, and recent action history into a compact `SageContext`.
- **Verified Action Execution**: Requires strict database verification post-execution. If a database mutation is not confirmed, SAGE reports failure rather than hallucinating success.
- **Transparent Command Center UI**: Real-time HUD displaying memory counters, pending task state, action verification pills, and context usage badges.

---

## Core Features

- 🧠 **Semantic Vector Memory**: Long-term preference recall powered by Qdrant and FastEmbed (`BAAI/bge-small-en-v1.5`).
- 🎯 **Context Relevance Gate**: Intelligently suppresses unrelated tasks and habits when addressing cross-domain queries (e.g. appointment scheduling).
- 📋 **Structured Task Lifecycle**: Natural language creation, listing, semantic matching, and verified completion of tasks.
- 🔒 **Defense-in-Depth Safety Gate**: Destructive actions (e.g., cancelling tasks, account deletion) halt for user confirmation before execution.
- 🎙️ **Multi-Modal Voice Ingestion**: Supports real-time webhook streaming from Omi Wearable as well as deduplicated browser microphone speech.
- 🛡️ **Zero Hallucinated Actions**: Success is only reported when post-execution verification checks confirm persistent database mutations.
- 💻 **Real-Time Command Center**: Modern, responsive dashboard with active context badges, activity telemetry, and manual/voice input.

---

## System Architecture

```text
OMI / Browser Voice
        │
        ▼
SAGE API
        │
        ▼
Orchestrator
        │
        ├───────────────┐
        ▼               ▼
Context Builder      Reasoner
        │               │
        ▼               ▼
Qdrant Memory      Action Registry
FastEmbed              │
        │               ├── Memory Tools
        │               └── Task Tools
        │
        ▼
Verification
        │
        ▼
Memory / Task Update
        │
        ▼
SAGE Response
        │
        ▼
Command Center UI
```

---

## Architecture Diagram

The execution path moves through 8 well-defined states:

```text
[Input] → [Understanding] → [Memory Retrieval & Relevance Gate] → [Context Fusion]
              │
              ▼
         [Reasoner (Lyzr / Local Fallback)]
              │
              ├── Direct Answer ────────────────────────────┐
              │                                             │
              ▼                                             ▼
       [Tool Selection]                              [State Update]
              │                                             │
              ▼                                             ▼
      [Action Execution]                             [Response Ready]
              │                                             │
              ▼                                             ▼
       [Verification] ──(Pass/Fail)────────────────── [Command Center HUD]
```

---

## Technology Stack

| Layer | Technology | Role |
| :--- | :--- | :--- |
| **Wearable Audio** | [Omi Hardware & Webhook](https://github.com/BasedHardware/Omi) | Ambient voice streaming, transcript ingestion, deduplication |
| **Vector Engine** | [Qdrant Vector Database](https://qdrant.tech/) | Persistent vector storage, payload filtering, user isolation |
| **Embeddings** | [FastEmbed](https://github.com/qdrant/fastembed) | Local embedding microservice running `BAAI/bge-small-en-v1.5` (384-dim) |
| **Agent Reasoning** | [Lyzr Agent Studio](https://lyzr.ai/) | Agent reasoning, tool definition, schema contracts |
| **Core API** | Node.js, Fastify, TypeScript | State machine orchestrator, Action Registry, Task Service |
| **Frontend UI** | React, Vite, TypeScript | SAGE Command Center with voice HUD and context telemetry |

---

## Single Public Website Architecture

To ensure judges can test SAGE without running local background processes, the production deployment integrates both frontend and backend under **one public origin**:

```text
Browser
   │
   ▼
ONE PUBLIC SAGE URL (HTTPS)
   │
   ├── SAGE Web Command Center (Static Assets + SPA Fallback)
   │
   └── API Endpoints (/orchestrator/*, /demo/*, /tasks/*, /health)
           │
           ├── Qdrant Cloud (384-dim Vector Storage)
           ├── FastEmbed Microservice (Local / Private Network)
           └── Lyzr Cloud (Agent Inference & Fallback)
```

- **Unified Origin**: No CORS friction; the browser makes relative requests (`/orchestrator/run`, `/health`, `/demo/context`, `/demo/reset`) directly to the host origin.
- **Route Precedence**: Fastify routes all API endpoints first. Any non-API paths serve the compiled React SPA `index.html`.
- **No Leaked Internal URLs**: Production client errors never leak localhost or internal hostnames.

---

## Omi Integration

SAGE provides full native support for the **Omi Wearable**:
- **Webhook Endpoint**: `POST /omi/webhook?uid=:userId` ingests live transcript chunks.
- **Direct Endpoint**: `POST /omi/input` accepts formatted transcript payloads.
- **HMAC Authentication**: Validates webhook authenticity using SHA-256 HMAC headers.
- **Segment Deduplication**: Caches chunk hashes to ignore re-transmitted speech segments.
- **Source Tagging**: Memories and tasks recorded via Omi are tagged with `source: "omi"` in Qdrant payloads.

---

## Qdrant Vector Memory Integration

Persistent vector storage is handled via Qdrant Cloud or local instances:
- **Collection Name**: `sage_memories`
- **Vector Dimension**: `384` (Cosine distance)
- **User Isolation**: All vector similarity queries and payload scrolls require strict `userId` filter matching to guarantee tenant isolation.
- **Payload Schema**: Each memory point stores:
  ```json
  {
    "id": "uuid",
    "userId": "user-123",
    "content": "I study best at night.",
    "type": "preference",
    "source": "omi",
    "createdAt": "2026-09-26T12:00:00.000Z"
  }
  ```

---

## FastEmbed Microservice Integration

Vector embeddings are generated locally using FastEmbed:
- **Service Port**: `http://127.0.0.1:8000` (or dynamic platform `$PORT`)
- **Model**: `BAAI/bge-small-en-v1.5`
- **Prefix Support**: Prepends `"passage: "` for indexing and `"query: "` for retrieval queries.
- **Self-Hosted & Private**: Runs completely on-device/private network without cloud embedding API dependencies or token fees.

---

## Lyzr Agent & Tool Integration

SAGE integrates with Lyzr AI for tool orchestration and OpenAPI specifications:
- **Tool Contracts**: OpenAPI 3.0 specification exported at `/openapi.json`.
- **Integrated Tools**:
  - `save_memory`: Stores user preferences and facts to Qdrant.
  - `search_memory`: Semantic vector search over stored memories.
  - `forget_memory`: Removes specific memories from persistent storage.
  - `create_task`: Persists structured pending tasks with deadlines.
  - `list_tasks`: Retrieves active vs. completed tasks.
  - `complete_task`: Marks tasks as completed after verification.
  - `cancel_task`: Destructive cancellation (requires confirmation).
- **Graceful Fallback**: If Lyzr Cloud Studio free-tier inference is exhausted (HTTP 402), SAGE's internal deterministic reasoner activates immediately to ensure 100% demo reliability.

---

## Memory Architecture

SAGE categorizes long-term records into explicit types:
1. **Preferences**: Habits, routines, and constraints (e.g., *"I study best at night."*).
2. **Facts**: Fixed personal attributes (e.g., *"My preferred IDE is IntelliJ IDEA."*).
3. **Context**: Ephemeral conversation observations.
4. **Tasks**: Pending and completed items (`type: "task"`), which are strictly distinguished from personal preferences.

---

## Task & Action Architecture

Tasks are managed by the unified TaskService:
- Persisted in Qdrant with `type: "task"` and `status: "pending" | "completed" | "cancelled"`.
- Support due dates, natural language titles, and semantic lookup.
- **Task Reference Rule**: Pending tasks are only injected into context when the user explicitly asks about tasks, refers to a task by name, or requests task planning. Unrelated requests (e.g., booking appointments) suppress task inclusion.

---

## Safety & Confirmation Gates

To eliminate unintended side effects and hallucinations:
- **Confirmation Required**: Destructive tools (e.g., `cancel_task`, `delete_account`) return a `requiresConfirmation` status. SAGE will not execute the mutation until the user replies with confirmation.
- **Mandatory Verification**: Every action executor is paired with a verifier. The verifier queries the database to confirm that the state actually changed. If the check fails, the orchestrator returns an error rather than false success.
- **Confidential Reasoning**: Private model thoughts are kept internal. Only concise, explainable execution milestones (e.g., `✓ Memory saved`, `✓ Task completed`) are sent to the client.

---

## User-Facing Command Center

The web frontend (`apps/web`) provides an intuitive Command Center HUD:
- **Live HUD Metrics**: Memory counters, active task counters, and connection status.
- **Context Fusion Badges**: Real-time display showing exactly what stored memory or task informed the response.
- **Action Verification Pills**: Instant visual confirmation when actions are verified in the database.
- **Microphone Voice Input**: Browser Web Speech API with real-time speech deduplication.
- **Responsive Layout**: Designed for presentation on laptops, tablets, and mobile screens.

---

## The Agentic Loop Explained

```text
LISTEN ──► REMEMBER ──► REASON ──► ACT ──► VERIFY
```
1. **Listen**: User speaks or types an intent.
2. **Remember**: Memory service fetches candidates; the Relevance Gate filters out cross-domain noise.
3. **Reason**: The reasoner evaluates the fused context (`SageContext`) and selects tools.
4. **Act**: The strongly typed action executor runs against local or remote services.
5. **Verify**: The verifier confirms database state change.
6. **Respond**: A concise, helpful answer is delivered to the user with transparent execution milestones.

---

## Local Development Setup

### Prerequisites
- Node.js $\ge 18$
- Python $\ge 3.10$
- Qdrant Cloud cluster or local Docker container

### 1. Clone the Repository
```bash
git clone https://github.com/yashasgowdacr/sage-personal-context-agent.git
cd sage-personal-context-agent
```

### 2. Setup Embedding Microservice
```bash
cd services/embeddings
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

### 3. Setup Backend API & Web Frontend
```bash
# Terminal 2: Start API (serves static UI or API routes)
cd apps/api
npm install
npm run dev

# Terminal 3: Start Web Dev Server (optional for HMR during development)
cd apps/web
npm install
npm run dev
```

---

## Production Deployment (Render Blueprint)

The repository includes a ready-to-use [`render.yaml`](file:///Users/apple/Documents/SAGE/render.yaml) Blueprint:

1. **Push to GitHub**: Connect your GitHub repository `yashasgowdacr/sage-personal-context-agent`.
2. **New Blueprint Instance**: On Render, select **New + $\rightarrow$ Blueprint**.
3. **Automatic Provisioning**:
   - `sage-app`: Builds web frontend (`apps/web/dist`) and API server (`apps/api/dist`), exposing a single unified public URL.
   - `sage-embeddings`: Builds Python FastEmbed microservice.
4. **Environment Secrets**: Input `QDRANT_URL`, `QDRANT_API_KEY`, and `LYZR_API_KEY` in the Render dashboard.

---

## Environment Variables

Configure in your deployment platform or `apps/api/.env`:

```env
NODE_ENV=production
PORT=3001
HOST=0.0.0.0

# Qdrant Vector Database
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# Lyzr Agent Studio
LYZR_API_KEY=your-lyzr-api-key
LYZR_AGENT_ID=your-lyzr-agent-id
LYZR_AGENT_URL=https://agent-prod.studio.lyzr.ai/v3/inference/chat/

# FastEmbed Microservice (Internal or localhost)
EMBEDDING_SERVICE_URL=http://127.0.0.1:8000

# SAGE Internal Tool Security Key
SAGE_TOOL_API_KEY=your-secure-internal-tool-key

# Demo Mode (Predictable deterministic demo user state)
SAGE_DEMO_MODE=true
```

---

## Example Commands & Prompts

| User Intent | Prompt Example | Expected SAGE Behavior |
| :--- | :--- | :--- |
| **Store Preference** | *"Remember that I study best at night."* | Persists preference to Qdrant vector store. |
| **Create Task** | *"Create a task to finish my DBMS assignment tomorrow."* | Parses title & deadline, creates pending task. |
| **Context Fusion** | *"What should I work on tonight?"* | Synthesizes study habit + DBMS task into advice. |
| **Task Completion** | *"I finished my DBMS assignment."* | Verifies and marks task as completed. |
| **State Listing** | *"What tasks do I have left?"* | Confirms 0 pending tasks remain without hallucination. |
| **Memory Recall** | *"What do you remember about me?"* | Retrieves stored night study preference. |
| **Cross-Domain Query**| *"Schedule an appointment with doctor"* | Asks for appointment date & time; excludes DBMS task. |

---

## Testing & Verification

Run the full automated test suite:

```bash
cd apps/api

# 1. Typecheck
npx tsc --noEmit

# 2. Context Fusion Suite
npx tsx src/context/context.test.ts

# 3. Context Relevance & Cross-Domain Regression Suite
npx tsx src/context/relevance.test.ts

# 4. Memory Tools Verification
npx tsx src/tools/test-memory-tools.ts

# 5. Task Service Unit Tests
npx tsx src/tasks/tasks.test.ts

# 6. Task Tool Verification
npx tsx src/tools/test-task-tools.ts

# 7. Orchestrator State Machine Suite (14 tests)
npx tsx src/orchestrator/orchestrator.test.ts

# 8. Omi Ingestion Suite (7 tests)
npx tsx src/omi/omi.test.ts

# 9. Lyzr E2E Tool Contracts
npx tsx src/agent/test-lyzr-agent-tools.ts

# 10. Web Voice Deduplication Suite
cd ../web
npx tsx src/components/voice-dedup.test.ts

# 11. Web Production Build
npm run build
```

---

## 4-to-5 Minute Hackathon Demo Workflow

Follow this live demo sequence in the Command Center (`https://translation-summary-intent-draft.trycloudflare.com` or local `http://localhost:3001`):

1. **Introduction (0:00–0:30)**: Introduce SAGE: *"Instead of treating every conversation as a blank slate, SAGE builds personal context and uses it to act."*
2. **Teach Personal Preference (0:30–1:15)**:
   - Type or speak: *"Remember that I study best at night."*
   - Highlight: Memory card updates in sidebar; execution pill displays `✓ Memory saved`.
3. **Create Structured Task (1:15–2:00)**:
   - Type or speak: *"Create a task to finish my DBMS assignment tomorrow."*
   - Highlight: Task appears in Tasks panel as `PENDING` with `Tomorrow` deadline.
4. **Context Fusion (2:00–2:45)**:
   - Ask: *"What should I work on tonight?"*
   - Highlight: SAGE responds *"Since you prefer studying at night, tonight would be a good time to work on your DBMS assignment."*
   - Point out the `🧠 CONTEXT USED` badges for Study preference and Pending DBMS task.
5. **Task Completion & Verification (2:45–3:30)**:
   - Say: *"I finished my DBMS assignment."*
   - Show: Task is marked completed and verified in the database.
   - Ask: *"What tasks do I have left?"* $\rightarrow$ SAGE confirms *"You have no pending tasks."*
6. **Cross-Domain Relevance Test (3:30–4:15)**:
   - Ask: *"Schedule an appointment with doctor."*
   - Highlight: SAGE asks *"I can help with that. What date and time would you like for the appointment?"*
   - Point out that SAGE **does not mention DBMS** and **does not attach unrelated study habits**.
7. **Conclusion (4:15–4:45)**: Summarize the Listen $\rightarrow$ Remember $\rightarrow$ Reason $\rightarrow$ Act $\rightarrow$ Verify architecture.

---

## Known Non-Blocking Limitations

1. **Lyzr Cloud Free-Tier Inference Credits (HTTP 402)**: The Lyzr Studio free-tier credits for the test account are exhausted. All OpenAPI tool definitions and contracts remain 100% compliant, and SAGE seamlessly switches to its deterministic local reasoner fallback with zero downtime.
2. **Local Python FastEmbed Daemon**: Requires running Python microservice for local vector embedding generation.
3. **Action Tracker Ephemerality**: The rolling 10-turn recent action log is stored in-memory in the API process and resets upon server restart (long-term memories and tasks are persistently preserved in Qdrant).

---

## Future Scope

1. **Direct Calendar Integration**: Integration with Google Calendar and CalDAV to schedule verified calendar events upon user confirmation.
2. **On-Device ONNX Embedding Pipeline**: Embedding generation directly inside Node.js to eliminate external Python daemon dependencies.
3. **Multi-Modal Vision Understanding**: Ingestion of camera frames from wearable hardware to combine visual scene memory with speech context.
