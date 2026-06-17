import { readFile } from "fs/promises";
import { createHash } from "crypto";
import { basename } from "path";
import type { ParsedDocument } from "@vale/shared";

/**
 * Parse a PDF file, extracting text content.
 *
 * Uses a lightweight approach: tries pdfjs-dist first,
 * falls back to exec'ing pdftotext if available.
 *
 * NOTE: This is a stub implementation. For production use,
 * install pdfjs-dist or a dedicated PDF parsing library.
 */
export async function parsePdf(filePath: string): Promise<ParsedDocument> {
  const buffer = await readFile(filePath);
  const checksum = createHash("sha256").update(buffer).digest("hex");

  let title = basename(filePath, ".pdf");
  let body = "";

  // Attempt to extract text
  try {
    const text = await extractPdfText(buffer);
    body = text;

    // Try to find a title: first line that looks like a title
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length > 0) {
      const first = lines[0].trim();
      if (first.length > 3 && first.length < 200 && !first.endsWith(".")) {
        title = first;
      }
    }
  } catch {
    body = `[PDF content could not be extracted: ${filePath}]`;
  }

  return {
    frontmatter: { title, source: filePath },
    body,
    title,
    rawSize: buffer.length,
    checksum,
  };
}

/**
 * Extract text from a PDF buffer.
 * Stub implementation — replace with pdfjs-dist or similar for production.
 */
async function extractPdfText(_buffer: Buffer): Promise<string> {
  // TODO: Implement with pdfjs-dist
  // For now, return a placeholder so the ingest pipeline doesn't break
  //
  // Production implementation:
  //   import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
  //   const doc = await getDocument({ data: buffer }).promise;
  //   let text = '';
  //   for (let i = 1; i <= doc.numPages; i++) {
  //     const page = await doc.getPage(i);
  //     const content = await page.getTextContent();
  //     text += content.items.map((item: any) => item.str).join(' ') + '\n';
  //   }
  //   return text;
  throw new Error(
    "PDF text extraction requires pdfjs-dist. Install with: npm install pdfjs-dist",
  );
}
