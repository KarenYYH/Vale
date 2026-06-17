import Database from "better-sqlite3";
import { join } from "path";
import { VALE_DIR } from "@vale/shared";
import { runMigrations } from "./migrations.js";

/** Connection pool: one DB per workspace */
const dbCache = new Map<string, Database.Database>();

function dbPath(workspacePath: string): string {
  return join(workspacePath, VALE_DIR, ".index.db");
}

/** Get or create a database connection for a workspace */
export function getDb(workspacePath: string): Database.Database {
  const cached = dbCache.get(workspacePath);
  if (cached) return cached;

  const db = new Database(dbPath(workspacePath));
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.pragma("foreign_keys = ON");

  // Run migrations (creates tables on first connection)
  runMigrations(db);

  dbCache.set(workspacePath, db);
  return db;
}

/** Close and remove a workspace's database connection */
export function closeDb(workspacePath: string): void {
  const db = dbCache.get(workspacePath);
  if (db) {
    db.close();
    dbCache.delete(workspacePath);
  }
}

/** Close all open database connections (use on process exit) */
export function closeAllDbs(): void {
  for (const [, db] of dbCache) {
    db.close();
  }
  dbCache.clear();
}

/** Check if a database connection is open for a workspace */
export function hasDb(workspacePath: string): boolean {
  return dbCache.has(workspacePath);
}
