import type { ExplainableExecutionEvent } from "../orchestrator/types.js";
import type { SageContext } from "../context/types.js";

export interface TimelineRenderOptions {
  width?: number;
  subtitle?: string;
  context?: SageContext;
}

/**
 * Builds and renders the judge-facing ASCII Visual Execution Timeline box
 * matching STEP 13.5 specifications.
 */
export function renderVisualTimeline(
  events: ExplainableExecutionEvent[] = [],
  options?: TimelineRenderOptions,
): string {
  const width = options?.width ?? 58;
  const subtitle = options?.subtitle ?? "Personal Context & Action Agent";

  const topBorder = `┌${"─".repeat(width)}┐`;
  const midDivider = `├${"─".repeat(width)}┤`;
  const botBorder = `└${"─".repeat(width)}┘`;

  const padLine = (content: string): string => {
    // Basic terminal length handling (strip emojis for width calculation)
    const visualLen = Array.from(content).length;
    const padding = Math.max(0, width - visualLen - 2);
    return `│ ${content}${" ".repeat(padding)} │`;
  };

  const lines: string[] = [
    topBorder,
    padLine("SAGE"),
    padLine(subtitle),
    midDivider,
  ];

  if (events.length === 0) {
    lines.push(padLine("○ Idle / Awaiting input"));
  } else {
    for (const ev of events) {
      let icon = "✓";
      if (ev.status === "skipped") icon = "○";
      if (ev.status === "failed") icon = "✗";

      let lineText = "";
      if (ev.stage === "voice_received") {
        lineText = "🎙 Voice received";
      } else if (ev.stage === "understanding") {
        lineText = "✓ Understanding request";
      } else if (ev.stage === "memory_retrieval") {
        lineText = ev.detail && ev.detail.includes("relevant memories retrieved")
          ? "✓ Memory matched"
          : "✓ Context retrieved";
      } else if (ev.stage === "context_fusion") {
        lineText = ev.detail && ev.detail.includes("pending tasks") && !ev.detail.startsWith("0")
          ? "✓ Pending task found"
          : "✓ Context fused";
      } else if (ev.stage === "reasoning") {
        lineText = "🤖 Lyzr reasoning";
      } else if (ev.stage === "tool_selection") {
        const toolMatch = ev.detail?.replace(/^Tool:\s*/i, "");
        lineText = toolMatch && toolMatch !== "Direct conversational response"
          ? `🔧 ${toolMatch}`
          : "🔧 Synthesize response";
      } else if (ev.stage === "action_verification") {
        lineText = ev.status === "completed" ? "✓ Action verified" : "✗ Verification failed";
      } else if (ev.stage === "memory_update") {
        lineText = ev.status === "completed" ? "💾 Context updated" : "○ Context unchanged";
      } else if (ev.stage === "response_ready") {
        lineText = "🔊 Response ready";
      } else {
        lineText = `${icon} ${ev.label}`;
      }

      lines.push(padLine(lineText));
    }
  }

  lines.push(botBorder);
  return lines.join("\n");
}
