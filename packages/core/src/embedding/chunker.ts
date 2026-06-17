/**
 * Paragraph-aware text chunker for embedding generation.
 *
 * Splits text into chunks of approximately maxChars, preferring to split at:
 *   1. Paragraph boundaries (double newlines)
 *   2. Sentence boundaries (。！？.!?)
 *   3. Word boundaries (whitespace)
 *
 * Supports both CJK and Latin punctuation.
 */
export function chunkText(text: string, maxChars = 1500): string[] {
  if (!text.trim()) return [];
  if (text.length <= maxChars) return [text.trim()];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\s*\n/);

  let current = "";

  for (const para of paragraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;

    if (current && (current.length + trimmed.length + 2 > maxChars)) {
      // Current chunk + new paragraph would overflow
      if (current.length > 0) {
        chunks.push(current.trim());
      }

      if (trimmed.length > maxChars) {
        // Single paragraph exceeds maxChars — split at sentence boundaries
        const subChunks = splitLongParagraph(trimmed, maxChars);
        const last = subChunks.pop();
        current = last ?? "";
        chunks.push(...subChunks);
      } else {
        current = trimmed;
      }
    } else {
      current = current
        ? current + "\n\n" + trimmed
        : trimmed;
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text.trim()];
}

/** Split an oversized paragraph at sentence boundaries */
function splitLongParagraph(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  // Supports both CJK and Latin sentence endings
  const sentences = text.split(/(?<=[。！？.!?])\s*/);
  let current = "";

  for (const sentence of sentences) {
    if (current && (current.length + sentence.length > maxChars)) {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
    } else {
      current += sentence;
    }

    // If still too long after merging, force-split at word boundaries
    if (current.length > maxChars) {
      const words = current.split(/\s+/);
      current = "";
      for (const word of words) {
        if (current && (current.length + word.length + 1 > maxChars)) {
          chunks.push(current.trim());
          current = word;
        } else {
          current = current ? current + " " + word : word;
        }
      }
    }
  }

  if (current.trim()) {
    chunks.push(current.trim());
  }

  return chunks.length > 0 ? chunks : [text];
}
