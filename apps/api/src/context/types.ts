export interface SageContextMemory {
  content: string;
  type: string;
  importance: number;
  score?: number;
}

export interface SageContextTask {
  id: string;
  title: string;
  dueAt?: string;
}

export interface SageContextAction {
  action: string;
  status: string;
  timestamp: string;
}

export interface SageContext {
  userId: string;
  currentInput: string;
  memories: SageContextMemory[];
  pendingTasks: SageContextTask[];
  recentActions: SageContextAction[];
}

export interface ContextBuilderOptions {
  minMemoryScore?: number | undefined;
  maxMemories?: number | undefined;
  includeTasks?: boolean | undefined;
  forceIncludeTasks?: boolean | undefined;
  maxRecentActions?: number | undefined;
}
