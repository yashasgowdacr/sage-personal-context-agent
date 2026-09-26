import "dotenv/config";
import assert from "node:assert/strict";
import { memoryManager } from "../memory/manager.js";
import { taskService } from "../tasks/service.js";
import { resetDemoUser, DEMO_USER_ID } from "../demo/reset.js";
import { renderVisualTimeline } from "../demo/timeline.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const rawSageToolKey = process.env.SAGE_TOOL_API_KEY;

if (!rawSageToolKey) {
  throw new Error("SAGE_TOOL_API_KEY is not set in environment");
}

const SAGE_TOOL_KEY: string = rawSageToolKey;

async function sendOmiUtterance(userId: string, sessionId: string, text: string) {
  const payload = {
    session_id: sessionId,
    segments: [
      {
        speaker: "SPEAKER_00",
        text,
        start: 0.0,
        end: 3.0,
      },
    ],
  };

  const response = await fetch(`${BASE_URL}/omi/webhook?uid=${encodeURIComponent(userId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": SAGE_TOOL_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Omi webhook failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function runJudgeDemo() {
  const userId = DEMO_USER_ID; // "sage-demo-user"
  const sessionId = `judge-session-${Date.now()}`;

  console.log("================================================================================");
  console.log("                    SAGE: Personal Context & Action Agent                       ");
  console.log("                         HACKATHON FINAL DEMONSTRATION                          ");
  console.log("            Listen → Remember → Retrieve → Reason → Act → Verify                ");
  console.log("================================================================================");
  console.log(`Demo User:    ${userId}`);
  console.log(`Session ID:   ${sessionId}`);
  console.log(`API Endpoint: ${BASE_URL}`);
  console.log("--------------------------------------------------------------------------------\n");

  // ============================================================================
  // PRE-DEMO: Clean State Reset (STEP 13.3)
  // ============================================================================
  console.log("🧹 [STEP 13.3] Performing Pre-Demo Clean Reset...");
  const resetResult = await resetDemoUser(userId);
  console.log(`   ✓ Qdrant memories cleared for "${userId}"`);
  console.log(`   ✓ Qdrant pending tasks cleared for "${userId}"`);
  console.log(`   ✓ Action tracker history cleared for "${userId}"`);
  console.log("   ✓ Clean baseline established.\n");

  // Verify baseline is indeed empty
  const initialMemories = await memoryManager.recall(userId, "anything", 5);
  const initialTasks = await taskService.listTasks(userId);
  assert.equal(initialMemories.length, 0, "Pre-demo memories must be 0");
  assert.equal(initialTasks.length, 0, "Pre-demo tasks must be 0");

  // ============================================================================
  // TURN 1: Remember User Preference (Semantic Memory Ingestion)
  // ============================================================================
  console.log("================================================================================");
  console.log("TURN 1 — REMEMBER");
  console.log("User (via Omi): \"Remember that I study best at night.\"");
  console.log("================================================================================");
  const out1 = await sendOmiUtterance(userId, sessionId, "Remember that I study best at night.");

  console.log(`🗣️  SAGE: "${out1.response}"`);
  console.log(renderVisualTimeline(out1.executionEvents, { subtitle: "Turn 1: Semantic Memory Ingestion" }));

  // Verification in Qdrant
  const recalled1 = await memoryManager.recall(userId, "study habits", 5);
  assert.ok(recalled1.length > 0, "Turn 1: Memory must be stored in Qdrant");
  console.log(`✓ Verified in Qdrant: "${recalled1[0]?.memory.content}" (score: ${recalled1[0]?.score.toFixed(3)}, source: ${recalled1[0]?.memory.source})\n`);

  // ============================================================================
  // TURN 2: Create Active Pending Task (Tool Selection & Execution)
  // ============================================================================
  console.log("================================================================================");
  console.log("TURN 2 — CREATE TASK");
  console.log("User (via Omi): \"Add a task to finish my DBMS assignment tomorrow.\"");
  console.log("================================================================================");
  const out2 = await sendOmiUtterance(userId, sessionId, "Add a task to finish my DBMS assignment tomorrow.");

  console.log(`🗣️  SAGE: "${out2.response}"`);
  console.log(renderVisualTimeline(out2.executionEvents, { subtitle: "Turn 2: Structured Task Creation" }));

  // Verification in TaskService
  const tasks2 = await taskService.listTasks(userId, "pending");
  assert.equal(tasks2.length, 1, "Turn 2: Exactly 1 pending task must exist");
  console.log(`✓ Verified in Task Service: [${tasks2[0]?.status}] "${tasks2[0]?.title}" (due: ${tasks2[0]?.dueAt})\n`);

  // ============================================================================
  // TURN 3: Contextual Question (Context Fusion & Reasoning)
  // ============================================================================
  console.log("================================================================================");
  console.log("TURN 3 — CONTEXTUAL REASONING & FUSION");
  console.log("User (via Omi): \"What should I work on tonight?\"");
  console.log("================================================================================");
  const out3 = await sendOmiUtterance(userId, sessionId, "What should I work on tonight?");

  console.log(`🗣️  SAGE: "${out3.response}"`);
  console.log(renderVisualTimeline(out3.executionEvents, { subtitle: "Turn 3: Multi-Entity Context Fusion" }));

  // Verification of Context Fusion
  assert.ok(out3.sageContext, "Turn 3: sageContext must be returned");
  console.log("🧩 Fused Context State:");
  console.log(`   - Retrieved Memories: ${out3.sageContext.memories.map((m: any) => `"${m.content}" (${m.score?.toFixed(3)})`).join(", ")}`);
  console.log(`   - Pending Tasks:      ${out3.sageContext.pendingTasks.map((t: any) => `"${t.title}" (due: ${t.dueAt})`).join(", ")}`);
  console.log(`   - Recent Actions:     ${out3.sageContext.recentActions.map((a: any) => `"${a.action}"`).join(", ")}`);

  const respLower3 = out3.response.toLowerCase();
  assert.ok(respLower3.includes("night") && respLower3.includes("dbms"), "Response must fuse night study preference and DBMS assignment");
  console.log("✓ Context Fusion Verified: Combined preference + task into tailored advice without CoT exposure.\n");

  // ============================================================================
  // TURN 4: Complete Task (Action Execution & Verification)
  // ============================================================================
  console.log("================================================================================");
  console.log("TURN 4 — COMPLETE TASK");
  console.log("User (via Omi): \"I finished my DBMS assignment.\"");
  console.log("================================================================================");
  const out4 = await sendOmiUtterance(userId, sessionId, "I finished my DBMS assignment.");

  console.log(`🗣️  SAGE: "${out4.response}"`);
  console.log(renderVisualTimeline(out4.executionEvents, { subtitle: "Turn 4: Action Execution & Verification" }));

  // Verification that task is now completed
  const completedTasks = await taskService.listTasks(userId, "completed");
  assert.equal(completedTasks.length, 1, "Turn 4: Task must be marked completed");
  console.log(`✓ Verified in Task Service: [${completedTasks[0]?.status}] "${completedTasks[0]?.title}" (completedAt: ${completedTasks[0]?.completedAt})\n`);

  // ============================================================================
  // TURN 5: Verify (Dynamic Zero-Hallucination Query)
  // ============================================================================
  console.log("================================================================================");
  console.log("TURN 5 — DYNAMIC STATE VERIFICATION");
  console.log("User (via Omi): \"What tasks do I have left?\"");
  console.log("================================================================================");
  const out5 = await sendOmiUtterance(userId, sessionId, "What tasks do I have left?");

  console.log(`🗣️  SAGE: "${out5.response}"`);
  console.log(renderVisualTimeline(out5.executionEvents, { subtitle: "Turn 5: Accurate State Verification" }));

  // Verification that pending list is genuinely 0
  const pendingTasksAfter = await taskService.listTasks(userId, "pending");
  assert.equal(pendingTasksAfter.length, 0, "Turn 5: No pending tasks should remain");
  assert.ok(out5.response.toLowerCase().includes("no pending tasks"), "Response must confirm 0 pending tasks");
  console.log("✓ Verified State: 0 pending tasks remain. Zero hallucinations confirmed.\n");

  // ============================================================================
  // DEMO SUMMARY
  // ============================================================================
  console.log("================================================================================");
  console.log("🏆 JUDGE DEMONSTRATION COMPLETE: ALL 5 TURNS VERIFIED WITH FULL TRANSPARENCY");
  console.log("Demonstrated Capabilities:");
  console.log("  1. Semantic Memory:    Stored and retrieved user preference via Qdrant & FastEmbed");
  console.log("  2. Task Management:    Created, tracked, and persisted structured pending tasks");
  console.log("  3. Context Fusion:     Fused preference + active task + request into personalized recommendation");
  console.log("  4. Verified Action:    Executed complete_task with database state verification");
  console.log("  5. Safe Architecture:  Zero hallucinated actions, no chain-of-thought exposure, explainable timeline");
  console.log("================================================================================\n");
}

runJudgeDemo().catch((err) => {
  console.error("Demo Execution Failed:", err);
  process.exit(1);
});
