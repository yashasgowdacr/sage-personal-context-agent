import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { invokeLyzr } from "./lyzr.js";

const AgentChatSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  message: z.string().min(1),
});

export async function agentRoutes(app: FastifyInstance) {
  app.post("/agent/chat", async (request, reply) => {
    const parsed = AgentChatSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid agent request",
        details: parsed.error.flatten(),
      });
    }

    try {
      const result = await invokeLyzr(parsed.data);

      return {
        success: true,
        ...result,
      };
    } catch (error) {
      request.log.error(error);

      return reply.code(502).send({
        success: false,
        error: "Lyzr agent request failed",
      });
    }
  });
}
