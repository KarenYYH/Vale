// ── Answer engine abstraction ──

export type AnswerTier = "spawn-cli" | "api-llm" | "retrieval";

export interface AnswerResult {
  answer: string;
  tier: AnswerTier;
  /** Source matches from runQuery */
  matches?: unknown[];
  answerPath?: string;
}

export interface AnswerEngine {
  tier: AnswerTier;
  available(): Promise<boolean>;
  answer(question: string, workspacePath: string): Promise<AnswerResult>;
}

// ── Agent CLI detection ──

export interface AgentInfo {
  cli: "claude" | "codex";
  binPath: string;
  version: string;
}

export interface UpdateInfo {
  current: string;
  latest: string;
  hasUpdate: boolean;
}
