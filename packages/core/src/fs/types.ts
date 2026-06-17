export interface FileChangeEvent {
  type: "added" | "changed" | "removed";
  filePath: string;
  workspacePath: string;
}

export type FileChangeHandler = (
  event: FileChangeEvent,
) => void | Promise<void>;
