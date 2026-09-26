import "dotenv/config";
import { initializeMemoryCollection } from "./init.js";

async function main() {
  try {
    await initializeMemoryCollection();
    console.log("✅ Memory initialization complete");
  } catch (error) {
    console.error("❌ Memory initialization failed");
    console.error(error);
    process.exit(1);
  }
}

main();
