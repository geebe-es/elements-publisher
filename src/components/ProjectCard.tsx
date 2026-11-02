import {
  FolderGit2,
  GitBranch,
  Clock,
  ExternalLink,
  Rocket,
  AlertTriangle,
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
      <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4 animate-pulse">
        <div className="h-4 w-1/3 bg-dark-800 rounded mb-3" />
        <div className="h-3 w-2/3 bg-dark-800 rounded mb-2" />
        <div className="h-3 w-1/2 bg-dark-800 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4 hover:border-accent-500/40 hover:shadow-card-glow transition-all duration-200 group">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-accent-gradient flex items-center justify-center shadow-accent-glow-sm">
            <FolderGit2 size={17} className="text-white" />
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
            <span className="flex items-center gap-1.5 text-[11px] text-amber-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(251,191,36,0.7)]" />
              Alterações pendentes
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
              Sincronizado
            </span>
          )
        ) : (
          <span className="flex items-center gap-1.5 text-[11px] text-red-400 font-medium">
            <AlertTriangle size={12} />
            Sem repo
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-3">
        <GitBranch size={10} className="text-gray-600" />
        <span className="text-gray-400">{status.branch || '—'}</span>
        <span className="text-gray-700">→</span>
        <Clock size={10} />
        {status.last_commit_date || 'sem commits'}
      </div>
      <p className="text-xs text-gray-400 truncate mb-4" title={status.last_commit_message}>
        {status.last_commit_message || 'Nenhum commit encontrado'}
      </p>

      <div className="flex items-center gap-2">
        <a
          href={repoWebUrl(project.repo_url, status.branch)}
          target="_blank"
          rel="noreferrer"
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-dark-800/80 border border-dark-600 text-gray-300 text-xs font-medium hover:bg-dark-700/80 transition-colors"
        >
          <ExternalLink size={13} />
          Abrir no GitHub
        </a>
        <button
          onClick={onPublish}
          disabled={!status.is_repo}
          className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-accent-gradient text-white text-xs font-semibold shadow-accent-glow-sm hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none transition-all"
        >
          <Rocket size={13} />
          Publicar
        </button>
      </div>
    </div>
  );
}
