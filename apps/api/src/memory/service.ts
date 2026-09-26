import { randomUUID } from "node:crypto";

import type { CreateMemoryInput, SageMemory } from "./types.js";
import { embeddingProvider } from "./fastembed.js";
import { qdrant, MEMORY_COLLECTION } from "./qdrant.js";

export async function createMemory(
  input: CreateMemoryInput,
): Promise<SageMemory> {
  const memory: SageMemory = {
    id: randomUUID(),
    userId: input.userId,
    type: input.type,
    content: input.content.trim(),
    importance: input.importance ?? 0.5,
    source: input.source ?? "user",
    createdAt: new Date().toISOString(),
    metadata: input.metadata,
  };

  if (!memory.content) {
    throw new Error("Memory content cannot be empty");
  }

  const vector = await embeddingProvider.embed(
    memory.content,
    "document",
  );

  await qdrant.upsert(MEMORY_COLLECTION, {
    wait: true,
    points: [
      {
        id: memory.id,
        vector,
        payload: {
          userId: memory.userId,
          type: memory.type,
          content: memory.content,
          importance: memory.importance,
          source: memory.source,
          createdAt: memory.createdAt,
          metadata: memory.metadata ?? {},
        },
      },
    ],
  });

  return memory;
}
