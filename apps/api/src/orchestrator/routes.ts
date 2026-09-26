import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { SageOrchestrator } from "./orchestrator.js";
import { validateToolAuth } from "../auth/tool-auth.js";

const OrchestratorRequestSchema = z
  .object({
    userId: z.string().min(1),
    request: z.string().optional(),
    input: z.string().optional(),
    sessionId: z.string().optional(),
    confirmed: z.boolean().optional(),
    confirmationToken: z.string().optional(),
    constraints: z
      .object({
        requireConfirmationForDestructive: z.boolean().optional(),
        maxMemoryRetrievals: z.number().int().positive().optional(),
        minMemoryScore: z.number().min(0).max(1).optional(),
      })
      .optional(),
  })
  .refine((data) => Boolean(data.request || data.input), {
    message: "Either 'request' or 'input' must be provided",
  });

export async function orchestratorRoutes(
  app: FastifyInstance,
  options?: { orchestrator?: SageOrchestrator },
) {
  const orchestrator = options?.orchestrator ?? new SageOrchestrator();

  app.post(
    "/orchestrator/run",
    { preHandler: validateToolAuth },
    async (request, reply) => {
    const parsed = OrchestratorRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid orchestrator request",
        details: parsed.error.flatten(),
      });
    }

    try {
      const requestText = parsed.data.request || parsed.data.input || "";
      const result = await orchestrator.run({
        ...parsed.data,
        request: requestText,
      });
      return reply.code(result.success ? 200 : (result.requiresConfirmation ? 200 : 400)).send(result);
    } catch (error) {
      request.log.error(error);
      return reply.code(500).send({
        success: false,
        error: "Orchestration execution error",
        message: (error as Error).message,
      });
    }
  });
}
