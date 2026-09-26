import { z } from "zod";
import { taskService } from "../tasks/service.js";
import type {
  SageActionTool,
  ToolExecutionContext,
  ToolExecutionResult,
  VerificationResult,
} from "../orchestrator/types.js";
import type { SageTask } from "../tasks/types.js";

const CreateTaskInputSchema = z.object({
  userId: z.string().min(1).optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  dueAt: z.string().optional(),
});

const ListTasksInputSchema = z.object({
  userId: z.string().min(1).optional(),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
});

const CompleteTaskInputSchema = z.object({
  userId: z.string().min(1).optional(),
  taskId: z.string().min(1),
});

const CancelTaskInputSchema = z.object({
  userId: z.string().min(1).optional(),
  taskId: z.string().min(1),
});

export const createTaskTool: SageActionTool = {
  name: "create_task",
  description: "Create a new actionable task or to-do item for the user.",
  requiresConfirmation: false,
  isDestructive: false,
  execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const parsed = CreateTaskInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid input for create_task: ${parsed.error.message}`,
      };
    }

    try {
      const task = await taskService.createTask({
        userId: parsed.data.userId ?? ctx.userId,
        title: parsed.data.title,
        ...(parsed.data.description ? { description: parsed.data.description } : {}),
        ...(parsed.data.dueAt ? { dueAt: parsed.data.dueAt } : {}),
      });

      return {
        success: true,
        data: { task },
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  },
  verify: async (result: ToolExecutionResult): Promise<VerificationResult> => {
    if (!result.success || !result.data) {
      return { verified: false, reason: "Execution did not succeed" };
    }
    const task = (result.data as { task?: SageTask }).task;
    if (task && task.id && task.status === "pending") {
      return { verified: true };
    }
    return { verified: false, reason: "Task was not created with a valid ID and pending status" };
  },
};

export const listTasksTool: SageActionTool = {
  name: "list_tasks",
  description: "List tasks for the user, optionally filtered by status (pending, completed, cancelled).",
  requiresConfirmation: false,
  isDestructive: false,
  execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const parsed = ListTasksInputSchema.safeParse(input ?? {});
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid input for list_tasks: ${parsed.error.message}`,
      };
    }

    try {
      const userId = parsed.data.userId ?? ctx.userId;
      const tasks = await taskService.listTasks(userId, parsed.data.status);
      return {
        success: true,
        data: { tasks },
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  },
  verify: async (result: ToolExecutionResult): Promise<VerificationResult> => {
    if (result.success && result.data && Array.isArray((result.data as { tasks?: unknown[] }).tasks)) {
      return { verified: true };
    }
    return { verified: false, reason: "Tasks list was not returned as an array" };
  },
};

export const completeTaskTool: SageActionTool = {
  name: "complete_task",
  description: "Mark an existing task as completed.",
  requiresConfirmation: false,
  isDestructive: false,
  execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const parsed = CompleteTaskInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid input for complete_task: ${parsed.error.message}`,
      };
    }

    try {
      const userId = parsed.data.userId ?? ctx.userId;
      const task = await taskService.completeTask(userId, parsed.data.taskId);
      if (!task) {
        return {
          success: false,
          error: `Task not found or does not belong to user: ${parsed.data.taskId}`,
        };
      }
      return {
        success: true,
        data: { task },
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  },
  verify: async (result: ToolExecutionResult): Promise<VerificationResult> => {
    if (!result.success || !result.data) {
      return { verified: false, reason: "Execution did not succeed" };
    }
    const task = (result.data as { task?: SageTask }).task;
    if (task && task.status === "completed") {
      return { verified: true };
    }
    return { verified: false, reason: "Task was not marked with completed status" };
  },
};

export const cancelTaskTool: SageActionTool = {
  name: "cancel_task",
  description: "Cancel an existing task. Sensitive and irreversible operation.",
  requiresConfirmation: true,
  isDestructive: true,
  execute: async (input: unknown, ctx: ToolExecutionContext): Promise<ToolExecutionResult> => {
    const parsed = CancelTaskInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        success: false,
        error: `Invalid input for cancel_task: ${parsed.error.message}`,
      };
    }

    try {
      const userId = parsed.data.userId ?? ctx.userId;
      const task = await taskService.cancelTask(userId, parsed.data.taskId);
      if (!task) {
        return {
          success: false,
          error: `Task not found or does not belong to user: ${parsed.data.taskId}`,
        };
      }
      return {
        success: true,
        data: { task },
      };
    } catch (err) {
      return {
        success: false,
        error: (err as Error).message,
      };
    }
  },
  verify: async (result: ToolExecutionResult): Promise<VerificationResult> => {
    if (!result.success || !result.data) {
      return { verified: false, reason: "Execution did not succeed" };
    }
    const task = (result.data as { task?: SageTask }).task;
    if (task && task.status === "cancelled") {
      return { verified: true };
    }
    return { verified: false, reason: "Task was not marked with cancelled status" };
  },
};
