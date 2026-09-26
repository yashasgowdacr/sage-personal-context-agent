import "dotenv/config";
import assert from "node:assert/strict";
import { OmiAdapter, type SageOrchestratorClient } from "./adapter.js";
import { SageOrchestrator } from "../orchestrator/orchestrator.js";
import { ActionRegistry } from "../orchestrator/registry.js";
import { StandardReasoner } from "../orchestrator/reasoner.js";
import type { SageActionTool, ToolExecutionContext, ToolExecutionResult } from "../orchestrator/types.js";

async function runTests() {
  console.log("=== SAGE OMI ADAPTER TEST SUITE ===\n");

  let passed = 0;
  let failed = 0;

  // TEST 1 — Valid transcript
  try {
    let orchestratorCalled = false;
    const mockOrchestrator: SageOrchestratorClient = {
      run: async (input) => {
        orchestratorCalled = true;
        assert.equal(input.userId, "omi-test-user");
        assert.equal(input.request, "What is the weather today?");
        assert.equal(input.sessionId, "session-123");
        return {
          success: true,
          response: "The weather is sunny and 72 degrees.",
          requestId: "req-abc",
          state: "response",
        };
      },
    };

    const adapter = new OmiAdapter(mockOrchestrator);
    const result = await adapter.handle({
      userId: "omi-test-user",
      sessionId: "session-123",
      transcript: "What is the weather today?",
    });

    assert.equal(result.success, true);
    assert.equal(result.response, "The weather is sunny and 72 degrees.");
    assert.equal(result.requestId, "req-abc");
    assert.equal(result.state, "response");
    assert.equal(orchestratorCalled, true);

    console.log("✅ PASS: Test 1 — Valid transcript correctly handled and returns success");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: Test 1 — Valid transcript", err);
    failed++;
  }

  // TEST 2 — Empty transcript
  try {
    let orchestratorCalled = false;
    const mockOrchestrator: SageOrchestratorClient = {
      run: async () => {
        orchestratorCalled = true;
        return {
          success: true,
          response: "Should not be called",
        };
      },
    };

    const adapter = new OmiAdapter(mockOrchestrator);
    const result = await adapter.handle({
      userId: "omi-test",
      sessionId: "session-1",
      transcript: "   ",
    });

    assert.equal(result.success, false);
    assert.equal(result.response, "I didn't receive any speech to process.");
    assert.equal(orchestratorCalled, false, "Orchestrator should not execute on empty transcript");

    console.log("✅ PASS: Test 2 — Empty transcript rejected without calling orchestrator");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: Test 2 — Empty transcript", err);
    failed++;
  }

  // TEST 3 — Source propagation
  try {
    let capturedSource: string | undefined;
    let capturedContent: string | undefined;

    const registry = new ActionRegistry();
    // Wrap save_memory to inspect the passed payload source
    const originalSave = registry.get("save_memory")!;
    registry.register({
      name: "save_memory_test",
      description: "Test save memory wrapper",
      execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const payload = input as { source?: string; content?: string };
        capturedSource = payload.source;
        capturedContent = payload.content;
        return { success: true, data: { id: "test-mem-id" } };
      },
      ...(originalSave.verify ? { verify: originalSave.verify } : {}),
    });

    // Create a reasoner that chooses save_memory_test
    const testReasoner = {
      reason: async (context: any) => {
        return {
          thoughtSummary: "Detected memory to save with source",
          selectedTool: {
            name: "save_memory_test",
            input: {
              type: "preference",
              content: "I prefer studying at night.",
              source: context.metadata?.source ?? "agent",
            },
          },
        };
      },
    };

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: testReasoner,
    });

    const adapter = new OmiAdapter(orchestrator);
    const result = await adapter.handle({
      userId: "omi-test-user",
      sessionId: "session-456",
      transcript: "Remember that I prefer studying at night.",
    });

    assert.equal(result.success, true);
    assert.equal(capturedSource, "omi", "Memory source must be 'omi'");
    assert.equal(capturedContent, "I prefer studying at night.");

    console.log("✅ PASS: Test 3 — Source propagation sets source = 'omi'");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: Test 3 — Source propagation", err);
    failed++;
  }

  // TEST 4 — Raw segments normalization
  try {
    let capturedTranscript: string | undefined;
    let capturedUserId: string | undefined;

    const mockOrchestrator: SageOrchestratorClient = {
      run: async (input) => {
        capturedTranscript = input.request;
        capturedUserId = input.userId;
        return { success: true, response: "Received segments" };
      },
    };

    const { OmiIngestionService } = await import("./ingestion.js");
    const adapter = new OmiAdapter(mockOrchestrator);
    const ingestion = new OmiIngestionService(adapter);

    const result = await ingestion.ingest(
      {
        session_id: "sess-seg",
        segments: [{ text: "Hello" }, { text: "from" }, { text: "Omi" }],
      },
      { uid: "uid-query-user" },
    );

    assert.equal(result.success, true);
    assert.equal(capturedTranscript, "Hello from Omi");
    assert.equal(capturedUserId, "uid-query-user");
    assert.equal(result.eventType, "transcript");

    console.log("✅ PASS: Test 4 — Raw segments normalized into transcript and query uid resolved");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: Test 4 — Raw segments normalization", err);
    failed++;
  }

  // TEST 5 — Structured memory event normalization
  try {
    let capturedTranscript: string | undefined;

    const mockOrchestrator: SageOrchestratorClient = {
      run: async (input) => {
        capturedTranscript = input.request;
        return { success: true, response: "Memory processed" };
      },
    };

    const { OmiIngestionService } = await import("./ingestion.js");
    const adapter = new OmiAdapter(mockOrchestrator);
    const ingestion = new OmiIngestionService(adapter);

    const result = await ingestion.ingest({
      id: "memory_abc123",
      uid: "structured-user",
      structured: {
        title: "Study Habit",
        overview: "User prefers studying late at night.",
      },
    });

    assert.equal(result.success, true);
    assert.equal(capturedTranscript, "User prefers studying late at night.");
    assert.equal(result.eventType, "memory_created");

    console.log("✅ PASS: Test 5 — Structured memory event normalized and eventType detected");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: Test 5 — Structured memory event normalization", err);
    failed++;
  }

  // TEST 6 — Event deduplication
  try {
    let executionCount = 0;

    const mockOrchestrator: SageOrchestratorClient = {
      run: async () => {
        executionCount++;
        return { success: true, response: "Executed" };
      },
    };

    const { OmiIngestionService, EventDeduplicator } = await import("./ingestion.js");
    const deduplicator = new EventDeduplicator(60000);
    const adapter = new OmiAdapter(mockOrchestrator);
    const ingestion = new OmiIngestionService(adapter, deduplicator);

    const rawEvent = {
      id: "event-unique-12345",
      uid: "dedup-user",
      transcript: "Turn off the lights",
    };

    // First call: executes
    const firstResult = await ingestion.ingest(rawEvent);
    assert.equal(firstResult.success, true);
    assert.equal(firstResult.duplicate, undefined);
    assert.equal(executionCount, 1);

    // Second call: duplicate detected, does NOT execute
    const secondResult = await ingestion.ingest(rawEvent);
    assert.equal(secondResult.success, true);
    assert.equal(secondResult.duplicate, true);
    assert.equal(executionCount, 1, "Orchestrator must not be called again for duplicate event");

    console.log("✅ PASS: Test 6 — Duplicate event detected and prevented from executing again");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: Test 6 — Event deduplication", err);
    failed++;
  }

  // TEST 7 — Discarded event handling
  try {
    let executionCount = 0;

    const mockOrchestrator: SageOrchestratorClient = {
      run: async () => {
        executionCount++;
        return { success: true, response: "Should not execute" };
      },
    };

    const { OmiIngestionService } = await import("./ingestion.js");
    const adapter = new OmiAdapter(mockOrchestrator);
    const ingestion = new OmiIngestionService(adapter);

    const result = await ingestion.ingest({
      discarded: true,
      transcript: "background chatter that should be ignored",
    });

    assert.equal(result.success, true);
    assert.equal(executionCount, 0, "Discarded event must not execute");

    console.log("✅ PASS: Test 7 — Discarded event safely ignored without execution");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: Test 7 — Discarded event handling", err);
    failed++;
  }

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();

