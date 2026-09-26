import {
  searchMemoryTool,
  saveMemoryTool,
  forgetMemoryTool,
} from "./memory.js";
import type { SageTool } from "./types.js";

export const memoryTools: SageTool[] = [
  {
    name: "save_memory",
    description: "Save useful persistent information about the user.",
    execute: saveMemoryTool,
  },
  {
    name: "search_memory",
    description: "Search the user's persistent memories using semantic similarity.",
    execute: searchMemoryTool,
  },
  {
    name: "forget_memory",
    description: "Remove a specific stored memory when the user asks.",
    execute: forgetMemoryTool,
  },
];

export const sageTools: Record<string, (input: unknown) => Promise<unknown>> = {
  search_memory: searchMemoryTool,
  save_memory: saveMemoryTool,
  forget_memory: forgetMemoryTool,
};
