import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireToolAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const configuredKey = process.env.SAGE_TOOL_API_KEY;

  if (!configuredKey) {
    request.log.error("SAGE_TOOL_API_KEY is not configured");
    return reply.code(500).send({
      error: "Tool authentication is not configured",
    });
  }

  const suppliedKey =
    (request.headers["x-sage-tool-key"] as string | undefined) ||
    (request.headers.authorization?.startsWith("Bearer ")
      ? request.headers.authorization.slice(7)
      : undefined) ||
    (request.query as Record<string, string> | undefined)?.key ||
    (request.query as Record<string, string> | undefined)?.api_key ||
    (request.query as Record<string, string> | undefined)?.token;

  if (suppliedKey !== configuredKey) {
    return reply.code(401).send({
      error: "Unauthorized",
    });
  }
}

export const validateToolAuth = requireToolAuth;
