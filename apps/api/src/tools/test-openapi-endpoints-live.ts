import "dotenv/config";
import assert from "node:assert/strict";

const SERVER_URL =
  process.env.API_BASE_URL || "https://sage-personal-context-agent.onrender.com";
const rawToolKey = process.env.SAGE_TOOL_API_KEY;
if (!rawToolKey) {
  throw new Error("SAGE_TOOL_API_KEY is not set");
}
const TOOL_KEY: string = rawToolKey;


async function run() {
  console.log("==========================================================");
  console.log("TESTING ALL 7 SAGE OPENAPI OPERATIONS VIA PRODUCTION API");
  console.log(`Server URL: ${SERVER_URL}`);
  console.log("==========================================================\n");

  const testUserId = `openapi-live-user-${Date.now()}`;

  // 1. Unauthenticated request to /tasks -> MUST BE 401
  console.log("1. Testing Auth Gate (Unauthenticated POST /tasks)...");
  const unauthRes = await fetch(`${SERVER_URL}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: testUserId, title: "Unauthorized task" }),
  });
  assert.equal(unauthRes.status, 401, "Expected 401 Unauthorized without tool key");
  console.log("   ✅ PASS: Unauthenticated call correctly rejected with 401\n");

  // 2. save_memory: POST /memory
  console.log("2. Testing save_memory: POST /memory...");
  const saveRes = await fetch(`${SERVER_URL}/memory`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": TOOL_KEY,
    },
    body: JSON.stringify({
      userId: testUserId,
      type: "preference",
      content: "I prefer studying at night with lo-fi music.",
      importance: 0.9,
    }),
  });
  assert.equal(saveRes.status, 201, `save_memory failed: ${saveRes.status}`);
  const saveJson = await saveRes.json();
  const savedMem = saveJson.memory;
  assert.ok(savedMem?.id, "Expected memory to have id");
  console.log(`   ✅ PASS: Memory saved with ID ${savedMem.id} (content: "${savedMem.content}")\n`);

  // 3. search_memory: GET /memory/search
  console.log("3. Testing search_memory: GET /memory/search...");
  const searchRes = await fetch(
    `${SERVER_URL}/memory/search?userId=${encodeURIComponent(testUserId)}&q=${encodeURIComponent("studying at night")}`,
    {
      headers: { "x-sage-tool-key": TOOL_KEY },
    },
  );
  assert.equal(searchRes.status, 200, `search_memory failed: ${searchRes.status}`);
  const searchData = await searchRes.json();
  assert.ok(searchData.results && searchData.results.length > 0, "Expected at least 1 memory match");
  console.log(`   ✅ PASS: Search returned ${searchData.results.length} result(s), top score: ${searchData.results[0].score.toFixed(3)}\n`);

  // 4. create_task: POST /tasks
  console.log("4. Testing create_task: POST /tasks...");
  const createTaskRes = await fetch(`${SERVER_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": TOOL_KEY,
    },
    body: JSON.stringify({
      userId: testUserId,
      title: "Finish DBMS assignment",
      dueAt: "tomorrow",
    }),
  });
  assert.equal(createTaskRes.status, 201, `create_task failed: ${createTaskRes.status}`);
  const createTaskJson = await createTaskRes.json();
  const createdTask = createTaskJson.task;
  assert.equal(createdTask.title, "Finish DBMS assignment");
  assert.equal(createdTask.status, "pending");
  console.log(`   ✅ PASS: Task created with ID ${createdTask.id} (title: "${createdTask.title}", status: "${createdTask.status}")\n`);

  // 5. list_tasks: GET /tasks
  console.log("5. Testing list_tasks: GET /tasks...");
  const listRes = await fetch(`${SERVER_URL}/tasks?userId=${encodeURIComponent(testUserId)}`, {
    headers: { "x-sage-tool-key": TOOL_KEY },
  });
  assert.equal(listRes.status, 200, `list_tasks failed: ${listRes.status}`);
  const listData = await listRes.json();
  assert.ok(Array.isArray(listData.tasks) && listData.tasks.length > 0, "Expected list of tasks");
  console.log(`   ✅ PASS: Listed ${listData.tasks.length} task(s) for user\n`);

  // 6. complete_task: POST /tasks/:id/complete
  console.log("6. Testing complete_task: POST /tasks/:id/complete...");
  const completeRes = await fetch(`${SERVER_URL}/tasks/${createdTask.id}/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": TOOL_KEY,
    },
    body: JSON.stringify({ userId: testUserId }),
  });
  assert.equal(completeRes.status, 200, `complete_task failed: ${completeRes.status}`);
  const completeJson = await completeRes.json();
  const completedTask = completeJson.task;
  assert.equal(completedTask.status, "completed");
  console.log(`   ✅ PASS: Task ${completedTask.id} marked as completed\n`);

  // 7. cancel_task: create another task then cancel it
  console.log("7. Testing cancel_task: POST /tasks/:id/cancel...");
  const taskToCancelRes = await fetch(`${SERVER_URL}/tasks`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": TOOL_KEY,
    },
    body: JSON.stringify({
      userId: testUserId,
      title: "Task to be cancelled",
    }),
  });
  const taskToCancelJson = await taskToCancelRes.json();
  const taskToCancel = taskToCancelJson.task;
  const cancelRes = await fetch(`${SERVER_URL}/tasks/${taskToCancel.id}/cancel`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": TOOL_KEY,
    },
    body: JSON.stringify({ userId: testUserId }),
  });
  assert.equal(cancelRes.status, 200, `cancel_task failed: ${cancelRes.status}`);
  const cancelJson = await cancelRes.json();
  const cancelledTask = cancelJson.task;
  assert.equal(cancelledTask.status, "cancelled");
  console.log(`   ✅ PASS: Task ${cancelledTask.id} successfully cancelled\n`);

  // 8. forget_memory: DELETE /memory/:id
  console.log("8. Testing forget_memory: DELETE /memory/:id...");
  const forgetRes = await fetch(
    `${SERVER_URL}/memory/${savedMem.id}?userId=${encodeURIComponent(testUserId)}`,
    {
      method: "DELETE",
      headers: { "x-sage-tool-key": TOOL_KEY },
    },
  );
  assert.equal(forgetRes.status, 200, `forget_memory failed: ${forgetRes.status}`);
  console.log(`   ✅ PASS: Memory ${savedMem.id} removed\n`);

  // 9. Negative Test (Step 11.10 verification: Nonexistent task complete fails)
  console.log("9. Testing Failure Behavior (Nonexistent task completion)...");
  const failRes = await fetch(`${SERVER_URL}/tasks/non-existent-uuid/complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sage-tool-key": TOOL_KEY,
    },
    body: JSON.stringify({ userId: testUserId }),
  });
  assert.equal(failRes.status, 404, "Expected 404 for non-existent task");
  console.log("   ✅ PASS: Failed operation correctly returns 404 error and cannot be faked as success\n");

  console.log("==========================================================");
  console.log("ALL 7 OPENAPI TOOLS VERIFIED OVER LIVE CLOUDFLARE TUNNEL!");
  console.log("==========================================================");
}

run().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
