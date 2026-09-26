import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { memoryManager } from "./manager.js";
import { requireToolAuth } from "../auth/tool-auth.js";

const createMemorySchema = z.object({
  userId: z.string().min(1),
  type: z.enum([
    "fact",
    "preference",
    "goal",
    "commitment",
    "task",
    "event",
    "decision",
    "conversation",
    "document_fact",
    "action_result",
  ]),
  content: z.string().min(1),
  importance: z.number().min(0).max(1).optional(),
  source: z
    .enum(["omi", "user", "agent", "document", "tool"])
    .optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export async function memoryRoutes(app: FastifyInstance) {
  // Remember: save new memory (protected by tool auth)
  app.post("/memory", { preHandler: requireToolAuth }, async (request, reply) => {
    const parsed = createMemorySchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.status(400).send({
        error: "Invalid memory",
        details: parsed.error.flatten(),
      });
    }

    const memory = await memoryManager.remember(parsed.data);

    return reply.status(201).send({
      success: true,
      memory,
    });
  });

  // Recall: search memories (protected by tool auth)
  app.get("/memory/search", { preHandler: requireToolAuth }, async (request, reply) => {
    const query = request.query as {
      userId?: string;
      q?: string;
      limit?: string;
    };

    if (!query.userId || !query.q) {
      return reply.code(400).send({
        error: "userId and q are required",
      });
    }

    const limit = query.limit ? Number(query.limit) : 5;

    const results = await memoryManager.recall(
      query.userId,
      query.q,
      limit,
    );

    return {
      results,
    };
  });

  // Forget: delete a memory (protected by tool auth)
  app.delete("/memory/:id", { preHandler: requireToolAuth }, async (request, reply) => {
    const params = request.params as { id: string };
    const query = request.query as { userId?: string };

    if (!params.id || !query.userId) {
      return reply.code(400).send({
        error: "Memory id and userId are required",
      });
    }

    await memoryManager.forget(query.userId, params.id);

    return {
      success: true,
      message: `Memory ${params.id} deleted successfully`,
    };
  });
}
