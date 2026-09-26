import type { OmiInput, OmiOutput } from "./types.js";

export interface SageOrchestratorClient {
  run(input: {
    userId: string;
    request: string;
    sessionId?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  }): Promise<{
    success: boolean;
    response: string;
    requestId?: string | undefined;
    state?: string | undefined;
    sageContext?: import("../context/types.js").SageContext | undefined;
    executionEvents?: import("../orchestrator/types.js").ExplainableExecutionEvent[] | undefined;
  }>;
}

export class OmiAdapter {
  constructor(
    private readonly orchestrator: SageOrchestratorClient,
  ) {}

  async handle(input: OmiInput): Promise<OmiOutput> {
    const transcript = input.transcript.trim();

    if (!transcript) {
      return {
        success: false,
        response: "I didn't receive any speech to process.",
      };
    }

    const result = await this.orchestrator.run({
      userId: input.userId,
      request: transcript,
      sessionId: input.sessionId,
      metadata: {
        source: "omi",
        ...(input.context ?? {}),
      },
    });

    return {
      success: result.success,
      response: result.response,
      requestId: result.requestId,
      state: result.state,
      sageContext: result.sageContext,
      executionEvents: result.executionEvents,
    };
  }
}
