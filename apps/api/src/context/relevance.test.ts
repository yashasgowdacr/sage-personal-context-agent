import "dotenv/config";
import assert from "node:assert/strict";
import { memoryManager } from "../memory/manager.js";
import { taskService } from "../tasks/service.js";
import { buildSageContext } from "./builder.js";
import { SageOrchestrator } from "../orchestrator/orchestrator.js";

async function runRelevanceRegressionTests() {
  console.log("=== SAGE CONTEXT RELEVANCE & CROSS-DOMAIN REGRESSION TEST SUITE ===");
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

  const userId = `rel-test-user-${Date.now()}`;
  const orchestrator = new SageOrchestrator();

  // Setup initial state: Memory + Pending Task
  console.log("Setting up baseline context: study preference + DBMS task...");
  await memoryManager.remember({
    userId,
    type: "preference",
    content: "I study best at night.",
  });

  await taskService.createTask({
    userId,
    title: "Finish my DBMS assignment",
    dueAt: "tomorrow",
  });

  // TEST A: "What should I work on tonight?" -> Both preference and task are allowed as relevant context
  await test("Test A: 'What should I work on tonight?' includes both study preference and task", async () => {
    const ctx = await buildSageContext(userId, "What should I work on tonight?");
    assert.ok(ctx.memories.length > 0, "Expected study preference memory in context");
    assert.ok(ctx.memories.some((m) => m.content.toLowerCase().includes("night")));
    assert.ok(ctx.pendingTasks.length > 0, "Expected DBMS task in context");
    assert.ok(ctx.pendingTasks.some((t) => t.title.toLowerCase().includes("dbms")));

    const res = await orchestrator.run({
      userId,
      request: "What should I work on tonight?",
    });
    assert.equal(res.success, true);
    assert.ok(res.response.toLowerCase().includes("dbms"), "Response must mention DBMS task");
    assert.ok(res.response.toLowerCase().includes("night"), "Response must mention night preference");
  });

  // TEST B: "Schedule an appointment with doctor." -> Neither DBMS memory nor study preference is included
  await test("Test B: 'Schedule an appointment with doctor.' excludes unrelated DBMS task and study preference", async () => {
    const ctx = await buildSageContext(userId, "Schedule an appointment with doctor.");
    assert.equal(ctx.memories.length, 0, "Study preference must NOT be included in appointment context");
    assert.equal(ctx.pendingTasks.length, 0, "DBMS task must NOT be included in appointment context");

    const res = await orchestrator.run({
      userId,
      request: "Schedule an appointment with doctor.",
    });
    assert.equal(res.success, true);
    assert.equal(res.memoriesUsed.length, 0, "No memories should be used for appointment request");
    // Verify response does not contain DBMS or study preferences
    const lower = res.response.toLowerCase();
    assert.ok(!lower.includes("dbms"), "Response must NOT mention DBMS");
    assert.ok(!lower.includes("assignment"), "Response must NOT mention assignment");
    assert.ok(!lower.includes("study best at night"), "Response must NOT mention study best at night");
    assert.ok(lower.includes("appointment"), "Response must focus on appointment clarification");
  });

  // TEST C: "What are my pending tasks?" -> Pending tasks ARE included
  await test("Test C: 'What are my pending tasks?' explicitly includes pending tasks", async () => {
    const ctx = await buildSageContext(userId, "What are my pending tasks?");
    assert.ok(ctx.pendingTasks.length > 0, "Pending tasks must be included");
    assert.ok(ctx.pendingTasks.some((t) => t.title.toLowerCase().includes("dbms")));

    const res = await orchestrator.run({
      userId,
      request: "What are my pending tasks?",
    });
    assert.equal(res.success, true);
    assert.ok(res.response.toLowerCase().includes("dbms"), "Response should list DBMS task");
  });

  // TEST D: "Tell me about my study habits." -> Study preference IS included
  await test("Test D: 'Tell me about my study habits.' includes study preference", async () => {
    const ctx = await buildSageContext(userId, "Tell me about my study habits.");
    assert.ok(ctx.memories.length > 0, "Study preference memory must be included");
    assert.ok(ctx.memories.some((m) => m.content.toLowerCase().includes("night")));
    assert.equal(ctx.pendingTasks.length, 0, "DBMS task must NOT be included in study habits inquiry");

    const res = await orchestrator.run({
      userId,
      request: "Tell me about my study habits.",
    });
    assert.equal(res.success, true);
    assert.ok(res.response.toLowerCase().includes("night"), "Response should recall night study habit");
  });

  // TEST E: "I finished my DBMS assignment." -> DBMS task is relevant and can be completed
  await test("Test E: 'I finished my DBMS assignment.' matches and completes DBMS task", async () => {
    const ctx = await buildSageContext(userId, "I finished my DBMS assignment.");
    assert.ok(ctx.pendingTasks.length > 0, "DBMS task must be identified as relevant");

    const res = await orchestrator.run({
      userId,
      request: "I finished my DBMS assignment.",
    });
    assert.equal(res.success, true);
    assert.equal(res.actionResult?.tool, "complete_task");
    assert.equal(res.actionResult?.success, true);
    assert.ok(res.response.toLowerCase().includes("completed") || res.response.toLowerCase().includes("finish"));

    // Verify task is now completed
    const pendingRemaining = await taskService.listTasks(userId, "pending");
    assert.equal(pendingRemaining.length, 0, "No pending tasks should remain");
  });

  // REGRESSION TEST 10: Appointment request must never produce a DBMS response
  await test("Test 10 (Regression): 'schedule an appointment with doctor' asks for date/time without hallucinated DBMS context", async () => {
    // Re-create DBMS task for fresh check
    await taskService.createTask({
      userId,
      title: "Finish my DBMS assignment",
      dueAt: "tomorrow",
    });

    const res = await orchestrator.run({
      userId,
      request: "schedule an appointment with doctor",
    });

    assert.equal(res.success, true);
    assert.equal(res.memoriesUsed.length, 0, "No memories must be marked as used");
    assert.equal(res.sageContext?.pendingTasks.length, 0, "Pending tasks must be excluded from appointment context");

    const responseLower = res.response.toLowerCase();
    assert.ok(!responseLower.includes("dbms"), "Response must NOT contain DBMS");
    assert.ok(!responseLower.includes("assignment"), "Response must NOT contain assignment");
    assert.ok(!responseLower.includes("night"), "Response must NOT contain night");
    assert.ok(
      responseLower.includes("date") ||
        responseLower.includes("time") ||
        responseLower.includes("appointment"),
      "Response must clarify date/time for the appointment"
    );
  });

  console.log(`\nRELEVANCE REGRESSION TEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runRelevanceRegressionTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
