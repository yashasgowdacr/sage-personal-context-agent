import "dotenv/config";
import dotenv from "dotenv";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { memoryRoutes } from "./memory/routes.js";
import { orchestratorRoutes } from "./orchestrator/routes.js";
import { SageOrchestrator } from "./orchestrator/orchestrator.js";
import { GroqReasonerAdapter } from "./orchestrator/reasoner.js";
import { OmiAdapter } from "./omi/adapter.js";
import { registerOmiRoutes } from "./omi/routes.js";
import { taskRoutes } from "./tasks/routes.js";
import { contextRoutes } from "./context/routes.js";
import { authRoutes } from "./auth/routes.js";
import { initializeMemoryCollection } from "./memory/init.js";
import { initializeConversationStore } from "./context/conversation.js";

dotenv.config({ path: resolve(process.cwd(), "../../.env.local") });

const app = Fastify({
  logger: true,
});

const requiredEnvironment = ["DATABASE_URL", "GROQ_API_KEY", "GROQ_MODEL", "QDRANT_URL", "QDRANT_API_KEY", "SAGE_SESSION_SECRET", "SAGE_TOOL_API_KEY", "WEB_ORIGIN"];
const missingEnvironment = requiredEnvironment.filter((name) => !process.env[name]?.trim());
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(", ")}`);
}

await app.register(cors, {
  origin: process.env.WEB_ORIGIN as string,
  credentials: true,
});

await app.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
  ban: 2,
});

app.get("/health", async () => {
  return {
    status: "ok",
    service: "sage-api",
    timestamp: new Date().toISOString(),
  };
});

app.get("/openapi.json", async (_request, reply) => {
  try {
    const specPath = join(process.cwd(), "openapi.json");
    const spec = JSON.parse(readFileSync(specPath, "utf8"));
    return reply.header("Content-Type", "application/json").send(spec);
  } catch {
    return reply.status(500).send({ error: "Failed to load openapi.json" });
  }
});

app.get("/openapi.yaml", async (_request, reply) => {
  try {
    const specPath = join(process.cwd(), "openapi.yaml");
    const spec = readFileSync(specPath, "utf8");
    return reply.header("Content-Type", "text/yaml").send(spec);
  } catch {
    return reply.status(500).send({ error: "Failed to load openapi.yaml" });
  }
});

// Production reasoning is Groq-only. The API does not silently switch to a rule engine.
const reasoner = new GroqReasonerAdapter();
const orchestrator = new SageOrchestrator({ reasoner });
const omiAdapter = new OmiAdapter(orchestrator);

await app.register(memoryRoutes);
await app.register(taskRoutes);
await app.register(orchestratorRoutes, { orchestrator });
await registerOmiRoutes(app, omiAdapter);
await app.register(contextRoutes);
await app.register(authRoutes);

// Ensure Qdrant collection and indices exist
try {
  await initializeMemoryCollection();
} catch (error) {
  console.warn("Notice: Qdrant memory collection check deferred or failed:", error);
}

try {
  await initializeConversationStore();
} catch (error) {
  console.error("Conversation database initialization failed:", error);
  process.exit(1);
}

// Find built frontend dist path if available
const currentDir = dirname(fileURLToPath(import.meta.url));
const possibleDistPaths = [
  join(process.cwd(), "../web/dist"),
  join(process.cwd(), "apps/web/dist"),
  resolve(currentDir, "../../../web/dist"),
  resolve(currentDir, "../../web/dist"),
  resolve(currentDir, "../web/dist"),
];
const webDistPath = possibleDistPaths.find((p) => existsSync(p) && existsSync(join(p, "index.html")));

if (webDistPath) {
  await app.register(fastifyStatic, {
    root: webDistPath,
    prefix: "/",
    wildcard: true,
  });

  app.setNotFoundHandler(async (request, reply) => {
    const url = request.raw.url || "";
    if (
      url.startsWith("/api") ||
      url.startsWith("/orchestrator") ||
      url.startsWith("/context") ||
      url.startsWith("/conversations") ||
      url.startsWith("/omi") ||
      url.startsWith("/tasks") ||
      url.startsWith("/memory") ||
      url.startsWith("/agent") ||
      url.startsWith("/health") ||
      url.startsWith("/openapi")
    ) {
      return reply.status(404).send({ error: "API route not found", path: url });
    }
    return reply.sendFile("index.html");
  });

  console.log(`Serving SAGE Web Command Center from ${webDistPath}`);
}

const PORT = Number(process.env.PORT) || 3001;
const HOST = process.env.HOST || "0.0.0.0";

try {
  await app.listen({
    port: PORT,
    host: HOST,
  });

  console.log(`SAGE API running on http://localhost:${PORT}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
