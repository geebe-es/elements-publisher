import { useState, useCallback } from 'react';
import { GitBranch, RefreshCw, Plus, CloudDownload, CloudUpload } from 'lucide-react';
import { api } from '../lib/api';
import type { Project } from '../lib/types';
import type { BranchesResult, GitResult } from '../lib/git_types';

export function BranchesPage({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<string>('');
  const [data, setData] = useState<BranchesResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [newName, setNewName] = useState('');
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async (path: string) => {
    setSelected(path);
    setLoading(true);
    try {
      setData(await api.getBranches(path));
    } finally {
      setLoading(false);
    }
  }, []);

  const act = async (fn: () => Promise<GitResult>, successText: string) => {
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fn();
      setFeedback({ ok: res.success, text: res.success ? successText : res.error ?? 'Erro' });
      if (selected) await load(selected);
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
        <GitBranch size={20} className="text-accent-500" /> Branches
      </h2>
      <p className="text-sm text-gray-500 mb-6">Gerencie branches locais e remotas</p>

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

      {selected === '' && <p className="text-sm text-gray-500 py-8 text-center">Selecione um projeto.</p>}

      {selected !== '' && (
        <>
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => load(selected)}
              className="flex items-center gap-1.5 text-xs text-gray-400 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 hover:text-gray-200"
            >
              <RefreshCw size={13} /> Atualizar
            </button>
            <button
              onClick={() => act(() => api.fetch(selected), 'Referências remotas atualizadas (git fetch --all).')}
              className="flex items-center gap-1.5 text-xs text-gray-400 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 hover:text-gray-200"
            >
              <CloudDownload size={13} /> git fetch
            </button>
            <button
              onClick={() => act(() => api.push(selected, data?.current ?? ''), 'Push da branch atual enviado.')}
              className="flex items-center gap-1.5 text-xs text-gray-400 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 hover:text-gray-200"
            >
              <CloudUpload size={13} /> Push da atual
            </button>
          </div>

          {feedback && (
            <div
              className={`mb-4 rounded-lg p-3 text-xs border ${
                feedback.ok
                  ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                  : 'bg-red-400/10 border-red-400/30 text-red-400'
              }`}
            >
              {feedback.text}
            </div>
          )}

          <div className="flex gap-2 mb-5">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="flex-1 bg-dark-950 border border-dark-700 rounded-lg py-2 px-4 text-white text-sm focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none"
              placeholder="Nova branch — ex: feature/nova-funcionalidade"
            />
            <button
              onClick={() => {
                if (!newName.trim()) return;
                act(() => api.createBranch(selected, newName.trim()), `Branch "${newName.trim()}" criada e ativada.`);
                setNewName('');
              }}
              className="flex items-center gap-1.5 text-xs font-medium text-white bg-accent-500 hover:bg-accent-600 rounded-lg px-4 transition-colors"
            >
              <Plus size={13} /> Criar
            </button>
          </div>

          {loading && <p className="text-sm text-gray-400">Carregando...</p>}

          {!loading && data && (
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-dark-900 border border-dark-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Locais</h3>
                <div className="space-y-1">
                  {data.local.map((b) => (
                    <button
                      key={b}
                      onClick={() => act(() => api.switchBranch(selected, b), `Branch alterada para "${b}"`)}
                      className={`w-full text-left text-sm px-3 py-1.5 rounded-lg flex items-center gap-2 ${
                        b === data.current
                          ? 'bg-accent-500/10 text-accent-500 font-medium'
                          : 'text-gray-300 hover:bg-dark-800'
                      }`}
                    >
                      <GitBranch size={12} /> {b}
                      {b === data.current && <span className="ml-auto text-[10px]">atual</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="bg-dark-900 border border-dark-800 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Remotas (origin)</h3>
                <div className="space-y-1">
                  {data.remote.length === 0 && (
                    <p className="text-xs text-gray-600">Nenhuma branch remota conhecida. Use "git fetch".</p>
                  )}
                  {data.remote.map((b) => (
                    <button
                      key={b}
                      onClick={() => act(() => api.switchBranch(selected, b.split('/')[1] ?? b), 'Trocando de branch...')}
                      className="w-full text-left text-sm px-3 py-1.5 rounded-lg text-gray-400 hover:bg-dark-800 flex items-center gap-2"
                    >
                      <GitBranch size={12} /> {b}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
