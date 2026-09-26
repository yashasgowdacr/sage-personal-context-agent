export type TaskStatus = "pending" | "completed" | "cancelled";

export interface SageTask {
  id: string;
  userId: string;
  title: string;
  description?: string | undefined;
  status: TaskStatus;
  dueAt?: string | undefined;
  createdAt: string;
  completedAt?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface CreateTaskInput {
  userId: string;
  title: string;
  description?: string | undefined;
  dueAt?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}
