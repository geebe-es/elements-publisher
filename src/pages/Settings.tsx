import { useState, useEffect, useCallback } from 'react';
import { Settings, User, Mail, CheckCircle, AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { logger } from '../lib/logger';
import { checkForUpdate } from '../lib/updater';
import type { GitResult } from '../lib/git_types';

export function SettingsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [gitVersion, setGitVersion] = useState('');
  const [ghOk, setGhOk] = useState<boolean | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const [updateFeedback, setUpdateFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const [n, e, v, gh] = await Promise.all([
      api.getGitConfig('user.name').catch(() => ''),
      api.getGitConfig('user.email').catch(() => ''),
      api.gitVersion().catch(() => ''),
      api.checkGhCli().catch(() => false),
    ]);
    setName(n);
    setEmail(e);
    setGitVersion(v);
    setGhOk(gh);
    setLoaded(true);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    if (!name.trim() || !email.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res: GitResult = await invokeSet('user.name', name.trim());
      const res2: GitResult = await invokeSet('user.email', email.trim());
      const ok = res.success && res2.success;
      setFeedback({
        ok,
        text: ok ? 'Configuração global do Git atualizada.' : res.error ?? res2.error ?? 'Erro desconhecido.',
      });
      logger.log(ok ? 'Configuração global do Git atualizada (nome/e-mail).' : `Falha ao salvar: ${res.error ?? ''}`);
      await load();
    } catch (e) {
      setFeedback({ ok: false, text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  };

  const invokeSet = (key: string, value: string) => api.setGitConfig(key, value);

  const checkUpdate = async () => {
    setUpdateChecking(true);
    setUpdateFeedback(null);
    try {
      const found = await checkForUpdate();
      if (found) {
        setUpdateFeedback({ ok: false, text: `Nova versão v${found.version} disponível! Use o botão que apareceu no canto superior direito do app para instalar.` });
      } else {
        setUpdateFeedback({ ok: true, text: 'Você já está na versão mais recente.' });
      }
    } catch {
      setUpdateFeedback({ ok: false, text: 'Falha ao consultar o GitHub (sem internet ou endpoint indisponível). Tente mais tarde.' });
    } finally {
      setUpdateChecking(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl">
      <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
        <Settings size={20} className="text-accent-500" /> Configurações
      </h2>
      <p className="text-sm text-gray-500 mb-6">Identidade Git e ambiente</p>

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

      {/* Ambiente */}
      <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4 mb-4 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">Git instalado</span>
          {gitVersion ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle size={13} /> v{gitVersion}
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-red-400">
              <AlertCircle size={13} /> não encontrado —
              <a href="https://git-scm.com/download/win" target="_blank" rel="noreferrer" className="underline">
                baixar oficial
              </a>
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-300">GitHub CLI (gh) — opcional</span>
          {ghOk === null ? (
            <Loader2 size={13} className="animate-spin text-gray-500" />
          ) : ghOk ? (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400">
              <CheckCircle size={13} /> encontrado
            </span>
          ) : (
            <a
              href="https://cli.github.com"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-amber-400 underline"
            >
              <AlertCircle size={13} /> instalar (releases completas)
            </a>
          )}
        </div>
      </div>

      {/* Atualizações */}
      <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Atualizações do app</h3>
            <p className="text-[11px] text-gray-600 mt-0.5">Verificação via GitHub Releases (geebe-es/elements-publisher)</p>
          </div>
          <button
            onClick={checkUpdate}
            className="flex items-center gap-1.5 text-xs text-white bg-accent-gradient rounded-lg px-3 py-2 font-medium shadow-accent-glow-sm hover:brightness-110"
          >
            <RefreshCw size={12} className={updateChecking ? 'animate-spin' : ''} /> Verificar agora
          </button>
        </div>
        {updateFeedback && (
          <div
            className={`text-xs rounded-lg px-3 py-2 border ${
              updateFeedback.ok
                ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400'
                : 'bg-accent-500/10 border-accent-500/30 text-accent-400'
            }`}
          >
            {updateFeedback.text}
          </div>
        )}
      </div>

      {/* Identidade */}
      <div className="bg-dark-850/70 border border-dark-700/60 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Identidade Git (global)</h3>
          <button
            onClick={load}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200"
          >
            <RefreshCw size={12} /> Recarregar
          </button>
        </div>

        {!loaded ? (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" /> Carregando configuração atual...
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Nome do desenvolvedor</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-gray-500" size={16} />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!loaded}
                  className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none focus:ring-accent-glow-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-gray-500" size={16} />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!loaded}
                  className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2 pl-10 pr-4 text-white text-sm focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none focus:ring-accent-glow-sm"
                />
              </div>
            </div>
            <button
              onClick={save}
              disabled={saving || !name.trim() || !email.trim()}
              className="w-full py-2.5 bg-accent-gradient hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-accent-glow"
            >
              {saving ? 'Salvando...' : 'Salvar configuração global'}
            </button>
            <p className="text-[11px] text-gray-600">
              A configuração é alterada somente ao clicar em salvar. Caminho: git config --global
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
