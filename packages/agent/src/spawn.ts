import { spawn } from "node:child_process";
import { runQuery, saveAnswer } from "@vale/core";
import type { AnswerEngine, AnswerResult, AgentInfo } from "./types.js";

const DEFAULT_TIMEOUT_MS = 120_000; // 2 min

/**
 * Build the spawn environment for a CLI agent, injecting ONLY the API-key
 * env var for that agent's own provider (I1). A claude process must never
 * receive an OpenAI key and vice versa; any foreign provider key inherited
 * from the base env is also stripped to avoid leaking it to the child.
 */
export function buildAgentEnv(
  cli: AgentInfo["cli"],
  apiKey: string | undefined,
  baseEnv: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv };
  // Strip both provider keys first so a stale/foreign key never leaks to the
  // child process.
  delete env.ANTHROPIC_API_KEY;
  delete env.OPENAI_API_KEY;
  // Only inject when we actually have a key. With no key, the CLI falls back to
  // its own login (OAuth/subscription) — injecting an empty value would break it.
  if (apiKey) {
    if (cli === "claude") {
      env.ANTHROPIC_API_KEY = apiKey;
    } else {
      env.OPENAI_API_KEY = apiKey;
    }
  }
  return env;
}

/**
 * Tier-2b: spawn claude/codex headless, inject MCP config pointing at
 * Vale's own HTTP MCP transport so the agent can call all 13 tools.
 */
export class SpawnCliEngine implements AnswerEngine {
  readonly tier = "spawn-cli" as const;

  constructor(
    private readonly agentInfo: AgentInfo,
    private readonly opts: {
      apiKey?: string;       // optional — CLI may use its own login (OAuth/subscription)
      mcpHttpUrl?: string;   // e.g. "http://127.0.0.1:4568/mcp"
      timeoutMs?: number;
      workspacePath: string;
    },
  ) {}

  async available(): Promise<boolean> {
    return true; // already probed at construction
  }

  async answer(question: string, workspacePath: string): Promise<AnswerResult> {
    const { agentInfo, opts } = this;
    const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    // Build MCP server config for the spawned agent
    const mcpConfig = opts.mcpHttpUrl
      ? JSON.stringify({
          mcpServers: {
            vale: { url: opts.mcpHttpUrl },
          },
        })
      : undefined;

    const cliArgs: string[] = ["-p", question, "--output-format", "json"];
    if (mcpConfig) {
      cliArgs.push("--mcp-config", mcpConfig);
    }

    const env = buildAgentEnv(
      agentInfo.cli,
      opts.apiKey,
      process.env,
    );

    return new Promise<AnswerResult>((resolve, reject) => {
      let stdout = "";
      let stderr = "";

      const proc = spawn(agentInfo.binPath, cliArgs, {
        cwd: workspacePath,
        env,
        timeout: timeoutMs,
      });

      proc.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
      proc.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Agent timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      proc.on("close", async (code) => {
        clearTimeout(timer);
        if (code !== 0 && !stdout) {
          reject(new Error(`Agent exited ${code}: ${stderr.slice(0, 300)}`));
          return;
        }
        try {
          const answer = extractAnswer(stdout);
          const answerPath = await saveAnswer(workspacePath, question, answer);
          resolve({ answer, tier: "spawn-cli", answerPath });
        } catch {
          resolve({ answer: stdout.trim() || stderr.trim(), tier: "spawn-cli" });
        }
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }
}

function extractAnswer(raw: string): string {
  // Claude Code --output-format json emits a JSON object per line (NDJSON)
  // We want the last "result" or "assistant" message text
  const lines = raw.trim().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]) as Record<string, unknown>;
      if (typeof obj.result === "string") return obj.result;
      if (typeof obj.content === "string") return obj.content;
      if (Array.isArray(obj.content)) {
        const text = (obj.content as Array<{ type: string; text?: string }>)
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("\n");
        if (text) return text;
      }
    } catch {
      // not JSON, keep looking
    }
  }
  return raw.trim();
}
