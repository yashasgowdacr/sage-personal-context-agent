import { memoryManager } from "../memory/manager.js";
import { taskService } from "../tasks/service.js";
import type {
  SageContext,
  SageContextMemory,
  SageContextTask,
  SageContextAction,
  ContextBuilderOptions,
} from "./types.js";

export class ActionTracker {
  private actions: Map<string, SageContextAction[]> = new Map();

  record(userId: string, action: string, status = "completed"): void {
    const list = this.actions.get(userId) ?? [];
    list.unshift({
      action,
      status,
      timestamp: new Date().toISOString(),
    });
    if (list.length > 20) {
      list.pop();
    }
    this.actions.set(userId, list);
  }

  getRecent(userId: string, limit = 5): SageContextAction[] {
    return (this.actions.get(userId) ?? []).slice(0, limit);
  }

  clear(userId?: string): void {
    if (userId) {
      this.actions.delete(userId);
    } else {
      this.actions.clear();
    }
  }
}

export const actionTracker = new ActionTracker();

/**
 * Default relevance threshold determined from FastEmbed BAAI/bge-small-en-v1.5 cosine similarity.
 * Empirically:
 * - Directly relevant memories: score >= 0.75
 * - Weak / unrelated baseline: score ~ 0.60 - 0.67
 */
export const DEFAULT_RELEVANCE_THRESHOLD = 0.70;


/**
 * Builds a unified, relevance-filtered SageContext combining:
 * 1. Semantic persistent memories from Qdrant
 * 2. Active pending tasks
 * 3. Recent action results
 */
export async function buildSageContext(
  userId: string,
  currentInput: string,
  options?: ContextBuilderOptions,
): Promise<SageContext> {
  const trimmedUserId = userId.trim();
  const trimmedInput = currentInput.trim();

  const minScore = options?.minMemoryScore ?? DEFAULT_RELEVANCE_THRESHOLD;
  const maxMemories = options?.maxMemories ?? 5;

  // 1. Retrieve & filter memories by semantic similarity threshold
  let memories: SageContextMemory[] = [];
  if (trimmedInput) {
    try {
      const recalled = await memoryManager.recall(trimmedUserId, trimmedInput, maxMemories);
      const seen = new Set<string>();

      for (const item of recalled) {
        if (item.score >= minScore) {
          if (item.memory.type === "task") {
            continue;
          }
          const key = item.memory.content.trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            memories.push({
              content: item.memory.content,
              type: item.memory.type,
              importance: item.memory.importance,
              score: item.score,
            });
          }
        }
      }
    } catch {
      memories = [];
    }
  }

  // 2. Retrieve active pending tasks
  let pendingTasks: SageContextTask[] = [];
  if (options?.includeTasks !== false) {
    try {
      const rawTasks = await taskService.listTasks(trimmedUserId, "pending");
      pendingTasks = rawTasks.map((t) => ({
        id: t.id,
        title: t.title,
        ...(t.dueAt ? { dueAt: t.dueAt } : {}),
      }));
    } catch {
      pendingTasks = [];
    }
  }

  // 3. Retrieve recent actions
  const recentActions = actionTracker.getRecent(trimmedUserId, options?.maxRecentActions ?? 3);

  return {
    userId: trimmedUserId,
    currentInput: trimmedInput,
    memories,
    pendingTasks,
    recentActions,
  };
}
