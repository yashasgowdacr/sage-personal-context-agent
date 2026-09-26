import { createHash, randomUUID } from "node:crypto";
import type { OmiAdapter } from "./adapter.js";
import type { OmiInput, OmiOutput } from "./types.js";

export interface RawOmiTranscriptSegment {
  text: string;
  speaker?: string | undefined;
  speaker_id?: number | undefined;
  is_user?: boolean | undefined;
  start?: number | undefined;
  end?: number | undefined;
}

export interface RawOmiEvent {
  id?: string | undefined;
  session_id?: string | undefined;
  conversation_id?: string | undefined;
  uid?: string | undefined;
  userId?: string | undefined;
  user_id?: string | undefined;
  transcript?: string | undefined;
  segments?: RawOmiTranscriptSegment[] | undefined;
  transcript_segments?: RawOmiTranscriptSegment[] | undefined;
  event_type?: "transcript" | "memory_created" | "command" | "context" | string | undefined;
  structured?: {
    title?: string | undefined;
    overview?: string | undefined;
    action_items?: string[] | undefined;
    events?: unknown[] | undefined;
  } | undefined;
  discarded?: boolean | undefined;
  created_at?: string | undefined;
  started_at?: string | undefined;
  finished_at?: string | undefined;
  timestamp?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface IngestionResult extends OmiOutput {
  duplicate?: boolean | undefined;
  omiEventId?: string | undefined;
  eventType?: string | undefined;
}

export class EventDeduplicator {
  private seenEvents = new Map<string, number>();
  private readonly ttlMs: number;

  constructor(ttlMs = 10 * 60 * 1000) {
    this.ttlMs = ttlMs;
  }

  isDuplicate(eventId: string): boolean {
    this.cleanup();
    return this.seenEvents.has(eventId);
  }

  markProcessed(eventId: string): void {
    this.seenEvents.set(eventId, Date.now());
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [id, timestamp] of this.seenEvents.entries()) {
      if (now - timestamp > this.ttlMs) {
        this.seenEvents.delete(id);
      }
    }
  }

  clear(): void {
    this.seenEvents.clear();
  }
}

export class OmiIngestionService {
  private deduplicator: EventDeduplicator;

  constructor(
    private readonly adapter: OmiAdapter,
    deduplicator?: EventDeduplicator,
  ) {
    this.deduplicator = deduplicator ?? new EventDeduplicator();
  }

  getDeduplicator(): EventDeduplicator {
    return this.deduplicator;
  }

  async ingest(
    rawEvent: RawOmiEvent,
    queryParams?: Record<string, string | undefined>,
  ): Promise<IngestionResult> {
    // 1. Discard check
    if (rawEvent.discarded) {
      return {
        success: true,
        response: "Event marked as discarded; skipped processing.",
        eventType: "context",
      };
    }

    // 2. Resolve User ID
    const userId =
      queryParams?.uid ||
      rawEvent.uid ||
      rawEvent.userId ||
      rawEvent.user_id ||
      "default-omi-user";

    // 3. Resolve Session ID
    const sessionId =
      rawEvent.session_id ||
      rawEvent.conversation_id ||
      rawEvent.id ||
      randomUUID();

    // 4. Extract Transcript
    let transcript = "";
    if (rawEvent.transcript && rawEvent.transcript.trim()) {
      transcript = rawEvent.transcript.trim();
    } else if (rawEvent.segments && rawEvent.segments.length > 0) {
      transcript = rawEvent.segments
        .map((s) => s.text)
        .filter(Boolean)
        .join(" ")
        .trim();
    } else if (rawEvent.transcript_segments && rawEvent.transcript_segments.length > 0) {
      transcript = rawEvent.transcript_segments
        .map((s) => s.text)
        .filter(Boolean)
        .join(" ")
        .trim();
    } else if (rawEvent.structured?.overview) {
      transcript = rawEvent.structured.overview.trim();
    }

    // 5. Determine Event Type
    let eventType = rawEvent.event_type;
    if (!eventType) {
      if (rawEvent.structured || rawEvent.id?.startsWith("memory_")) {
        eventType = "memory_created";
      } else if (transcript) {
        eventType = "transcript";
      } else {
        eventType = "context";
      }
    }

    // 6. Generate/Extract Event ID for Deduplication
    const omiEventId =
      rawEvent.id ||
      createHash("sha256")
        .update(`${userId}:${sessionId}:${transcript}:${rawEvent.created_at ?? ""}`)
        .digest("hex");

    if (this.deduplicator.isDuplicate(omiEventId)) {
      return {
        success: true,
        duplicate: true,
        omiEventId,
        eventType,
        response: "Event already processed.",
      };
    }

    this.deduplicator.markProcessed(omiEventId);

    // 7. Normalize to OmiInput
    const omiInput: OmiInput = {
      userId,
      sessionId,
      transcript,
      context: {
        conversationId: rawEvent.conversation_id ?? rawEvent.session_id,
        transcriptId: rawEvent.id,
        timestamp:
          rawEvent.created_at ||
          rawEvent.timestamp ||
          rawEvent.started_at ||
          new Date().toISOString(),
        metadata: {
          source: "omi",
          omiEventId,
          eventType,
          ...(rawEvent.metadata ?? {}),
          ...(rawEvent.structured ? { structured: rawEvent.structured } : {}),
        },
      },
    };

    // 8. Forward to existing OmiAdapter
    const result = await this.adapter.handle(omiInput);

    return {
      ...result,
      omiEventId,
      eventType,
    };
  }
}
