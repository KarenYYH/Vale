import type { FtsSearchResult } from "@vale/shared";
import { getDb } from "./connection.js";

/**
 * Full-text search using FTS5.
 * Falls back to LIKE search if FTS5 query parsing fails.
 */
export function searchFts(
  workspacePath: string,
  query: string,
  limit = 50,
): FtsSearchResult[] {
  const db = getDb(workspacePath);
  const safe = query.replace(/['"*()^]/g, "").trim();
  if (!safe) return [];

  // Wrap each word in double quotes so AND/OR/NOT are treated as literals,
  // and join with OR so natural-language questions match on any term.
  // BM25 ranking surfaces the documents matching the most (and rarest) terms.
  const ftsQuery = safe.split(/\s+/).map((w) => `"${w}"`).join(" OR ");

  try {
    const rows = db.prepare(`
      SELECT
        file_path,
        snippet(entries_fts, 2, '<mark>', '</mark>', '...', 40) AS snippet,
        rank
      FROM entries_fts
      WHERE entries_fts MATCH @query
      ORDER BY rank
      LIMIT @limit
    `).all({ query: ftsQuery, limit }) as Array<{
      file_path: string;
      snippet: string;
      rank: number;
    }>;

    return rows.map((r) => ({
      filePath: r.file_path,
      line: 0,
      content: r.snippet
        .replace(/<mark>/g, "**")
        .replace(/<\/mark>/g, "**"),
      score: Math.round((1 / (1 + (r.rank ?? 0))) * 100),
    }));
  } catch {
    // FTS5 query parse error — fall back to LIKE search
    return likeSearch(workspacePath, safe, limit);
  }
}

/** Fallback: simple LIKE-based search when FTS5 can't parse the query */
function likeSearch(
  workspacePath: string,
  query: string,
  limit: number,
): FtsSearchResult[] {
  const db = getDb(workspacePath);
  try {
    const rows = db.prepare(`
      SELECT file_path, file_name FROM entries
      WHERE file_name LIKE @q OR file_path LIKE @q
      LIMIT @limit
    `).all({ q: `%${query}%`, limit }) as Array<{
      file_path: string;
      file_name: string;
    }>;

    return rows.map((r) => ({
      filePath: r.file_path,
      line: 0,
      content: r.file_name,
      score: 10,
    }));
  } catch {
    return [];
  }
}

/** Index a file's content in FTS5 (delete old + insert new) */
export function indexContent(
  workspacePath: string,
  filePath: string,
  content: string,
): void {
  const db = getDb(workspacePath);
  db.prepare("DELETE FROM entries_fts WHERE file_path = ?").run(filePath);
  db.prepare(
    "INSERT INTO entries_fts (file_path, file_name, content) VALUES (?, ?, ?)",
  ).run(filePath, filePath.split("/").pop() ?? filePath, content);
}

/** Remove a file from the FTS5 index */
export function removeContent(workspacePath: string, filePath: string): void {
  const db = getDb(workspacePath);
  db.prepare("DELETE FROM entries_fts WHERE file_path = ?").run(filePath);
}
