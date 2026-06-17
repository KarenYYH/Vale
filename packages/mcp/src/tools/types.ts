import type { ValeMcpContext } from "../server.js";

export type { ValeMcpContext };

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (input: Record<string, unknown>, ctx: ValeMcpContext) => Promise<{
    content: Array<{ type: "text"; text: string }>;
    isError?: boolean;
    _meta?: Record<string, unknown>;
  }>;
}

export function ok(text: string, meta?: Record<string, unknown>) {
  return {
    content: [{ type: "text" as const, text }],
    ...(meta ? { _meta: meta } : {}),
  };
}

export function err(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true,
  };
}
