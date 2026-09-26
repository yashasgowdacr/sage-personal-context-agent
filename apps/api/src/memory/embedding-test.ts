import "dotenv/config";
import { embeddingProvider } from "./fastembed.js";

async function main() {
  try {
    const text = "I prefer studying at night.";

    const docVector = await embeddingProvider.embed(text, "document");
    console.log("✅ Document embedding generated");
    console.log("Dimensions:", docVector.length);
    console.log("First 5 values:", docVector.slice(0, 5));

    const queryVector = await embeddingProvider.embed("When do I prefer studying?", "query");
    console.log("✅ Query embedding generated");
    console.log("Dimensions:", queryVector.length);
    console.log("First 5 values:", queryVector.slice(0, 5));
  } catch (error) {
    console.error("❌ Embedding generation failed");
    console.error(error);
    process.exit(1);
  }
}

main();
