import "dotenv/config";
import { qdrant, MEMORY_COLLECTION } from "./qdrant.js";

const DEFAULT_VECTOR_SIZE = 384;

export async function initializeMemoryCollection(vectorSize: number = DEFAULT_VECTOR_SIZE) {
  const collections = await qdrant.getCollections();

  const exists = collections.collections.some(
    (collection) => collection.name === MEMORY_COLLECTION,
  );

  if (!exists) {
    await qdrant.createCollection(MEMORY_COLLECTION, {
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    });
    console.log(`✓ Created Qdrant collection "${MEMORY_COLLECTION}" (size: ${vectorSize})`);
  } else {
    console.log(`✓ Qdrant collection "${MEMORY_COLLECTION}" exists`);
  }

    try {
      await qdrant.createPayloadIndex(MEMORY_COLLECTION, {
        field_name: "userId",
        field_schema: "keyword",
      });
      console.log(`✓ Created payload index on "userId"`);
    } catch (err) {
      // Index may already exist
    }

    try {
      await qdrant.createPayloadIndex(MEMORY_COLLECTION, {
        field_name: "type",
        field_schema: "keyword",
      });
      console.log(`✓ Created payload index on "type"`);
    } catch (err) {
      // Index may already exist
    }
}

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeMemoryCollection().catch(console.error);
}

