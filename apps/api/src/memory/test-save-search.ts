import "dotenv/config";
import { createMemory } from "./service.js";
import { searchMemories } from "./search.js";

async function main() {
  try {
    console.log("1. Testing createMemory...");
    const memory = await createMemory({
      userId: "demo-user",
      type: "preference",
      content: "I prefer studying at night.",
      importance: 0.8,
      source: "user",
    });
    console.log("✅ Saved memory:", memory);

    console.log("\n2. Testing searchMemories...");
    const results = await searchMemories("demo-user", "When do I like to study?");
    console.log("✅ Search results:", JSON.stringify(results, null, 2));
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

main();
