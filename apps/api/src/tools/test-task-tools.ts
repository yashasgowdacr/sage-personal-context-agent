import "dotenv/config";
import assert from "node:assert/strict";
import {
  createTaskTool,
  listTasksTool,
  completeTaskTool,
  cancelTaskTool,
} from "./tasks.js";
import type { ToolExecutionContext } from "../orchestrator/types.js";
import type { SageTask } from "../tasks/types.js";

async function runTests() {
  console.log("=== SAGE Task Tools Verification ===\n");

  const userId = `tool-test-user-${Date.now()}`;
  const ctx: ToolExecutionContext = {
    requestId: "test-req-123",
    userId,
    sessionId: "test-sess-123",
  };

  let createdTaskId: string;

  // 1. Testing create_task tool
  console.log("1. Testing create_task tool...");
  const createResult = await createTaskTool.execute(
    {
      title: "Prepare DBMS presentation slides",
      description: "Focus on B-trees and indexing",
      dueAt: "tomorrow",
    },
    ctx,
  );

  assert.equal(createResult.success, true);
  const task = (createResult.data as { task: SageTask }).task;
  assert.ok(task.id);
  assert.equal(task.title, "Prepare DBMS presentation slides");
  assert.equal(task.status, "pending");
  createdTaskId = task.id;

  const createVerify = await createTaskTool.verify!(createResult, ctx);
  assert.equal(createVerify.verified, true);
  console.log("CREATE_TASK\n✅ task created and verified:", task.id);

  // 2. Testing list_tasks tool
  console.log("\n2. Testing list_tasks tool...");
  const listResult = await listTasksTool.execute({ status: "pending" }, ctx);
  assert.equal(listResult.success, true);
  const tasks = (listResult.data as { tasks: SageTask[] }).tasks;
  assert.ok(Array.isArray(tasks));
  assert.ok(tasks.length >= 1);
  assert.ok(tasks.find((t) => t.id === createdTaskId));

  const listVerify = await listTasksTool.verify!(listResult, ctx);
  assert.equal(listVerify.verified, true);
  console.log(`LIST_TASKS\n✅ retrieved ${tasks.length} pending task(s) and verified`);

  // 3. Testing complete_task tool
  console.log("\n3. Testing complete_task tool...");
  const completeResult = await completeTaskTool.execute(
    { taskId: createdTaskId },
    ctx,
  );
  assert.equal(completeResult.success, true);
  const completedTask = (completeResult.data as { task: SageTask }).task;
  assert.equal(completedTask.status, "completed");

  const completeVerify = await completeTaskTool.verify!(completeResult, ctx);
  assert.equal(completeVerify.verified, true);
  console.log("COMPLETE_TASK\n✅ task completed and verified:", completedTask.id);

  // 4. Testing cancel_task tool (and metadata)
  console.log("\n4. Testing cancel_task tool...");
  assert.equal(cancelTaskTool.isDestructive, true);
  assert.equal(cancelTaskTool.requiresConfirmation, true);

  // Create a second task to cancel
  const taskToCancel = await createTaskTool.execute(
    { title: "Task to cancel test" },
    ctx,
  );
  const cancelTaskId = (taskToCancel.data as { task: SageTask }).task.id;

  const cancelResult = await cancelTaskTool.execute(
    { taskId: cancelTaskId },
    ctx,
  );
  assert.equal(cancelResult.success, true);
  const cancelledTask = (cancelResult.data as { task: SageTask }).task;
  assert.equal(cancelledTask.status, "cancelled");

  const cancelVerify = await cancelTaskTool.verify!(cancelResult, ctx);
  assert.equal(cancelVerify.verified, true);
  console.log("CANCEL_TASK\n✅ task cancelled and verified:", cancelledTask.id);

  console.log("\n=== ALL TASK TOOL TESTS PASSED ===\n");
}

runTests().catch((err) => {
  console.error("Task tools verification failed:", err);
  process.exit(1);
});
