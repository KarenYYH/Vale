import { readFile } from "fs/promises";
import type { WikiLink, LinkIndex } from "@vale/shared";
import { collectMarkdownFiles } from "../fs/utils.js";

/** Regex for [[wikilink]] parsing: captures [[Target]], [[Target|alias]], [[Target#heading]] */
const WIKILINK_RE = /\[\[([^\]|#]+)(?:[|#][^\]]+)?\]\]/g;

/**
 * Parse wikilinks from a file's content.
 */
export function parseLinks(
  filePath: string,
  content: string,
): WikiLink[] {
  const links: WikiLink[] = [];
  let match: RegExpExecArray | null;

  // Track line numbers
  const lines = content.split("\n");
  for (let line = 0; line < lines.length; line++) {
    WIKILINK_RE.lastIndex = 0;
    while ((match = WIKILINK_RE.exec(lines[line])) !== null) {
      links.push({
        from: filePath,
        to: match[1].trim(),
        line: line + 1,
        raw: match[0],
      });
    }
  }

  return links;
}

/**
 * Build a bidirectional link index for the entire workspace.
 * This is an expensive operation — use IncrementalLinkCache for repeated access.
 */
export async function buildLinkIndex(
  workspacePath: string,
): Promise<LinkIndex> {
  const outgoing = new Map<string, WikiLink[]>();
  const incoming = new Map<string, WikiLink[]>();

  const files = await collectMarkdownFiles(workspacePath);

  for (const filePath of files) {
    try {
      const content = await readFile(filePath, "utf-8");
      const links = parseLinks(filePath, content);
      outgoing.set(filePath, links);

      for (const link of links) {
        const existing = incoming.get(link.to) ?? [];
        existing.push(link);
        incoming.set(link.to, existing);
      }
    } catch {
      // Skip unreadable files
    }
  }

  return { outgoing, incoming };
}

/**
 * Find pages with zero incoming links (orphans).
 */
export function findOrphanedPages(linkIndex: LinkIndex): string[] {
  const orphans: string[] = [];

  for (const [filePath, links] of linkIndex.outgoing) {
    if (!linkIndex.incoming.has(filePath) || linkIndex.incoming.get(filePath)!.length === 0) {
      // Skip known entry points
      const name = filePath.split("/").pop() ?? "";
      if (
        name === "index.md" ||
        name === "log.md" ||
        filePath.includes("/answers/") ||
        filePath.includes("/.vale/") ||
        filePath === "CLAUDE.md"
      ) continue;
      orphans.push(filePath);
    }
  }

  return orphans;
}

/**
 * Find wikilinks pointing to non-existent pages.
 */
export function findBrokenLinks(linkIndex: LinkIndex): WikiLink[] {
  const broken: WikiLink[] = [];
  const allPages = new Set(linkIndex.outgoing.keys());

  for (const links of linkIndex.outgoing.values()) {
    for (const link of links) {
      // Check if any file path ends with the target name
      const exists = [...allPages].some(
        (p) => p === link.to || p.endsWith("/" + link.to) || p.endsWith("/" + link.to + ".md"),
      );
      if (!exists) {
        broken.push(link);
      }
    }
  }

  return broken;
}
