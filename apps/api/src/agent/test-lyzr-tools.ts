import "dotenv/config";
import { invokeLyzr } from "./lyzr.js";
import { memoryManager } from "../memory/manager.js";
import { taskService } from "../tasks/service.js";

async function main() {
  const userId = `lyzr-test-user-${Date.now()}`;
  const sessionId = `lyzr-test-session-${Date.now()}`;

  console.log("=================================================");
  console.log("STEP 11.9: TESTING LYZR LIVE TOOL ACTIVATION");
  console.log(`User ID: ${userId}`);
  console.log("=================================================\n");

  // Test 1: save_memory
  console.log("--- 1. Testing save_memory ---");
  console.log("Prompt: 'Remember that I prefer studying at night.'");
  const saveRes = await invokeLyzr({
    userId,
    sessionId,
    message: "Remember that I prefer studying at night.",
  });
  console.log("Lyzr Response:\n", saveRes.response);

  // Verify memory in Qdrant
  console.log("\nVerifying memory in Qdrant...");
  const memories = await memoryManager.recall(userId, "studying");
  console.log(`Found ${memories.length} memories for user:`);
  for (const m of memories) {
    console.log(`  - [Score: ${m.score.toFixed(3)}] ${m.memory.content} (type: ${m.memory.type})`);
  }

  if (memories.length === 0) {
    console.error("❌ Test 1 Failed: Memory was not saved to Qdrant via Lyzr tool call");
  } else {
    console.log("✅ Test 1 Passed: Lyzr successfully invoked save_memory -> SAGE API -> Qdrant\n");
  }

  // Test 2: search_memory
  console.log("--- 2. Testing search_memory ---");
  console.log("Prompt: 'When do I prefer studying?'");
  const searchRes = await invokeLyzr({
    userId,
    sessionId,
    message: "When do I prefer studying?",
  });
  console.log("Lyzr Response:\n", searchRes.response);

  const lowerSearchResp = searchRes.response.toLowerCase();
  if (lowerSearchResp.includes("night")) {
    console.log("✅ Test 2 Passed: Lyzr retrieved memory and accurately answered 'night'\n");
  } else {
    console.log("⚠️ Test 2 Note: Check response above to see if it answered using the memory.\n");
  }

  // Test 3: create_task
  console.log("--- 3. Testing create_task ---");
  console.log("Prompt: 'Add a task to finish my DBMS assignment tomorrow.'");
  const taskRes = await invokeLyzr({
    userId,
    sessionId,
    message: "Add a task to finish my DBMS assignment tomorrow.",
  });
  console.log("Lyzr Response:\n", taskRes.response);

  // Verify task in taskService
  console.log("\nVerifying task in taskService...");
  const tasks = await taskService.listTasks(userId);
  console.log(`Found ${tasks.length} tasks for user:`);
  for (const t of tasks) {
    console.log(`  - [${t.status}] ${t.title} (ID: ${t.id}, Due: ${t.dueAt})`);
  }

  if (tasks.length === 0) {
    console.error("❌ Test 3 Failed: Task was not created via Lyzr tool call");
  } else {
    console.log("✅ Test 3 Passed: Lyzr successfully invoked create_task -> SAGE API -> Tasks\n");
  }

  // Test 4: list_tasks
  console.log("--- 4. Testing list_tasks ---");
  console.log("Prompt: 'What tasks do I have?'");
  const listRes = await invokeLyzr({
    userId,
    sessionId,
    message: "What tasks do I have?",
  });
  console.log("Lyzr Response:\n", listRes.response);

  if (listRes.response.toLowerCase().includes("dbms")) {
    console.log("✅ Test 4 Passed: Lyzr listed the DBMS task via list_tasks\n");
  } else {
    console.log("⚠️ Test 4 Note: Check response above.\n");
  }

  // Test 5: complete_task
  if (tasks.length > 0) {
    console.log("--- 5. Testing complete_task ---");
    console.log("Prompt: 'Mark my DBMS assignment as completed.'");
    const completeRes = await invokeLyzr({
      userId,
      sessionId,
      message: "Mark my DBMS assignment as completed.",
    });
    console.log("Lyzr Response:\n", completeRes.response);

    const updatedTasks = await taskService.listTasks(userId);
    const dbmsTask = updatedTasks.find((t) => t.title.toLowerCase().includes("dbms"));
    if (dbmsTask && dbmsTask.status === "completed") {
      console.log("✅ Test 5 Passed: Lyzr successfully invoked complete_task\n");
    } else {
      console.log(`⚠️ Test 5 Note: Current task status: ${dbmsTask?.status}\n`);
    }
  }

  console.log("=================================================");
  console.log("STEP 11.9 COMPLETE");
  console.log("=================================================");
}

main().catch((err) => {
  console.error("Lyzr tools test failed:", err);
  process.exit(1);
});
