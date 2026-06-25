import { readFile } from "fs/promises";
import { createHash } from "crypto";
import { basename } from "path";
import type { ParsedDocument } from "@vale/shared";

/**
 * Parse a PDF file, extracting text content via pdfjs-dist.
 *
 * Requires the optional `pdfjs-dist` dependency. If extraction fails (missing
 * dependency or unreadable PDF), this throws so the ingest pipeline records a
 * failed result rather than silently storing an empty placeholder.
 */
export async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);
  const checksum = createHash("sha256").update(buffer).digest("hex");

  let title = basename(filePath, ".pdf");

  let text: string;
  try {
    text = await extractPdfText(buffer);
  } catch (e) {
    throw new Error(
      `PDF text extraction failed for ${basename(filePath)}: ${(e as Error).message}. ` +
        `Ensure the optional 'pdfjs-dist' dependency is installed.`,
    );
  }

  // Find a title: first line that looks like one.
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length > 0) {
    const first = lines[0].trim();
    if (first.length > 3 && first.length < 200 && !first.endsWith(".")) {
      title = first;
    }
  }

  return {
    frontmatter: { title, source: filePath },
    body: text,
    title,
    rawSize: buffer.length,
    checksum,
  };
}

/**
 * Extract text from a PDF buffer using pdfjs-dist (an optional dependency).
 * Throws if pdfjs-dist is not installed or extraction fails; the caller
 * (parsePdf) degrades gracefully.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  // pdfjs-dist is an optional dependency — import lazily.
  // @ts-ignore — optional dependency, types may be absent
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const getDocument = pdfjs.getDocument as (
    src: { data: Uint8Array },
  ) => { promise: Promise<PdfDocument> };

  // Copy into a fresh Uint8Array (pdfjs may detach the buffer).
  const data = new Uint8Array(buffer);
  const doc = await getDocument({ data }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(text);
  }
  return pages.join("\n").trim();
}

/** Minimal structural types for the pdfjs-dist surface we use. */
interface PdfDocument {
  numPages: number;
  getPage(n: number): Promise<PdfPage>;
}
interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
}
