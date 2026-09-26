import "dotenv/config";
import assert from "node:assert/strict";
import { memoryManager } from "../memory/manager.js";
import { taskService } from "../tasks/service.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const rawSageToolKey = process.env.SAGE_TOOL_API_KEY;

if (!rawSageToolKey) {
  throw new Error("SAGE_TOOL_API_KEY is not set in environment");
}

const SAGE_TOOL_KEY: string = rawSageToolKey;

function printExecutionEvents(events?: Array<{ stage: string; label: string; status: string; detail?: string }>) {
  if (!events || events.length === 0) return;
  console.log("\n   [Explainable Execution Pipeline]");
  for (const ev of events) {
    const icon = ev.status === "completed" ? "✓" : ev.status === "skipped" ? "○" : "✗";
    console.log(`     ${icon} ${ev.label.padEnd(32)} [${ev.status}] ${ev.detail ?? ""}`);
  }
  console.log();
}

async function runMilestone12Demo() {
  const userId = `m12-demo-user-${Date.now()}`;
  const sessionId = `m12-session-${Date.now()}`;

  console.log("================================================================================");
  console.log("🚀 SAGE MILESTONE 12: CONTEXT FUSION & DEMO INTELLIGENCE VERIFICATION");
  console.log("Listen → Remember → Retrieve → Understand Context → Reason → Act → Verify → Remember");
  console.log(`User ID: ${userId}`);
  console.log(`Session ID: ${sessionId}`);
  console.log("================================================================================\n");

  // ============================================================================
  // TURN 1: Store User Preference via Omi
  // ============================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log(">>> TURN 1: User wearing Omi: 'Remember that I study best at night.'");
  console.log("--------------------------------------------------------------------------------");
  const turn1Payload = {
    session_id: sessionId,
    segments: [
      {
        speaker: "SPEAKER_00",
        text: "Remember that I study best at night.",
        start: 0.0,
        end: 2.5,
      },
    ],
  };

  const res1 = await fetch(`${BASE_URL}/omi/webhook?uid=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": SAGE_TOOL_KEY,
    },
    body: JSON.stringify(turn1Payload),
  });

  assert.equal(res1.status, 200, `Turn 1 HTTP status ${res1.status}`);
  const out1 = await res1.json();
  console.log(`🗣️ SAGE Output: "${out1.response}"`);
  printExecutionEvents(out1.executionEvents);

  // Verify memory persistence in Qdrant
  const recalledMemories = await memoryManager.recall(userId, "study habits preference", 5);
  assert.ok(recalledMemories.length > 0, "Turn 1: Memory must exist in Qdrant");
  const storedPref = recalledMemories[0];
  console.log(`💾 Stored Qdrant Memory: "${storedPref?.memory.content}" (score: ${storedPref?.score.toFixed(3)})`);
  console.log("✅ Turn 1 Verified: User study preference persisted and indexed with FastEmbed.\n");

  // ============================================================================
  // TURN 2: Create Active Pending Task via Omi
  // ============================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log(">>> TURN 2: User wearing Omi: 'Add a task to finish my DBMS assignment tomorrow.'");
  console.log("--------------------------------------------------------------------------------");
  const turn2Payload = {
    session_id: sessionId,
    segments: [
      {
        speaker: "SPEAKER_00",
        text: "Add a task to finish my DBMS assignment tomorrow.",
        start: 3.0,
        end: 5.8,
      },
    ],
  };

  const res2 = await fetch(`${BASE_URL}/omi/webhook?uid=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": SAGE_TOOL_KEY,
    },
    body: JSON.stringify(turn2Payload),
  });

  assert.equal(res2.status, 200, `Turn 2 HTTP status ${res2.status}`);
  const out2 = await res2.json();
  console.log(`🗣️ SAGE Output: "${out2.response}"`);
  printExecutionEvents(out2.executionEvents);

  // Verify task persistence in TaskService
  const pendingTasks = await taskService.listTasks(userId, "pending");
  assert.ok(pendingTasks.length > 0, "Turn 2: Task must exist in TaskService");
  const createdTask = pendingTasks[0];
  console.log(`📋 Stored Pending Task: "${createdTask?.title}" (Due: ${createdTask?.dueAt})`);
  console.log("✅ Turn 2 Verified: Task created, indexed, and action recorded.\n");

  // ============================================================================
  // TURN 3: Context Fusion & Demo Intelligence
  // ============================================================================
  console.log("--------------------------------------------------------------------------------");
  console.log(">>> TURN 3: User wearing Omi: 'What should I work on tonight?'");
  console.log("--------------------------------------------------------------------------------");
  const turn3Payload = {
    session_id: sessionId,
    segments: [
      {
        speaker: "SPEAKER_00",
        text: "What should I work on tonight?",
        start: 6.5,
        end: 8.5,
      },
    ],
  };

  const res3 = await fetch(`${BASE_URL}/omi/webhook?uid=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": SAGE_TOOL_KEY,
    },
    body: JSON.stringify(turn3Payload),
  });

  assert.equal(res3.status, 200, `Turn 3 HTTP status ${res3.status}`);
  const out3 = await res3.json();

  console.log(`🗣️ SAGE Output: "${out3.response}"`);
  printExecutionEvents(out3.executionEvents);

  // Validate the fused SageContext returned to the client
  assert.ok(out3.sageContext, "Turn 3: Expected sageContext to be returned");
  console.log("🧩 Fused SageContext Summary:");
  console.log(`   - Memories (${out3.sageContext.memories.length}):`, out3.sageContext.memories.map((m: any) => `"${m.content}" (score: ${m.score?.toFixed(3)})`).join(", "));
  console.log(`   - Pending Tasks (${out3.sageContext.pendingTasks.length}):`, out3.sageContext.pendingTasks.map((t: any) => `"${t.title}" (due: ${t.dueAt})`).join(", "));
  console.log(`   - Recent Actions (${out3.sageContext.recentActions.length}):`, out3.sageContext.recentActions.map((a: any) => `"${a.action}"`).join(", "));

  // Verification assertions
  assert.ok(out3.sageContext.memories.length > 0, "Must contain relevant preference memory");
  assert.ok(out3.sageContext.pendingTasks.length > 0, "Must contain active pending task");
  assert.ok(out3.sageContext.recentActions.length > 0, "Must contain recent actions");

  const responseLower = out3.response.toLowerCase();
  assert.ok(
    responseLower.includes("night") && responseLower.includes("dbms"),
    `Response must combine preference (night) and task (DBMS): "${out3.response}"`,
  );

  console.log("\n================================================================================");
  console.log("🏆 MILESTONE 12 VERIFICATION COMPLETE: ALL GATES & CONTEXT FUSION PASS!");
  console.log("Intelligence Chain Demonstrated:");
  console.log("  1. Memory:   'I study best at night.' (retrieved by semantic similarity)");
  console.log("  2. Task:     'Finish DBMS assignment' (retrieved from active task store)");
  console.log("  3. Action:   'Created task Finish DBMS assignment' (tracked in ActionTracker)");
  console.log("  4. Fusion:   Unified into compact SageContext without CoT leakage");
  console.log("  5. Response: 'Since you prefer studying at night, tonight would be a good time to work on your DBMS assignment.'");
  console.log("================================================================================\n");
}

runMilestone12Demo().catch((err) => {
  console.error("Milestone 12 Demo Failed:", err);
  process.exit(1);
});
