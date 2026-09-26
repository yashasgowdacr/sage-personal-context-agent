export type EmbeddingInputType = "document" | "query";

export interface EmbeddingProvider {
  embed(
    text: string,
    type?: EmbeddingInputType,
  ): Promise<number[]>;

  dimension(): number;
}
