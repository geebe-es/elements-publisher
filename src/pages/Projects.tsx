import {
  FolderGit2,
  Info,
  RefreshCw,
  GitBranch,
  Link2,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import type { ProjectWithStatus } from '../lib/types';

export function Projects({
  items,
  onRefresh,
}: {
  items: ProjectWithStatus[];
  onRefresh: () => void;
}) {
  return (
    <div className="p-6 max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1">Meus Projetos</h2>
          <p className="text-sm text-gray-500">
            Projetos locais e seus repositórios GitHub
          </p>
        </div>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 transition-colors"
        >
          <RefreshCw size={13} />
          Atualizar status
        </button>
      </div>

      {items.length === 0 ? (
        <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-10 text-center">
          <Info size={20} className="text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Nenhum projeto cadastrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((data) => {
            const { project, status, loading } = data;
            return (
              <div
                key={project.name}
                className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-dark-800 border border-dark-700 flex items-center justify-center shrink-0">
                    <FolderGit2 size={16} className="text-accent-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-white">{project.name}</h3>
                    <p className="text-[11px] text-gray-500 truncate" title={project.path}>
                      {project.path}
                    </p>
                  </div>
                  {loading ? (
                    <Loader2 size={16} className="text-gray-500 animate-spin" />
                  ) : status?.is_repo ? (
                    <CheckCircle2 size={16} className="text-emerald-400" />
                  ) : (
                    <XCircle size={16} className="text-red-400" />
                  )}
                </div>

                {status && (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                    <div className="flex items-start gap-1.5">
                      <GitBranch size={12} className="text-gray-600 mt-0.5 shrink-0" />
                      <span className="text-gray-500">Branch:</span>
                      <span className="text-gray-300">{status.branch || '—'}</span>
                    </div>
                    <div className="flex items-start gap-1.5 min-w-0">
                      <Link2 size={12} className="text-gray-600 mt-0.5 shrink-0" />
                      <span className="text-gray-500">Remote:</span>
                      <span className="text-gray-300 truncate" title={status.remote_url}>
                        {status.remote_ok ? 'origin OK' : 'não configurado'}
                      </span>
                    </div>
                    <div className="col-span-2 flex items-start gap-1.5 min-w-0">
                      <span className="text-gray-500 shrink-0">Último commit:</span>
                      <span className="text-gray-300 truncate" title={status.last_commit_message}>
                        {status.last_commit_hash ? (
                          <>
                            <span className="text-accent-500/80 mr-1.5">{status.last_commit_hash}</span>
                            {status.last_commit_message}
                            <span className="text-gray-600 ml-2">({status.last_commit_author})</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="text-gray-500">Pendências:</span>
                      <span
                        className={
                          (status.pending > 0 ? 'text-amber-400' : 'text-emerald-400') + ' font-medium'
                        }
                      >
                        {status.pending} arquivo{status.pending === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="flex items-start gap-1.5 min-w-0">
                      <span className="text-gray-500">Repositório:</span>
                      <span className="text-gray-300 truncate" title={project.repo_url}>
                        {project.repo_url}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
