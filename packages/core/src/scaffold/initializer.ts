import { mkdir, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { VALE_DIR, SCHEMA_DIR } from "@vale/shared";
import {
  CLAUDE_MD_TEMPLATE,
  WIKI_RULES_TEMPLATE,
  INGEST_PROTOCOL_TEMPLATE,
  QUERY_PROTOCOL_TEMPLATE,
  LINT_PROTOCOL_TEMPLATE,
  WIKI_INDEX_TEMPLATE,
  WIKI_LOG_TEMPLATE,
  CONFIG_JSON_TEMPLATE,
} from "./templates/index.js";

export interface ScaffoldResult {
  workspacePath: string;
  created: string[];
  skipped: string[];
  failed: string[];
}

export interface FileTemplate {
  relPath: string;
  content: string;
  isDir?: boolean;
}

/** Get the directory structure for a new workspace */
function getTemplates(workspaceName: string): FileTemplate[] {
  const date = new Date().toISOString().split("T")[0];

  const replace = (s: string) =>
    s.replace(/\{WORKSPACE_NAME\}/g, workspaceName)
     .replace(/\{DATE\}/g, date);

  return [
    // Directories
    { relPath: `${VALE_DIR}/skills`, content: "", isDir: true },
    { relPath: "wiki/concepts", content: "", isDir: true },
    { relPath: "wiki/summaries", content: "", isDir: true },
    { relPath: "wiki/answers", content: "", isDir: true },
    { relPath: "raw/documents", content: "", isDir: true },
    { relPath: "raw/clippings", content: "", isDir: true },
    { relPath: "raw/media", content: "", isDir: true },
    { relPath: "zettel", content: "", isDir: true },
    { relPath: "projects", content: "", isDir: true },
    { relPath: "template", content: "", isDir: true },

    // Schema files
    { relPath: `${SCHEMA_DIR}/wiki-rules.md`, content: replace(WIKI_RULES_TEMPLATE) },
    { relPath: `${SCHEMA_DIR}/ingest-protocol.md`, content: replace(INGEST_PROTOCOL_TEMPLATE) },
    { relPath: `${SCHEMA_DIR}/query-protocol.md`, content: replace(QUERY_PROTOCOL_TEMPLATE) },
    { relPath: `${SCHEMA_DIR}/lint-protocol.md`, content: replace(LINT_PROTOCOL_TEMPLATE) },

    // Root files
    { relPath: "CLAUDE.md", content: replace(CLAUDE_MD_TEMPLATE) },
    { relPath: "wiki/index.md", content: replace(WIKI_INDEX_TEMPLATE) },
    { relPath: "wiki/log.md", content: replace(WIKI_LOG_TEMPLATE) },

    // Config
    { relPath: `${VALE_DIR}/config.json`, content: replace(CONFIG_JSON_TEMPLATE) },
  ];
}

/**
 * Initialize a new Vale workspace with the four-layer directory structure.
 * Does not overwrite existing files.
 */
export async function initializeWorkspace(
  workspacePath: string,
  workspaceName?: string,
): Promise<ScaffoldResult> {
  const name = workspaceName ?? "My Knowledge Base";
  const templates = getTemplates(name);
  const created: string[] = [];
  const skipped: string[] = [];
  const failed: string[] = [];

  for (const template of templates) {
    const targetPath = join(workspacePath, template.relPath);

    try {
      if (template.isDir) {
        // Only count as "created" when the directory was actually missing, so
        // a repair pass on a healthy workspace reports nothing newly created.
        let existed = false;
        try {
          const { stat } = await import("fs/promises");
          existed = (await stat(targetPath)).isDirectory();
        } catch {
          existed = false;
        }
        await mkdir(targetPath, { recursive: true });
        if (existed) skipped.push(template.relPath);
        else created.push(template.relPath);
      } else {
        // Check if file already exists
        try {
          const { stat } = await import("fs/promises");
          await stat(targetPath);
          skipped.push(template.relPath);
          continue;
        } catch {
          // File doesn't exist, proceed
        }

        // Ensure parent directory exists. targetPath is already absolute
        // (join of workspacePath + relPath), so derive the parent from it
        // directly — do NOT re-join with workspacePath.
        const dir = dirname(targetPath);
        await mkdir(dir, { recursive: true });

        await writeFile(targetPath, template.content, "utf-8");
        created.push(template.relPath);
      }
    } catch (err) {
      failed.push(`${template.relPath} (${(err as Error).message})`);
    }
  }

  return { workspacePath, created, skipped, failed };
}

/** Check if a workspace is already initialized */
export async function isWorkspaceInitialized(
  workspacePath: string,
): Promise<boolean> {
  try {
    const { stat } = await import("fs/promises");
    await stat(join(workspacePath, VALE_DIR, "config.json"));
    return true;
  } catch {
    return false;
  }
}

/**
 * Repair a workspace: recreate any missing standard directories and the
 * default config/schema files, without overwriting existing content.
 *
 * Backs `vale doctor --fix`. Because initializeWorkspace already skips files
 * that exist and only (re)creates what is missing, repair is just an
 * initialize pass — idempotent on a healthy workspace (created === []).
 */
export async function repairWorkspace(
  workspacePath: string,
  workspaceName?: string,
): Promise<ScaffoldResult> {
  return initializeWorkspace(workspacePath, workspaceName);
}
