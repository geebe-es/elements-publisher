import { useState, useCallback } from 'react';
import { History, ExternalLink } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { api } from '../lib/api';
import type { Project } from '../lib/types';
import type { CommitLog } from '../lib/git_types';

export function HistoryPage({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<string>('');
  const [logs, setLogs] = useState<CommitLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');

  const load = useCallback(async (path: string) => {
    setSelected(path);
    setLoading(true);
    const proj = projects.find((p) => p.path === path);
    setRepoUrl(proj?.repo_url.replace(/\.git$/, '') ?? '');
    try {
      setLogs(await api.getHistory(path, 50));
    } finally {
      setLoading(false);
    }
  }, [projects]);

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <History size={20} className="text-accent-500" /> Histórico
          </h2>
          <p className="text-sm text-gray-500">Últimos 50 commits de cada projeto (consultados do Git local)</p>
        </div>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {projects.map((p) => (
          <button
            key={p.path}
            onClick={() => load(p.path)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              selected === p.path
                ? 'bg-accent-500/10 border-accent-500/50 text-accent-500 font-medium'
                : 'bg-dark-900 border-dark-800 text-gray-400 hover:text-gray-200'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selected === '' && (
        <p className="text-sm text-gray-500 py-8 text-center">Selecione um projeto para ver o histórico.</p>
      )}

      {loading && <p className="text-sm text-gray-400 py-8 text-center">Carregando histórico...</p>}

      {!loading && selected !== '' && (
        <div className="bg-dark-900 border border-dark-800 rounded-xl divide-y divide-dark-800">
          {logs.length === 0 && (
            <p className="text-sm text-gray-500 py-8 text-center">Nenhum commit.</p>
          )}
          {logs.map((c) => (
            <div key={c.hash} className="flex items-center gap-3 px-4 py-3">
              <span className="text-xs font-mono text-accent-500/90 shrink-0">{c.short_hash}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200 truncate">{c.message}</p>
                <p className="text-[11px] text-gray-500">{c.author} · {c.date}</p>
              </div>
              {repoUrl && (
                <button
                  onClick={() => openUrl(`${repoUrl}/commit/${c.hash}`)}
                  className="text-gray-500 hover:text-accent-500 transition-colors"
                  title="Abrir no GitHub"
                >
                  <ExternalLink size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
