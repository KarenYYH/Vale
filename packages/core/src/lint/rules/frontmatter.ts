import type { LintIssue, NoteInfo } from "@vale/shared";
import { parseFrontmatter } from "@vale/shared";

export function checkFrontmatter(
  _workspacePath: string,
  notes: NoteInfo[],
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const note of notes) {
    // Skip system files
    if (
      note.path.startsWith(".vale/") ||
      note.path === "CLAUDE.md"
    ) {
      continue;
    }

    const { frontmatter } = parseFrontmatter(note.content);

    if (Object.keys(frontmatter).length === 0) {
      issues.push({
        filePath: note.path,
        rule: "frontmatter",
        severity: "warning",
        message: "Missing YAML frontmatter. Consider adding title and tags.",
      });
      continue;
    }

    if (!frontmatter.title) {
      issues.push({
        filePath: note.path,
        rule: "frontmatter",
        severity: "warning",
        message: 'Missing "title" field in frontmatter',
      });
    }

    if (!frontmatter.tags) {
      issues.push({
        filePath: note.path,
        rule: "frontmatter",
        severity: "info",
        message: 'Missing "tags" field in frontmatter',
      });
    }
  }

  return issues;
}
