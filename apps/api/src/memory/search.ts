import { embeddingProvider } from "./fastembed.js";
import { qdrant, MEMORY_COLLECTION } from "./qdrant.js";
import type { SageMemory } from "./types.js";

export interface MemorySearchResult {
  memory: SageMemory;
  score: number;
}

export async function searchMemories(
  userId: string,
  query: string,
  limit = 5,
): Promise<MemorySearchResult[]> {
  const input = query.trim();

  if (!input) {
    throw new Error("Search query cannot be empty");
  }

  const vector = await embeddingProvider.embed(input, "query");

  const response = await qdrant.query(MEMORY_COLLECTION, {
    query: vector,
    limit,
    with_payload: true,
    filter: {
      must: [
        {
          key: "userId",
          match: {
            value: userId,
          },
        },
      ],
    },
  });

  const points = response.points ?? [];

  return points.map((result) => {
    const payload = (result.payload ?? {}) as Record<string, unknown>;

    return {
      score: result.score ?? 0,
      memory: {
        id: String(result.id),
        userId: String(payload.userId),
        type: payload.type as SageMemory["type"],
        content: String(payload.content),
        importance: Number(payload.importance),
        source: payload.source as SageMemory["source"],
        createdAt: String(payload.createdAt),
        metadata: payload.metadata as Record<string, unknown> | undefined,
      },
    };
  });
}
