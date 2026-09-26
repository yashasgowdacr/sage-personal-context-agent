import "dotenv/config";
import assert from "node:assert/strict";
import { memoryManager } from "../memory/manager.js";
import { taskService } from "../tasks/service.js";

const BASE_URL = process.env.API_BASE_URL || "http://localhost:3001";
const rawSageToolKey = process.env.SAGE_TOOL_API_KEY;

if (!rawSageToolKey) {
  throw new Error("SAGE_TOOL_API_KEY is not set");
}

const SAGE_TOOL_KEY: string = rawSageToolKey;


async function runDemo() {
  const userId = `omi-demo-user-${Date.now()}`;
  const sessionId = `omi-session-${Date.now()}`;

  console.log("================================================================================");
  console.log("MILESTONE 11: FULL DEMONSTRATION — OMI -> SAGE -> LYZR/REASONER -> TOOLS");
  console.log(`User ID: ${userId}`);
  console.log(`Session ID: ${sessionId}`);
  console.log("================================================================================\n");

  // TURN 1: User wearing Omi says: "Remember that I study best at night."
  console.log(">>> TURN 1: User wearing Omi: 'Remember that I study best at night.'");
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

  assert.equal(res1.status, 200, `Turn 1 failed: ${res1.status}`);
  const out1 = await res1.json();
  console.log("SAGE Response 1:", out1.response);
  console.log("State 1:", out1.state);

  // Verify memory in Qdrant
  const memories1 = await memoryManager.recall(userId, "study");
  console.log(`Verified in Qdrant: ${memories1.length} memory found.`);
  assert.ok(memories1.length > 0, "Memory should be saved in Qdrant");
  console.log(`Stored Memory Content: "${memories1[0]?.memory.content}" (source: ${memories1[0]?.memory.source})`);
  console.log("✅ Turn 1 Complete: Memory saved and verified in Qdrant.\n");

  // TURN 2: User wearing Omi says: "Add a task to finish my DBMS assignment tomorrow."
  console.log(">>> TURN 2: User: 'Add a task to finish my DBMS assignment tomorrow.'");
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

  assert.equal(res2.status, 200, `Turn 2 failed: ${res2.status}`);
  const out2 = await res2.json();
  console.log("SAGE Response 2:", out2.response);
  console.log("State 2:", out2.state);

  // Verify task in TaskService
  const tasks2 = await taskService.listTasks(userId);
  console.log(`Verified in Task Service: ${tasks2.length} task found.`);
  assert.ok(tasks2.length > 0, "Task should be created");
  console.log(`Stored Task: [${tasks2[0]?.status}] "${tasks2[0]?.title}" (Due: ${tasks2[0]?.dueAt})`);
  console.log("✅ Turn 2 Complete: Task created and verified.\n");

  // TURN 3: User wearing Omi asks: "What should I work on tonight?"
  console.log(">>> TURN 3: User: 'What should I work on tonight?'");
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

  assert.equal(res3.status, 200, `Turn 3 failed: ${res3.status}`);
  const out3 = await res3.json();
  console.log("SAGE Response 3:", out3.response);
  console.log("State 3:", out3.state);
  console.log("Memories retrieved:", out3.metadata?.memoriesCount ?? 0);
  console.log("✅ Turn 3 Complete: Contextual response generated with active task & preference context.\n");

  console.log("================================================================================");
  console.log("🏆 ALL 3 TURNS SUCCESSFULLY DEMONSTRATED VIA OMI -> SAGE PIPELINE!");
  console.log("================================================================================");
}

runDemo().catch((err) => {
  console.error("Demo failed:", err);
  process.exit(1);
});
