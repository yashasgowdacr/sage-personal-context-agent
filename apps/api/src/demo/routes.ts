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

  // Safe read-only context endpoint for Command Center UI sidebar
  app.get("/demo/context", async (request, reply) => {
    const query = (request.query ?? {}) as { userId?: string };
    const targetUserId = query.userId ?? DEMO_USER_ID;

    try {
      // 1. Fetch real pending tasks from taskService
      const { taskService } = await import("../tasks/service.js");
      const tasks = await taskService.listTasks(targetUserId, "pending");

      // 2. Fetch real recent actions from actionTracker
      const { actionTracker } = await import("../context/builder.js");
      const recentActions = actionTracker.getRecent(targetUserId, 10).map((a) => a.action);

      // 3. Fetch real stored memories from Qdrant (excluding task records)
      const { qdrant, MEMORY_COLLECTION } = await import("../memory/qdrant.js");
      const scrollResult = await qdrant.scroll(MEMORY_COLLECTION, {
        filter: {
          must: [{ key: "userId", match: { value: targetUserId } }],
        },
        limit: 50,
        with_payload: true,
      });

      const memories = (scrollResult.points ?? [])
        .map((p) => {
          const payload = p.payload as Record<string, unknown> | undefined;
          return {
            id: String(p.id ?? payload?.id ?? ""),
            content: String(payload?.content ?? ""),
            type: String(payload?.type ?? "fact"),
            createdAt: payload?.createdAt ? String(payload.createdAt) : undefined,
          };
        })
        .filter((item) => Boolean(item.content && item.type !== "task"));

      return reply.send({
        userId: targetUserId,
        memories,
        tasks,
        recentActions,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        error: "Failed to fetch demo context",
        message: (err as Error).message,
      });
    }
  });
}
