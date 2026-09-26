import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { taskService } from "./service.js";
import { validateToolAuth } from "../auth/tool-auth.js";

const createTaskSchema = z.object({
  userId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  dueAt: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listTasksQuerySchema = z.object({
  userId: z.string().min(1),
  status: z.enum(["pending", "completed", "cancelled"]).optional(),
});

export async function taskRoutes(app: FastifyInstance) {
  // 1. Create task: POST /tasks
  app.post("/tasks", { preHandler: validateToolAuth }, async (request, reply) => {
    const parsed = createTaskSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid task input",
        details: parsed.error.flatten(),
      });
    }

    try {
      const task = await taskService.createTask(parsed.data);
      return reply.code(201).send({
        success: true,
        task,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        success: false,
        error: "Failed to create task",
        message: (err as Error).message,
      });
    }
  });

  // 2. List tasks: GET /tasks
  app.get("/tasks", { preHandler: validateToolAuth }, async (request, reply) => {
    const parsed = listTasksQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "userId query parameter is required",
        details: parsed.error.flatten(),
      });
    }

    try {
      const tasks = await taskService.listTasks(parsed.data.userId, parsed.data.status);
      return reply.send({
        success: true,
        tasks,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        success: false,
        error: "Failed to list tasks",
        message: (err as Error).message,
      });
    }
  });

  // 3. Complete task: POST /tasks/:id/complete
  app.post("/tasks/:id/complete", { preHandler: validateToolAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { userId?: string };
    const query = (request.query ?? {}) as { userId?: string };
    const userId = body.userId || query.userId;

    if (!userId) {
      return reply.code(400).send({
        error: "userId is required in body or query",
      });
    }

    try {
      const task = await taskService.completeTask(userId, id);
      if (!task) {
        return reply.code(404).send({
          success: false,
          error: `Task not found or does not belong to user: ${id}`,
        });
      }

      return reply.send({
        success: true,
        task,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        success: false,
        error: "Failed to complete task",
        message: (err as Error).message,
      });
    }
  });

  // 4. Cancel task: POST /tasks/:id/cancel
  app.post("/tasks/:id/cancel", { preHandler: validateToolAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { userId?: string };
    const query = (request.query ?? {}) as { userId?: string };
    const userId = body.userId || query.userId;

    if (!userId) {
      return reply.code(400).send({
        error: "userId is required in body or query",
      });
    }

    try {
      const task = await taskService.cancelTask(userId, id);
      if (!task) {
        return reply.code(404).send({
          success: false,
          error: `Task not found or does not belong to user: ${id}`,
        });
      }

      return reply.send({
        success: true,
        task,
      });
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({
        success: false,
        error: "Failed to cancel task",
        message: (err as Error).message,
      });
    }
  });
}
