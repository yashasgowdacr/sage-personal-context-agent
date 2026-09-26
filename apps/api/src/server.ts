import "dotenv/config";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { memoryRoutes } from "./memory/routes.js";
import { agentRoutes } from "./agent/routes.js";
import { orchestratorRoutes } from "./orchestrator/routes.js";
import { SageOrchestrator } from "./orchestrator/orchestrator.js";
import { LyzrReasonerAdapter } from "./orchestrator/reasoner.js";
import { OmiAdapter } from "./omi/adapter.js";
import { registerOmiRoutes } from "./omi/routes.js";
import { taskRoutes } from "./tasks/routes.js";
import { demoRoutes } from "./demo/routes.js";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: true,
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
const reasoner = new LyzrReasonerAdapter();
const orchestrator = new SageOrchestrator({ reasoner });
const omiAdapter = new OmiAdapter(orchestrator);

await app.register(memoryRoutes);
await app.register(agentRoutes);
await app.register(taskRoutes);
await app.register(orchestratorRoutes, { orchestrator });
await registerOmiRoutes(app, omiAdapter);
await app.register(demoRoutes);



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
