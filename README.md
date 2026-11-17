# SAGE — Personal Context Agent

**A conversational assistant that combines Groq reasoning with personal memory, semantic retrieval, and persistent chat history.**

[Open SAGE](https://sage-personal-context-agent.vercel.app/)

SAGE uses Groq to understand requests and decide when to retrieve or update personal context. Qdrant stores semantic memories and tasks, Neon stores conversations, and FastEmbed creates vectors for similarity search.

## Technology

| Area | Technology | Purpose |
| --- | --- | --- |
| Web client | React, TypeScript, Vite | Chat interface and conversation history |
| API | Node.js, TypeScript, Fastify | Authenticated API and agent orchestration |
| Reasoning | Groq API, OpenAI-compatible SDK | Understands requests, chooses tools, writes responses |
| Vector memory | Qdrant Cloud | Stores and retrieves user-scoped memories and tasks |
| Embeddings | FastEmbed, `BAAI/bge-small-en-v1.5` | Produces 384-dimensional semantic vectors |
| Conversation database | Neon Serverless Postgres | Persists conversations and messages |
| Frontend hosting | Vercel | Hosts the public web application |
| API and container hosting | Render | Runs the API and, in the Docker deployment, FastEmbed |
| Container | Docker | Packages Python embeddings and the Node API together |

## How a request works

1. The browser sends a message and the active conversation ID to the SAGE API.
2. The API loads recent messages from Neon and relevant user-scoped context from Qdrant.
3. Groq reasons over the request, conversation, and retrieved context, then selects a tool when useful.
4. SAGE executes the selected memory or task operation against Qdrant.
5. Groq receives the operation result and writes the final conversational response.
6. The user message and assistant response are saved to Neon for the recent-chat list and history view.

```text
Vercel web client → Render API → Groq
                              ├→ Neon Postgres: conversations and messages
                              ├→ Qdrant: memories and tasks
                              └→ FastEmbed: semantic vector generation
```

Neon and Qdrant have distinct roles: Neon stores chat transcripts; Qdrant stores searchable personal context and task records.

## Features

- Groq-driven conversational responses and tool selection
- Semantic memory retrieval and updates using Qdrant and FastEmbed
- Persistent recent chats and message history in Neon
- User-scoped memory, task, and conversation queries
- Task creation, listing, completion, and cancellation
- Browser voice input
- Session cookies, API key protection for integrations, explicit CORS origin, and API rate limiting
- Health endpoint at `/health`

## Deployment

### Live application

The frontend is hosted on Vercel:

**[https://sage-personal-context-agent.vercel.app/](https://sage-personal-context-agent.vercel.app/)**

The Vite client uses `VITE_SAGE_API_URL` to reach the public SAGE API. Configure that variable in Vercel to the Render API URL, then redeploy the frontend after changing it.

### Render API and FastEmbed

The repository includes a root `Dockerfile` for running the API and the embedding service in one Render web service. FastEmbed listens internally on `127.0.0.1:8000`; the API listens on Render's assigned `$PORT`.

Configure the Render service with:

| Setting | Value |
| --- | --- |
| Service | Web Service |
| Runtime | Docker |
| Branch | `main` |
| Root directory | Repository root |
| Dockerfile | `Dockerfile` |
| Health check path | `/health` |

Render injects `PORT`; do not set a fixed API port in the Render dashboard. The Docker image excludes local environment files through `.dockerignore`.

### Environment variables

Set these in the Render API service environment. Keep values private and never place server secrets in Vercel's `VITE_` variables.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon pooled Postgres connection used by the API |
| `GROQ_API_KEY` | Server-side Groq API credential |
| `GROQ_MODEL` | Groq model name, currently `openai/gpt-oss-20b` |
| `GROQ_BASE_URL` | Groq OpenAI-compatible endpoint, `https://api.groq.com/openai/v1` |
| `QDRANT_URL` | Qdrant Cloud cluster URL |
| `QDRANT_API_KEY` | Qdrant Cloud credential |
| `SAGE_SESSION_SECRET` | Signs browser session cookies |
| `SAGE_TOOL_API_KEY` | Protects trusted API integrations |
| `WEB_ORIGIN` | Exact public Vercel origin allowed by CORS |
| `NODE_ENV` | Set to `production` |
| `HOST` | Set to `0.0.0.0` |
| `EMBEDDING_SERVICE_URL` | In the single-container deployment, `http://127.0.0.1:8000` |

For a separate FastEmbed Render service instead of the combined Docker service, configure `EMBEDDING_SERVICE_HOST` and `EMBEDDING_SERVICE_PORT` on the API service according to Render's private networking details.

## Local development

Requirements: Node.js, Python 3.11+, a Neon database, a Qdrant collection, and a Groq API key.

Install JavaScript dependencies:

```bash
npm --prefix apps/web install
npm --prefix apps/api install
```

Configure the API environment in `apps/api/.env`. Provide the required variables listed above and set:

```env
EMBEDDING_SERVICE_URL=http://127.0.0.1:8000
WEB_ORIGIN=http://localhost:3001
```

Run FastEmbed in one terminal:

```bash
cd services/embeddings
python -m venv .venv
```

Activate the environment and install dependencies:

```powershell
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn server:app --host 127.0.0.1 --port 8000
```

Run the API in another terminal:

```bash
cd apps/api
npm run dev
```

Run the Vite client in a third terminal when using a separate frontend development server:

```bash
cd apps/web
npm run dev
```

The API can serve the built web client from `apps/web/dist`; the local API default is `http://localhost:3001`.

## Build

From the repository root:

```bash
npm run build
```

The command builds the React client and type-checks/compiles the API.

## API overview

- `GET /health` — service health
- `POST /auth/login`, `GET /auth/me`, `POST /auth/logout` — browser session endpoints
- `POST /orchestrator/run` — conversational agent endpoint
- `/conversations` — list a user's recent conversations and retrieve messages
- `/memory` — memory operations
- `/tasks` — task operations
- `/context` — current personal context
- `/omi` — Omi wearable integration

Refer to `apps/api/openapi.yaml` for the API contract.

## Data and privacy notes

- Conversation history is stored in Neon Postgres.
- Semantic memories and task records are stored in Qdrant with user identifiers used in retrieval filters.
- Groq receives the current request, bounded conversation context, and relevant retrieved context needed to answer.
- The current username-only sign-in identifies a workspace but does not verify a real-world identity. Use it for the project's intended setup; do not treat it as strong authentication for sensitive public deployments.
- Keep `.env`, `.env.local`, database URLs, and provider keys out of Git. `.dockerignore` prevents local environment files from entering the Docker build context.

## Repository layout

```text
apps/
  api/                 Fastify API, orchestration, tools, Neon and Qdrant access
  web/                 React and Vite client
services/
  embeddings/          FastAPI service backed by FastEmbed
Dockerfile             Combined Render API and embeddings image
render.yaml            Render service configuration
neon.ts                Neon project configuration
```
