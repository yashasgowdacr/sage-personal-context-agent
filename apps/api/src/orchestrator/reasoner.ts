import type { OrchestrationContext, ReasoningDecision } from "./types.js";
import { invokeLyzr } from "../agent/lyzr.js";
import { taskService } from "../tasks/service.js";

export interface SageReasoner {
  reason(context: OrchestrationContext): Promise<ReasoningDecision>;
}

export class StandardReasoner implements SageReasoner {
  async reason(context: OrchestrationContext): Promise<ReasoningDecision> {
    const text = context.userRequest.trim();
    const lower = text.toLowerCase();

    // 0a. Check for Task Creation intent ("remind me to...", "add a task to...", "create task...")
    if (
      lower.startsWith("remind me to ") ||
      lower.startsWith("add a task to ") ||
      lower.startsWith("add a task: ") ||
      lower.startsWith("add a task ") ||
      lower.startsWith("add task ") ||
      lower.startsWith("create a task to ") ||
      lower.startsWith("create a task: ") ||
      lower.startsWith("create a task ") ||
      lower.startsWith("create task ") ||
      lower.startsWith("task: ")
    ) {
      let rawTitle = text;
      if (lower.startsWith("remind me to ")) rawTitle = text.slice(13).trim();
      else if (lower.startsWith("add a task to ")) rawTitle = text.slice(14).trim();
      else if (lower.startsWith("add a task: ")) rawTitle = text.slice(12).trim();
      else if (lower.startsWith("add a task ")) rawTitle = text.slice(11).trim();
      else if (lower.startsWith("add task ")) rawTitle = text.slice(9).trim();
      else if (lower.startsWith("create a task to ")) rawTitle = text.slice(17).trim();
      else if (lower.startsWith("create a task: ")) rawTitle = text.slice(15).trim();
      else if (lower.startsWith("create a task ")) rawTitle = text.slice(14).trim();
      else if (lower.startsWith("create task ")) rawTitle = text.slice(12).trim();
      else if (lower.startsWith("task: ")) rawTitle = text.slice(6).trim();

      let dueAt: string | undefined;
      // Strip trailing period/punctuation before matching due patterns
      rawTitle = rawTitle.replace(/[.,!?]+$/, "").trim();
      let title = rawTitle;

      const duePatterns = [
        /\s+(tomorrow)$/i,
        /\s+(tonight)$/i,
        /\s+(today)$/i,
        /\s+(next week)$/i,
        /\s+by\s+([^,]+)$/i,
        /\s+on\s+([^,]+)$/i,
      ];

      for (const pattern of duePatterns) {
        const match = rawTitle.match(pattern);
        if (match && match[1]) {
          dueAt = match[1].trim();
          title = rawTitle.replace(pattern, "").trim();
          break;
        }
      }

      // Capitalize first letter of title if lowercase
      if (title.length > 0) {
        title = title.charAt(0).toUpperCase() + title.slice(1);
      }

      return {
        thoughtSummary: `Detected task creation request for "${title}"`,
        selectedTool: {
          name: "create_task",
          input: {
            userId: context.userId,
            title,
            dueAt,
          },
        },
      };
    }

    // 0b. Check for Context Fusion Recommendation ("what should I work on tonight?", "what should I do tonight?")
    const isRecommendationQuery =
      lower.includes("what should i work on") ||
      lower.includes("what should i do") ||
      lower.includes("what to work on") ||
      lower.includes("what should i study");

    if (isRecommendationQuery && context.sageContext) {
      const pending = context.sageContext.pendingTasks;
      const memories = context.sageContext.memories;

      if (pending.length > 0) {
        const timePreference = memories.find((m) => {
          const c = m.content.toLowerCase();
          return c.includes("night") || c.includes("evening") || c.includes("study") || c.includes("prefer");
        });

        if (timePreference && (lower.includes("tonight") || lower.includes("night"))) {
          const primaryTask = pending[0];
          let taskTitle = (primaryTask?.title ?? "")
            .replace(/\bmy\b/gi, "your")
            .replace(/[.]+$/, "")
            .trim();

          let actionStr = taskTitle;
          if (taskTitle.toLowerCase().startsWith("finish ")) {
            actionStr = `work on ${taskTitle.slice(7).trim()}`;
          } else if (!taskTitle.toLowerCase().startsWith("work on ")) {
            actionStr = `work on ${taskTitle}`;
          }

          return {
            thoughtSummary: "Context fusion: Combined night study preference and pending task for recommendation",
            directResponse: `Since you prefer studying at night, tonight would be a good time to ${actionStr}.`,
          };
        }
      }
    }

    // 0e. Check for Appointment / Scheduling clarification intent
    const isAppointmentRequest =
      lower.includes("appointment") ||
      (lower.includes("schedule") &&
        (lower.includes("doctor") ||
          lower.includes("dentist") ||
          lower.includes("meeting") ||
          lower.includes("call") ||
          lower.includes("visit") ||
          lower.includes("consultation")));

    if (isAppointmentRequest) {
      return {
        thoughtSummary: "Detected appointment scheduling intent; requesting date and time details",
        directResponse: "I can help with that. What date and time would you like for the appointment?",
      };
    }

    // 0c. Check for Task Listing intent ("what tasks do i have?", "show my pending tasks", "what do i need to do?")
    if (
      lower.includes("what tasks do i have") ||
      lower.includes("what are my pending tasks") ||
      lower.includes("what are my tasks") ||
      lower.includes("what tasks do i") ||
      lower.includes("what tasks") ||
      lower.includes("my pending tasks") ||
      lower.includes("show my tasks") ||
      lower.includes("show my pending tasks") ||
      lower.includes("list my tasks") ||
      lower.includes("list tasks") ||
      lower.includes("what do i need to do") ||
      lower.includes("what's on my to-do list") ||
      lower.includes("what is on my to-do list") ||
      lower.includes("what should i work on")
    ) {
      return {
        thoughtSummary: "Detected task listing inquiry",
        selectedTool: {
          name: "list_tasks",
          input: {
            userId: context.userId,
            status: "pending",
          },
        },
      };
    }

    // 0c. Check for Task Completion intent ("mark ... as completed", "i finished my ...", "complete task ...")
    if (
      (lower.startsWith("mark ") && (lower.includes("completed") || lower.includes("done"))) ||
      lower.startsWith("i finished ") ||
      lower.startsWith("completed ") ||
      lower.startsWith("complete task ") ||
      lower.includes("finished my ")
    ) {
      let query = text;
      if (lower.startsWith("i finished my ")) query = text.slice(14).trim();
      else if (lower.startsWith("i finished ")) query = text.slice(11).trim();
      else if (lower.startsWith("completed ")) query = text.slice(10).trim();
      else if (lower.startsWith("complete task ")) query = text.slice(14).trim();
      else if (lower.startsWith("mark my ")) {
        query = text.slice(8).replace(/\s+(as\s+)?(completed|done)\.?$/i, "").trim();
      } else if (lower.startsWith("mark ")) {
        query = text.slice(5).replace(/\s+(as\s+)?(completed|done)\.?$/i, "").trim();
      }

      query = query.replace(/[.,!?]+$/, "").trim();

      // Check context.sageContext.pendingTasks first
      let matchedTaskId: string | undefined;
      if (context.sageContext?.pendingTasks) {
        const queryLower = query.toLowerCase();
        for (const t of context.sageContext.pendingTasks) {
          const titleLower = t.title.toLowerCase();
          if (
            titleLower.includes(queryLower) ||
            queryLower.includes(titleLower.replace(/^finish\s+/i, "")) ||
            queryLower.includes(titleLower)
          ) {
            matchedTaskId = t.id;
            break;
          }
        }
      }

      // Check context.retrievedMemories for a matching task second
      if (!matchedTaskId) {
        for (const m of context.retrievedMemories) {
          if (m.memory.type === "task") {
            matchedTaskId = m.memory.id;
            break;
          }
        }
      }

      // If not in context memories, query taskService directly
      if (!matchedTaskId) {
        const found = await taskService.findTask(context.userId, query);
        if (found) {
          matchedTaskId = found.id;
        }
      }

      if (matchedTaskId) {
        return {
          thoughtSummary: `Identified task completion request matching task ${matchedTaskId}`,
          selectedTool: {
            name: "complete_task",
            input: {
              userId: context.userId,
              taskId: matchedTaskId,
            },
          },
        };
      }

      return {
        thoughtSummary: "Task completion requested but no matching task was found",
        directResponse: "I couldn't find a matching task to mark as completed.",
      };
    }

    // 0d. Check for Task Cancellation intent ("cancel task ...", "cancel my ... task")
    if (
      lower.startsWith("cancel task ") ||
      lower.startsWith("cancel my ") ||
      lower.includes("cancel the task") ||
      lower.includes("delete task ")
    ) {
      let query = text;
      if (lower.startsWith("cancel task ")) query = text.slice(12).trim();
      else if (lower.startsWith("cancel my ")) query = text.slice(10).replace(/\s+task$/i, "").trim();
      else if (lower.includes("delete task ")) query = text.slice(lower.indexOf("delete task ") + 12).trim();

      query = query.replace(/[.,!?]+$/, "").trim();

      let matchedTaskId: string | undefined;
      if (context.sageContext?.pendingTasks) {
        const queryLower = query.toLowerCase();
        for (const t of context.sageContext.pendingTasks) {
          const titleLower = t.title.toLowerCase();
          if (
            titleLower.includes(queryLower) ||
            queryLower.includes(titleLower.replace(/^finish\s+/i, "")) ||
            queryLower.includes(titleLower)
          ) {
            matchedTaskId = t.id;
            break;
          }
        }
      }

      if (!matchedTaskId) {
        for (const m of context.retrievedMemories) {
          if (m.memory.type === "task") {
            matchedTaskId = m.memory.id;
            break;
          }
        }
      }

      if (!matchedTaskId) {
        const found = await taskService.findTask(context.userId, query);
        if (found) {
          matchedTaskId = found.id;
        }
      }

      if (matchedTaskId) {
        return {
          thoughtSummary: `Identified task cancellation request matching task ${matchedTaskId}`,
          selectedTool: {
            name: "cancel_task",
            input: {
              userId: context.userId,
              taskId: matchedTaskId,
            },
          },
        };
      }

      return {
        thoughtSummary: "Task cancellation requested but no matching task was found",
        directResponse: "I couldn't find a matching task to cancel.",
      };
    }

    // 1. Check for "forget / delete" memory intent
    if (lower.startsWith("forget ") || lower.startsWith("delete memory ") || lower.includes("forget that")) {
      // Look in retrieved memories for candidate ID
      const targetMemory = context.retrievedMemories[0]?.memory;
      if (targetMemory) {
        return {
          thoughtSummary: "Identified memory deletion request matching retrieved context",
          selectedTool: {
            name: "forget_memory",
            input: { memoryId: targetMemory.id },
          },
        };
      }

      return {
        thoughtSummary: "Memory deletion requested but specific memory could not be identified",
        directResponse: "I couldn't find a matching stored memory to remove.",
      };
    }

    const isQuestion =
      lower.endsWith("?") ||
      lower.startsWith("when ") ||
      lower.startsWith("what ") ||
      lower.startsWith("where ") ||
      lower.startsWith("how ") ||
      lower.startsWith("who ") ||
      lower.startsWith("why ") ||
      lower.startsWith("which ");

    // 2. Check for "remember / save" intent
    if (
      !isQuestion &&
      (lower.startsWith("remember ") ||
        lower.startsWith("remember that ") ||
        lower.startsWith("save ") ||
        lower.includes("my preferred ") ||
        lower.includes("i prefer "))
    ) {
      let content = text;
      if (lower.startsWith("remember that ")) {
        content = text.slice(14).trim();
      } else if (lower.startsWith("remember ")) {
        content = text.slice(9).trim();
      }

      const isPreference = lower.includes("prefer") || lower.includes("favorite") || lower.includes("like");

      return {
        thoughtSummary: "Detected persistent information to store",
        selectedTool: {
          name: "save_memory",
          input: {
            type: isPreference ? "preference" : "fact",
            content,
            importance: 0.8,
            source: (context.metadata?.source as any) ?? "agent",
          },
        },
      };
    }

    // 3. Check for questions / memory recall answered by retrieved memories
    const isMemoryRecallInquiry =
      isQuestion ||
      lower.includes("what do you remember") ||
      lower.includes("remember about me") ||
      lower.includes("tell me about") ||
      lower.includes("study habit") ||
      lower.includes("my preference") ||
      lower.includes("about me");

    if (isMemoryRecallInquiry && context.retrievedMemories && context.retrievedMemories.length > 0) {
      // Exclude tasks - only genuine memories
      const nonTaskMemories = context.retrievedMemories.filter((m) => m.memory.type !== "task");
      const topMemory = nonTaskMemories[0];
      const minScore = context.constraints.minMemoryScore ?? 0.70;

      if (
        topMemory &&
        (topMemory.score >= minScore ||
          lower.includes("remember about me") ||
          lower.includes("what do you remember"))
      ) {
        let content = topMemory.memory.content;
        if (lower.includes("what do you remember") || lower.includes("remember about me")) {
          const cleaned = content.replace(/^i\s+/i, "you ").replace(/^my\s+/i, "your ");
          content = `I remember that ${cleaned.endsWith(".") ? cleaned.slice(0, -1) : cleaned}.`;
        }
        return {
          thoughtSummary: "Found high-confidence memory matching the question",
          directResponse: content,
        };
      }
    }

    // 4. Default direct conversational response
    return {
      thoughtSummary: "No specialized tool execution required",
      directResponse: `I have received your request: "${context.userRequest}". How can I help you further with this?`,
    };
  }
}

