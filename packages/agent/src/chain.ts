import type { ValeConfigParsed } from "@vale/shared";
import type { AnswerEngine, AnswerResult } from "./types.js";
import { SpawnCliEngine } from "./spawn.js";
import { ApiLlmEngine, RetrievalEngine } from "./engines.js";
import { detect } from "./provider.js";

export interface ChainOptions {
  workspacePath: string;
  config: ValeConfigParsed;
  /** Resolved API key (read from keychain/env by caller, never stored here) */
  apiKey?: string;
  /** URL of Vale's own MCP HTTP transport for spawn-cli to connect back */
  mcpHttpUrl?: string;
}

/**
 * Build the answer-engine chain based on config.agent.engine:
 *   "auto"     → probe and pick the highest available tier
 *   "claude"   → force spawn-cli with claude
 *   "codex"    → force spawn-cli with codex
 *   "api"      → force api-llm
 *   "none"     → retrieval only
 */
export async function buildAnswerChain(opts: ChainOptions): Promise<AnswerEngine> {
  const { config, workspacePath, apiKey, mcpHttpUrl } = opts;
  const engine = config.agent.engine;

  if (engine === "none") return new RetrievalEngine();

  if (engine === "api") {
    return buildApiEngine(config, apiKey) ?? new RetrievalEngine();
  }

  if (engine === "claude" || engine === "codex") {
    // Explicitly chosen: use the detected CLI with whatever auth it has — an
    // API key if provided, otherwise the CLI's own login (OAuth/subscription).
    const info = await detect(engine);
    if (info) {
      return new SpawnCliEngine(info, { apiKey, mcpHttpUrl, workspacePath });
    }
    return new RetrievalEngine();
  }

  // "auto" — highest available tier wins
  // Try tier 2b: spawn-cli
  if (apiKey) {
    const preferred = config.agent.preferredCli;
    const info = await detect(preferred);
    if (info) {
      return new SpawnCliEngine(info, { apiKey, mcpHttpUrl, workspacePath });
    }
  }

  // Try tier 1: api-llm
  const apiEngine = buildApiEngine(config, apiKey);
  if (apiEngine && await apiEngine.available()) return apiEngine;

  // Tier 0: retrieval (always works)
  return new RetrievalEngine();
}

function buildApiEngine(
  config: ValeConfigParsed,
  apiKey?: string,
): ApiLlmEngine | null {
  const { apiEndpoint, apiModel } = config.agent;
  const key = apiKey ?? process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiEndpoint || !apiModel || !key) return null;
  return new ApiLlmEngine({ apiEndpoint, apiModel, apiKey: key });
}
