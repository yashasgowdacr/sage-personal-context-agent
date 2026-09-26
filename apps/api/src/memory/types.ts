export type MemoryType =
  | "fact"
  | "preference"
  | "goal"
  | "commitment"
  | "task"
  | "event"
  | "decision"
  | "conversation"
  | "document_fact"
  | "action_result";

export type MemorySource =
  | "omi"
  | "user"
  | "agent"
  | "document"
  | "tool";

export interface SageMemory {
  id: string;
  userId: string;
  type: MemoryType;
  content: string;
  importance: number;
  source: MemorySource;
  createdAt: string;
  metadata?: Record<string, unknown> | undefined;
}

export interface CreateMemoryInput {
  userId: string;
  type: MemoryType;
  content: string;
  importance?: number | undefined;
  source?: MemorySource | undefined;
  metadata?: Record<string, unknown> | undefined;
}
