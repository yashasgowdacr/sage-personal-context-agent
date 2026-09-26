import { qdrant, MEMORY_COLLECTION } from "../memory/qdrant.js";
import { actionTracker } from "../context/builder.js";

export const DEMO_USER_ID = "sage-demo-user";

/**
 * Resets all demo data for a given user in Qdrant and in-memory action tracker,
 * ensuring predictable, pristine state before every demo/judging session.
 */
export async function resetDemoUser(userId: string = DEMO_USER_ID) {
  const targetUser = userId.trim();

  // 1. Delete all points in Qdrant for this user (both memories and tasks)
  try {
    await qdrant.delete(MEMORY_COLLECTION, {
      wait: true,
      filter: {
        must: [
          {
            key: "userId",
            match: {
              value: targetUser,
            },
          },
        ],
      },
    });
  } catch (err) {
    console.warn(`[DemoReset] Qdrant delete note for ${targetUser}: ${(err as Error).message}`);
  }

  // 2. Clear action tracker history for this user
  actionTracker.clear(targetUser);

  return {
    success: true,
    userId: targetUser,
    cleared: {
      memories: true,
      tasks: true,
      actions: true,
    },
    message: `Demo state reset for "${targetUser}". All previous memories, tasks, and actions cleared.`,
    timestamp: new Date().toISOString(),
  };
}
