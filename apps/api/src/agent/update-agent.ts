import "dotenv/config";

const apiKey = process.env.LYZR_API_KEY;
const agentId = process.env.LYZR_AGENT_ID;

if (!apiKey) {
  throw new Error("LYZR_API_KEY is not configured");
}
if (!agentId) {
  throw new Error("LYZR_AGENT_ID is not configured");
}

const toolNames = [
  "openapi-sage-action-tools-save_memory",
  "openapi-sage-action-tools-search_memory",
  "openapi-sage-action-tools-forget_memory",
  "openapi-sage-action-tools-create_task",
  "openapi-sage-action-tools-list_tasks",
  "openapi-sage-action-tools-complete_task",
  "openapi-sage-action-tools-cancel_task",
];

const actionMap: Record<string, string> = {
  "openapi-sage-action-tools-save_memory": "save_memory",
  "openapi-sage-action-tools-search_memory": "search_memory",
  "openapi-sage-action-tools-forget_memory": "forget_memory",
  "openapi-sage-action-tools-create_task": "create_task",
  "openapi-sage-action-tools-list_tasks": "list_tasks",
  "openapi-sage-action-tools-complete_task": "complete_task",
  "openapi-sage-action-tools-cancel_task": "cancel_task",
};

const toolConfigs = toolNames.map((name) => ({
  tool_name: name,
  tool_source: "openapi",
  action_names: [actionMap[name]],
  persist_auth: true,
  server_id: "",
  provider_uuid: "",
  credential_id: "",
}));

const toolUsageDescription = JSON.stringify(
  Object.fromEntries(toolNames.map((name) => [name, [actionMap[name]]])),
  null,
  2,
);

const agentInstructions = `You are the reasoning agent for SAGE. SAGE is a persistent personal agent that can remember information and perform safe actions. Use SAGE tools when the user's request requires memory retrieval or an external action.

Memory:
- Use search_memory when answering questions that may depend on previously stored user context.
- Use save_memory for useful persistent information.
- Use forget_memory only when the user explicitly asks to forget something.

Tasks:
- Use create_task when the user asks to create/add a task.
- Use list_tasks when the user asks about their tasks.
- Use complete_task when the user indicates an existing task is finished.
- Use cancel_task only after explicit confirmation.

Always use the current user's userId. Never fabricate tool results. Never claim an action succeeded unless the tool response indicates success.`;

console.log("Fetching existing Lyzr agent:", agentId);

const getRes = await fetch(`https://agent-prod.studio.lyzr.ai/v3/agents/${agentId}`, {
  headers: {
    accept: "application/json",
    "x-api-key": apiKey,
  },
});

if (!getRes.ok) {
  throw new Error(`Failed to fetch existing agent: ${getRes.status} ${await getRes.text()}`);
}

const existingAgent = await getRes.json();

// Merge modifications
const updatedPayload = {
  ...existingAgent,
  tools: toolNames,
  tool_configs: toolConfigs,
  tool_usage_description: toolUsageDescription,
  agent_instructions: agentInstructions,
};

// Remove read-only or server-generated fields if any
delete updatedPayload._id;
delete updatedPayload.created_at;
delete updatedPayload.updated_at;
delete updatedPayload.is_owner;
delete updatedPayload.created_by;
delete updatedPayload.access_level;

console.log("Updating Lyzr agent:", agentId);

const response = await fetch(`https://agent-prod.studio.lyzr.ai/v3/agents/${agentId}`, {
  method: "PUT",
  headers: {
    accept: "application/json",
    "Content-Type": "application/json",
    "x-api-key": apiKey,
  },
  body: JSON.stringify(updatedPayload),
});

const body = await response.text();
console.log("HTTP Status:", response.status);
if (!response.ok) {
  console.error("Update failed:", body);
  process.exit(1);
}

console.log("Agent updated successfully!");
const updated = JSON.parse(body);
console.log("Updated tools:", updated.tools);
console.log("Updated instructions preview:\n", updated.agent_instructions?.slice(0, 160));

