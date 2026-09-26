# SAGE

Listen. Remember. Reason. Act.

Personal Context & Action Agent powered by Omi Wearable, Lyzr AI, Qdrant Vector Memory, and FastEmbed.

---

## Problem

Modern voice assistants and LLM chat interfaces suffer from three critical shortcomings:

1. **Context Blindness:** They lack persistent, longitudinal memory of personal user preferences, habits, and schedules. Every interaction begins from a blank slate.
2. **Action Disconnect:** They can generate fluent conversational text, but cannot execute reliable, verified actions against real-world systems, often hallucinating that an action succeeded when nothing occurred.
3. **Passive Retrieval:** When assistants do search memory, they regurgitate raw facts rather than synthesizing multi-entity context (preferences + active tasks + recent history) into personalized decisions.

---

## Solution

SAGE is an autonomous Personal Context & Action Agent that combines continuous ambient voice from wearable hardware (Omi) with persistent semantic memory (Qdrant), local fast embeddings (FastEmbed), and agent reasoning (Lyzr).

Instead of passively answering:
> *"You have 1 pending task."*

SAGE performs Multi-Entity Context Fusion and reasons:
> *"Since you prefer studying at night, tonight would be a good time to work on your DBMS assignment."*

SAGE guarantees **execution integrity**: every action is selected, executed through strict contracts, and verified before claiming success.

---

## Architecture

```text
                    ┌──────────┐
                    │   OMI    │
                    └────┬─────┘
                         │
                         ▼
                ┌──────────────────┐
                │ SAGE Orchestrator│
                └───────┬──────────┘
                        │
               ┌────────▼─────────┐
               │  Context Fusion  │
               └────────┬─────────┘
                        │
            ┌───────────┼───────────┐
            ▼           ▼           ▼
         Qdrant       Tasks      Actions
            │           │           │
            └───────────┼───────────┘
                        ▼
                    ┌───────┐
                    │ Lyzr  │
                    └───┬───┘
                        │
                        ▼
                     Tools
                        │
                        ▼
                   Verification
                        │
                        ▼
                     Qdrant
                        │
                        ▼
                       OMI
```

---

## How It Works

The complete SAGE intelligence lifecycle follows an 8-stage state machine:

```text
Understand → Retrieve Context → Context Fusion → Reason → Select Tools → Execute → Verify → Update Memory → Respond
```

1. **Listen:** Ambient audio segments are captured by the Omi wearable and ingested via the real-time SAGE Omi webhook.
2. **Remember:** Facts, observations, and personal preferences are extracted, vectorized into 384-dimensional dense vectors using FastEmbed, and persisted in Qdrant.
3. **Retrieve:** When a query arrives, SAGE performs vector semantic search with an empirical relevance threshold ($\ge 0.70$) to filter out irrelevant memories.
4. **Context Fusion:** SAGE combines relevant memories, active pending tasks, and recent action history into a compact `SageContext` without exposing raw reasoning traces or chain-of-thought tokens.
5. **Reason:** The Lyzr Agent evaluates the fused context and selects the appropriate tool or conversational strategy.
6. **Act:** SAGE invokes strongly typed tools (`create_task`, `complete_task`, `save_memory`, etc.).
7. **Verify:** Every tool execution undergoes validation against persistence stores. If verification fails, SAGE reports failure rather than hallucinating success.
8. **Feedback:** Verified results are reflected back to Omi audio playback with explainable execution events for UI transparency.

---

