import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePdf } from "../src/ingest/parsers/pdf.js";

// PDF parsing must extract real text via pdfjs-dist (optional dep). Previously
// a stub that threw and was caught into a fake-success placeholder.

let dir: string;
let pdfPath: string;

// Build a minimal valid single-page PDF containing known text.
function buildPdf(text: string): Buffer {
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
  ];
  const stream = `BT /F1 24 Tf 72 700 Td (${text}) Tj ET`;
  objs.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  objs.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += String(off).padStart(10, "0") + " 00000 n \n";
  });
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "vale-pdf-"));
  pdfPath = join(dir, "doc.pdf");
  await writeFile(pdfPath, buildPdf("Hello Vale PDF Test"));
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("parsePdf", () => {
  test("extracts text content from a real PDF", async () => {
    const parsed = await parsePdf(pdfPath);
    expect(parsed.body).toContain("Hello Vale PDF");
    expect(parsed.checksum).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed.rawSize).toBeGreaterThan(0);
  });

  test("derives a title from the first content line", async () => {
    const parsed = await parsePdf(pdfPath);
    expect(parsed.title.length).toBeGreaterThan(0);
  });

  test("throws (not fake-success) on a non-PDF file", async () => {
    const bad = join(dir, "not.pdf");
    await writeFile(bad, "this is not a pdf at all");
    await expect(parsePdf(bad)).rejects.toThrow(/PDF text extraction failed/);
  });
});
