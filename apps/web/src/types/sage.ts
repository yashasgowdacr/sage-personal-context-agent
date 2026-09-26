export interface ExplainableExecutionEvent {
  stage: string;
  label: string;
  timestamp: string;
  status: 'pending' | 'completed' | 'failed' | 'skipped';
  detail?: string;
}

export interface ConfirmationRequest {
  tool: string;
  input: unknown;
  message: string;
  confirmationToken: string;
}

export interface ContextMemoryItem {
  score?: number;
  content: string;
  type?: string;
}

export interface ContextTaskItem {
  id: string;
  title: string;
  dueAt?: string;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt?: string;
}

export interface SageContextSummary {
  retrievedMemories?: ContextMemoryItem[];
  pendingTasks?: ContextTaskItem[];
  recentActions?: string[];
}

export interface OrchestrationApiResponse {
  success: boolean;
  finalState?: string;
  state?: string;
  requestId?: string;
  response: string;
  memoriesUsed?: { score: number; memory: { content: string; type: string } }[];
  sageContext?: {
    retrievedMemories?: { score: number; memory: { content: string; type: string } }[];
    pendingTasks?: ContextTaskItem[];
    recentActions?: string[];
  };
  executionEvents?: ExplainableExecutionEvent[];
  actionResult?: {
    tool: string;
    success: boolean;
    verified: boolean;
    data?: unknown;
    error?: string;
  };
  requiresConfirmation?: ConfirmationRequest;
  error?: string;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  executionEvents?: ExplainableExecutionEvent[];
  requiresConfirmation?: ConfirmationRequest;
  sageContext?: SageContextSummary;
  isError?: boolean;
}

export interface HealthStatus {
  status: string;
  service: string;
  timestamp?: string;
}
