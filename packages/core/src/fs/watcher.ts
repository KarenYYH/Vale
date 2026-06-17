import chokidar, { type FSWatcher } from "chokidar";
import { join } from "path";
import type { FileChangeEvent, FileChangeHandler } from "./types.js";

/** Active watchers per workspace */
const watchers = new Map<string, FSWatcher>();

/**
 * Start watching a workspace's raw/ directory for file changes.
 * When a file is added, modified, or removed, the handler is called.
 */
export function watchWorkspace(
  workspacePath: string,
  handler: FileChangeHandler,
): FSWatcher {
  // Stop existing watcher for this workspace
  stopWatching(workspacePath);

  const watchPath = join(workspacePath, "raw");

  const watcher = chokidar.watch(watchPath, {
    ignored: /(^|[/\\])\../, // ignore dotfiles
    persistent: true,
    ignoreInitial: true,
    depth: 10,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100,
    },
  });

  watcher.on("add", (filePath: string) => {
    handler({ type: "added", filePath, workspacePath });
  });

  watcher.on("change", (filePath: string) => {
    handler({ type: "changed", filePath, workspacePath });
  });

  watcher.on("unlink", (filePath: string) => {
    handler({ type: "removed", filePath, workspacePath });
  });

  watchers.set(workspacePath, watcher);
  return watcher;
}

/** Stop watching a specific workspace */
export function stopWatching(workspacePath: string): void {
  const watcher = watchers.get(workspacePath);
  if (watcher) {
    watcher.close();
    watchers.delete(workspacePath);
  }
}

/** Stop all active watchers */
export function stopAllWatchers(): void {
  for (const [ws, watcher] of watchers) {
    watcher.close();
  }
  watchers.clear();
}
