import type { LintIssue, NoteInfo } from "@vale/shared";
import { buildLinkIndex, findBrokenLinks } from "../../linker/parser.js";

export async function checkBrokenLinks(
  workspacePath: string,
  _notes: NoteInfo[],
): Promise<LintIssue[]> {
  const linkIndex = await buildLinkIndex(workspacePath);
  const broken = findBrokenLinks(linkIndex);

  return broken.map((link) => ({
    filePath: link.from,
    line: link.line,
    rule: "broken-links",
    severity: "error" as const,
    message: `Broken wikilink: [[${link.to}]] — target page does not exist`,
  }));
}
