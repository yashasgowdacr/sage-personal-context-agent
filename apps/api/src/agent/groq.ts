import OpenAI from "openai";
import type { OrchestrationContext, ReasoningDecision } from "../orchestrator/types.js";

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  { type: "function", function: { name: "save_memory", description: "Save a user fact or preference.", parameters: { type: "object", properties: { type: { type: "string", enum: ["fact", "preference"] }, content: { type: "string" }, importance: { type: "number" } }, required: ["type", "content"] } } },
  { type: "function", function: { name: "search_memory", description: "Search the user's stored memories.", parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] } } },
  { type: "function", function: { name: "forget_memory", description: "Forget a stored memory.", parameters: { type: "object", properties: { memoryId: { type: "string" } }, required: ["memoryId"] } } },
  { type: "function", function: { name: "create_task", description: "Create a task.", parameters: { type: "object", properties: { title: { type: "string" }, dueAt: { type: "string" }, description: { type: "string" } }, required: ["title"] } } },
  { type: "function", function: { name: "list_tasks", description: "List tasks.", parameters: { type: "object", properties: { status: { type: "string", enum: ["pending", "completed", "cancelled"] } } } } },
  { type: "function", function: { name: "complete_task", description: "Complete a task using its ID or a precise natural-language query.", parameters: { type: "object", properties: { taskId: { type: "string" }, query: { type: "string" } } } } },
  { type: "function", function: { name: "cancel_task", description: "Cancel a task using its ID or a precise natural-language query.", parameters: { type: "object", properties: { taskId: { type: "string" }, query: { type: "string" } } } } },
];

function getClientAndModel() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY is not configured");
  const client = new OpenAI({ apiKey: key, baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1" });
  const configuredModel = process.env.GROQ_MODEL;
  const model = configuredModel && !["llama-3.3-70b-versatile", "llama-3.1-8b-instant"].includes(configuredModel) ? configuredModel : "openai/gpt-oss-20b";
  return { client, model };
}

export async function groqReason(context: OrchestrationContext): Promise<ReasoningDecision> {
  const { client, model } = getClientAndModel();
  const history = (context.conversationHistory ?? []).map((turn) => ({ role: turn.role, content: turn.content } as const));
  const result = await client.chat.completions.create({ model, temperature: 0.1, tools, tool_choice: "auto", messages: [
    { role: "system", content: `You are SAGE, a concise personal context assistant. Use conversation history to resolve short follow-ups such as “6pm to 10pm”. Answer the user's actual question naturally in 1–3 short paragraphs. Do not expose internal tools, action status, Qdrant, embeddings, saved-content dumps, or generic capability lists. Qdrant context is private evidence only; interpret it and answer in your own words. Use a tool only when it is the best way to fulfill the request. When the user states an identity, preference, fact, or goal, use save_memory. When the user asks what they remember or asks for a stored personal fact, use search_memory. User ID is authoritative and belongs only to the authenticated current user: ${context.userId}. Never infer or access another user.\nOlder conversation summary:\n${context.conversationSummary || "None"}\nPrivate context evidence from Qdrant:\n${context.formattedContext || "No stored context."}` },
    ...history,
    { role: "user", content: context.userRequest },
  ] });
  const message = result.choices[0]?.message;
  const call = message?.tool_calls?.[0];
  if (call?.type === "function") {
    const allowed = new Set(tools.map((tool) => tool.type === "function" ? tool.function.name : ""));
    if (!allowed.has(call.function.name)) throw new Error(`Groq selected unknown tool: ${call.function.name}`);
    let input: Record<string, unknown>;
    try { input = JSON.parse(call.function.arguments || "{}"); } catch { throw new Error("Groq returned invalid tool arguments"); }
    if (call.function.name !== "forget_memory") input.userId = context.userId;
    return { thoughtSummary: "Groq selected a verified SAGE tool", selectedTool: { name: call.function.name, input } };
  }
  return { thoughtSummary: "Groq generated a direct response", directResponse: message?.content || "I could not formulate a response." };
}

export async function groqFinalize(context: OrchestrationContext, toolName: string, toolResult: unknown): Promise<string> {
  const { client, model } = getClientAndModel();
  const result = await client.chat.completions.create({
    model,
    temperature: 0.2,
    messages: [
      { role: "system", content: "You are SAGE. Write the final answer to the user after an internal tool completed. Answer naturally and concisely. Never mention tools, Qdrant, internal status, implementation details, or raw JSON. If the operation failed, explain that plainly and do not claim success." },
      { role: "user", content: `User request: ${context.userRequest}\nInternal operation: ${toolName}\nOperation result: ${JSON.stringify(toolResult)}` },
    ],
  });
  return result.choices[0]?.message?.content?.trim() || "I could not formulate a response.";
}
