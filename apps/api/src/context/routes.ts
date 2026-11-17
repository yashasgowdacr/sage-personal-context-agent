import type { FastifyInstance } from "fastify";
import { validateToolAuth } from "../auth/tool-auth.js";
import { taskService } from "../tasks/service.js";
import { actionTracker } from "./builder.js";
import { qdrant, MEMORY_COLLECTION } from "../memory/qdrant.js";
import { getConversationMessages, listConversations } from "./conversation.js";

export async function contextRoutes(app: FastifyInstance) {
  app.get("/conversations", { preHandler: validateToolAuth }, async (request, reply) => {
    const userId = ((request.query ?? {}) as { userId?: string }).userId?.trim();
    if (!userId) return reply.code(400).send({ error: "userId is required" });
    return reply.send({ conversations: await listConversations(userId) });
  });

  app.get("/conversations/:sessionId/messages", { preHandler: validateToolAuth }, async (request, reply) => {
    const query = (request.query ?? {}) as { userId?: string };
    const { sessionId } = request.params as { sessionId: string };
    const userId = query.userId?.trim();
    if (!userId || !sessionId) return reply.code(400).send({ error: "userId and sessionId are required" });
    return reply.send({ messages: await getConversationMessages(userId, sessionId) });
  });

  app.get("/context", { preHandler: validateToolAuth }, async (request, reply) => {
    const query = (request.query ?? {}) as { userId?: string };
    const userId = query.userId?.trim();
    if (!userId) return reply.code(400).send({ error: "userId is required" });
    try {
      const [tasks, scrollResult] = await Promise.all([
        taskService.listTasks(userId, "pending"),
        qdrant.scroll(MEMORY_COLLECTION, {
          filter: { must: [{ key: "userId", match: { value: userId } }] },
          limit: 50,
          with_payload: true,
        }),
      ]);
      const memories = (scrollResult.points ?? []).map((p) => {
        const payload = p.payload as Record<string, unknown> | undefined;
        return { id: String(p.id), content: String(payload?.content ?? ""), type: String(payload?.type ?? "fact"), createdAt: payload?.createdAt ? String(payload.createdAt) : undefined };
      }).filter((item) => item.content && item.type !== "task");
      return reply.send({ userId, memories, tasks, recentActions: actionTracker.getRecent(userId, 10).map((a) => a.action) });
    } catch (error) {
      request.log.error(error);
      return reply.code(503).send({ error: "Context service unavailable" });
    }
  });
}
