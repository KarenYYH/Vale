import { readFile } from "fs/promises";
import { createHash } from "crypto";
import { basename } from "path";
import { writeFile, mkdir } from "fs/promises";
import { join, extname, dirname } from "path";
import { parseFrontmatter, extractTitle, serializeFrontmatter } from "@vale/shared";
import type { ParsedDocument } from "@vale/shared";

/**
 * Parse a Markdown file, extracting frontmatter and computing a checksum.
 */
export async function parseMarkdown(filePath: string): Promise<ParsedDocument> {
  const content = await readFile(filePath, "utf-8");
  const { frontmatter, body } = parseFrontmatter(content);
  const title = extractTitle(
    frontmatter,
    body,
    basename(filePath, extname(filePath)),
  );
  const checksum = createHash("sha256").update(content).digest("hex");

  return {
    frontmatter,
    body,
    title,
    rawSize: Buffer.byteLength(content, "utf-8"),
    checksum,
  };
}

/**
 * Write a parsed document as a wiki page in wiki/concepts/.
 */
export async function writeWikiPage(
  workspacePath: string,
  parsed: ParsedDocument,
  sourceFileName: string,
): Promise<string> {
  const slug = sourceFileName
    .replace(/\.[^.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9一-鿿㐀-䶿_-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80) || "untitled";

  const wikiPath = join(workspacePath, "wiki", "concepts", `${slug}.md`);

  // Reconstruct the document. Reuse the canonical YAML serializer so values
  // are safely escaped (no injection) and preserved across types — and create
  // the target directory, since the workspace may not have been scaffolded.
  const fm = parsed.frontmatter;
  const content =
    Object.keys(fm).length > 0
      ? serializeFrontmatter(fm, parsed.body)
      : parsed.body;

  await mkdir(dirname(wikiPath), { recursive: true });
  await writeFile(wikiPath, content, "utf-8");
  return wikiPath;
}
