import { randomUUID } from "node:crypto";
import { memoryManager } from "../memory/manager.js";
import { OrchestrationLogger } from "./logger.js";
import { ActionRegistry } from "./registry.js";
import { StandardReasoner, type SageReasoner } from "./reasoner.js";
import { buildSageContext, actionTracker, DEFAULT_RELEVANCE_THRESHOLD } from "../context/builder.js";
import { formatContextForReasoner } from "../context/formatter.js";
import type { SageContext } from "../context/types.js";
import type {
  OrchestrationContext,
  OrchestratorInput,
  OrchestrationResult,
  OrchestrationState,
  ToolExecutionResult,
  VerificationResult,
  ExplainableExecutionEvent,
} from "./types.js";

export class SageOrchestrator {
  private registry: ActionRegistry;
  private reasoner: SageReasoner;

  constructor(options?: { registry?: ActionRegistry; reasoner?: SageReasoner }) {
    this.registry = options?.registry ?? new ActionRegistry();
    this.reasoner = options?.reasoner ?? new StandardReasoner();
  }

  getRegistry(): ActionRegistry {
    return this.registry;
  }

  setReasoner(reasoner: SageReasoner): void {
    this.reasoner = reasoner;
  }

  async run(input: OrchestratorInput): Promise<OrchestrationResult> {
    const requestId = randomUUID();
    const sessionId = input.sessionId ?? randomUUID();
    const logger = new OrchestrationLogger(requestId);
    const executionEvents: ExplainableExecutionEvent[] = [];

    // Optional initial event: Voice received when originating from Omi wearable
    if (input.metadata?.source === "omi") {
      executionEvents.push({
        stage: "voice_received",
        label: "🎙 Voice received",
        timestamp: new Date().toISOString(),
        status: "completed",
        detail: "Audio stream transcribed and ingested from Omi",
      });
    }

    // Default constraints
    const constraints = {
      requireConfirmationForDestructive: true,
      maxMemoryRetrievals: 5,
      minMemoryScore: DEFAULT_RELEVANCE_THRESHOLD,
      ...input.constraints,
    };

    // 1. UNDERSTANDING
    let currentState: OrchestrationState = "understanding";
    logger.logState(currentState, {
      userId: input.userId,
      requestLength: input.request?.length ?? 0,
      hasConfirmation: Boolean(input.confirmed),
    });

    if (!input.userId || !input.request?.trim()) {
      executionEvents.push({
        stage: "understanding",
        label: "🧠 Understanding request",
        timestamp: new Date().toISOString(),
        status: "failed",
        detail: "Validation failed: userId and non-empty request required",
      });

      return {
        success: false,
        finalState: currentState,
        state: currentState,
        requestId,
        response: "Invalid request: userId and non-empty request are required.",
        transitions: logger.getTransitions(),
        memoriesUsed: [],
        executionEvents,
        metadata: { requestId, error: "Validation failed" },
      };
    }

    executionEvents.push({
      stage: "understanding",
      label: "🧠 Understanding request",
      timestamp: new Date().toISOString(),
      status: "completed",
      detail: `Input analyzed (${input.request.trim().length} characters)`,
    });

    const context: OrchestrationContext = {
      requestId,
      userId: input.userId.trim(),
      sessionId,
      userRequest: input.request.trim(),
      retrievedMemories: [],
      availableTools: this.registry.listMetadata(),
      constraints,
      confirmed: input.confirmed,
      confirmationToken: input.confirmationToken,
      metadata: input.metadata,
    };

    // 2. CONTEXT RETRIEVAL & CONTEXT FUSION
    currentState = "memory_retrieval";
    let sageContext: SageContext = {
      userId: context.userId,
      currentInput: context.userRequest,
      memories: [],
      pendingTasks: [],
      recentActions: [],
    };

    try {
      sageContext = await buildSageContext(context.userId, context.userRequest, {
        minMemoryScore: constraints.minMemoryScore,
        maxMemories: constraints.maxMemoryRetrievals,
      });
      context.sageContext = sageContext;
      context.formattedContext = formatContextForReasoner(sageContext);

      // Recall memories directly for backward-compatibility with retrievedMemories
      const memories = await memoryManager.recall(
        context.userId,
        context.userRequest,
        constraints.maxMemoryRetrievals,
      );
      context.retrievedMemories = memories;

      logger.logState(currentState, {
        count: memories.length,
        topScore: memories[0]?.score,
        fusedMemories: sageContext.memories.length,
        fusedTasks: sageContext.pendingTasks.length,
      });

      executionEvents.push({
        stage: "memory_retrieval",
        label: "🔎 Retrieving relevant memory",
        timestamp: new Date().toISOString(),
        status: "completed",
        detail: sageContext.memories.length > 0
          ? `${sageContext.memories.length} relevant memories retrieved (threshold >= ${constraints.minMemoryScore})`
          : "No relevant memories found exceeding threshold",
      });

      executionEvents.push({
        stage: "context_fusion",
        label: "📋 Checking pending tasks",
        timestamp: new Date().toISOString(),
        status: "completed",
        detail: `${sageContext.pendingTasks.length} pending tasks and ${sageContext.recentActions.length} recent actions fused into context`,
      });
    } catch (err) {
      logger.logState(currentState, {
        count: 0,
        error: (err as Error).message,
      });
      executionEvents.push({
        stage: "memory_retrieval",
        label: "🔎 Retrieving relevant memory",
        timestamp: new Date().toISOString(),
        status: "failed",
        detail: (err as Error).message,
      });
      // Non-blocking: continue if memory retrieval has an issue
    }

    // 3. REASONING
    currentState = "reasoning";
    const decision = await this.reasoner.reason(context);
    logger.logState(currentState, {
      summary: decision.thoughtSummary,
      selectedToolName: decision.selectedTool?.name,
      hasDirectResponse: Boolean(decision.directResponse),
    });

    executionEvents.push({
      stage: "reasoning",
      label: "🤖 Lyzr reasoning",
      timestamp: new Date().toISOString(),
      status: "completed",
      detail: decision.selectedTool
        ? `Selected tool "${decision.selectedTool.name}"`
        : "Formulated response from fused context",
    });

    // 4. SELECT TOOLS
    currentState = "tool_selection";
    const selectedToolName = decision.selectedTool?.name;

    executionEvents.push({
      stage: "tool_selection",
      label: "🔧 Tool selected",
      timestamp: new Date().toISOString(),
      status: "completed",
      detail: selectedToolName ? `Tool: ${selectedToolName}` : "Direct conversational response",
    });

    if (!selectedToolName) {
      logger.logState(currentState, { selected: null });

      if (decision.memoryToSave) {
        currentState = "memory_update";
        try {
          await memoryManager.remember({
            userId: context.userId,
            type: decision.memoryToSave.type,
            content: decision.memoryToSave.content,
            importance: decision.memoryToSave.importance ?? 0.8,
            source: (context.metadata?.source as any) ?? "agent",
          });
          actionTracker.record(
            context.userId,
            `Saved ${decision.memoryToSave.type} memory: "${decision.memoryToSave.content}".`,
            "completed",
          );
          logger.logState(currentState, { updated: true, type: decision.memoryToSave.type });
          executionEvents.push({
            stage: "memory_update",
            label: "💾 Memory updated",
            timestamp: new Date().toISOString(),
            status: "completed",
            detail: `Saved ${decision.memoryToSave.type} memory`,
          });
        } catch (err) {
          logger.logState(currentState, {
            updated: false,
            error: (err as Error).message,
          });
          executionEvents.push({
            stage: "memory_update",
            label: "💾 Memory updated",
            timestamp: new Date().toISOString(),
            status: "failed",
            detail: (err as Error).message,
          });
        }
      }

      currentState = "response";
      logger.logState(currentState, { reason: "Direct response generated" });
      executionEvents.push({
        stage: "response_ready",
        label: "🔊 Response ready",
        timestamp: new Date().toISOString(),
        status: "completed",
        detail: "Direct response generated",
      });

      return {
        success: true,
        finalState: currentState,
        state: currentState,
        requestId,
        response: decision.directResponse ?? "Request completed.",
        transitions: logger.getTransitions(),
        memoriesUsed: context.retrievedMemories,
        sageContext: context.sageContext,
        executionEvents,
        metadata: {
          requestId,
          summary: decision.thoughtSummary,
        },
      };
    }

    const tool = this.registry.get(selectedToolName);
    logger.logState(currentState, {
      toolName: selectedToolName,
      toolFound: Boolean(tool),
      requiresConfirmation: tool?.requiresConfirmation,
    });

    // Missing tool check
    if (!tool) {
      currentState = "response";
      logger.logState(currentState, { error: `Tool not found: ${selectedToolName}` });
      executionEvents.push({
        stage: "response_ready",
        label: "🔊 Response ready",
        timestamp: new Date().toISOString(),
        status: "failed",
        detail: `Missing tool: ${selectedToolName}`,
      });

      return {
        success: false,
        finalState: currentState,
        state: currentState,
        requestId,
        response: `The required tool "${selectedToolName}" is not available in the registry.`,
        transitions: logger.getTransitions(),
        memoriesUsed: context.retrievedMemories,
        sageContext: context.sageContext,
        executionEvents,
        actionResult: {
          tool: selectedToolName,
          success: false,
          verified: false,
          error: `Missing tool: ${selectedToolName}`,
        },
        metadata: { requestId, error: "Tool not found" },
      };
    }

    // Confirmation safety gate
    const mustConfirm =
      (tool.requiresConfirmation || tool.isDestructive) &&
      constraints.requireConfirmationForDestructive;

    if (mustConfirm && !context.confirmed) {
      const confirmationToken = randomUUID();
      currentState = "response";
      logger.logState(currentState, {
        haltedForConfirmation: true,
        tool: tool.name,
      });
      executionEvents.push({
        stage: "response_ready",
        label: "🔊 Response ready",
        timestamp: new Date().toISOString(),
        status: "completed",
        detail: `Confirmation required for sensitive action "${tool.name}"`,
      });

      return {
        success: false,
        finalState: currentState,
        state: currentState,
        requestId,
        response: `Action "${tool.name}" requires confirmation before execution as it is a sensitive or irreversible operation.`,
        transitions: logger.getTransitions(),
        memoriesUsed: context.retrievedMemories,
        sageContext: context.sageContext,
        executionEvents,
        requiresConfirmation: {
          tool: tool.name,
          input: decision.selectedTool?.input,
          message: `Please confirm execution of ${tool.name}.`,
          confirmationToken,
        },
        metadata: {
          requestId,
          requiresConfirmation: true,
        },
      };
    }

    // 5. EXECUTE
    currentState = "executing";
    let executionResult: ToolExecutionResult;
    try {
      executionResult = await tool.execute(decision.selectedTool?.input, {
        requestId,
        userId: context.userId,
        sessionId: context.sessionId,
      });
      logger.logState(currentState, {
        tool: tool.name,
        success: executionResult.success,
        hasError: Boolean(executionResult.error),
      });

      if (executionResult.success) {
        let actionDesc = `Executed ${tool.name}.`;
        if (tool.name === "create_task") {
          const t = (executionResult.data as any)?.task;
          actionDesc = `Created task "${t?.title ?? (decision.selectedTool?.input as any)?.title}".`;
        } else if (tool.name === "complete_task") {
          const t = (executionResult.data as any)?.task;
          actionDesc = `Completed task "${t?.title ?? "task"}".`;
        } else if (tool.name === "cancel_task") {
          const t = (executionResult.data as any)?.task;
          actionDesc = `Cancelled task "${t?.title ?? "task"}".`;
        } else if (tool.name === "save_memory") {
          actionDesc = `Saved memory: "${(decision.selectedTool?.input as any)?.content}".`;
        } else if (tool.name === "forget_memory") {
          actionDesc = `Removed memory.`;
        }
        actionTracker.record(context.userId, actionDesc, "completed");
      }
    } catch (err) {
      executionResult = {
        success: false,
        error: (err as Error).message,
      };
      logger.logState(currentState, {
        tool: tool.name,
        success: false,
        error: (err as Error).message,
      });
    }

    // Rule 7: Never claim an action succeeded unless executor returns success: true
    if (!executionResult.success) {
      currentState = "response";
      logger.logState(currentState, {
        actionFailed: true,
        error: executionResult.error,
      });
      executionEvents.push({
        stage: "action_verification",
        label: "✅ Action verified",
        timestamp: new Date().toISOString(),
        status: "failed",
        detail: executionResult.error ?? "Action execution failed",
      });
      executionEvents.push({
        stage: "response_ready",
        label: "🔊 Response ready",
        timestamp: new Date().toISOString(),
        status: "failed",
        detail: "Action failed response generated",
      });

      return {
        success: false,
        finalState: currentState,
        state: currentState,
        requestId,
        response: `Action "${tool.name}" failed: ${executionResult.error ?? "Unknown execution error"}.`,
        transitions: logger.getTransitions(),
        memoriesUsed: context.retrievedMemories,
        sageContext: context.sageContext,
        executionEvents,
        actionResult: {
          tool: tool.name,
          success: false,
          verified: false,
          error: executionResult.error,
        },
        metadata: { requestId, error: executionResult.error },
      };
    }

    // 6. VERIFY
    currentState = "verification";
    let verification: VerificationResult = { verified: true };
    if (tool.verify) {
      try {
        verification = await tool.verify(executionResult, {
          requestId,
          userId: context.userId,
          sessionId: context.sessionId,
        });
      } catch (err) {
        verification = {
          verified: false,
          reason: `Verification exception: ${(err as Error).message}`,
        };
      }
    }

    logger.logState(currentState, {
      tool: tool.name,
      verified: verification.verified,
      reason: verification.reason,
    });

    executionEvents.push({
      stage: "action_verification",
      label: "✅ Action verified",
      timestamp: new Date().toISOString(),
      status: verification.verified ? "completed" : "failed",
      detail: verification.verified
        ? `Action "${tool.name}" verified successfully`
        : (verification.reason ?? "Verification failed"),
    });

    if (!verification.verified) {
      currentState = "response";
      logger.logState(currentState, {
        verificationFailed: true,
        reason: verification.reason,
      });
      executionEvents.push({
        stage: "response_ready",
        label: "🔊 Response ready",
        timestamp: new Date().toISOString(),
        status: "failed",
        detail: "Verification failed response generated",
      });

      return {
        success: false,
        finalState: currentState,
        state: currentState,
        requestId,
        response: `Action "${tool.name}" executed but failed verification: ${verification.reason ?? "Verification failed"}.`,
        transitions: logger.getTransitions(),
        memoriesUsed: context.retrievedMemories,
        sageContext: context.sageContext,
        executionEvents,
        actionResult: {
          tool: tool.name,
          success: true,
          verified: false,
          data: executionResult.data,
          error: verification.reason,
        },
        metadata: { requestId, verificationError: verification.reason },
      };
    }

    // 7. UPDATE MEMORY
    currentState = "memory_update";
    if (decision.memoryToSave) {
      try {
        await memoryManager.remember({
          userId: context.userId,
          type: decision.memoryToSave.type,
          content: decision.memoryToSave.content,
          importance: decision.memoryToSave.importance ?? 0.8,
          source: (context.metadata?.source as any) ?? "agent",
        });
        actionTracker.record(
          context.userId,
          `Saved ${decision.memoryToSave.type} memory: "${decision.memoryToSave.content}".`,
          "completed",
        );
        logger.logState(currentState, { updated: true, type: decision.memoryToSave.type });
        executionEvents.push({
          stage: "memory_update",
          label: "💾 Memory updated",
          timestamp: new Date().toISOString(),
          status: "completed",
          detail: `Saved ${decision.memoryToSave.type} memory`,
        });
      } catch (err) {
        logger.logState(currentState, {
          updated: false,
          error: (err as Error).message,
        });
        executionEvents.push({
          stage: "memory_update",
          label: "💾 Memory updated",
          timestamp: new Date().toISOString(),
          status: "failed",
          detail: (err as Error).message,
        });
      }
    } else {
      logger.logState(currentState, { updated: false, reason: "No memory update required" });
      executionEvents.push({
        stage: "memory_update",
        label: "💾 Memory updated",
        timestamp: new Date().toISOString(),
        status: "skipped",
        detail: "No memory update required",
      });
    }

    // 8. RESPOND
    currentState = "response";
    let finalResponse = decision.directResponse;
    if (!finalResponse) {
      if (tool.name === "save_memory") {
        finalResponse = "I've remembered that for you.";
      } else if (tool.name === "forget_memory") {
        finalResponse = "I have removed that memory as requested.";
      } else if (tool.name === "search_memory") {
        finalResponse = "Memory search completed.";
      } else if (tool.name === "create_task") {
        const t = (executionResult.data as any)?.task;
        finalResponse = `I've added '${t?.title ?? "your task"}' to your tasks${t?.dueAt ? ` for ${t.dueAt}` : ""}.`;
      } else if (tool.name === "list_tasks") {
        const tasks = (executionResult.data as any)?.tasks ?? [];
        if (tasks.length === 0) {
          finalResponse = "You have no pending tasks.";
        } else {
          // Check for contextual memory fusion: e.g. "What should I work on tonight?" + study preference
          const userLower = context.userRequest.toLowerCase();
          const isContextualInquiry =
            userLower.includes("what should i work on") ||
            userLower.includes("what should i do") ||
            userLower.includes("what to work on");

          const memoriesToSearch = context.sageContext?.memories?.length
            ? context.sageContext.memories.map((m) => m.content.toLowerCase())
            : context.retrievedMemories.map((m) => m.memory.content.toLowerCase());

          const timePreference = memoriesToSearch.find((c) => {
            return c.includes("night") || c.includes("evening") || c.includes("study") || c.includes("prefer");
          });

          const primaryTask = tasks[0];
          let primaryTitle = (primaryTask?.title ?? "")
            .replace(/\bmy\b/gi, "your")
            .replace(/[.]+$/, "")
            .trim();

          if (isContextualInquiry && timePreference && (userLower.includes("tonight") || userLower.includes("night"))) {
            // Strip trailing "tomorrow" or similar if duplicated in title
            primaryTitle = primaryTitle.replace(/\s+tomorrow$/i, "").trim();

            let formattedAction = primaryTitle;
            if (primaryTitle.toLowerCase().startsWith("finish ")) {
              formattedAction = `work on ${primaryTitle.slice(7).trim()}`;
            } else if (!primaryTitle.toLowerCase().startsWith("work on ")) {
              formattedAction = `work on ${primaryTitle}`;
            }
            finalResponse = `Since you prefer studying at night, tonight would be a good time to ${formattedAction}.`;
          } else {
            const countWord = tasks.length === 1 ? "one" : tasks.length.toString();
            const taskNoun = tasks.length === 1 ? "pending task" : "pending tasks";
            const taskItems = tasks
              .map((t: any) => {
                const cleaned = (t.title ?? "")
                  .replace(/\bmy\b/gi, "your")
                  .replace(/[.]+$/, "");
                return `${cleaned}${t.dueAt ? `, due ${t.dueAt}` : ""}`;
              })
              .join("; ");
            finalResponse = `You have ${countWord} ${taskNoun}: ${taskItems}.`;
          }
        }
      } else if (tool.name === "complete_task") {
        const t = (executionResult.data as any)?.task;
        finalResponse = `Marked your ${t?.title ?? "task"} as completed.`;
      } else if (tool.name === "cancel_task") {
        const t = (executionResult.data as any)?.task;
        finalResponse = `Cancelled ${t?.title ?? "task"}.`;
      } else {
        finalResponse = `Successfully completed ${tool.name}.`;
      }
    }

    logger.logState(currentState, { completed: true });

    executionEvents.push({
      stage: "response_ready",
      label: "🔊 Response ready",
      timestamp: new Date().toISOString(),
      status: "completed",
      detail: "Response synthesized successfully",
    });

    return {
      success: true,
      finalState: currentState,
      state: currentState,
      requestId,
      response: finalResponse,
      transitions: logger.getTransitions(),
      memoriesUsed: context.retrievedMemories,
      sageContext: context.sageContext,
      executionEvents,
      actionResult: {
        tool: tool.name,
        success: true,
        verified: true,
        data: executionResult.data,
      },
      metadata: {
        requestId,
        summary: decision.thoughtSummary,
      },
    };
  }
}
