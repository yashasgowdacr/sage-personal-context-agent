import type { SageAgentRequest, SageAgentResponse } from "./types.js";

const LYZR_API_URL =
  process.env.LYZR_AGENT_URL && process.env.LYZR_AGENT_URL.includes("inference/chat")
    ? process.env.LYZR_AGENT_URL
    : "https://agent-prod.studio.lyzr.ai/v3/inference/chat/";

export async function invokeLyzr(
  input: SageAgentRequest,
): Promise<SageAgentResponse> {
  const apiKey = process.env.LYZR_API_KEY;
  const agentId = process.env.LYZR_AGENT_ID;

  if (!apiKey) {
    throw new Error("LYZR_API_KEY is not configured");
  }

  if (!agentId) {
    throw new Error("LYZR_AGENT_ID is not configured");
  }

  const response = await fetch(LYZR_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      user_id: input.userId,
      agent_id: agentId,
      session_id: input.sessionId,
      message: input.message,
    }),
  });

  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Lyzr request failed (${response.status}): ${body}`);
  }

  const data = JSON.parse(body) as { response?: string };

  return {
    response: data.response ?? body,
  };
}
