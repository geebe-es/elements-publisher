import { useState, useCallback } from 'react';
import { Tag, Plus, CloudUpload, Loader2, ExternalLink, Info } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { api, type ReleaseInfo } from '../lib/api';
import type { Project } from '../lib/types';
import type { GitResult } from '../lib/git_types';

interface Feedback {
  ok: boolean;
  text: string;
}

export function ReleasesPage({ projects }: { projects: Project[] }) {
  const [selected, setSelected] = useState<string>('');
  const [version, setVersion] = useState('');
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [releases, setReleases] = useState<ReleaseInfo[] | null>(null);
  const [ghReady, setGhReady] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const load = useCallback(async (path: string) => {
    setSelected(path);
    setLoading(true);
    setReleases(null);
    try {
      setTags(await api.listTags(path));
    } finally {
      setLoading(false);
    }
  }, []);

  const run = async (fn: () => Promise<GitResult>, okText: string) => {
    setFeedback(null);
    setLoading(true);
    try {
      const res = await fn();
      setFeedback({ ok: res.success, text: res.success ? okText : res.error ?? 'Erro' });
      if (selected) await load(selected);
      return res.success;
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : String(e) });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const selectedProject = projects.find((p) => p.path === selected);

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
        <Tag size={20} className="text-accent-500" /> Releases
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Versionamento oficial — tags e GitHub Releases (separado de um push comum)
      </p>

      <div className="flex gap-2 mb-5 flex-wrap">
        {projects.map((p) => (
          <button
            key={p.path}
            onClick={() => load(p.path)}
            className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
              selected === p.path
                ? 'bg-accent-500/10 border-accent-500/50 text-accent-500 font-medium'
                : 'bg-dark-850/70 border-dark-700/60 text-gray-400 hover:text-gray-200'
            }`}
          >
            {p.name}
          </button>
        ))}
      </div>

      {selected === '' && <p className="text-sm text-gray-500 py-8 text-center">Selecione um projeto.</p>}

      {selected !== '' && (
        <>
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

          {/* Criar tag */}
          <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Criar versão (tag anotada + push da tag)
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                className="w-44 bg-dark-950 border border-dark-700 rounded-lg py-2 px-4 text-white text-sm focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none"
                placeholder="v1.0.0"
              />
              <button
                disabled={!version.trim()}
                onClick={async () => {
                  const ok1 = await run(
                    () => api.createTag(selected, version.trim(), notes.trim() || `Release ${version.trim()}`),
                    `Tag "${version.trim()}" criada.`,
                  );
                  if (ok1) {
                    const ok2 = await run(() => api.pushTag(selected, version.trim()), `Tag "${version.trim()}" enviada ao GitHub.`);
                    if (ok2 && notes.trim()) {
                      // Notas disponíveis: tenta criar a Release via gh (após confirmação anterior)
                      await run(
                        () => api.ghCreateRelease(selectedProject?.repo_url ?? '', version.trim(), version.trim(), notes.trim()),
                        'GitHub Release publicada.',
                      );
                    }
                    setVersion('');
                  }
                }}
                className="flex items-center gap-1.5 text-xs font-medium text-white bg-accent-gradient hover:brightness-110 disabled:opacity-40 rounded-lg px-4 transition-all"
              >
                <Plus size={13} /> Criar tag e publicar
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2 px-4 text-white text-sm h-24 resize-none focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none"
              placeholder="Notas da versão — o que mudou nesta release?"
            />
            <p className="text-[11px] text-gray-600 mt-2 flex items-center gap-1">
              <Info size={10} />
              A tag é criada pelo Git e enviada ao GitHub. Se o GitHub CLI estiver instalado e autenticado, a Release completa é criada com as notas.
            </p>
          </div>

          {/* Tags locais */}
          <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4 mb-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Tags locais</h3>
            {tags.length === 0 ? (
              <p className="text-xs text-gray-600">Nenhuma tag ainda.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {tags.map((t) => (
                  <button
                    key={t}
                    onClick={() => run(() => api.pushTag(selected, t), `Tag "${t}" enviada ao GitHub.`)}
                    className="flex items-center gap-1.5 text-xs bg-dark-850/70 border border-dark-700/60 rounded-lg px-3 py-1.5 text-gray-300 hover:text-white"
                    title="Enviar tag ao GitHub"
                  >
                    <Tag size={11} className="text-accent-500" /> {t}
                    <CloudUpload size={10} className="text-gray-600" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Releases no GitHub */}
          <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Releases no GitHub</h3>
              <button
                onClick={async () => {
                  if (!selectedProject) return;
                  setGhReady(await api.checkGhCli());
                  setLoading(true);
                  const res = await api.ghReleaseList(selectedProject.repo_url);
                  if (res.success) {
                    try {
                      setReleases(JSON.parse(res.output) as ReleaseInfo[]);
                      setFeedback(null);
                    } catch {
                      setFeedback({ ok: false, text: 'Resposta inválida da API.' });
                    }
                  } else {
                    setFeedback({ ok: false, text: res.error ?? 'Erro' });
                  }
                  setLoading(false);
                }}
                className="text-xs text-gray-400 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 hover:text-gray-200"
              >
                Consultar
              </button>
            </div>
            {ghReady === false && (
              <p className="text-[11px] text-amber-400/80 mb-2">
                GitHub CLI (gh) não encontrado — consulta via API pública. Para criar releases com anexos, instale em https://cli.github.com
              </p>
            )}
            {releases === null ? (
              <p className="text-xs text-gray-600">Clique em "Consultar" para listar as releases publicadas.</p>
            ) : releases.length === 0 ? (
              <p className="text-xs text-gray-600">Nenhuma release publicada.</p>
            ) : (
              <div className="space-y-1.5">
                {releases.map((r) => (
                  <button
                    key={r.html_url}
                    onClick={() => openUrl(r.html_url)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-dark-800 transition-colors"
                  >
                    <Tag size={12} className="text-accent-500 shrink-0" />
                    <span className="text-sm text-gray-200">{r.tag_name}</span>
                    <span className="text-xs text-gray-500 truncate flex-1">{r.name}</span>
                    {r.draft && <span className="text-[10px] text-amber-400">rascunho</span>}
                    {r.prerelease && <span className="text-[10px] text-sky-400">pre</span>}
                    <ExternalLink size={11} className="text-gray-600" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {loading && (
            <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
              <Loader2 size={12} className="animate-spin" /> Processando...
            </div>
          )}
        </>
      )}
    </div>
  );
}
