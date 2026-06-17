import { resolve, normalize, isAbsolute, sep, dirname } from "path";
import { realpath } from "fs/promises";

/**
 * Resolve a user-supplied path safely within a workspace root.
 * Throws if the resolved path escapes the workspace.
 *
 * Leading slashes are treated as workspace-relative for UX
 * (e.g. /wiki/index.md → <workspace>/wiki/index.md).
 */
export function resolveSafePath(workspacePath: string, userPath: string): string {
  const root = resolve(workspacePath);
  const normalized = normalize(userPath);

  // If absolute and already within the workspace, return as-is.
  if (isAbsolute(normalized)) {
    const direct = resolve(normalized);
    if (direct.startsWith(root + sep) || direct === root) {
      return direct;
    }
  }

  // Treat the path as workspace-relative: strip leading slashes then resolve.
  const stripped = normalized.replace(/^[/\\]+/, "");
  const target = resolve(root, stripped);
  if (!target.startsWith(root + sep) && target !== root) {
    throw new Error(`Path traversal denied: ${userPath}`);
  }
  return target;
}

/**
 * Resolve a path within the workspace root, then resolve symlinks
 * and re-verify the real path is still within the workspace boundary.
 *
 * This prevents symlink escape attacks where a file inside the workspace
 * is a symlink pointing outside the workspace.
 */
export async function resolveRealSafePath(
  workspacePath: string,
  userPath: string,
): Promise<string> {
  const resolved = resolveSafePath(workspacePath, userPath);

  let realRoot: string;
  try {
    realRoot = await realpath(workspacePath);
  } catch {
    realRoot = resolve(workspacePath);
  }

  let real: string;
  try {
    real = await realpath(resolved);
  } catch {
    const parent = dirname(resolved);
    try {
      real = await realpath(parent);
      real = resolve(
        real,
        normalize(userPath).split(/[/\\]/).pop() ?? "",
      );
    } catch {
      return resolved;
    }
  }

  if (!real.startsWith(realRoot + sep) && real !== realRoot) {
    throw new Error(
      `Path traversal denied (symlink): ${userPath} → ${real}`,
    );
  }
  return real;
}
