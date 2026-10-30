export interface GitResult {
  success: boolean;
  output: string;
  error: string | null;
}

export interface FileChange {
  path: string;
  code: string;
  category: 'modified' | 'new' | 'deleted' | 'renamed' | 'untracked';
  staged: boolean;
}

export interface ChangesResult {
  success: boolean;
  branch: string;
  files: FileChange[];
  error: string | null;
}

export interface CommitResult {
  success: boolean;
  hash: string;
  short_hash: string;
  message: string;
  error: string | null;
}

export interface CommitLog {
  hash: string;
  short_hash: string;
  message: string;
  author: string;
  date: string;
}

export interface BranchesResult {
  current: string;
  local: string[];
  remote: string[];
}
