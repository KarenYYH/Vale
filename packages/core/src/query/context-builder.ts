import { readFile } from "fs/promises";
import type { SearchMatch, ContextFile } from "@vale/shared";
import { LAYER_PRIORITY, MAX_CONTEXT_FILES, MAX_CONTEXT_CHARS } from "@vale/shared";
import type { Layer } from "@vale/shared";

/**
 * Assemble search matches into an AI-friendly context string.
 *
 * Strategy:
 *   1. Group matches by file, keep best score per file
 *   2. Sort by layer priority (zettel > wiki > raw) then by score
 *   3. Take top N files, cap total characters
 */
export async function buildContext(
  workspacePath: string,
  matches: SearchMatch[],
  options?: {
    maxFiles?: number;
    maxChars?: number;
  },
): Promise<string> {
  if (matches.length === 0) return "";

  const maxFiles = options?.maxFiles ?? MAX_CONTEXT_FILES;
  const maxChars = options?.maxChars ?? MAX_CONTEXT_CHARS;

  // Group by file, keep best score
  const fileMap = new Map<string, SearchMatch>();
  for (const match of matches) {
    const existing = fileMap.get(match.filePath);
    if (!existing || match.score > existing.score) {
      fileMap.set(match.filePath, match);
    }
  }

  // Convert to ContextFile with layer detection
  const files: ContextFile[] = [...fileMap.values()].map((m) => ({
    filePath: m.filePath,
    content: "", // populated below
    layer: detectLayer(m.filePath),
    matchScore: m.score,
  }));

  // Sort: layer priority first, then score
  files.sort((a, b) => {
    const layerDiff =
      (LAYER_PRIORITY[b.layer as Layer] ?? 0) -
      (LAYER_PRIORITY[a.layer as Layer] ?? 0);
    if (layerDiff !== 0) return layerDiff;
    return b.matchScore - a.matchScore;
  });

  // Take top N and read content
  const selected = files.slice(0, maxFiles);
  const parts: string[] = [];
  let totalChars = 0;

  for (const file of selected) {
    try {
      const content = await readFile(
        file.filePath.startsWith("/")
          ? file.filePath
          : `${workspacePath}/${file.filePath}`,
        "utf-8",
      );
      const perFileMax = Math.min(
        4000, // hard cap per file
        maxChars - totalChars,
      );
      if (perFileMax <= 0) break;

      const truncated =
        content.length > perFileMax
          ? content.slice(0, perFileMax) + "\n...(truncated)"
          : content;

      const layerLabel =
        file.layer === "zettel"
          ? "Zettelkasten"
          : file.layer === "wiki"
            ? "Wiki"
            : file.layer === "raw"
              ? "Raw Material"
              : "Other";

      parts.push(`### [${layerLabel}] ${file.filePath}\n\`\`\`markdown\n${truncated}\n\`\`\``);
      totalChars += truncated.length;
    } catch {
      // Skip unreadable files
    }
  }

  return parts.join("\n\n");
}

/** Detect which layer a file belongs to based on its path */
function detectLayer(filePath: string): Layer | "other" {
  if (filePath.includes("zettel/") || filePath.startsWith("zettel/")) return "zettel";
  if (filePath.includes("wiki/") || filePath.startsWith("wiki/")) return "wiki";
  if (filePath.includes("raw/") || filePath.startsWith("raw/")) return "raw";
  return "other";
}
