import type { FastifyInstance } from "fastify";
import { resetDemoUser, DEMO_USER_ID } from "./reset.js";

export async function demoRoutes(app: FastifyInstance) {
  // Check if demo mode is enabled
  const isDemoEnabled = () =>
    process.env.SAGE_DEMO_MODE === "true" || process.env.NODE_ENV === "development";

  app.get("/demo/status", async (_request, reply) => {
    return reply.send({
      demoMode: isDemoEnabled(),
      demoUser: DEMO_USER_ID,
      environment: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  });

  app.post("/demo/reset", async (request, reply) => {
    if (!isDemoEnabled()) {
      return reply.code(403).send({
        success: false,
        error: "Demo reset is disabled in production mode. Set SAGE_DEMO_MODE=true to enable.",
      });
    }

    const body = (request.body ?? {}) as { userId?: string };
    const targetUserId = body.userId ?? DEMO_USER_ID;

    try {
      const result = await resetDemoUser(targetUserId);
      return reply.send(result);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        success: false,
        error: `Failed to reset demo state: ${(err as Error).message}`,
      });
    }
  });
}
