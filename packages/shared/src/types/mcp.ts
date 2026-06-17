import type { ValeConfig } from "./config.js";

/** Context injected into every MCP tool handler */
export interface ValeMcpContext {
  /** Absolute path to the workspace root */
  workspacePath: string;
  /** Loaded workspace configuration */
  config: ValeConfig;
}

/** Standard MCP tool call result */
export interface CallToolResult {
  content: Array<{
    type: "text";
    text: string;
  }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/** Helper: create a success result */
export function ok(text: string, meta?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text }],
    ...(meta ? { _meta: meta } : {}),
  };
}

/** Helper: create an error result */
export function err(message: string, meta?: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
    ...(meta ? { _meta: meta } : {}),
  };
}

/** Vale permissions */
export type ValePermission =
  | "read:wiki"
  | "read:raw"
  | "read:zettel"
  | "write:wiki"
  | "write:raw"
  | "ai:query"
  | "ai:embedding"
  | "ai:ingest"
  | "skill:execute"
  | "network";

/** All high-risk permissions (trigger user confirmation) */
export const HIGH_RISK_PERMISSIONS: ValePermission[] = [
  "write:wiki",
  "write:raw",
  "network",
];

export function isHighRisk(permissions: ValePermission[]): boolean {
  return permissions.some((p) => HIGH_RISK_PERMISSIONS.includes(p));
}

/** MCP transport mode */
export type McpTransportMode = "stdio" | "http";
