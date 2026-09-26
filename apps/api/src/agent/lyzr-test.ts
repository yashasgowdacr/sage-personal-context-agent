import "dotenv/config";

const apiKey = process.env.LYZR_API_KEY;
const agentId = process.env.LYZR_AGENT_ID;

if (!apiKey) {
  throw new Error("LYZR_API_KEY is not configured");
}

if (!agentId) {
  throw new Error("LYZR_AGENT_ID is not configured");
}

const response = await fetch("https://agent-prod.studio.lyzr.ai/v3/inference/chat/", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify({
    user_id: "sage-test-user",
    agent_id: agentId,
    session_id: "sage-test-session",
    message: "Reply with exactly: SAGE LYZR CONNECTION OK",
  }),
});

const body = await response.text();
console.log("HTTP:", response.status);
console.log(body);

if (!response.ok) {
  process.exit(1);
}
