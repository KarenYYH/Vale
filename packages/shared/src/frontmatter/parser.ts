import { parse as parseYaml, stringify as stringifyYaml } from "yaml";

/**
 * Parse YAML frontmatter from a Markdown document.
 *
 * This is the SINGLE canonical frontmatter parser for all of Vale.
 * Consolidated from three separate implementations in the old codebase.
 *
 * @param content - Raw Markdown file content
 * @returns Parsed frontmatter object and the body text
 */
export function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) {
    return { frontmatter: {}, body: content };
  }

  // Find the closing --- (must be at start of line, after the opening ---)
  const endMatch = trimmed.slice(3).match(/\n---\n?/);
  if (!endMatch || endMatch.index === undefined) {
    // Opening --- but no closing --- — treat whole thing as body
    return { frontmatter: {}, body: content };
  }

  const frontmatterRaw = trimmed.slice(3, endMatch.index! + 3);
  // Skip past the full closing delimiter (e.g. "\n---\n"), not a fixed 3 chars,
  // otherwise a stray "-" leaks into the body.
  const body = trimmed.slice(endMatch.index! + 3 + endMatch[0].length).trimStart();

  try {
    const parsed = parseYaml(frontmatterRaw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { frontmatter: parsed as Record<string, unknown>, body };
    }
    return { frontmatter: {}, body };
  } catch {
    return { frontmatter: {}, body };
  }
}

/**
 * Extract a title from a document — checks frontmatter first, then first heading, then filename.
 */
export function extractTitle(
  frontmatter: Record<string, unknown>,
  body: string,
  fallback?: string,
): string {
  // 1. Check frontmatter
  if (frontmatter.title && typeof frontmatter.title === "string") {
    return frontmatter.title;
  }

  // 2. Check first # heading
  const headingMatch = body.match(/^#\s+(.+)$/m);
  if (headingMatch) {
    return headingMatch[1].trim();
  }

  // 3. Fallback
  return fallback ?? "Untitled";
}

/**
 * Check if a string looks like valid frontmatter (starts with ---).
 */
export function hasFrontmatter(content: string): boolean {
  return content.trimStart().startsWith("---");
}

/**
 * Serialize a frontmatter object + body into a Markdown document, with the
 * frontmatter delimited by `---` fences. Values are serialized via the YAML
 * library (not string interpolation), so titles/tags containing quotes,
 * newlines, or `---` are safely escaped and cannot inject new keys (I3).
 */
export function serializeFrontmatter(
  frontmatter: Record<string, unknown>,
  body = "",
): string {
  // yaml.stringify always ends with a trailing newline.
  const yaml = stringifyYaml(frontmatter);
  return `---\n${yaml}---\n\n${body}`;
}
