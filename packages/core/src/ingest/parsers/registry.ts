import type { DocumentParser, ParserRegistry } from "@vale/shared";

/**
 * Extensible parser registry.
 * Skills can register parsers for additional formats via the register() method.
 */
class ParserRegistryImpl implements ParserRegistry {
  private parsers = new Map<string, DocumentParser>();

  constructor() {
    // Built-in parsers are registered lazily on first use
  }

  register(extension: string, parser: DocumentParser): void {
    const ext = extension.startsWith(".") ? extension : `.${extension}`;
    this.parsers.set(ext.toLowerCase(), parser);
  }

  get(extension: string): DocumentParser | undefined {
    const ext = extension.toLowerCase();
    // Check cache
    if (this.parsers.has(ext)) return this.parsers.get(ext);

    // Lazy-load built-in parsers
    switch (ext) {
      case ".md":
      case ".txt":
        return this.lazyLoad("markdown");
      case ".html":
      case ".htm":
        return this.lazyLoad("html");
      case ".pdf":
        return this.lazyLoad("pdf");
      default:
        return undefined;
    }
  }

  supportedExtensions(): string[] {
    return Array.from(this.parsers.keys());
  }

  remove(extension: string): void {
    this.parsers.delete(extension.toLowerCase());
  }

  private lazyLoad(type: string): DocumentParser {
    // Dynamic import to avoid circular deps and reduce startup cost
    const parser: DocumentParser = async (filePath, options) => {
      switch (type) {
        case "markdown": {
          const { parseMarkdown } = await import("./markdown.js");
          return parseMarkdown(filePath);
        }
        case "html": {
          const { parseHtml } = await import("./html.js");
          return parseHtml(filePath);
        }
        case "pdf": {
          const { parsePdf } = await import("./pdf.js");
          return parsePdf(filePath);
        }
        default:
          throw new Error(`Unknown parser type: ${type}`);
      }
    };
    return parser;
  }
}

/** Singleton parser registry */
export const parserRegistry: ParserRegistry = new ParserRegistryImpl();
