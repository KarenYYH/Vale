import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { valeConfigSchema, type ValeConfigParsed } from "./schema.js";

export { valeConfigSchema };
export type { ValeConfigParsed };

/**
 * Default configuration values.
 * Used as the base when no config file is present.
 */
export const DEFAULT_CONFIG: ValeConfigParsed = valeConfigSchema.parse({
  version: "2.0",
});

/**
 * Merge partial user config with defaults.
 * User values override defaults; arrays are replaced, not merged.
 */
export function mergeConfig(
  defaults: ValeConfigParsed,
  overrides: Record<string, unknown>,
): ValeConfigParsed {
  // Use Zod parsing to validate and merge — Zod .default() fills in missing fields
  return valeConfigSchema.parse({
    ...defaults,
    ...overrides,
  });
}

/**
 * Load vale.config.json from a workspace directory, merged with defaults.
 * Returns DEFAULT_CONFIG if the file is missing or invalid.
 */
export async function loadConfig(workspacePath: string): Promise<ValeConfigParsed> {
  try {
    const raw = await readFile(join(workspacePath, "vale.config.json"), "utf-8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return mergeConfig(DEFAULT_CONFIG, parsed);
  } catch {
    return DEFAULT_CONFIG;
  }
}
