import { z } from "zod";
import type { Middleware } from "./chain.js";
import { err } from "../tools/types.js";

/**
 * Middleware: validate tool input against its Zod schema.
 */
export const validateInput: Middleware = async (tool, input, ctx, next) => {
  try {
    // If the tool defines a Zod schema, validate input
    const schema = (tool as unknown as { inputSchema?: z.ZodType }).inputSchema;
    if (schema && schema instanceof z.ZodType) {
      const parsed = schema.parse(input);
      return next(parsed as Record<string, unknown>);
    }
    return next(input);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const issues = e.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      return err(`Invalid input for tool "${tool.name}":\n${issues}`);
    }
    return err(`Validation error: ${(e as Error).message}`);
  }
};
