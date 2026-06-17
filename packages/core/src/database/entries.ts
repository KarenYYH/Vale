import type { IndexEntry } from "@vale/shared";
import { getDb } from "./connection.js";

const ENTRY_COLUMNS = `
  file_path   AS filePath,
  file_name   AS fileName,
  extension   AS extension,
  size        AS size,
  modified_at AS modifiedAt,
  ingested_at AS ingestedAt,
  wiki_path   AS wikiPath,
  checksum    AS checksum
`;

/** Insert or update a file entry in the index */
export function upsertEntry(workspacePath: string, entry: IndexEntry): void {
  const db = getDb(workspacePath);
  db.prepare(`
    INSERT INTO entries (file_path, file_name, extension, size, modified_at, ingested_at, wiki_path, checksum)
    VALUES (@filePath, @fileName, @extension, @size, @modifiedAt, @ingestedAt, @wikiPath, @checksum)
    ON CONFLICT(file_path) DO UPDATE SET
      file_name   = excluded.file_name,
      extension   = excluded.extension,
      size        = excluded.size,
      modified_at = excluded.modified_at,
      ingested_at = excluded.ingested_at,
      wiki_path   = excluded.wiki_path,
      checksum    = excluded.checksum
  `).run({
    filePath: entry.filePath,
    fileName: entry.fileName,
    extension: entry.extension,
    size: entry.size,
    modifiedAt: entry.modifiedAt,
    ingestedAt: entry.ingestedAt ?? null,
    wikiPath: entry.wikiPath ?? null,
    checksum: entry.checksum,
  });
}

/** Find a single entry by file path */
export function findEntry(
  workspacePath: string,
  filePath: string,
): IndexEntry | undefined {
  const db = getDb(workspacePath);
  return db.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM entries WHERE file_path = ?`,
  ).get(filePath) as IndexEntry | undefined;
}

/** Find all entries with a given file extension */
export function findEntriesByExtension(
  workspacePath: string,
  extension: string,
): IndexEntry[] {
  const db = getDb(workspacePath);
  return db.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM entries WHERE extension = ?`,
  ).all(extension) as IndexEntry[];
}

/** Remove an entry and its FTS index */
export function removeEntry(workspacePath: string, filePath: string): void {
  const db = getDb(workspacePath);
  db.prepare("DELETE FROM entries WHERE file_path = ?").run(filePath);
  db.prepare("DELETE FROM entries_fts WHERE file_path = ?").run(filePath);
}

/** List all indexed entries */
export function listEntries(workspacePath: string): IndexEntry[] {
  const db = getDb(workspacePath);
  return db.prepare(
    `SELECT ${ENTRY_COLUMNS} FROM entries ORDER BY file_path`,
  ).all() as IndexEntry[];
}

/** Count total indexed entries */
export function countEntries(workspacePath: string): number {
  const db = getDb(workspacePath);
  const row = db.prepare("SELECT COUNT(*) as cnt FROM entries").get() as {
    cnt: number;
  };
  return row.cnt;
}
