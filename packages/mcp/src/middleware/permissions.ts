import type { Middleware } from "./chain.js";

/** Tool-to-permission mapping */
const TOOL_PERMISSIONS: Record<string, string[]> = {
  search_wiki: ["read:wiki"],
  search_semantic: ["read:wiki", "ai:embedding"],
  search_hybrid: ["read:wiki", "ai:embedding"],
  run_query: ["read:wiki", "ai:query"],
  run_ingest: ["write:wiki", "ai:ingest"],
  run_lint: ["read:wiki"],
  get_graph: ["read:wiki"],
  get_schema: ["read:wiki"],
  get_health: ["read:wiki"],
  link_notes: ["write:wiki"],
  create_note: ["write:wiki"],
  list_skills: [],
  run_skill: ["skill:execute"],
};

/** Tools that require explicit user confirmation */
const HIGH_RISK_TOOLS = new Set([
  "run_ingest",
  "link_notes",
  "create_note",
  "run_skill",
]);

/**
 * Middleware: check permissions for the tool being called.
 * High-risk tools are identified for the caller to handle permission prompts.
 */
export const permissionsCheck: Middleware = async (tool, input, ctx, next) => {
  const permissions = TOOL_PERMISSIONS[tool.name] ?? [];
  const isHighRisk = HIGH_RISK_TOOLS.has(tool.name);

  // Attach permission metadata to the context for the transport layer to use
  (ctx as unknown as Record<string, unknown>)._toolPermissions = permissions;
  (ctx as unknown as Record<string, unknown>)._toolIsHighRisk = isHighRisk;

  // Permission gating is handled by the transport layer (e.g., Claude Code's canUseTool)
  // This middleware just annotates the context
  return next(input);
};
