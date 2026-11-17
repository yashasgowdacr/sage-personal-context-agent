import type { OrchestrationContext, ReasoningDecision } from "./types.js";
import { groqReason } from "../agent/groq.js";

export interface SageReasoner {
  reason(context: OrchestrationContext): Promise<ReasoningDecision>;
}

export class GroqReasonerAdapter implements SageReasoner {
  async reason(context: OrchestrationContext): Promise<ReasoningDecision> {
    try {
      return await groqReason(context);
    } catch (error) {
      return {
        thoughtSummary: `Groq reasoning failed: ${(error as Error).message}`,
        directResponse: "The reasoning service is temporarily unavailable.",
      };
    }
  }
}
