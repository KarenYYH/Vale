import { stat } from "fs/promises";
import { basename, extname } from "path";
import type { IngestResult, DocumentParser } from "@vale/shared";
import { parserRegistry } from "./parsers/registry.js";
import { findEntry, upsertEntry, indexContent } from "../database/index.js";
import { generateAndStoreEmbeddings } from "../embedding/indexer.js";
import { writeWikiPage } from "./parsers/markdown.js";

/**
 * Ingest a single file through the 4-step pipeline:
 *   1. Parse — determine parser by extension, extract content
 *   2. Write — create wiki page
 *   3. Index — update SQLite entries + FTS5
 *   4. Embed — (fire-and-forget) generate vector embeddings
 */
export async function ingestFile(
  workspacePath: string,
  rawFilePath: string,
): Promise<IngestResult> {
  try {
    let fileStat;
    try {
      fileStat = await stat(rawFilePath);
    } catch {
      return {
        filePath: rawFilePath,
        success: false,
        error: "File not found",
      };
    }

    const ext = extname(rawFilePath).toLowerCase();
    const parser = parserRegistry.get(ext);
    if (!parser) {
      return {
        filePath: rawFilePath,
        success: false,
        error: `Unsupported format: ${ext}`,
      };
    }

    // Step 1: Parse
    const parsed = await parser(rawFilePath);

    // Check if already ingested with same checksum
    const existing = findEntry(workspacePath, rawFilePath);
    if (existing && existing.checksum === parsed.checksum) {
      return {
        filePath: rawFilePath,
        success: true,
        wikiPath: existing.wikiPath ?? undefined,
      };
    }

    // Step 2: Write wiki page
    const wikiPath = await writeWikiPage(
      workspacePath,
      parsed,
      basename(rawFilePath),
    );

    // Step 3: Index
    upsertEntry(workspacePath, {
      filePath: rawFilePath,
      fileName: basename(rawFilePath),
      extension: ext,
      size: parsed.rawSize,
      modifiedAt: fileStat.mtimeMs,
      ingestedAt: Date.now(),
      wikiPath,
      checksum: parsed.checksum,
    });
    indexContent(workspacePath, rawFilePath, parsed.body);

    // Step 4: Embed (fire-and-forget)
    generateAndStoreEmbeddings(
      workspacePath,
      rawFilePath,
      parsed.body,
    ).catch(() => {});

    return {
      filePath: rawFilePath,
      success: true,
      wikiPath,
    };
  } catch (err) {
    return {
      filePath: rawFilePath,
      success: false,
      error: (err as Error).message,
    };
  }
}

/**
 * Ingest all supported files in a directory.
 */
export async function ingestDirectory(
  workspacePath: string,
  dirPath: string,
): Promise<IngestResult[]> {
  const { readdir } = await import("fs/promises");
  const { join } = await import("path");

  const results: IngestResult[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;

    const fullPath = join(dirPath, entry.name);

    if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (parserRegistry.get(ext)) {
        const result = await ingestFile(workspacePath, fullPath);
        results.push(result);
      }
    } else if (entry.isDirectory()) {
      const subResults = await ingestDirectory(workspacePath, fullPath);
      results.push(...subResults);
    }
  }

  return results;
}
