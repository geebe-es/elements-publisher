export interface Project {
  name: string;
  path: string;
  repo_url: string;
}

export interface ProjectStatus {
  is_repo: boolean;
  exists: boolean;
  branch: string;
  remote_url: string;
  remote_ok: boolean;
  last_commit_hash: string;
  last_commit_message: string;
  last_commit_author: string;
  last_commit_date: string;
  pending: number;
}

export interface ProjectWithStatus {
  project: Project;
  status: ProjectStatus | null;
  loading: boolean;
}
