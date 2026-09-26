import { memoryManager } from "../memory/manager.js";
import {
  createTaskTool,
  listTasksTool,
  completeTaskTool,
  cancelTaskTool,
} from "../tools/tasks.js";
import type {
  SageActionTool,
  ToolExecutionContext,
  ToolExecutionResult,
  ToolMetadata,
  VerificationResult,
} from "./types.js";

export class ActionRegistry {
  private tools: Map<string, SageActionTool> = new Map();

  constructor() {
    this.registerDefaultMemoryTools();
    this.registerDefaultTaskTools();
  }

  private registerDefaultTaskTools(): void {
    this.register(createTaskTool);
    this.register(listTasksTool);
    this.register(completeTaskTool);
    this.register(cancelTaskTool);
  }

  register(tool: SageActionTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool already registered: ${tool.name}`);
    }
    this.tools.set(tool.name, tool);
  }

  get(name: string): SageActionTool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  listMetadata(): ToolMetadata[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      requiresConfirmation: Boolean(tool.requiresConfirmation),
      isDestructive: Boolean(tool.isDestructive),
    }));
  }

  private registerDefaultMemoryTools(): void {
    // 1. save_memory tool
    this.register({
      name: "save_memory",
      description: "Save useful persistent information about the user.",
      requiresConfirmation: false,
      isDestructive: false,
      execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const payload = input as {
          type: any;
          content: string;
          importance?: number;
          source?: any;
          metadata?: Record<string, unknown>;
        };

        if (!payload?.content || !payload?.type) {
          return { success: false, error: "Missing required fields: content, type" };
        }

        try {
          const memory = await memoryManager.remember({
            userId: ctx.userId,
            type: payload.type,
            content: payload.content,
            importance: payload.importance ?? 0.5,
            source: payload.source ?? "agent",
            metadata: payload.metadata,
          });

          return { success: true, data: memory };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
      verify: async (result: ToolExecutionResult): Promise<VerificationResult> => {
        if (result.success && result.data && (result.data as any).id) {
          return { verified: true };
        }
        return { verified: false, reason: "Memory object was not returned or lacked an ID" };
      },
    });

    // 2. search_memory tool
    this.register({
      name: "search_memory",
      description: "Search the user's persistent memories using semantic similarity.",
      requiresConfirmation: false,
      isDestructive: false,
      execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const payload = input as { query: string; limit?: number };
        if (!payload?.query) {
          return { success: false, error: "Missing query parameter" };
        }

        try {
          const results = await memoryManager.recall(ctx.userId, payload.query, payload.limit ?? 5);
          return { success: true, data: results };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
      verify: async (result: ToolExecutionResult): Promise<VerificationResult> => {
        if (result.success && Array.isArray(result.data)) {
          return { verified: true };
        }
        return { verified: false, reason: "Search did not return an array of results" };
      },
    });

    // 3. forget_memory tool (destructive -> requires confirmation)
    this.register({
      name: "forget_memory",
      description: "Remove a specific stored memory when the user asks.",
      requiresConfirmation: true,
      isDestructive: true,
      execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
        const payload = input as { memoryId: string };
        if (!payload?.memoryId) {
          return { success: false, error: "Missing memoryId parameter" };
        }

        try {
          const success = await memoryManager.forget(ctx.userId, payload.memoryId);
          return { success, data: { deletedId: payload.memoryId } };
        } catch (err) {
          return { success: false, error: (err as Error).message };
        }
      },
      verify: async (result: ToolExecutionResult): Promise<VerificationResult> => {
        if (result.success) {
          return { verified: true };
        }
        return { verified: false, reason: "Deletion failed in memory manager" };
      },
    });
  }
}
