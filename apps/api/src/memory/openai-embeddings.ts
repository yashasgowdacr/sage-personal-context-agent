import OpenAI from "openai";
import type { EmbeddingProvider, EmbeddingInputType } from "./embeddings.js";

const MODEL = "text-embedding-3-small";
const DIMENSION = 1536;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  dimension(): number {
    return DIMENSION;
  }

  async embed(text: string, _type?: EmbeddingInputType): Promise<number[]> {
    const input = text.trim();

    if (!input) {
      throw new Error("Cannot generate an embedding for empty text");
    }

    const response = await client.embeddings.create({
      model: MODEL,
      input,
      dimensions: DIMENSION,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding) {
      throw new Error("Failed to generate embedding from OpenAI");
    }

    return embedding;
  }
}

export const embeddingProvider = new OpenAIEmbeddingProvider();
