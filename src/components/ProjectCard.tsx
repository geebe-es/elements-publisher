import {
  FolderGit2,
  GitBranch,
  CircleDot,
  ExternalLink,
  UploadCloud,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type { ProjectWithStatus } from '../lib/types';

// Converte https://github.com/usuario/repo.git → link de visualização
function repoWebUrl(url: string, branch: string): string {
  if (!url) return '';
  const clean = url.replace(/\.git$/, '');
  return branch ? `${clean}/tree/${branch}` : clean;
}

export function ProjectCard({
  data,
  onPublish,
}: {
  data: ProjectWithStatus;
  onPublish: () => void;
}) {
  const { project, status, loading } = data;

  if (loading || !status) {
    return (
      <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 animate-pulse">
        <div className="h-4 w-1/3 bg-dark-800 rounded mb-3" />
        <div className="h-3 w-2/3 bg-dark-800 rounded mb-2" />
        <div className="h-3 w-1/2 bg-dark-800 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 hover:border-dark-600 transition-colors group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center">
            <FolderGit2 size={16} className="text-accent-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{project.name}</h3>
            <span className="text-[11px] text-gray-500 flex items-center gap-1">
              <GitBranch size={10} />
              {status.branch || 'sem branch'}
            </span>
          </div>
        </div>
        {status.is_repo ? (
          status.pending > 0 ? (
            <span className="flex items-center gap-1 text-[11px] text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full font-medium">
              <CircleDot size={10} />
              {status.pending} pendentes
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full font-medium">
              <CheckCircle2 size={10} />
              sincronizado
            </span>
          )
        ) : (
          <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-400/10 px-2 py-1 rounded-full font-medium">
            <AlertTriangle size={10} />
            sem repo
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 truncate mb-1" title={status.last_commit_message}>
        {status.last_commit_message || 'Nenhum commit encontrado'}
      </p>
      <p className="text-[11px] text-gray-600 mb-4">
        {status.last_commit_hash && (
          <span className="text-accent-500/80 mr-1.5">{status.last_commit_hash}</span>
        )}
        {status.last_commit_date || '—'}
      </p>

      <div className="flex items-center gap-2">
        <button
          onClick={onPublish}
          disabled={!status.is_repo}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-accent-500/10 border border-accent-500/30 text-accent-500 text-xs font-medium hover:bg-accent-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <UploadCloud size={13} />
          Publicar
        </button>
        {status.remote_url && (
          <a
            href={repoWebUrl(project.repo_url, status.branch)}
            target="_blank"
            rel="noreferrer"
            className="p-2 rounded-lg bg-dark-800 border border-dark-700 text-gray-400 hover:text-gray-200 transition-colors"
            title="Abrir no GitHub"
          >
            <ExternalLink size={13} />
          </a>
        )}
      </div>
    </div>
  );
}
