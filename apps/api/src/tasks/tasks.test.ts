import "dotenv/config";
import assert from "node:assert/strict";
import { taskService } from "./service.js";

async function runTests() {
  console.log("=== SAGE TASK SERVICE TEST SUITE ===\n");

  const userId = `test-user-${Date.now()}`;
  const otherUserId = `other-user-${Date.now()}`;
  let passed = 0;
  let failed = 0;

  let createdTaskId = "";

  // 1. Create Task
  try {
    const task = await taskService.createTask({
      userId,
      title: "Finish my DBMS assignment",
      description: "Normalization and indexing chapter",
      dueAt: "tomorrow",
    });

    assert.ok(task.id, "Task should have an ID");
    assert.equal(task.userId, userId);
    assert.equal(task.title, "Finish my DBMS assignment");
    assert.equal(task.status, "pending");
    assert.equal(task.dueAt, "tomorrow");

    createdTaskId = task.id;
    console.log("✅ PASS: 1. Create Task successfully persists task with pending status");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: 1. Create Task", err);
    failed++;
  }

  // 2. List Pending Tasks
  try {
    const tasks = await taskService.listTasks(userId, "pending");
    assert.ok(Array.isArray(tasks), "Should return an array");
    assert.ok(tasks.length >= 1, "Should have at least 1 pending task");
    const found = tasks.find((t) => t.id === createdTaskId);
    assert.ok(found, "Created task should be present in pending tasks");

    console.log("✅ PASS: 2. List Pending Tasks returns created task");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: 2. List Pending Tasks", err);
    failed++;
  }

  // 3. User Isolation (other user cannot see this task)
  try {
    const otherTasks = await taskService.listTasks(otherUserId, "pending");
    assert.equal(otherTasks.length, 0, "Other user should see 0 tasks");

    const forbiddenTask = await taskService.completeTask(otherUserId, createdTaskId);
    assert.equal(forbiddenTask, null, "Other user cannot complete another user's task");

    console.log("✅ PASS: 3. User Isolation prevents unauthorized access across users");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: 3. User Isolation", err);
    failed++;
  }

  // 4. Find Task Semantically
  try {
    const found = await taskService.findTask(userId, "DBMS homework assignment");
    assert.ok(found, "Semantic search should find the DBMS assignment");
    assert.equal(found?.id, createdTaskId);

    console.log("✅ PASS: 4. Find Task Semantically matches query using FastEmbed");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: 4. Find Task Semantically", err);
    failed++;
  }

  // 5. Complete Task
  try {
    const completed = await taskService.completeTask(userId, createdTaskId);
    assert.ok(completed, "Should return completed task");
    assert.equal(completed?.status, "completed");
    assert.ok(completed?.completedAt, "Should have completedAt timestamp");

    // Verify it is no longer in pending
    const pendingTasks = await taskService.listTasks(userId, "pending");
    const stillPending = pendingTasks.find((t) => t.id === createdTaskId);
    assert.equal(stillPending, undefined, "Completed task should not appear in pending list");

    // Verify it appears in completed
    const completedTasks = await taskService.listTasks(userId, "completed");
    const inCompleted = completedTasks.find((t) => t.id === createdTaskId);
    assert.ok(inCompleted, "Task should appear in completed list");

    console.log("✅ PASS: 5. Complete Task updates status to completed and filters correctly");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: 5. Complete Task", err);
    failed++;
  }

  // 6. Cancel Task
  try {
    const taskToCancel = await taskService.createTask({
      userId,
      title: "Temporary test task to cancel",
    });

    const cancelled = await taskService.cancelTask(userId, taskToCancel.id);
    assert.ok(cancelled, "Should return cancelled task");
    assert.equal(cancelled?.status, "cancelled");

    const pendingAfterCancel = await taskService.listTasks(userId, "pending");
    assert.equal(
      pendingAfterCancel.find((t) => t.id === taskToCancel.id),
      undefined,
      "Cancelled task should not appear in pending",
    );

    console.log("✅ PASS: 6. Cancel Task updates status to cancelled");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: 6. Cancel Task", err);
    failed++;
  }

  // 7. Missing Task Detection
  try {
    const missing = await taskService.completeTask(userId, "non-existent-task-id-12345");
    assert.equal(missing, null, "Non-existent task should return null");

    console.log("✅ PASS: 7. Missing Task Detection returns null for invalid task ID");
    passed++;
  } catch (err) {
    console.error("❌ FAIL: 7. Missing Task Detection", err);
    failed++;
  }

  console.log(`\nTEST SUMMARY: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
