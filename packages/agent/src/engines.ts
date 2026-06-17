import { runQuery, saveAnswer } from "@vale/core";
import type { AnswerEngine, AnswerResult } from "./types.js";

/**
 * Tier-1: single-turn model call via any OpenAI-compatible API.
 * runQuery assembles context, then we POST to the model endpoint.
 */
export class ApiLlmEngine implements AnswerEngine {
  readonly tier = "api-llm" as const;

  constructor(
    private readonly opts: {
      apiEndpoint: string;
      apiModel: string;
      apiKey: string;
    },
  ) {}

  async available(): Promise<boolean> {
    return !!(this.opts.apiKey && this.opts.apiEndpoint && this.opts.apiModel);
  }

  async answer(question: string, workspacePath: string): Promise<AnswerResult> {
    const { context, matches } = await runQuery(workspacePath, question);

    const systemPrompt =
      "You are a helpful assistant. Answer using only the knowledge base context provided. " +
      "Cite sources with [[wikilink]] notation where relevant. Be concise and accurate.";

    const userPrompt = `Context from knowledge base:\n\n${context}\n\nQuestion: ${question}`;

    const response = await fetch(`${this.opts.apiEndpoint}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.opts.apiKey}`,
      },
      body: JSON.stringify({
        model: this.opts.apiModel,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2048,
      }),
    });

    if (!response.ok) {
      throw new Error(`LLM API error ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const answer = data.choices?.[0]?.message?.content ?? "";
    const answerPath = await saveAnswer(workspacePath, question, answer);
    return { answer, tier: "api-llm", matches, answerPath };
  }
}

/**
 * Tier-0: retrieval only — returns assembled context without model generation.
 * Always available, never fails.
 */
export class RetrievalEngine implements AnswerEngine {
  readonly tier = "retrieval" as const;

  async available(): Promise<boolean> {
    return true;
  }

  async answer(question: string, workspacePath: string): Promise<AnswerResult> {
    const { context, matches } = await runQuery(workspacePath, question);
    return { answer: context, tier: "retrieval", matches };
  }
}
