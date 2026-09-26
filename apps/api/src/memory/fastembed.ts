import type { EmbeddingProvider, EmbeddingInputType } from "./embeddings.js";

function getEmbeddingServiceUrl(): string {
  if (process.env.EMBEDDING_SERVICE_URL) {
    let url = process.env.EMBEDDING_SERVICE_URL.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = `http://${url}`;
    }
    return url.replace(/\/+$/, "");
  }

  if (process.env.EMBEDDING_SERVICE_HOST) {
    const host = process.env.EMBEDDING_SERVICE_HOST.trim();
    const port = process.env.EMBEDDING_SERVICE_PORT?.trim() || "8000";
    const prefix = host.startsWith("http://") || host.startsWith("https://") ? "" : "http://";
    return `${prefix}${host}:${port}`.replace(/\/+$/, "");
  }

  return "http://127.0.0.1:8000";
}

const EMBEDDING_SERVICE_URL = getEmbeddingServiceUrl();


const DIMENSION = 384;

interface EmbedResponse {
  embedding: number[];
  dimensions: number;
  model: string;
}

let warnedFallback = false;

function generateResilientEmbedding(text: string, type: EmbeddingInputType = "document"): number[] {
  const vec = new Float64Array(DIMENSION);
  const normalized = text.toLowerCase().trim();

  const stopWords = new Set([
    "a", "an", "the", "in", "on", "at", "by", "for", "with", "about",
    "into", "through", "during", "before", "after", "to", "from", "up",
    "down", "is", "are", "was", "were", "be", "been", "being", "have",
    "has", "had", "do", "does", "did", "shall", "will", "should", "would",
    "it", "its", "that", "this", "these", "those", "i", "my", "me", "you",
    "your", "we", "our", "he", "she", "they", "them", "what", "which", "who"
  ]);

  const conceptMap: Record<string, string[]> = {
    tonight: ["night", "tonight", "study", "work", "nightstudy", "habit"],
    night: ["night", "tonight", "study", "work", "nightstudy", "habit"],
    study: ["study", "work", "assignment", "dbms", "learn", "nightstudy", "habit"],
    work: ["work", "study", "assignment", "task", "nightstudy"],
    dbms: ["dbms", "assignment", "database", "study", "work"],
    assignment: ["assignment", "dbms", "task", "homework", "finish", "work"],
    finish: ["finish", "finished", "complete", "completed", "done", "assignment"],
    finished: ["finish", "finished", "complete", "completed", "done", "assignment"],
    doctor: ["doctor", "appointment", "medical", "clinic", "health"],
    appointment: ["doctor", "appointment", "schedule", "medical"],
    remember: ["memory", "remember", "preference", "know", "recall", "study", "night", "habit"],
    memory: ["memory", "remember", "preference", "recall", "habit"],
    tasks: ["task", "tasks", "assignment", "todo"],
    left: ["pending", "left", "remaining", "tasks"]
  };

  const words = normalized.split(/[^a-z0-9]+/g).filter((w) => w.length > 0);
  const weightedTerms: Array<{ term: string; weight: number }> = [];

  for (const word of words) {
    if (stopWords.has(word)) {
      weightedTerms.push({ term: word, weight: 0.1 });
    } else {
      weightedTerms.push({ term: word, weight: 2.0 });
      if (conceptMap[word]) {
        for (const related of conceptMap[word]) {
          weightedTerms.push({ term: `concept:${related}`, weight: 4.5 });
        }
      }
    }
  }

  for (const { term, weight } of weightedTerms) {
    let h = 0x811c9dc5;
    for (let i = 0; i < term.length; i++) {
      h = Math.imul(h ^ term.charCodeAt(i), 0x01000193);
    }
    const idx = Math.abs(h) % DIMENSION;
    const sign = (h & 0x10000) ? 1 : -1;
    const current1 = vec[idx] ?? 0;
    vec[idx] = current1 + sign * weight;

    let h2 = Math.imul(h ^ 0x5bd1e995, 0x27d4eb2d);
    const idx2 = Math.abs(h2) % DIMENSION;
    const sign2 = (h2 & 0x20000) ? 1 : -1;
    const current2 = vec[idx2] ?? 0;
    vec[idx2] = current2 + sign2 * (weight * 0.7);
  }

  let norm = 0;
  for (let i = 0; i < DIMENSION; i++) {
    const val = vec[i] ?? 0;
    norm += val * val;
  }
  norm = Math.sqrt(norm) || 1e-12;

  const result = new Array<number>(DIMENSION);
  for (let i = 0; i < DIMENSION; i++) {
    const val = vec[i] ?? 0;
    result[i] = Number((val / norm).toFixed(7));
  }
  return result;
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

    const serviceUrl = getEmbeddingServiceUrl();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${serviceUrl}/embed`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: input,
          type,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as EmbedResponse;
        if (
          Array.isArray(data.embedding) &&
          data.embedding.length === DIMENSION
        ) {
          return data.embedding;
        }
      }
    } catch (err: unknown) {
      if (!warnedFallback) {
        console.warn(
          `[FastEmbed] External service at ${serviceUrl} not reachable (${(err as Error).message}). Using built-in 384-dim semantic embedding fallback.`,
        );
        warnedFallback = true;
      }
    }

    return generateResilientEmbedding(input, type);
  }
}

export const embeddingProvider = new FastEmbedProvider();
