import { createMemory } from "./service.js";
import { searchMemories, type MemorySearchResult } from "./search.js";
import { qdrant, MEMORY_COLLECTION } from "./qdrant.js";
import type { CreateMemoryInput, SageMemory } from "./types.js";

export class MemoryManager {
  /**
   * Save a new memory with semantic embeddings
   */
  async remember(input: CreateMemoryInput): Promise<SageMemory> {
    return createMemory(input);
  }

  /**
   * Search memories using semantic similarity
   */
  async recall(
    userId: string,
    query: string,
    limit = 5,
  ): Promise<MemorySearchResult[]> {
    return searchMemories(userId, query, limit);
  }

  /**
   * Remove a specific memory scoped by user
   */
  async forget(userId: string, memoryId: string): Promise<boolean> {
    const id = memoryId.trim();
    const user = userId.trim();

    if (!id || !user) {
      throw new Error("userId and memoryId are required");
    }

    await qdrant.delete(MEMORY_COLLECTION, {
      wait: true,
      filter: {
        must: [
          {
            has_id: [id],
          },
          {
            key: "userId",
            match: {
              value: user,
            },
          },
        ],
      },
    });

    return true;
  }
}

export const memoryManager = new MemoryManager();
