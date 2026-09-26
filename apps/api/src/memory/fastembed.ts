import type { EmbeddingProvider, EmbeddingInputType } from "./embeddings.js";

const EMBEDDING_SERVICE_URL =
  process.env.EMBEDDING_SERVICE_URL || "http://127.0.0.1:8000";

const DIMENSION = 384;

interface EmbedResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

export class FastEmbedProvider implements EmbeddingProvider {
  dimension(): number {
    return DIMENSION;
  }

  async embed(
    text: string,
    type: EmbeddingInputType = "document",
  ): Promise<number[]> {
    const input = text.trim();

    if (!input) {
      throw new Error("Cannot generate an embedding for empty text");
    }

    const response = await fetch(`${EMBEDDING_SERVICE_URL}/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: input,
        type,
      }),
    });

    if (!response.ok) {
      const body = await response.text();

      throw new Error(
        `Embedding service failed (${response.status}): ${body}`,
      );
    }

    const data = (await response.json()) as EmbedResponse;

    if (
      !Array.isArray(data.embedding) ||
      data.embedding.length !== DIMENSION
    ) {
      throw new Error(
        `Invalid embedding dimension: expected ${DIMENSION}, received ${
          data.embedding?.length ?? 0
        }`,
      );
    }

    return data.embedding;
  }
}

export const embeddingProvider = new FastEmbedProvider();
