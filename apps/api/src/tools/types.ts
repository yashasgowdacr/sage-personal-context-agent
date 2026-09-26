export interface SageTool {
  name: string;
  description: string;
  execute: (input: unknown) => Promise<unknown>;
}
