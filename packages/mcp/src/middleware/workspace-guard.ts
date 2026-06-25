import { isWorkspaceInitialized } from "@vale/core";
import type { Middleware } from "./chain.js";
import { err } from "../tools/types.js";

/** Tools permitted to run before the workspace is initialized. */
const INIT_SAFE_TOOLS = new Set(["get_schema"]);

/**
 * Middleware: ensure the workspace exists and is initialized.
 * Tools in INIT_SAFE_TOOLS (e.g. get_schema) are allowed through so clients
 * can introspect before `vale init`; everything else is blocked until ready.
 */
export const workspaceGuard: Middleware = async (tool, input, ctx, next) => {
  const initialized = await isWorkspaceInitialized(ctx.workspacePath);
  if (!initialized) {
    if (INIT_SAFE_TOOLS.has(tool.name)) {
      return next(input);
    }
    return err(
      `Workspace at ${ctx.workspacePath} is not initialized. Run \`vale init\` first.`,
    );
  }
  return next(input);
};
