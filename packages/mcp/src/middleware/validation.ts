import { z } from "zod";
import type { Middleware } from "./chain.js";
import { err } from "../tools/types.js";

/**
 * Middleware: validate tool input against its Zod schema.
 *
 * Tools declare `inputSchema` as a plain Zod *shape* (Record<field, ZodType>),
 * mirroring how mount.ts builds the JSON schema. We wrap it in z.object() so
 * that min/max/enum/type constraints are actually enforced and defaults are
 * applied. (A previous `instanceof z.ZodType` check never matched a shape, so
 * all validation was silently skipped — see C4.)
 */
export const validateInput: Middleware = async (tool, input, ctx, next) => {
  try {
    const raw = (tool as unknown as { inputSchema?: unknown }).inputSchema;

    // Already a ZodType (e.g. a pre-built z.object) — use directly.
    if (raw instanceof z.ZodType) {
      return next(raw.parse(input) as Record<string, unknown>);
    }

    // A Zod shape: a non-empty plain object whose values are ZodTypes.
    if (raw && typeof raw === "object") {
      const shape = raw as Record<string, unknown>;
      const keys = Object.keys(shape);
      if (keys.length > 0 && keys.every((k) => shape[k] instanceof z.ZodType)) {
        const parsed = z.object(shape as z.ZodRawShape).parse(input);
        return next(parsed as Record<string, unknown>);
      }
    }

    // No usable schema — pass through unchanged.
    return next(input);
  } catch (e) {
    if (e instanceof z.ZodError) {
      const issues = e.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
      return err(`Invalid input for tool "${tool.name}":\n${issues}`);
    }
    return err(`Validation error: ${(e as Error).message}`);
  }
};
