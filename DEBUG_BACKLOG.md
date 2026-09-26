# SAGE Debug Backlog

This backlog documents known issues, architectural constraints, and deferred improvements identified during the finalization and freeze of Milestones 11–13. No breaking code modifications will be introduced during the freeze.

---

## Critical
Only issues that prevent the application/demo from running.

None identified during finalization.

---

## High
Issues that could affect judging or production reliability.

### Issue 1: Lyzr Cloud Studio Account Free-Tier Credits Exhausted (HTTP 402)
- **File**: [`apps/api/src/agent/lyzr-client.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/agent/lyzr-client.ts), [`apps/api/src/agent/test-lyzr-agent-tools.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/agent/test-lyzr-agent-tools.ts)
- **Evidence**:
  ```text
  Probe HTTP Status: 402 Payment Required
  ⚠️ LYZR ACCOUNT STATUS: HTTP 402 Payment Required (Credits exhausted).
  Lyzr Studio account (yashasgowdacr25@gmail.com) has exhausted its free-tier platform credits.
  ```
- **Impact**: While Lyzr Agent tool schemas, OpenAPI specifications, and contracts (`save_memory`, `create_task`, `list_tasks`) pass verification, live cloud inference requests via Lyzr Studio API will return HTTP 402 until credits are recharged. The system relies on its local orchestrator reasoning fallback for zero-downtime execution.
- **Reproduction**:
  Run `npx tsx src/agent/test-lyzr-agent-tools.ts` in `apps/api`.
- **Suggested future fix**:
  Recharge credits on [studio.lyzr.ai](https://studio.lyzr.ai) for the registered API key or update `LYZR_API_KEY` with an active enterprise or refreshed account key.

---

### Issue 2: External Dependency on FastEmbed Microservice Daemon
- **File**: [`apps/api/src/memory/embeddings.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/memory/embeddings.ts), [`services/embeddings/server.py`](file:///Users/apple/Documents/SAGE/services/embeddings/server.py)
- **Evidence**:
  If the Python FastAPI daemon (`http://127.0.0.1:8000`) is stopped, embedding calls throw connection errors:
  ```text
  FetchError: request to http://127.0.0.1:8000/embed failed, reason: connect ECONNREFUSED 127.0.0.1:8000
  ```
- **Impact**: SAGE API cannot perform semantic vector embeddings or similarity searches in Qdrant if the microservice process terminates.
- **Reproduction**:
  Stop the background process on port 8000 and run `npx tsx src/memory/embeddings.ts`.
- **Suggested future fix**:
  Implement an automated health-check retry loop or native Node.js ONNX runtime embedding fallback (`@xenova/transformers` / `onnxruntime-node`) so SAGE can run completely self-contained in a single Node process if needed.

---

## Medium
Non-blocking reliability/usability issues.

### Issue 1: In-Memory Action History Ephemerality
- **File**: [`apps/api/src/orchestrator/action-tracker.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/orchestrator/action-tracker.ts)
- **Evidence**:
  ```typescript
  export class ActionTracker {
    private actions: TrackedAction[] = [];
  }
  ```
- **Impact**: While tasks and memories persist in Qdrant Cloud across restarts, the rolling 10-item action audit log is stored in memory and is cleared upon API process restart.
- **Reproduction**:
  Restart the API server; `actionTracker.getRecentActions(userId)` returns `[]`.
- **Suggested future fix**:
  Persist `TrackedAction` entries to a dedicated Qdrant collection or SQLite/Postgres audit store alongside memory payloads.

---

### Issue 2: Task Title Parsing for Colloquial Phrasing
- **File**: [`apps/api/src/orchestrator/reasoner.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/orchestrator/reasoner.ts)
- **Evidence**:
  Colloquial phrases like *"Mark the assignment as done"* or *"I wrapped up DBMS"* rely on substring matches or semantic similarity. Highly abstract completions like *"I finished that homework from yesterday"* may not match if semantic similarity falls below the threshold.
- **Impact**: Edge-case conversational phrasing might fail to resolve the correct task to complete without follow-up clarification.
- **Reproduction**:
  Create task "Finish my DBMS assignment", then submit utterance "I wrapped up that thing".
- **Suggested future fix**:
  Enhance multi-turn entity resolution using conversational memory history and candidate disambiguation.

---

### Issue 3: Presentation Layer Coupling — Separating Clean Voice Output from Hackathon/Debug Timeline
- **File**: [`apps/api/src/omi/demo-final.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/omi/demo-final.ts), [`apps/api/src/demo/timeline.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/demo/timeline.ts)
- **Evidence**:
  `demo-final.ts` prints detailed hackathon verification assertions, fused context breakdowns, and ASCII timeline boxes to stdout alongside the spoken response. Standard end-user voice/chat interaction needs only the concise conversational response.
- **Impact**: Terminal outputs for judge demonstration combine verification diagnostics with user speech. Normal SAGE interaction should expose only the concise response at the presentation layer while retaining internal telemetry.
- **Reproduction**:
  Run `npx tsx src/omi/demo-final.ts`. Notice full ASCII timeline boxes and Qdrant verification metrics alongside user responses.
- **Suggested future fix**:
  Keep internal telemetry (`executionEvents`, `context fusion`, `action tracking`, `verification`) in `SageOrchestrator` and `OmiAdapter`, and introduce a presentation-layer toggle (`SAGE_OUTPUT_MODE=concise|judge` or CLI `--quiet` flag) or an interactive client runner that prints solely the natural language response without modifying core pipelines.

---

## Low
Cleanup/refactoring/documentation improvements.

### Issue 1: Production TypeScript Build Configuration (`npm run build`)
- **File**: [`apps/api/package.json`](file:///Users/apple/Documents/SAGE/apps/api/package.json), [`apps/api/tsconfig.json`](file:///Users/apple/Documents/SAGE/apps/api/tsconfig.json)
- **Evidence**:
  The development environment runs via `tsx`, and the production script is set to `"start": "node dist/server.js"`.
- **Impact**: `npm run build` runs `tsc`, but if ES module resolution or path aliases differ in transpiled output, `node dist/server.js` may require build-step validation before Docker containerization.
- **Reproduction**:
  Run `npm run build && npm start` in `apps/api`.
- **Suggested future fix**:
  Add `tsup` or `esbuild` bundling to produce a standalone single-file distribution bundle in `dist/`.

---

### Issue 2: Dedicated Test for Logger Redaction
- **File**: [`apps/api/src/utils/logger.ts`](file:///Users/apple/Documents/SAGE/apps/api/src/utils/logger.ts)
- **Evidence**:
  Credential redaction was manually verified via `git ls-files` and grep searches.
- **Impact**: No automated unit test enforces regression prevention if new credential keys are added to `.env`.
- **Reproduction**:
  No test failure occurs because the test does not exist.
- **Suggested future fix**:
  Add `src/utils/logger.test.ts` verifying that objects with `apiKey`, `LYZR_API_KEY`, and bearer tokens are automatically masked before stdout writing.
