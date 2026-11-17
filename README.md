# SAGE Personal Context Agent

SAGE is a production-oriented personal context assistant using Groq for reasoning, Qdrant for user-isolated memory, and FastEmbed for semantic search.

## Production services

- `apps/api`: Fastify API, authentication, Groq orchestration, Qdrant memory, and tasks.
- `apps/web`: React client.
- `services/embeddings`: FastEmbed HTTP service.

## Environment

The active environment file is `apps/api/.env`. Configure the Qdrant, Groq, embedding-service, and session settings there. Do not commit it.

## Run locally

```powershell
cd services/embeddings
.\.venv\Scripts\python -m uvicorn server:app --host 0.0.0.0 --port 8000
```

```powershell
cd apps/api
npm run dev
```

The application is available at `http://localhost:3001`.
