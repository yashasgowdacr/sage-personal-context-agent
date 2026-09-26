import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { OmiAdapter } from "./adapter.js";
import { OmiIngestionService, type RawOmiEvent } from "./ingestion.js";
import { validateToolAuth } from "../auth/tool-auth.js";

const OmiRequestSchema = z.object({
  userId: z.string().min(1),
  sessionId: z.string().min(1),
  transcript: z.string(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export async function registerOmiRoutes(
  fastify: FastifyInstance,
  adapter: OmiAdapter,
  ingestionService?: OmiIngestionService,
) {
  const ingestion = ingestionService ?? new OmiIngestionService(adapter);

  // 1. Direct normalized input endpoint
  fastify.post(
    "/omi/input",
    { preHandler: validateToolAuth },
    async (request, reply) => {
      const parsed = OmiRequestSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          success: false,
          error: "Invalid Omi input",
          details: parsed.error.flatten(),
        });
      }

      const result = await adapter.handle({
        userId: parsed.data.userId,
        sessionId: parsed.data.sessionId,
        transcript: parsed.data.transcript,
        context: parsed.data.context as any,
      });

      return reply.send(result);
    },
  );

  // 2. Real Omi webhook endpoint (handles raw events, segments, structured memories, query params)
  fastify.post(
    "/omi/webhook",
    { preHandler: validateToolAuth },
    async (request, reply) => {
      const rawEvent = (request.body ?? {}) as RawOmiEvent;
      const queryParams = (request.query ?? {}) as Record<string, string | undefined>;

      const result = await ingestion.ingest(rawEvent, queryParams);
      return reply.send(result);
    },
  );
}

