import "dotenv/config";
import { qdrant } from "./qdrant.js";

async function main() {
  try {
    const result = await qdrant.getCollections();

    console.log("✅ Qdrant connection successful");
    console.log("Collections:", result.collections);
  } catch (error) {
    console.error("❌ Qdrant connection failed");
    console.error(error);
    process.exit(1);
  }
}

main();
