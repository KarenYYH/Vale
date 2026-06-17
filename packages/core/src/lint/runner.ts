import { readFile } from "fs/promises";
import type { LintIssue, LintReport, LintRule, NoteInfo } from "@vale/shared";
import { parseFrontmatter } from "@vale/shared";
import { collectMarkdownFiles } from "../fs/utils.js";
import { checkBrokenLinks } from "./rules/broken-links.js";
import { checkOrphans } from "./rules/orphans.js";
import { checkFrontmatter } from "./rules/frontmatter.js";
import { checkTags } from "./rules/tags.js";

/** Built-in lint rule registry */
const builtinRules: Record<string, LintRule> = {
  "broken-links": checkBrokenLinks,
  orphans: checkOrphans,
  frontmatter: checkFrontmatter,
  tags: checkTags,
};

/**
 * Collect all notes in the workspace for linting.
 */
async function collectNotes(workspacePath: string): Promise<NoteInfo[]> {
  const files = await collectMarkdownFiles(workspacePath);
  const notes: NoteInfo[] = [];

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const { frontmatter } = parseFrontmatter(content);
      notes.push({
        path: filePath,
        name: filePath.split("/").pop() ?? filePath,
        content,
        frontmatter,
      });
    } catch {
      // Skip unreadable files
    }
  }

  return notes;
}

/**
 * Run all lint rules against the workspace.
 */
export async function runLint(
  workspacePath: string,
  enabledRules?: string[],
): Promise<LintReport> {
  const notes = await collectNotes(workspacePath);
  const rules = enabledRules ?? Object.keys(builtinRules);
  const allIssues: LintIssue[] = [];

  for (const ruleName of rules) {
    const rule = builtinRules[ruleName];
    if (!rule) continue;

    try {
      const issues = await rule(workspacePath, notes);
      allIssues.push(...issues);
    } catch {
      // One rule failing should not block others
    }
  }

  const summary = {
    errors: allIssues.filter((i) => i.severity === "error").length,
    warnings: allIssues.filter((i) => i.severity === "warning").length,
    infos: allIssues.filter((i) => i.severity === "info").length,
  };

  return {
    workspacePath,
    checkedFiles: notes.length,
    issues: allIssues,
    summary,
  };
}

/**
 * Format a lint report as Markdown.
 */
export function formatLintReport(report: LintReport): string {
  const lines: string[] = [
    `# Lint Report`,
    ``,
    `**Workspace:** ${report.workspacePath}`,
    `**Files checked:** ${report.checkedFiles}`,
    ``,
    `| Severity | Count |`,
    `|----------|-------|`,
    `| 🔴 Error   | ${report.summary.errors} |`,
    `| 🟡 Warning | ${report.summary.warnings} |`,
    `| 🔵 Info    | ${report.summary.infos} |`,
    ``,
  ];

  if (report.issues.length === 0) {
    lines.push("✅ No issues found!");
    return lines.join("\n");
  }

  lines.push("## Issues");
  lines.push("");

  for (const issue of report.issues) {
    const emoji =
      issue.severity === "error"
        ? "🔴"
        : issue.severity === "warning"
          ? "🟡"
          : "🔵";
    lines.push(
      `- ${emoji} **${issue.filePath}**${issue.line ? ` (line ${issue.line})` : ""} — ${issue.message} *[${issue.rule}]*`,
    );
  }

  return lines.join("\n");
}
