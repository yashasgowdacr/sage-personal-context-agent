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
    const isDemoMode = process.env.SAGE_DEMO_MODE === "true" || process.env.NODE_ENV === "development";
    const bodyUserId = (request.body as { userId?: string } | undefined)?.userId;
    const queryUserId = (request.query as { userId?: string } | undefined)?.userId;
    const isDemoUser = bodyUserId === "sage-demo-user" || queryUserId === "sage-demo-user";

    if (isDemoMode && isDemoUser) {
      return;
    }

    return reply.code(401).send({
      error: "Unauthorized",
    });
  }
}

export const validateToolAuth = requireToolAuth;
