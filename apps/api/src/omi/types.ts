import type { SageContext } from "../context/types.js";
import type { ExplainableExecutionEvent } from "../orchestrator/types.js";

export interface OmiContext {
  conversationId?: string | undefined;
  transcriptId?: string | undefined;
  deviceId?: string | undefined;
  timestamp?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface OmiInput {
  userId: string;
  transcript: string;
  sessionId: string;
  context?: OmiContext | undefined;
}

export interface OmiOutput {
  response: string;
  requestId?: string | undefined;
  state?: string | undefined;
  success: boolean;
  sageContext?: SageContext | undefined;
  executionEvents?: ExplainableExecutionEvent[] | undefined;
}
