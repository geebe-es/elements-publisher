import { invoke } from '@tauri-apps/api/core';
import type { Project, ProjectStatus } from './types';
import type { ChangesResult, FileChange, CommitResult, GitResult, CommitLog, BranchesResult } from './git_types';

export const api = {
  // Projetos
  loadProjects: () => invoke<Project[]>('load_projects'),
  saveProjects: (projects: Project[]) => invoke<boolean>('save_projects', { projects }),
  projectStatus: (path: string) => invoke<ProjectStatus>('get_project_status', { path: path }),
  getGitConfig: (key: string) => invoke<string>('get_git_config', { key, global: true }),
  setGitConfig: (key: string, value: string) => invoke<GitResult>('set_git_config', { key, value, global: true }),

  // Publicação
  getChanges: (path: string) => invoke<ChangesResult>('get_changes', { path }),
  getFileDiff: (path: string, file: string) => invoke<GitResult>('get_file_diff', { path, file }),
  verifyIdentity: (path: string) => invoke<GitResult>('verify_identity', { path }),
  stageFiles: (path: string, files: string[]) => invoke<GitResult>('stage_files', { path, files }),
  commit: (path: string, message: string) => invoke<CommitResult>('commit', { path, message }),
  push: (path: string, branch: string) => invoke<GitResult>('push', { path, branch }),
  pull: (path: string, branch: string) => invoke<GitResult>('pull', { path, branch }),

  // Histórico / Branches
  getHistory: (path: string, limit: number) => invoke<CommitLog[]>('get_history', { path, limit }),
  getBranches: (path: string) => invoke<BranchesResult>('get_branches', { path }),
  createBranch: (path: string, name: string) => invoke<GitResult>('create_branch', { path, name }),
  switchBranch: (path: string, name: string) => invoke<GitResult>('switch_branch', { path, name }),
  fetch: (path: string) => invoke<GitResult>('fetch', { path }),
  listTags: (path: string) => invoke<string[]>('list_tags', { path }),
  createTag: (path: string, name: string, message: string) => invoke<GitResult>('create_tag', { path, name, message }),
  pushTag: (path: string, name: string) => invoke<GitResult>('push_tag', { path, name }),
  checkGhCli: () => invoke<boolean>('check_gh_cli'),
  ghReleaseList: (repoUrl: string) => invoke<GitResult>('gh_release_list', { repoUrl }),
  ghCreateRelease: (repoUrl: string, tag: string, title: string, notes: string, assets: string[] = []) =>
    invoke<GitResult>('gh_create_release', { repoUrl, tag, title, notes, assets }),
  ghAuthStatus: () => invoke<GitResult>('gh_auth_status'),
  ghUser: () => invoke<string>('gh_user'),
  checkRemote: (path: string) => invoke<GitResult>('check_remote', { path }),
  getRemoteUrl: (path: string) => invoke<GitResult>('get_remote_url', { path }),
  setRemoteUrl: (path: string, url: string) => invoke<GitResult>('set_remote_url', { path, url }),
  gitVersion: () => invoke<string>('get_git_version'),
};

interface ReleaseInfo {
  tag_name: string;
  name: string | null;
  published_at: string | null;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

export type { ReleaseInfo };

export type { ChangesResult, FileChange, CommitResult, GitResult, CommitLog, BranchesResult };
