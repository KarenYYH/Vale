import type { LintIssue, NoteInfo } from "@vale/shared";
import { buildLinkIndex, findOrphanedPages } from "../../linker/parser.js";

export async function checkOrphans(
  workspacePath: string,
  _notes: NoteInfo[],
): Promise<LintIssue[]> {
  const linkIndex = await buildLinkIndex(workspacePath);
  const orphans = findOrphanedPages(linkIndex);

  return orphans.map((filePath) => ({
    filePath,
    rule: "orphans",
    severity: "warning" as const,
    message: "Orphaned page: no other pages link to this note",
  }));
}
