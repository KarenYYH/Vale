/** File metadata returned by directory traversal */
export interface FileInfo {
  path: string;
  name: string;
  isDirectory: boolean;
  extension?: string;
  size?: number;
  modifiedAt?: number;
}

/** Tree node for hierarchical file display */
export interface TreeNode {
  path: string;
  name: string;
  isDirectory: boolean;
  extension?: string;
  children: TreeNode[];
}

/** Workspace summary info */
export interface WorkspaceInfo {
  name: string;
  path: string;
  stats: {
    fileCount: number;
    totalSize: number;
  };
}
