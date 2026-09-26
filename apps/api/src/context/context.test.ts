import "dotenv/config";
import assert from "node:assert/strict";
import { memoryManager } from "../memory/manager.js";
import { taskService } from "../tasks/service.js";
import { buildSageContext, actionTracker } from "./builder.js";
import { formatContextForReasoner } from "./formatter.js";

async function runAllContextTests() {
  console.log("=== SAGE CONTEXT FUSION TEST SUITE ===");
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

  // TEST 1 — Relevant preference included
  await test("Test 1: Relevant preference is retrieved and included in context", async () => {
    const userId = `ctx-user-1-${Date.now()}`;
    await memoryManager.remember({
      userId,
      type: "preference",
      content: "I study best at night.",
    });

    const ctx = await buildSageContext(userId, "What should I work on tonight?");
    assert.equal(ctx.userId, userId);
    assert.ok(ctx.memories.length > 0, "Expected at least one relevant memory");
    const found = ctx.memories.some((m) => m.content.toLowerCase().includes("night"));
    assert.ok(found, "Expected 'I study best at night.' to be included");
    assert.ok((ctx.memories[0]?.score ?? 0) >= 0.70, "Score should exceed relevance threshold");
  });

  // TEST 2 — Irrelevant memory excluded by score threshold
  await test("Test 2: Irrelevant memory is excluded by relevance threshold", async () => {
    const userId = `ctx-user-2-${Date.now()}`;
    await memoryManager.remember({
      userId,
      type: "preference",
      content: "I like blue shoes.",
    });

    const ctx = await buildSageContext(userId, "What should I work on tonight?");
    const foundBlueShoes = ctx.memories.some((m) => m.content.toLowerCase().includes("blue shoes"));
    assert.equal(foundBlueShoes, false, "Irrelevant 'blue shoes' memory must be excluded by relevance threshold");
  });


  // TEST 3 — Pending task included in context
  await test("Test 3: Active pending tasks are included in context", async () => {
    const userId = `ctx-user-3-${Date.now()}`;
    const task = await taskService.createTask({
      userId,
      title: "Finish DBMS assignment tomorrow",
      dueAt: "tomorrow",
    });

    const ctx = await buildSageContext(userId, "What should I work on tonight?");
    assert.ok(ctx.pendingTasks.length > 0, "Pending tasks should be included");
    const foundTask = ctx.pendingTasks.some((t) => t.id === task.id);
    assert.ok(foundTask, "Task 'Finish DBMS assignment tomorrow' should be in context");
    assert.equal(ctx.pendingTasks[0]?.dueAt, "tomorrow");
  });

  // TEST 4 — Strict user isolation
  await test("Test 4: Strict user isolation prevents cross-user memory leakage", async () => {
    const userA = `user-a-${Date.now()}`;
    const userB = `user-b-${Date.now()}`;

    await memoryManager.remember({
      userId: userA,
      type: "fact",
      content: "User A secret research project on distributed databases.",
    });

    await memoryManager.remember({
      userId: userB,
      type: "fact",
      content: "User B secret financial trading strategy.",
    });

    const ctxA = await buildSageContext(userA, "tell me about research and trading");
    const leaksUserB = ctxA.memories.some((m) => m.content.includes("User B") || m.content.includes("trading strategy"));
    assert.equal(leaksUserB, false, "User A context must NOT contain User B memories");

    const ctxB = await buildSageContext(userB, "tell me about research and trading");
    const leaksUserA = ctxB.memories.some((m) => m.content.includes("User A") || m.content.includes("distributed databases"));
    assert.equal(leaksUserA, false, "User B context must NOT contain User A memories");
  });

  // TEST 5 — Empty context handling
  await test("Test 5: Empty context handles clean fallback without errors", async () => {
    const emptyUser = `empty-user-${Date.now()}`;
    const ctx = await buildSageContext(emptyUser, "Hello, can you help me?");

    assert.equal(ctx.userId, emptyUser);
    assert.equal(ctx.memories.length, 0);
    assert.equal(ctx.pendingTasks.length, 0);
    assert.equal(ctx.currentInput, "Hello, can you help me?");

    const formatted = formatContextForReasoner(ctx);
    assert.ok(formatted.includes("CURRENT REQUEST:\n- Hello, can you help me?"));
    assert.ok(!formatted.includes("RELEVANT USER MEMORY"));
    assert.ok(!formatted.includes("PENDING TASKS"));
  });

  // TEST 6 — Formatter integration with recent actions
  await test("Test 6: Formatter renders all sections cleanly and compactly", async () => {
    const userId = `formatted-user-${Date.now()}`;
    actionTracker.record(userId, 'Created task "Finish DBMS assignment tomorrow."');

    const sampleContext = {
      userId,
      currentInput: "What should I work on tonight?",
      memories: [
        {
          content: "I study best at night.",
          type: "preference",
          importance: 0.9,
          score: 0.82,
        },
      ],
      pendingTasks: [
        {
          id: "task-123",
          title: "Finish DBMS assignment tomorrow",
          dueAt: "tomorrow",
        },
      ],
      recentActions: actionTracker.getRecent(userId),
    };

    const formatted = formatContextForReasoner(sampleContext);
    assert.ok(formatted.includes("RELEVANT USER MEMORY:\n- I study best at night."));
    assert.ok(formatted.includes("PENDING TASKS:\n- Finish DBMS assignment tomorrow (due: tomorrow)"));
    assert.ok(formatted.includes('RECENT ACTIONS:\n- Created task "Finish DBMS assignment tomorrow." (completed)'));
    assert.ok(formatted.includes("CURRENT REQUEST:\n- What should I work on tonight?"));
  });

  console.log(`\nCONTEXT TEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runAllContextTests().catch((err) => {
  console.error("Test runner failed:", err);
  process.exit(1);
});
