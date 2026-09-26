import "dotenv/config";
import { qdrant, MEMORY_COLLECTION } from "./qdrant.js";

async function main() {
  try {
    const collections = await qdrant.getCollections();

    const exists = collections.collections.some(
      (collection) => collection.name === MEMORY_COLLECTION,
    );

    if (exists) {
      await qdrant.deleteCollection(MEMORY_COLLECTION);
      console.log(`✓ Deleted "${MEMORY_COLLECTION}"`);
    } else {
      console.log(`✓ "${MEMORY_COLLECTION}" does not exist`);
    }
  } catch (error) {
    console.error("❌ Failed to reset collection");
    console.error(error);
    process.exit(1);
  }
}

main();
