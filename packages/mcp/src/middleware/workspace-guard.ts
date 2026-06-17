import { isWorkspaceInitialized } from "@vale/core";
import type { Middleware } from "./chain.js";
import { err } from "../tools/types.js";

/**
 * Middleware: ensure the workspace exists and is initialized.
 * Returns an error if the workspace is not ready.
 */
export const workspaceGuard: Middleware = async (_tool, input, ctx, next) => {
  const initialized = await isWorkspaceInitialized(ctx.workspacePath);
  if (!initialized) {
    // Allow vale init-like tools to proceed
    const allowedTools = ["get_schema"]; // These may run during init
    // For now, strictly guard all tools
    return err(
      `Workspace at ${ctx.workspacePath} is not initialized. Run \`vale init\` first.`,
    );
  }
  return next(input);
};
