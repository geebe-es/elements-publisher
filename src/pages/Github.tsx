import { useState, useCallback, useEffect } from 'react';
import { Github, Loader2, CheckCircle2, XCircle, RefreshCw, ExternalLink, Link2 } from 'lucide-react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { api } from '../lib/api';
import { logger } from '../lib/logger';
import type { Project } from '../lib/types';

interface GhStatus {
  installed: boolean | null;
  authed: string;
}

export function GithubPage({ projects }: { projects: Project[] }) {
  const [gh, setGh] = useState<GhStatus>({ installed: null, authed: '' });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [editProject, setEditProject] = useState<Project | null>(null);
  const [newUrl, setNewUrl] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const installed = await api.checkGhCli().catch(() => false);
      let authed = '';
      if (installed) {
        const status = await api.ghAuthStatus().catch(() => null);
        if (status?.success) {
          authed = await api.ghUser().catch(() => '');
        }
      }
      setGh({ installed, authed });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const validate = async (p: Project) => {
    setFeedback(null);
    const res = await api.checkRemote(p.path);
    logger.log(`Validação de remote — ${p.name}: ${res.success ? 'OK' : 'FALHA'}`);
    setFeedback({
      ok: res.success,
      text: res.success
        ? `${p.name}: conexão com origin OK (leitura de branches remotos funcionou).`
        : `${p.name}: falha — ${(res.error ?? '').slice(0, 300)}`,
    });
  };

  const saveUrl = async () => {
    if (!editProject || !newUrl.trim()) return;
    const res = await api.setRemoteUrl(editProject.path, newUrl.trim());
    if (res.success) {
      logger.log(`Remote de ${editProject.name} atualizado para ${newUrl.trim()}`);
      setProjectsSaveUrl(editProject, newUrl.trim());
    }
    setFeedback({
      ok: res.success,
      text: res.success ? 'Remote origin atualizado.' : res.error ?? 'Erro',
    });
    setEditProject(null);
    setNewUrl('');
  };

  const setProjectsSaveUrl = (p: Project, url: string) => {
    // Persiste a URL correta na lista de projetos
    api.loadProjects().then((all) => {
      const updated = all.map((x) => (x.path === p.path ? { ...x, repo_url: url } : x));
      api.saveProjects(updated);
    });
  };

  return (
    <div className="p-6 max-w-4xl">
      <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
        <Github size={20} className="text-accent-500" /> Integração GitHub
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Autenticação segura — via GitHub CLI ou Git Credential Manager. Senhas nunca são solicitadas nem armazenadas aqui.
      </p>

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

      <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status da conta</h3>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200"
          >
            <RefreshCw size={12} /> Verificar novamente
          </button>
        </div>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-gray-400 py-2">
            <Loader2 size={14} className="animate-spin" /> Verificando...
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              {gh.installed ? (
                <CheckCircle2 size={14} className="text-emerald-400" />
              ) : (
                <XCircle size={14} className="text-amber-400" />
              )}
              <span className="text-gray-300">GitHub CLI (gh):</span>
              <span className={gh.installed ? 'text-emerald-400' : 'text-amber-400'}>
                {gh.installed ? 'instalado' : 'não instalado (opcional)'}
              </span>
              {!gh.installed && (
                <a href="https://cli.github.com" target="_blank" rel="noreferrer" className="text-[11px] underline text-gray-500">
                  instalar
                </a>
              )}
            </div>
            {gh.installed && (
              <div className="flex items-center gap-2">
                {gh.authed ? (
                  <CheckCircle2 size={14} className="text-emerald-400" />
                ) : (
                  <XCircle size={14} className="text-amber-400" />
                )}
                <span className="text-gray-300">Autenticação:</span>
                <span className={gh.authed ? 'text-emerald-400' : 'text-amber-400'}>
                  {gh.authed ? `conectado como ${gh.authed}` : 'não autenticado — execute "gh auth login" ou use o Credential Manager no push'}
                </span>
              </div>
            )}
            <p className="text-[11px] text-gray-600">
              O push via HTTPS usa o Git Credential Manager do Windows: na primeira publicação pode abrir uma janela oficial do GitHub para login no navegador. O token fica guardado no Gerenciador de Credenciais do Windows — nunca no app.
            </p>
          </div>
        )}
      </div>

      {/* Remotes dos projetos */}
      <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Repositórios conectados</h3>
        <div className="space-y-2">
          {projects.map((p) => (
            <div key={p.path} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-dark-850/70 border border-dark-700/60">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-200">{p.name}</p>
                <p className="text-[11px] text-gray-500 truncate flex items-center gap-1">
                  <Link2 size={9} /> {p.repo_url}
                </p>
              </div>
              <button
                onClick={() => validate(p)}
                className="text-[11px] text-gray-400 hover:text-emerald-400 bg-dark-850/70 border border-dark-700/60 rounded-lg px-2.5 py-1.5"
              >
                Validar
              </button>
              <button
                onClick={() => openUrl(p.repo_url.replace(/\.git$/, ''))}
                className="text-gray-500 hover:text-gray-300"
                title="Abrir no GitHub"
              >
                <ExternalLink size={13} />
              </button>
              <button
                onClick={() => {
                  setEditProject(p);
                  setNewUrl(p.repo_url);
                }}
                className="text-[11px] text-gray-400 hover:text-accent-500 bg-dark-850/70 border border-dark-700/60 rounded-lg px-2.5 py-1.5"
              >
                Alterar URL
              </button>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-gray-600 mt-3">
          Alterar o remote exige cuidado: se o origin já existir, a URL é atualizada (nunca é criado um segundo "origin").
        </p>
      </div>

      {editProject && (
        <div className="mt-4 bg-dark-850/70 border border-accent-500/40 rounded-2xl p-4">
          <h3 className="text-sm font-semibold text-white mb-3">
            Alterar remote de {editProject.name}
          </h3>
          <div className="flex gap-2">
            <input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2 px-3 text-white text-sm focus:ring-2 focus:ring-accent-500/50 outline-none focus:ring-accent-glow-sm"
              placeholder="https://github.com/geebe-es/..."
            />
            <button
              onClick={saveUrl}
              className="text-sm font-medium text-white bg-accent-gradient hover:brightness-110 rounded-lg px-4"
            >
              Salvar
            </button>
            <button
              onClick={() => setEditProject(null)}
              className="text-sm text-gray-400 bg-dark-850/70 border border-dark-700/60 rounded-lg px-3"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
