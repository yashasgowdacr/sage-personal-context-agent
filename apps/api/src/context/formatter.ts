import type { SageContext } from "./types.js";

/**
 * Formats a structured SageContext into a clean, compact context block
 * suitable for reasoning agents without exposing private chain-of-thought.
 */
export function formatContextForReasoner(context: SageContext): string {
  const sections: string[] = [];

  // 1. Relevant User Memory
  if (context.memories.length > 0) {
    const memoryLines = context.memories.map((m) => `- ${m.content}`);
    sections.push(`RELEVANT USER MEMORY:\n${memoryLines.join("\n")}`);
  }

  // 2. Pending Tasks
  if (context.pendingTasks.length > 0) {
    const taskLines = context.pendingTasks.map((t) => {
      const due = t.dueAt ? ` (due: ${t.dueAt})` : "";
      return `- ${t.title}${due}`;
    });
    sections.push(`PENDING TASKS:\n${taskLines.join("\n")}`);
  }

  // 3. Recent Actions
  if (context.recentActions.length > 0) {
    const actionLines = context.recentActions.map((a) => `- ${a.action} (${a.status})`);
    sections.push(`RECENT ACTIONS:\n${actionLines.join("\n")}`);
  }

  // 4. Current Request
  sections.push(`CURRENT REQUEST:\n- ${context.currentInput}`);

  return sections.join("\n\n");
}
