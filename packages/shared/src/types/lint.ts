/** A single lint issue found in the workspace */
export interface LintIssue {
  filePath: string;
  line?: number;
  rule: string;
  severity: "error" | "warning" | "info";
  message: string;
}

/** Complete lint report for a workspace */
export interface LintReport {
  workspacePath: string;
  checkedFiles: number;
  issues: LintIssue[];
  summary: {
    errors: number;
    warnings: number;
    infos: number;
  };
}

/** Lint rule function signature */
export type LintRule = (
  workspacePath: string,
  notes: NoteInfo[],
) => Promise<LintIssue[]> | LintIssue[];

/** Note metadata collected for linting */
export interface NoteInfo {
  path: string;
  name: string;
  content: string;
  frontmatter: Record<string, unknown>;
}
