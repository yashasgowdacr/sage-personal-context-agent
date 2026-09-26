import type { MemoryType, SageMemory } from "../memory/types.js";

export interface MemorySearchResult {
  score: number;
  memory: SageMemory;
}

export type OrchestrationState =
  | "understanding"
  | "memory_retrieval"
  | "reasoning"
  | "tool_selection"
  | "executing"
  | "verification"
  | "memory_update"
  | "response";

export interface StateTransition {
  state: OrchestrationState;
  timestamp: string;
  durationMs?: number | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface ExecutionConstraints {
  requireConfirmationForDestructive?: boolean | undefined;
  maxMemoryRetrievals?: number | undefined;
  minMemoryScore?: number | undefined;
}

export interface ToolMetadata {
  name: string;
  description: string;
  requiresConfirmation: boolean;
  isDestructive: boolean;
}

export interface ToolExecutionContext {
  requestId: string;
  userId: string;
  sessionId: string;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  error?: string | undefined;
}

export interface VerificationResult {
  verified: boolean;
  reason?: string | undefined;
}

export interface SageActionTool {
  name: string;
  description: string;
  requiresConfirmation?: boolean | undefined;
  isDestructive?: boolean | undefined;
  execute: (input: unknown, ctx: ToolExecutionContext) => Promise<ToolExecutionResult>;
  verify?: (result: ToolExecutionResult, ctx: ToolExecutionContext) => Promise<VerificationResult>;
}

import type { SageContext } from "../context/types.js";

export interface ExplainableExecutionEvent {
  stage: string;
  label: string;
  timestamp: string;
  status: "pending" | "completed" | "failed" | "skipped";
  detail?: string | undefined;
}

export interface OrchestrationContext {
  requestId: string;
  userId: string;
  sessionId: string;
  userRequest: string;
  retrievedMemories: MemorySearchResult[];
  availableTools: ToolMetadata[];
  constraints: ExecutionConstraints;
  confirmed?: boolean | undefined;
  confirmationToken?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
  sageContext?: SageContext | undefined;
  formattedContext?: string | undefined;
}

export interface ReasoningDecision {
  thoughtSummary: string;
  selectedTool?: {
    name: string;
    input: unknown;
  } | undefined;
  directResponse?: string | undefined;
  memoryToSave?: {
    type: MemoryType;
    content: string;
    importance?: number | undefined;
  } | undefined;
}

export interface OrchestrationResult {
  success: boolean;
  finalState: OrchestrationState;
  state?: string | undefined;
  requestId?: string | undefined;
  response: string;
  transitions: StateTransition[];
  memoriesUsed: MemorySearchResult[];
  sageContext?: SageContext | undefined;
  executionEvents?: ExplainableExecutionEvent[] | undefined;
  actionResult?: {
    tool: string;
    success: boolean;
    verified: boolean;
    data?: unknown;
    error?: string | undefined;
  } | undefined;
  requiresConfirmation?: {
    tool: string;
    input: unknown;
    message: string;
    confirmationToken: string;
  } | undefined;
  metadata: Record<string, unknown>;
}


export interface OrchestratorInput {
  userId: string;
  request: string;
  sessionId?: string | undefined;
  confirmed?: boolean | undefined;
  confirmationToken?: string | undefined;
  constraints?: Partial<ExecutionConstraints> | undefined;
  metadata?: Record<string, unknown> | undefined;
}

