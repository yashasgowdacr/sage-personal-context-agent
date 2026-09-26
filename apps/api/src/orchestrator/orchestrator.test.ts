import "dotenv/config";
import assert from "node:assert/strict";
import { SageOrchestrator } from "./orchestrator.js";
import { ActionRegistry } from "./registry.js";
import type {
  OrchestrationContext,
  ReasoningDecision,
  SageActionTool,
  ToolExecutionContext,
  ToolExecutionResult,
  VerificationResult,
} from "./types.js";

async function runAllTests() {
  console.log("=== SAGE ORCHESTRATOR TEST SUITE ===");
  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`❌ FAIL: ${name}`);
      console.error((err as Error).stack);
      failed++;
    }
  }

  // 1. Test Memory Retrieval
  await test("Memory Retrieval integrates with MemoryManager", async () => {
    const orchestrator = new SageOrchestrator();
    const result = await orchestrator.run({
      userId: "lyzr-tool-test",
      request: "Which coding editor do I prefer?",
    });

    assert.equal(result.success, true);
    assert.ok(result.memoriesUsed.length > 0, "Expected at least one memory to be retrieved");
    const topMemory = result.memoriesUsed[0];
    assert.ok(topMemory, "topMemory should be defined");
    assert.ok(topMemory.score > 0.6, `Score ${topMemory.score} should be > 0.6`);
    assert.ok(
      topMemory.memory.content.includes("IntelliJ"),
      `Memory content should mention IntelliJ: ${topMemory.memory.content}`,
    );
  });

  // 2. Test State Transitions
  await test("All 8 state transitions execute in correct sequence", async () => {
    const registry = new ActionRegistry();
    let executedTool = false;
    let verifiedTool = false;

    registry.register({
      name: "sample_tool",
      description: "A sample tool for testing all 8 states",
      execute: async () => {
        executedTool = true;
        return { success: true, data: { status: "ok" } };
      },
      verify: async () => {
        verifiedTool = true;
        return { verified: true };
      },
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Test reasoner selecting sample_tool and saving memory",
          selectedTool: { name: "sample_tool", input: {} },
          memoryToSave: {
            type: "fact",
            content: "Testing state transitions memory update",
            importance: 0.5,
          },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-state-user",
      request: "Run full state transition test",
    });

    assert.equal(result.success, true);
    assert.equal(executedTool, true);
    assert.equal(verifiedTool, true);

    const states = result.transitions.map((t) => t.state);
    const expectedSequence = [
      "understanding",
      "memory_retrieval",
      "reasoning",
      "tool_selection",
      "executing",
      "verification",
      "memory_update",
      "response",
    ];

    assert.deepEqual(states, expectedSequence, `Expected sequence ${expectedSequence.join(" -> ")} but got ${states.join(" -> ")}`);
    for (const transition of result.transitions) {
      assert.ok(typeof transition.timestamp === "string");
      assert.ok(typeof transition.durationMs === "number");
    }
  });

  // 3. Test Missing Tool
  await test("Missing tool handled gracefully without crash", async () => {
    const orchestrator = new SageOrchestrator({
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Selecting non-existent tool",
          selectedTool: { name: "non_existent_tool_xyz", input: {} },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-user",
      request: "Do something with missing tool",
    });

    assert.equal(result.success, false);
    assert.equal(result.finalState, "response");
    assert.ok(result.response.includes("non_existent_tool_xyz"));
    assert.equal(result.actionResult?.success, false);
    assert.ok(result.actionResult?.error?.includes("Missing tool"));
  });

  // 4. Test Failed Action
  await test("Failed action is captured and never falsely claimed as success", async () => {
    const registry = new ActionRegistry();
    registry.register({
      name: "failing_tool",
      description: "A tool that always fails",
      execute: async () => ({
        success: false,
        error: "External service connection refused",
      }),
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Selecting failing tool",
          selectedTool: { name: "failing_tool", input: {} },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-user",
      request: "Trigger failing tool",
    });

    assert.equal(result.success, false);
    assert.equal(result.actionResult?.success, false);
    assert.equal(result.actionResult?.verified, false);
    assert.equal(result.actionResult?.error, "External service connection refused");
    assert.ok(result.response.includes("failed"));
  });

  // 5. Test Successful Action
  await test("Successful action completes execution, verification, and returns data", async () => {
    const registry = new ActionRegistry();
    registry.register({
      name: "calc_tool",
      description: "Simple calculation tool",
      execute: async (input: unknown) => {
        const { a, b } = input as { a: number; b: number };
        return { success: true, data: { sum: a + b } };
      },
      verify: async (result: ToolExecutionResult) => {
        const data = result.data as { sum: number };
        return { verified: data?.sum === 42 };
      },
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Calculate 40 + 2",
          selectedTool: { name: "calc_tool", input: { a: 40, b: 2 } },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-user",
      request: "Add 40 and 2",
    });

    assert.equal(result.success, true);
    assert.equal(result.actionResult?.success, true);
    assert.equal(result.actionResult?.verified, true);
    assert.deepEqual(result.actionResult?.data, { sum: 42 });
  });

  // 6. Test Verification Failure
  await test("Verification failure marks action unverified and fails orchestration", async () => {
    const registry = new ActionRegistry();
    registry.register({
      name: "dishonest_tool",
      description: "Claims success but produces corrupt data",
      execute: async () => ({
        success: true,
        data: { corrupted: true },
      }),
      verify: async () => ({
        verified: false,
        reason: "Data integrity checksum mismatch",
      }),
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Selecting dishonest tool",
          selectedTool: { name: "dishonest_tool", input: {} },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-user",
      request: "Run dishonest tool",
    });

    assert.equal(result.success, false);
    assert.equal(result.actionResult?.success, true);
    assert.equal(result.actionResult?.verified, false);
    assert.ok(result.response.includes("failed verification"));
    assert.ok(result.response.includes("checksum mismatch"));
  });

  // 7. Test Confirmation Safety Gate
  await test("Destructive action halts for confirmation when unconfirmed", async () => {
    const registry = new ActionRegistry();
    let executed = false;

    registry.register({
      name: "delete_account",
      description: "Destructive operation",
      isDestructive: true,
      requiresConfirmation: true,
      execute: async () => {
        executed = true;
        return { success: true };
      },
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "User wants to delete account",
          selectedTool: { name: "delete_account", input: {} },
        }),
      },
    });

    // Run without confirmation
    const unconfirmedResult = await orchestrator.run({
      userId: "test-user",
      request: "Delete my account",
      confirmed: false,
    });

    assert.equal(unconfirmedResult.success, false);
    assert.equal(executed, false, "Destructive tool MUST NOT execute without confirmation");
    assert.ok(unconfirmedResult.requiresConfirmation);
    assert.equal(unconfirmedResult.requiresConfirmation?.tool, "delete_account");
    assert.ok(unconfirmedResult.requiresConfirmation?.confirmationToken);

    // Run with confirmation
    const confirmedResult = await orchestrator.run({
      userId: "test-user",
      request: "Delete my account",
      confirmed: true,
    });

    assert.equal(confirmedResult.success, true);
    assert.equal(executed, true, "Destructive tool should execute after confirmation");
  });

  // 8. Test A — Authentication on POST /orchestrator/run
  await test("POST /orchestrator/run requires x-sage-tool-key", async () => {
    // Without key -> 401
    const unauthRes = await fetch("http://localhost:3001/orchestrator/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "test-auth-user", request: "Hello SAGE" }),
    });
    assert.equal(unauthRes.status, 401, `Expected 401 but got ${unauthRes.status}`);

    // With valid key -> 200
    const authRes = await fetch("http://localhost:3001/orchestrator/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sage-tool-key": process.env.SAGE_TOOL_API_KEY ?? "",
      },
      body: JSON.stringify({ userId: "test-auth-user", request: "Hello SAGE" }),
    });
    assert.equal(authRes.status, 200, `Expected 200 but got ${authRes.status}`);
  });

  // 9. Test B — Omi Source in save_memory
  await test("save_memory accepts and persists source = 'omi'", async () => {
    const registry = new ActionRegistry();
    const saveTool = registry.get("save_memory");
    assert.ok(saveTool, "save_memory tool must exist");

    const result = await saveTool.execute(
      {
        userId: "test-omi-user",
        type: "fact",
        content: "User mentioned this through Omi",
        source: "omi",
      },
      {
        requestId: "test-omi-req",
        userId: "test-omi-user",
        sessionId: "test-omi-session",
      },
    );

    assert.equal(result.success, true);
    const memory = result.data as { source?: string; content?: string };
    assert.equal(memory.source, "omi", `Expected source 'omi' but got '${memory.source}'`);
  });

  // 10. Test C — Passive Memory Update (no tool selected)
  await test("Passive memory update executes when memoryToSave exists without a tool", async () => {
    const orchestrator = new SageOrchestrator({
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Direct answer while saving conversational context",
          selectedTool: undefined,
          directResponse: "I hear you, and I will keep that in mind.",
          memoryToSave: {
            type: "fact",
            content: "User mentioned passive context to store",
            importance: 0.7,
          },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-passive-user",
      request: "Just wanted to let you know something casually",
    });

    assert.equal(result.success, true);
    assert.equal(result.actionResult, undefined, "No action tool should execute");
    assert.equal(result.response, "I hear you, and I will keep that in mind.");

    const states = result.transitions.map((t) => t.state);
    const expectedSequence = [
      "understanding",
      "memory_retrieval",
      "reasoning",
      "tool_selection",
      "memory_update",
      "response",
    ];

    assert.deepEqual(
      states,
      expectedSequence,
      `Expected sequence ${expectedSequence.join(" -> ")} but got ${states.join(" -> ")}`,
    );
  });

  // 11. Test — Action Execution with all 8 states for create_task
  await test("create_task action passes through all 8 states in sequence", async () => {
    const orchestrator = new SageOrchestrator();
    const result = await orchestrator.run({
      userId: "test-task-orch-user",
      request: "Add a task to finish my DBMS assignment tomorrow",
    });

    assert.equal(result.success, true);
    assert.equal(result.actionResult?.tool, "create_task");
    assert.equal(result.actionResult?.success, true);
    assert.equal(result.actionResult?.verified, true);

    const states = result.transitions.map((t) => t.state);
    const expectedSequence = [
      "understanding",
      "memory_retrieval",
      "reasoning",
      "tool_selection",
      "executing",
      "verification",
      "memory_update",
      "response",
    ];

    assert.deepEqual(
      states,
      expectedSequence,
      `Expected sequence ${expectedSequence.join(" -> ")} but got ${states.join(" -> ")}`,
    );
  });

  // 12. Test — Failed task action
  await test("Failed task action execution marks orchestration failed", async () => {
    const registry = new ActionRegistry();
    registry.register({
      name: "failing_task_tool",
      description: "A task tool that fails execution",
      execute: async () => ({ success: false, error: "Database connection failed" }),
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Selecting failing task tool",
          selectedTool: { name: "failing_task_tool", input: {} },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-user",
      request: "Create failing task",
    });

    assert.equal(result.success, false);
    assert.equal(result.actionResult?.success, false);
    assert.ok(result.response.includes("failed"));
  });

  // 13. Test — Verification failure on task action
  await test("Task verification failure marks action unverified and fails orchestration", async () => {
    const registry = new ActionRegistry();
    registry.register({
      name: "unverified_task_tool",
      description: "A task tool whose verification fails",
      execute: async () => ({ success: true, data: { task: { id: "bad-task" } } }),
      verify: async () => ({ verified: false, reason: "Task was not found in persistence store" }),
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Selecting unverified task tool",
          selectedTool: { name: "unverified_task_tool", input: {} },
        }),
      },
    });

    const result = await orchestrator.run({
      userId: "test-user",
      request: "Create task that fails verify",
    });

    assert.equal(result.success, false);
    assert.equal(result.actionResult?.verified, false);
    assert.ok(result.response.includes("failed verification"));
  });

  // 14. Test — Destructive action gate for cancel_task
  await test("cancel_task halts for confirmation when unconfirmed without executing", async () => {
    let executorCalled = false;
    const registry = new ActionRegistry();
    // Wrap cancel_task to track if execute is invoked
    const originalCancel = registry.get("cancel_task")!;
    registry.register({
      name: "cancel_task_test",
      description: "Test cancel task wrapper",
      isDestructive: true,
      requiresConfirmation: true,
      execute: async (input, ctx) => {
        executorCalled = true;
        return originalCancel.execute(input, ctx);
      },
      ...(originalCancel.verify ? { verify: originalCancel.verify } : {}),
    });

    const orchestrator = new SageOrchestrator({
      registry,
      reasoner: {
        reason: async (): Promise<ReasoningDecision> => ({
          thoughtSummary: "Cancel existing task",
          selectedTool: { name: "cancel_task_test", input: { taskId: "any-task-id" } },
        }),
      },
    });

    // Unconfirmed call
    const result = await orchestrator.run({
      userId: "test-user",
      request: "Cancel my task",
      confirmed: false,
    });

    assert.equal(result.success, false);
    assert.ok(result.requiresConfirmation, "Must require confirmation");
    assert.equal(executorCalled, false, "Executor must NOT be called without confirmation");
  });

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner encountered fatal error:", err);
  process.exit(1);
});