## Technology Stack

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Voice Interface** | [Omi Wearable](https://github.com/BasedHardware/Omi) | Captures speech transcripts, speaker diarization, and context segments |
| **Embeddings** | [FastEmbed](https://github.com/qdrant/fastembed) | Local embedding service running `BAAI/bge-small-en-v1.5` (384 dimensions) |
| **Vector Memory** | [Qdrant](https://qdrant.tech/) | Cloud/Local vector database for semantic recall, structured payload filtering, and user isolation |
| **Agent Reasoning** | [Lyzr Agent API](https://lyzr.ai/) | Cloud agent reasoning engine with tool orchestration and local fallback reasoner |
| **Core API & Engine** | Node.js, Fastify, TypeScript | Strict typed orchestrator, state transition logger, action registry, and task service |

---

## Memory Architecture

SAGE memory is organized hierarchically inside Qdrant collection `sage_memories`:

```text
Qdrant Collection: "sage_memories"
├── User Partition: userId
│   ├── Type: "preference" (e.g., "I study best at night.")
│   ├── Type: "fact"       (e.g., "My preferred editor is IntelliJ IDEA.")
│   ├── Type: "task"       (e.g., "Finish DBMS assignment", status: pending/completed)
│   └── Type: "context"    (conversation context & observations)
```

- **Embedding Model:** `BAAI/bge-small-en-v1.5` with passage/query prefix differentiation.
- **Empirical Relevance Threshold:** Cosine similarity threshold $\ge 0.70$ prevents context dilution from unrelated memories.
- **Strict User Isolation:** All vector queries and payload scrolls require matching `userId` metadata filter.

---

## Agent Architecture

SAGE employs a decoupled reasoner architecture:

- **Primary Reasoner (`LyzrReasonerAdapter`):** Sends fused, compact context to Lyzr Agent Studio endpoints to drive high-level cognitive tool selection and natural language responses.
- **Deterministic Reasoner (`StandardReasoner`):** High-reliability rule and pattern engine that parses task creation, temporal deadlines, status transitions, and context fusion recommendations. Serves as instantaneous local fallback when cloud inference is offline.
- **Action Registry (`ActionRegistry`):** Sandboxed registry of typed tool executors and verifiers (`save_memory`, `search_memory`, `forget_memory`, `create_task`, `list_tasks`, `complete_task`, `cancel_task`).

---

## Safety

SAGE enforces defense-in-depth safety principles:

1. **No Hallucinated Actions:** Never report an action succeeded unless its executor returns `success: true` and the post-execution verification function verifies database state change.
2. **Destructive Action Safety Gate:** Sensitive operations (e.g., `cancel_task`, `delete_account`) require explicit confirmation tokens before execution.
3. **No Chain-of-Thought Leakage:** Private model thoughts and internal scratchpads are kept confidential. UI only receives explainable execution milestones.
4. **Credential Redaction:** The orchestration logger automatically scrubs secrets, keys, and tokens from all stdout traces.

---

## Demo

Experience SAGE's 5-turn intelligence loop:

```text
Turn 1: User: "Remember that I study best at night."
        SAGE: "I've remembered that for you."
        [Ingests preference to Qdrant via FastEmbed]

Turn 2: User: "Add a task to finish my DBMS assignment tomorrow."
        SAGE: "I've added 'Finish my DBMS assignment' to your tasks for tomorrow."
        [Creates structured task, records in ActionTracker]

Turn 3: User: "What should I work on tonight?"
        SAGE: "Since you prefer studying at night, tonight would be a good time to work on your DBMS assignment."
        [Multi-entity context fusion: preference + pending task + request]

Turn 4: User: "I finished my DBMS assignment."
        SAGE: "Marked your Finish my DBMS assignment as completed."
        [Executes complete_task, verifies in Qdrant store]

Turn 5: User: "What tasks do I have left?"
        SAGE: "You have no pending tasks."
        [Dynamic zero-hallucination verification]
```

### Visual Execution Timeline Box

```text
┌──────────────────────────────────────────────────────────┐
│ SAGE                                                     │
│ Turn 3: Multi-Entity Context Fusion                      │
├──────────────────────────────────────────────────────────┤
│ 🎙 Voice received                                         │
│ ✓ Understanding request                                  │
│ ✓ Memory matched                                         │
│ ✓ Pending task found                                     │
│ 🤖 Lyzr reasoning                                         │
│ 🔧 Synthesize response                                    │
│ 🔊 Response ready                                         │
└──────────────────────────────────────────────────────────┘
```

---

## Installation

### Prerequisites

- Node.js $\ge 18$
- Python $\ge 3.10$ (for FastEmbed microservice)
- Qdrant Cloud cluster or local Docker container

### 1. Clone Repository

```bash
git clone https://github.com/your-username/SAGE.git
cd SAGE
```

### 2. Setup Embedding Service

```bash
cd services/embeddings
python3 -m venv .venv
source .venv/bin/activate
pip install fastapi uvicorn fastembed pydantic
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

### 3. Setup SAGE API

```bash
cd ../../apps/api
npm install
cp ../../.env.example .env
```

---

## Environment Variables

Edit `apps/api/.env`:

```env
NODE_ENV=development
PORT=3001
HOST=0.0.0.0

# Qdrant Vector Database
QDRANT_URL=https://your-cluster.qdrant.io
QDRANT_API_KEY=your-qdrant-api-key

# Lyzr Agent
LYZR_API_KEY=your-lyzr-api-key
LYZR_AGENT_ID=your-lyzr-agent-id
LYZR_AGENT_URL=https://agent-prod.studio.lyzr.ai/v3/inference/chat/

# Local FastEmbed Service
EMBEDDING_SERVICE_URL=http://127.0.0.1:8000

# SAGE Tool Authentication Key
SAGE_TOOL_API_KEY=your-secure-internal-tool-key

# Demo Mode (Predictable demo state, deterministic test user)
SAGE_DEMO_MODE=true
```

---

## Running Locally

### Start Embedding Microservice (Port 8000)

```bash
cd services/embeddings
.venv/bin/python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

### Start SAGE API Dev Server (Port 3001)

```bash
cd apps/api
npm run dev
```

---

## API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | System health and uptime status |
| `POST` | `/omi/webhook?uid=:userId` | Omi wearable transcript ingestion endpoint |
| `POST` | `/omi/input` | Normalized direct transcript endpoint |
| `POST` | `/orchestrator/run` | Direct orchestration execution (`x-sage-tool-key` required) |
| `POST` | `/api/tasks` | Create task endpoint |
| `GET` | `/api/tasks` | List tasks endpoint (supports status filter) |
| `POST` | `/demo/reset` | Resets demo user state (available when `SAGE_DEMO_MODE=true`) |
| `GET` | `/demo/status` | Demo mode configuration status |
| `GET` | `/openapi.json` | Complete OpenAPI 3.0 tool contract specification |

---

## Testing

Run the full end-to-end regression and verification suite:

```bash
cd apps/api

# 1. Typecheck
npx tsc --noEmit

# 2. Context Fusion Verification
npx tsx src/context/context.test.ts

# 3. Memory Tools
npx tsx src/tools/test-memory-tools.ts

# 4. Task Service Unit Tests
npx tsx src/tasks/tasks.test.ts

# 5. Task Tool Contracts
npx tsx src/tools/test-task-tools.ts

# 6. Orchestrator State Machine (14 tests)
npx tsx src/orchestrator/orchestrator.test.ts

# 7. Omi Adapter & Webhook Tests (7 tests)
npx tsx src/omi/omi.test.ts

# 8. Lyzr E2E Tool Contracts & Safety Gates
npx tsx src/agent/test-lyzr-agent-tools.ts

# 9. Final Hackathon Judge Demo (5 turns)
npx tsx src/omi/demo-final.ts
```

---

## Future Scope

1. **Multi-Modal Vision Fusion:** Integrate Omi camera frames with Qdrant multi-vector index to answer queries about physical objects in the user's field of view.
2. **Proactive Intervention:** Trigger ambient voice reminders when the user's calendar indicates high likelihood of conflict or context switching.
3. **Federated On-Device Qdrant:** Transition vector storage directly onto local edge hardware for zero-cloud latency and complete privacy guarantees.
