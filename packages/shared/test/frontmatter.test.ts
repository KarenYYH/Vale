import { describe, test, expect } from "vitest";
import { serializeFrontmatter, parseFrontmatter } from "../src/index.js";

// I3: frontmatter must be serialized safely. Interpolating untrusted values
// (title, tags) directly into a YAML string allows injection — a title
// containing a quote, newline, or "---" can break or inject frontmatter.

describe("serializeFrontmatter (I3)", () => {
  test("escapes a title containing double quotes", () => {
    const doc = serializeFrontmatter({ title: 'He said "hi"' }, "body");
    const { frontmatter, body } = parseFrontmatter(doc);
    expect(frontmatter.title).toBe('He said "hi"');
    expect(body).toBe("body");
  });

  test("neutralizes a title containing a frontmatter delimiter", () => {
    const malicious = 'x\n---\ninjected: true\n# pwned';
    const doc = serializeFrontmatter({ title: malicious }, "body");
    const { frontmatter } = parseFrontmatter(doc);
    // The whole malicious string must round-trip as the title value,
    // not leak into a new top-level key.
    expect(frontmatter.title).toBe(malicious);
    expect(frontmatter.injected).toBeUndefined();
  });

  test("serializes tags as a proper list that round-trips", () => {
    const doc = serializeFrontmatter(
      { title: "t", tags: ["a", "b, c", 'd"e'] },
      "body",
    );
    const { frontmatter } = parseFrontmatter(doc);
    expect(frontmatter.tags).toEqual(["a", "b, c", 'd"e']);
  });

  test("produces a document that starts and ends frontmatter correctly", () => {
    const doc = serializeFrontmatter({ title: "t" }, "# Hello\n");
    expect(doc.startsWith("---\n")).toBe(true);
    const { body } = parseFrontmatter(doc);
    expect(body).toBe("# Hello\n");
  });
});
