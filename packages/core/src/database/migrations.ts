import type Database from "better-sqlite3";

/** Current schema version. Increment when adding migrations. */
const CURRENT_VERSION = 2;

/** Run all pending migrations */
export function runMigrations(db: Database.Database): void {
  // Ensure schema version table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS _vale_schema (
      version INTEGER PRIMARY KEY,
      applied_at REAL NOT NULL
    )
  `);

  const current = db.prepare(
    "SELECT MAX(version) as version FROM _vale_schema",
  ).get() as { version: number | null } | undefined;
  const appliedVersion = current?.version ?? 0;

  const migrations: Array<{ version: number; label: string; sql: string }> = [
    {
      version: 1,
      label: "Initial schema: entries, entries_fts, embeddings",
      sql: `
        CREATE TABLE IF NOT EXISTS entries (
          file_path   TEXT PRIMARY KEY,
          file_name   TEXT NOT NULL,
          extension   TEXT NOT NULL,
          size        INTEGER NOT NULL,
          modified_at REAL NOT NULL,
          ingested_at REAL,
          wiki_path   TEXT,
          checksum    TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS entries_fts USING fts5(
          file_path,
          file_name,
          content,
          tokenize='porter unicode61'
        );

        CREATE TABLE IF NOT EXISTS embeddings (
          file_path   TEXT NOT NULL,
          chunk_index INTEGER NOT NULL,
          chunk_text  TEXT NOT NULL,
          embedding   BLOB NOT NULL,
          model       TEXT NOT NULL,
          generated_at REAL NOT NULL,
          PRIMARY KEY (file_path, chunk_index)
        );
      `,
    },
    {
      version: 2,
      label: "Links table for incremental graph cache",
      sql: `
        CREATE TABLE IF NOT EXISTS links (
          source_file TEXT NOT NULL,
          target_page TEXT NOT NULL,
          line        INTEGER NOT NULL,
          raw_text    TEXT NOT NULL,
          PRIMARY KEY (source_file, target_page, line)
        );

        CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_file);
        CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_page);
      `,
    },
  ];

  for (const m of migrations) {
    if (m.version <= appliedVersion) continue;
    db.exec(m.sql);
    db.prepare(
      "INSERT INTO _vale_schema (version, applied_at) VALUES (?, ?)",
    ).run(m.version, Date.now() / 1000);
  }
}
