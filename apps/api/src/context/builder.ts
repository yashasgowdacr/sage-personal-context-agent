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
 * Determines whether pending tasks are relevant to the user input.
 * Implements the Task Reference Rule:
 * Tasks should be included when:
 * - user explicitly asks about tasks ("what are my pending tasks", "show my tasks")
 * - user refers to a specific task (e.g. mentions keywords from task title)
 * - current request clearly relates to task planning / work ("what should I work on tonight")
 * - current context requires task planning / action
 *
 * Tasks should NOT be included merely because they are pending.
 */
export function isTaskRelevantToInput(input: string, tasks: Array<{ title: string }>): boolean {
  const lower = input.toLowerCase().trim();
  if (!lower) return false;

  // 1. Unrelated cross-domain queries should NOT include study/work tasks
  // (e.g. appointment scheduling, doctor visits, greetings, general chit-chat)
  const isUnrelatedCrossDomain =
    lower.includes("appointment") ||
    lower.includes("doctor") ||
    lower.includes("dentist") ||
    lower.includes("hotel") ||
    lower.includes("flight") ||
    lower.includes("reservation") ||
    lower.startsWith("hello") ||
    lower.startsWith("hi ") ||
    lower === "hi" ||
    lower.includes("joke") ||
    lower.includes("weather");

  // Check if any specific task title keyword is explicitly mentioned in the request
  const mentionsSpecificTask = tasks.some((t) => {
    const titleWords = t.title
      .toLowerCase()
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 3 &&
          !["finish", "complete", "tomorrow", "tonight", "task", "assignment", "the", "and", "for"].includes(w)
      );
    return titleWords.some((w) => lower.includes(w));
  });

  if (mentionsSpecificTask) {
    return true;
  }

  if (isUnrelatedCrossDomain) {
    return false;
  }

  // 2. Explicit task listing / inquiry
  if (
    lower.includes("task") ||
    lower.includes("tasks") ||
    lower.includes("to-do") ||
    lower.includes("todo") ||
    lower.includes("what do i have") ||
    lower.includes("what do i need to do")
  ) {
    return true;
  }

  // 3. Work / Study / Task Planning queries
  if (
    lower.includes("work on") ||
    lower.includes("what should i do") ||
    lower.includes("what to do") ||
    lower.includes("what should i study") ||
    lower.includes("what to study") ||
    lower.includes("assignment") ||
    lower.includes("homework")
  ) {
    return true;
  }

  // 4. Task actions (completing, finishing, cancelling)
  if (
    lower.startsWith("i finished") ||
    lower.startsWith("completed") ||
    lower.startsWith("mark ") ||
    lower.startsWith("cancel ")
  ) {
    return true;
  }

  return false;
}

/**
 * Builds a unified, relevance-filtered SageContext combining:
 * 1. Semantic persistent memories from Qdrant
 * 2. Active pending tasks (filtered by task relevance)
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

  // 2. Retrieve active pending tasks (only if relevant to current input or explicitly forced)
  let pendingTasks: SageContextTask[] = [];
  if (options?.includeTasks !== false) {
    try {
      const rawTasks = await taskService.listTasks(trimmedUserId, "pending");
      const shouldInclude = options?.forceIncludeTasks || isTaskRelevantToInput(trimmedInput, rawTasks);
      if (shouldInclude) {
        pendingTasks = rawTasks.map((t) => ({
          id: t.id,
          title: t.title,
          ...(t.dueAt ? { dueAt: t.dueAt } : {}),
        }));
      }
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
