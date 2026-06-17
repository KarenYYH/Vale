import type { LintIssue, NoteInfo } from "@vale/shared";
import { parseFrontmatter } from "@vale/shared";

export function checkTags(
  _workspacePath: string,
  notes: NoteInfo[],
): LintIssue[] {
  const issues: LintIssue[] = [];

  for (const note of notes) {
    if (
      note.path.startsWith(".vale/") ||
      note.path === "CLAUDE.md" ||
      note.path.endsWith("index.md") ||
      note.path.endsWith("log.md") ||
      note.path.includes("/answers/")
    ) {
      continue;
    }

    const { frontmatter } = parseFrontmatter(note.content);

    if (!frontmatter.tags) {
      issues.push({
        filePath: note.path,
        rule: "tags",
        severity: "info",
        message: "Note has no tags — tagging improves discoverability",
      });
    }
  }

  return issues;
}