export class LyzrReasonerAdapter implements SageReasoner {
  private fallback: SageReasoner | undefined;

  constructor(options?: { fallback?: SageReasoner | null }) {
    this.fallback = options?.fallback === null ? undefined : (options?.fallback ?? new StandardReasoner());
  }


  async reason(context: OrchestrationContext): Promise<ReasoningDecision> {
    try {
      const promptMessage = context.formattedContext
        ? `${context.formattedContext}\n\nRespond directly and helpfully to the current request based on the context above.`
        : context.userRequest;

      const lyzrResponse = await invokeLyzr({
        userId: context.userId,
        sessionId: context.sessionId,
        message: promptMessage,
      });

      return {
        thoughtSummary: "Lyzr agent inference completed",
        directResponse: lyzrResponse.response,
      };
    } catch (error) {
      const errorMsg = (error as Error).message;
      if (this.fallback) {
        console.warn(`[LyzrReasonerAdapter] Lyzr API unavailable (${errorMsg}); activating fallback reasoner`);
        const decision = await this.fallback.reason(context);
        return {
          ...decision,
          thoughtSummary: `[Lyzr Fallback: ${errorMsg}] ${decision.thoughtSummary}`,
        };
      }

      return {
        thoughtSummary: `Lyzr reasoning failed: ${errorMsg}`,
        directResponse: "I encountered an issue processing this request with the reasoning agent.",
      };
    }
  }
}

