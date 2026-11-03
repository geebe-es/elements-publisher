import type { Project, ProjectStatus } from './types';
import type { GitResult, ChangesResult, CommitResult, CommitLog, BranchesResult } from './git_types';

/*
 * Camada de API compartilhada entre Electron e Tauri.
 *
 * No Electron as chamadas vão por IPC (preload com whitelist de canais).
 * No Tauri continuam usando `invoke`, o que permite rodar a versão antiga
 * durante a migração sem duplicar componentes.
 */

const isElectron = typeof window !== 'undefined' && 'electron' in window;

type IpcRenderer = {
  invoke: (channel: string, ...args: unknown[]) => Promise<any>;
};

function ipc(): IpcRenderer {
  return (window as any).electron.ipcRenderer as IpcRenderer;
}

async function tauriInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core');
  return await invoke<T>(command, args);
}

export interface ReleaseInfo {
  id: number;
  tag_name: string;
  name: string;
  html_url: string;
  published_at?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
}

export const api = {
  // --- Funções de Projeto ---
  async loadProjects(): Promise<Project[]> {
    if (isElectron) return await ipc().invoke('projects:load');
    return await tauriInvoke<Project[]>('load_projects');
  },

  async saveProjects(projects: Project[]): Promise<boolean> {
    if (isElectron) return await ipc().invoke('projects:save', projects);
    return await tauriInvoke<boolean>('save_projects', { projects });
  },

  // --- Funções Git ---
  async checkGitInstallation(): Promise<boolean> {
    if (isElectron) return await ipc().invoke('git:check-installation');
    return await tauriInvoke<boolean>('check_git_installation');
  },

  async gitVersion(): Promise<string> {
    if (isElectron) return await ipc().invoke('git:version');
    return await tauriInvoke<string>('get_git_version');
  },

  async projectStatus(path: string): Promise<ProjectStatus> {
    if (isElectron) return await ipc().invoke('git:project-status', path);
    return await tauriInvoke<ProjectStatus>('get_project_status', { path });
  },

  async getChanges(path: string): Promise<ChangesResult> {
    if (isElectron) return await ipc().invoke('git:get-changes', path);
    return await tauriInvoke<ChangesResult>('get_changes', { path });
  },

  async getFileDiff(path: string, file: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:get-diff', path, file);
    return await tauriInvoke<GitResult>('get_file_diff', { path, file });
  },

  async verifyIdentity(path: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:verify-identity', path);
    return await tauriInvoke<GitResult>('verify_identity', { path });
  },

  async stageFiles(path: string, files: string[]): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:stage', path, files);
    return await tauriInvoke<GitResult>('stage_files', { path, files });
  },

  async commit(path: string, message: string): Promise<CommitResult> {
    if (isElectron) return await ipc().invoke('git:commit', path, message);
    return await tauriInvoke<CommitResult>('commit', { path, message });
  },

  async push(path: string, branch: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:push', path, branch);
    return await tauriInvoke<GitResult>('push', { path, branch });
  },

  async pull(path: string, branch: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:pull', path, branch);
    return await tauriInvoke<GitResult>('pull', { path, branch });
  },

  async getHistory(path: string, limit: number): Promise<CommitLog[]> {
    if (isElectron) return await ipc().invoke('git:get-history', path, limit);
    return await tauriInvoke<CommitLog[]>('get_history', { path, limit });
  },

  async getBranches(path: string): Promise<BranchesResult> {
    if (isElectron) return await ipc().invoke('git:get-branches', path);
    return await tauriInvoke<BranchesResult>('get_branches', { path });
  },

  async createBranch(path: string, name: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:create-branch', path, name);
    return await tauriInvoke<GitResult>('create_branch', { path, name });
  },

  async switchBranch(path: string, name: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:switch-branch', path, name);
    return await tauriInvoke<GitResult>('switch_branch', { path, name });
  },

  async fetch(path: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:fetch', path);
    return await tauriInvoke<GitResult>('fetch', { path });
  },

  async listTags(path: string): Promise<string[]> {
    if (isElectron) return await ipc().invoke('git:list-tags', path);
    return await tauriInvoke<string[]>('list_tags', { path });
  },

  async createTag(path: string, name: string, message: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:create-tag', path, name, message);
    return await tauriInvoke<GitResult>('create_tag', { path, name, message });
  },

  async pushTag(path: string, name: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:push-tag', path, name);
    return await tauriInvoke<GitResult>('push_tag', { path, name });
  },

  // --- GitHub CLI / API ---
  async checkGhCli(): Promise<boolean> {
    if (isElectron) return await ipc().invoke('gh:check-installation');
    return await tauriInvoke<boolean>('check_gh_cli');
  },

  async ghAuthStatus(): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('gh:auth-status');
    return await tauriInvoke<GitResult>('gh_auth_status');
  },

  async ghUser(): Promise<string> {
    if (isElectron) return await ipc().invoke('gh:user');
    return await tauriInvoke<string>('gh_user');
  },

  async checkRemote(path: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:check-remote', path);
    return await tauriInvoke<GitResult>('check_remote', { path });
  },

  async getRemoteUrl(path: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:get-remote-url', path);
    return await tauriInvoke<GitResult>('get_remote_url', { path });
  },

  async setRemoteUrl(path: string, url: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:set-remote-url', path, url);
    return await tauriInvoke<GitResult>('set_remote_url', { path, url });
  },

  async ghReleaseList(repoUrl: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('gh:release-list', repoUrl);
    return await tauriInvoke<GitResult>('gh_release_list', { repo_url: repoUrl });
  },

  async ghCreateRelease(
    repoUrl: string,
    tag: string,
    title: string,
    notes: string,
    assets: string[] = []
  ): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('gh:create-release', repoUrl, tag, title, notes, assets);
    return await tauriInvoke<GitResult>('gh_create_release', {
      repo_url: repoUrl,
      tag,
      title,
      notes,
      assets
    });
  },

  // --- Configurações ---
  async getGitConfig(key: string): Promise<string> {
    if (isElectron) return await ipc().invoke('git:get-config', key, true);
    return await tauriInvoke<string>('get_git_config', { key, global: true });
  },

  async setGitConfig(key: string, value: string): Promise<GitResult> {
    if (isElectron) return await ipc().invoke('git:set-config', key, value, true);
    return await tauriInvoke<GitResult>('set_git_config', { key, value, global: true });
  }
};
