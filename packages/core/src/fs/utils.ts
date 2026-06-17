import { readdir, stat } from "fs/promises";
import { join, relative, extname } from "path";
import type { FileInfo } from "@vale/shared";

/**
 * Recursively read a directory, returning all files and subdirectories.
 *
 * @param dirPath - Absolute path to the directory
 * @param basePath - Base path for computing relative paths (defaults to dirPath)
 * @param depth - Maximum recursion depth (undefined = unlimited)
 */
export async function readDirRecursive(
  dirPath: string,
  basePath?: string,
  depth?: number,
): Promise<FileInfo[]> {
  const root = basePath ?? dirPath;
  const results: FileInfo[] = [];

  if (depth !== undefined && depth <= 0) return results;

  const entries = await readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    // Skip dotfiles
    if (entry.name.startsWith(".")) continue;

    const fullPath = join(dirPath, entry.name);

    if (entry.isDirectory()) {
      results.push({
        path: relative(root, fullPath),
        name: entry.name,
        isDirectory: true,
      });
      const children = await readDirRecursive(
        fullPath,
        root,
        depth !== undefined ? depth - 1 : undefined,
      );
      results.push(...children);
    } else if (entry.isFile()) {
      try {
        const stats = await stat(fullPath);
        results.push({
          path: relative(root, fullPath),
          name: entry.name,
          isDirectory: false,
          extension: extname(entry.name).toLowerCase() || undefined,
          size: stats.size,
          modifiedAt: stats.mtimeMs,
        });
      } catch {
        results.push({
          path: relative(root, fullPath),
          name: entry.name,
          isDirectory: false,
          extension: extname(entry.name).toLowerCase() || undefined,
        });
      }
    }
  }

  return results;
}

/** Collect all markdown files recursively from a directory */
export async function collectMarkdownFiles(
  dirPath: string,
): Promise<string[]> {
  const results: string[] = [];

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        const children = await collectMarkdownFiles(fullPath);
        results.push(...children);
      } else if (
        entry.isFile() &&
        (entry.name.endsWith(".md") || entry.name.endsWith(".txt"))
      ) {
        results.push(fullPath);
      }
    }
  } catch {
    // Directory doesn't exist or is inaccessible
  }

  return results;
}
