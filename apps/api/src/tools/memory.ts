import { z } from "zod";
import { memoryManager } from "../memory/manager.js";

const SearchMemorySchema = z.object({
  userId: z.string().min(1),
  query: z.string().min(1),
  limit: z.number().int().positive().max(20).default(5),
});

const SaveMemorySchema = z.object({
  userId: z.string().min(1),
  type: z.enum([
    "fact",
    "preference",
    "goal",
    "commitment",
    "task",
    "event",
    "decision",
    "conversation",
    "document_fact",
    "action_result",
  ]),
  content: z.string().min(1),
  importance: z.number().min(0).max(1).default(0.5),
  source: z
    .enum(["omi", "user", "agent", "document", "tool"])
    .default("agent"),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const ForgetMemorySchema = z.object({
  userId: z.string().min(1),
  memoryId: z.string().uuid(),
});

export async function searchMemoryTool(input: unknown) {
  const parsed = SearchMemorySchema.parse(input);

  return memoryManager.recall(
    parsed.userId,
    parsed.query,
    parsed.limit,
  );
}

export async function saveMemoryTool(input: unknown) {
  const parsed = SaveMemorySchema.parse(input);

  return memoryManager.remember(parsed);
}

export async function forgetMemoryTool(input: unknown) {
  const parsed = ForgetMemorySchema.parse(input);

  return memoryManager.forget(
    parsed.userId,
    parsed.memoryId,
  );
}
