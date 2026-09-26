import "dotenv/config";
import {
  saveMemoryTool,
  searchMemoryTool,
  forgetMemoryTool,
} from "./memory.js";

async function main() {
  const userId = "antigravity-test-user";

  try {
    console.log("=== SAGE Memory Tools Verification ===");

    // 1. SAVE
    console.log("\n1. Testing save_memory tool...");
    const memory = await saveMemoryTool({
      userId,
      type: "preference",
      content: "My preferred coding editor is IntelliJ IDEA.",
      importance: 0.9,
      source: "user",
    });
    console.log("SAVE\n✅ memory created:", {
      id: memory.id,
      userId: memory.userId,
      content: memory.content,
    });

    // 2. SEARCH
    console.log("\n2. Testing search_memory tool...");
    const searchResults = (await searchMemoryTool({
      userId,
      query: "Which editor do I prefer for coding?",
      limit: 5,
    })) as Array<{ score: number; memory: { id: string; content: string } }>;

    console.log("SEARCH\n✅ relevant memory returned:");
    console.log(`Top result (score: ${searchResults[0]?.score}): "${searchResults[0]?.memory?.content}"`);

    if (!searchResults.some((r) => r.memory.id === memory.id)) {
      throw new Error("Saved memory was not returned in search results");
    }

    // 3. FORGET
    console.log("\n3. Testing forget_memory tool...");
    await forgetMemoryTool({
      userId,
      memoryId: memory.id,
    });
    console.log("FORGET\n✅ memory deleted");

    // 4. SEARCH AGAIN
    console.log("\n4. Testing search_memory tool after forget...");
    const searchAfterForget = (await searchMemoryTool({
      userId,
      query: "Which editor do I prefer for coding?",
      limit: 5,
    })) as Array<{ score: number; memory: { id: string } }>;

    const stillExists = searchAfterForget.some((r) => r.memory.id === memory.id);
    if (stillExists) {
      throw new Error("Memory still found after forget!");
    }

    console.log("SEARCH AGAIN\n✅ no matching memory");
    console.log("\n=== ALL MEMORY TOOL TESTS PASSED ===");
  } catch (error) {
    console.error("❌ Memory tool test failed:", error);
    process.exit(1);
  }
}

main();
