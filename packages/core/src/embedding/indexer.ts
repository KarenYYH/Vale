import { chunkText } from "./chunker.js";
import {
  createEmbeddingClient,
  type EmbeddingClientOptions,
} from "./client.js";
import {
  removeEmbeddings,
  upsertEmbedding,
} from "../database/embeddingStore.js";

/**
 * Generate embeddings for a document's content and store them.
 * This is the orchestrator called after a file is ingested.
 */
export async function generateAndStoreEmbeddings(
  workspacePath: string,
  filePath: string,
  content: string,
  options?: EmbeddingClientOptions,
): Promise<void> {
  try {
    const client = createEmbeddingClient(options);
    const chunks = chunkText(content);
    if (chunks.length === 0) return;

    // Remove old embeddings for this file
    removeEmbeddings(workspacePath, filePath);

    // Batch-generate embeddings
    const embeddings = await client.generateEmbeddings(chunks);

    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const embedding = embeddings[i];
      if (!embedding || embedding.length === 0) continue;

      upsertEmbedding(
        workspacePath,
        filePath,
        i,
        chunks[i],
        embedding,
        options?.apiModel ?? "Xenova/all-MiniLM-L6-v2",
      );
    }
  } catch {
    // Embedding is best-effort; failure should not block ingest
  }
}
