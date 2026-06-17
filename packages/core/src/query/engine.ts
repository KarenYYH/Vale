import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { QueryResult, SearchMatch } from "@vale/shared";
import { searchHybrid } from "./hybrid.js";
import { buildContext } from "./context-builder.js";

/**
 * Run a structured query against the knowledge base:
 *   1. Execute hybrid search (FTS + vector RRF)
 *   2. Assemble context from top results
 *   3. Return matches + assembled context for AI consumption
 */
export async function runQuery(
  workspacePath: string,
  question: string,
): Promise<QueryResult> {
  const matches = await searchHybrid(workspacePath, question);
  const context = await buildContext(workspacePath, matches);

  return {
    question,
    context,
    matches,
  };
}

/**
 * Save an AI-generated answer as a wiki page.
 */
export async function saveAnswer(
  workspacePath: string,
  question: string,
  answer: string,
): Promise<string> {
  const answersDir = join(workspacePath, "wiki", "answers");
  await mkdir(answersDir, { recursive: true });

  // Generate a URL-safe slug from the question
  const slug = question
    .replace(/[^a-zA-Z0-9一-鿿\s_-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80) || "answer";

  const timestamp = new Date().toISOString();
  const content = `---
title: "${question}"
created: ${timestamp.split("T")[0]}
tags: [answer]
---

# ${question}

${answer}
`;

  const filePath = join(answersDir, `${slug}.md`);
  await writeFile(filePath, content, "utf-8");
  return filePath;
}

/**
 * Basic search across the workspace. Uses FTS5 primarily.
 * For advanced needs, use searchHybrid() directly.
 */
export async function searchWorkspace(
  workspacePath: string,
  query: string,
): Promise<SearchMatch[]> {
  return searchHybrid(workspacePath, query);
}
