import { randomUUID } from "node:crypto";
import { qdrant, MEMORY_COLLECTION } from "../memory/qdrant.js";
import { embeddingProvider } from "../memory/fastembed.js";
import type { CreateTaskInput, SageTask, TaskStatus } from "./types.js";

function pointToTask(id: string, payload: Record<string, unknown>): SageTask {
  const meta = ((payload.metadata ?? {}) as Record<string, unknown>);
  return {
    id: String(id),
    userId: String(payload.userId),
    title: String(meta.title ?? payload.content),
    description: meta.description as string | undefined,
    status: (meta.status as TaskStatus) ?? "pending",
    dueAt: meta.dueAt as string | undefined,
    createdAt: String(payload.createdAt ?? meta.createdAt ?? new Date().toISOString()),
    completedAt: meta.completedAt as string | undefined,
    metadata: meta,
  };
}

export class TaskService {
  /**
   * Create a new task and persist to Qdrant with embeddings
   */
  async createTask(input: CreateTaskInput): Promise<SageTask> {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const title = input.title.trim();

    if (!title) {
      throw new Error("Task title cannot be empty");
    }

    const content = `${title}${input.description ? ` - ${input.description}` : ""}${
      input.dueAt ? ` (Due: ${input.dueAt})` : ""
    }`;

    const vector = await embeddingProvider.embed(content, "document");

    const metadata: Record<string, unknown> = {
      taskId: id,
      title,
      status: "pending",
      ...(input.description ? { description: input.description } : {}),
      ...(input.dueAt ? { dueAt: input.dueAt } : {}),
      createdAt,
      ...(input.metadata ?? {}),
    };

    await qdrant.upsert(MEMORY_COLLECTION, {
      wait: true,
      points: [
        {
          id,
          vector,
          payload: {
            userId: input.userId,
            type: "task",
            content,
            importance: 0.8,
            source: "agent",
            createdAt,
            metadata,
          },
        },
      ],
    });

    return {
      id,
      userId: input.userId,
      title,
      description: input.description,
      status: "pending",
      dueAt: input.dueAt,
      createdAt,
      metadata,
    };
  }

  /**
   * List tasks for a user using structured Qdrant filter
   */
  async listTasks(userId: string, status?: TaskStatus): Promise<SageTask[]> {
    const mustFilters: Array<Record<string, unknown>> = [
      {
        key: "userId",
        match: {
          value: userId,
        },
      },
      {
        key: "type",
        match: {
          value: "task",
        },
      },
    ];

    const scrollResult = await qdrant.scroll(MEMORY_COLLECTION, {
      filter: {
        must: mustFilters,
      },
      with_payload: true,
      limit: 100,
    });

    const points = scrollResult.points ?? [];
    let tasks = points.map((p) =>
      pointToTask(String(p.id), (p.payload ?? {}) as Record<string, unknown>),
    );

    if (status) {
      tasks = tasks.filter((t) => t.status === status);
    }

    // Sort newest first
    tasks.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return tasks;
  }


  /**
   * Find a specific task using semantic search scoped to the user
   */
  async findTask(userId: string, query: string): Promise<SageTask | null> {
    const trimmed = query.trim();
    if (!trimmed) {
      return null;
    }

    const vector = await embeddingProvider.embed(trimmed, "query");

    const response = await qdrant.query(MEMORY_COLLECTION, {
      query: vector,
      limit: 5,
      with_payload: true,
      filter: {
        must: [
          {
            key: "userId",
            match: {
              value: userId,
            },
          },
          {
            key: "type",
            match: {
              value: "task",
            },
          },
        ],
      },
    });

    const points = response.points ?? [];
    if (points.length === 0 || !points[0]) {
      return null;
    }

    const topPoint = points[0];
    return pointToTask(
      String(topPoint.id),
      (topPoint.payload ?? {}) as Record<string, unknown>,
    );
  }

  /**
   * Mark a task as completed with user isolation
   */
  async completeTask(userId: string, taskId: string): Promise<SageTask | null> {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(taskId)) {
      return null;
    }

    const retrieved = await qdrant.retrieve(MEMORY_COLLECTION, {
      ids: [taskId],
      with_payload: true,
    });

    const point = retrieved[0];
    if (
      !point ||
      point.payload?.userId !== userId ||
      point.payload?.type !== "task"
    ) {
      return null;
    }

    const completedAt = new Date().toISOString();
    const existingMeta = ((point.payload?.metadata ?? {}) as Record<
      string,
      unknown
    >);
    const updatedMeta = {
      ...existingMeta,
      status: "completed",
      completedAt,
    };

    await qdrant.setPayload(MEMORY_COLLECTION, {
      wait: true,
      points: [taskId],
      payload: {
        metadata: updatedMeta,
      },
    });

    return pointToTask(taskId, {
      ...(point.payload ?? {}),
      metadata: updatedMeta,
    });
  }

  /**
   * Mark a task as cancelled with user isolation
   */
  async cancelTask(userId: string, taskId: string): Promise<SageTask | null> {
    const UUID_REGEX =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(taskId)) {
      return null;
    }

    const retrieved = await qdrant.retrieve(MEMORY_COLLECTION, {
      ids: [taskId],
      with_payload: true,
    });

    const point = retrieved[0];
    if (
      !point ||
      point.payload?.userId !== userId ||
      point.payload?.type !== "task"
    ) {
      return null;
    }

    const completedAt = new Date().toISOString();
    const existingMeta = ((point.payload?.metadata ?? {}) as Record<
      string,
      unknown
    >);
    const updatedMeta = {
      ...existingMeta,
      status: "cancelled",
      completedAt,
    };

    await qdrant.setPayload(MEMORY_COLLECTION, {
      wait: true,
      points: [taskId],
      payload: {
        metadata: updatedMeta,
      },
    });

    return pointToTask(taskId, {
      ...(point.payload ?? {}),
      metadata: updatedMeta,
    });
  }

}

export const taskService = new TaskService();
