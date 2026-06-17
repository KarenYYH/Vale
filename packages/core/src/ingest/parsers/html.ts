import { readFile } from "fs/promises";
import { createHash } from "crypto";
import { basename } from "path";
import type { ParsedDocument } from "@vale/shared";

/**
 * Parse an HTML file, extracting title and body text.
 */
export async function parseHtml(filePath: string): Promise<ParsedDocument> {
  const content = await readFile(filePath, "utf-8");

  // Extract title
  let title = basename(filePath, ".html");
  const titleMatch =
    content.match(/<title[^>]*>([\s\S]*?)<\/title>/i) ??
    content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (titleMatch) {
    title = titleMatch[1].replace(/<[^>]+>/g, "").trim();
  }

  // Strip HTML tags
  let body = content
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  const checksum = createHash("sha256").update(content).digest("hex");

  return {
    frontmatter: { title },
    body,
    title,
    rawSize: Buffer.byteLength(content, "utf-8"),
    checksum,
  };
}
