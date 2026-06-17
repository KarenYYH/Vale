import type { LinkIndex } from "@vale/shared";
import { buildLinkIndex } from "./parser.js";

/**
 * Incremental link cache.
 *
 * Caches the full link index in memory. When files change,
 * only affected entries are invalidated and rebuilt on next access.
 */
export class IncrementalLinkCache {
  private cache: LinkIndex | null = null;
  private dirty = new Set<string>();
  private dirtyAll = true;

  /**
   * Get the current link index, rebuilding only dirty files.
   */
  async getLinkIndex(workspacePath: string): Promise<LinkIndex> {
    if (this.cache && !this.dirtyAll && this.dirty.size === 0) {
      return this.cache;
    }

    if (this.dirtyAll || !this.cache) {
      // Full rebuild
      this.cache = await buildLinkIndex(workspacePath);
      this.dirtyAll = false;
      this.dirty.clear();
    } else {
      // Incremental update: rebuild only dirty files
      // For simplicity, we do a full rebuild if there are dirty files
      // (the incremental approach requires surgically updating both maps)
      if (this.dirty.size > 0) {
        this.cache = await buildLinkIndex(workspacePath);
        this.dirty.clear();
      }
    }

    return this.cache!;
  }

  /** Mark a single file as dirty (needs re-indexing on next access) */
  invalidate(filePath: string): void {
    this.dirty.add(filePath);
  }

  /** Force a full rebuild on next access */
  invalidateAll(): void {
    this.dirtyAll = true;
    this.dirty.clear();
  }

  /** Drop the cache entirely */
  clear(): void {
    this.cache = null;
    this.dirtyAll = true;
    this.dirty.clear();
  }
}

/** Singleton cache instance */
export const linkCache = new IncrementalLinkCache();
