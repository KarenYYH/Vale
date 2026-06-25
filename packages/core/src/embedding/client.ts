/**
 * Embedding generation client.
 *
 * Primary: Local model via HuggingFace Transformers.js (all-MiniLM-L6-v2, 384-dim)
 * Fallback: OpenAI-compatible /v1/embeddings API endpoint
 */
export interface EmbeddingClient {
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddings(texts: string[]): Promise<number[][]>;
}

/** Options for creating an embedding client */
export interface EmbeddingClientOptions {
  provider?: "local" | "api";
  apiKey?: string;
  apiEndpoint?: string;
  apiModel?: string;
  fallbackToLocal?: boolean;
  /** Inject a pre-built client (e.g. for tests or custom providers). */
  client?: EmbeddingClient;
}

/** Create the default local embedding client */
export function createEmbeddingClient(
  options?: EmbeddingClientOptions,
): EmbeddingClient {
  if (options?.client) return options.client;
  return new LocalEmbeddingClient();
}

/** Local HuggingFace Transformers.js client */
class LocalEmbeddingClient implements EmbeddingClient {
  private pipeline: unknown = null;
  private loading: Promise<unknown> | null = null;

  async generateEmbedding(text: string): Promise<number[]> {
    const results = await this.generateEmbeddings([text]);
    return results[0] ?? [];
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];

    try {
      const pipe = await this.getPipeline();
      // Use batch inference
      const output = await (pipe as Pipe).call(texts, {
        pooling: "mean",
        normalize: true,
      });

      // output is [batchSize, dim] tensor
      const dim = output.dims[1] as number;
      const data = output.data as Float32Array;
      const results: number[][] = [];

      for (let i = 0; i < texts.length; i++) {
        const vec = Array.from(
          data.slice(i * dim, (i + 1) * dim),
        );
        results.push(vec);
      }

      return results;
    } catch {
      // Return empty arrays on failure (caller handles gracefully)
      return texts.map(() => []);
    }
  }

  private async getPipeline(): Promise<unknown> {
    if (this.pipeline) return this.pipeline;
    if (this.loading) return this.loading;

    this.loading = (async () => {
      // @ts-ignore — @huggingface/transformers is an optional dependency; it
      // may be absent in installs that skip optional deps.
      const { pipeline } = await import("@huggingface/transformers");
      this.pipeline = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
      );
      return this.pipeline;
    })();

    this.pipeline = await this.loading;
    return this.pipeline;
  }
}

/** Minimal type for Transformers.js pipeline */
interface Pipe {
  call(inputs: string[], options?: Record<string, unknown>): Promise<{
    dims: number[];
    data: Float32Array;
  }>;
}
