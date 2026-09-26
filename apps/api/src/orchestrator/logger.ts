import type { OrchestrationState, StateTransition } from "./types.js";

export class OrchestrationLogger {
  private transitions: StateTransition[] = [];
  private lastTimestamp: number = Date.now();

  constructor(private readonly requestId: string) {}

  logState(state: OrchestrationState, metadata?: Record<string, unknown>): StateTransition {
    const now = Date.now();
    const durationMs = now - this.lastTimestamp;
    this.lastTimestamp = now;

    // Sanitize metadata to never include secrets
    const sanitizedMetadata = metadata ? this.sanitize(metadata) : undefined;

    const transition: StateTransition = {
      state,
      timestamp: new Date(now).toISOString(),
      durationMs,
      metadata: sanitizedMetadata,
    };

    this.transitions.push(transition);

    // Structured stdout log (safe, no secrets)
    console.log(
      JSON.stringify({
        tag: "SAGE_ORCHESTRATOR",
        requestId: this.requestId,
        state,
        durationMs,
        metadata: sanitizedMetadata,
      }),
    );

    return transition;
  }

  getTransitions(): StateTransition[] {
    return [...this.transitions];
  }

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    const sensitiveKeys = ["key", "token", "secret", "password", "auth", "api_key", "apikey"];

    for (const [k, v] of Object.entries(obj)) {
      const lower = k.toLowerCase();
      if (sensitiveKeys.some((s) => lower.includes(s))) {
        sanitized[k] = "[REDACTED]";
      } else if (v && typeof v === "object" && !Array.isArray(v)) {
        sanitized[k] = this.sanitize(v as Record<string, unknown>);
      } else {
        sanitized[k] = v;
      }
    }

    return sanitized;
  }
}
