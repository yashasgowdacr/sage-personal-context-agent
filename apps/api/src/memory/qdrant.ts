import { QdrantClient } from "@qdrant/js-client-rest";

const url = process.env.QDRANT_URL;

if (!url) {
  console.warn("QDRANT_URL is not configured.");
}

export const qdrant = new QdrantClient({
  url: url || "http://localhost:6333",
  ...(process.env.QDRANT_API_KEY ? { apiKey: process.env.QDRANT_API_KEY } : {}),
});

export const MEMORY_COLLECTION = "sage_memories";
