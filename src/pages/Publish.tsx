import { useState, useMemo, useCallback } from 'react';
import {
  UploadCloud,
  RefreshCw,
  FileCode2,
  FilePlus2,
  FileMinus2,
  FileSymlink,
  FileQuestion,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronLeft,
  ExternalLink,
  Eye,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Project } from '../lib/types';
import type { ChangesResult, GitResult, FileChange, CommitResult } from '../lib/git_types';

type Phase = 'select' | 'review' | 'running' | 'success' | 'error';

// ---------- Detecção de arquivos sensíveis / desnecessários ----------
const SENSITIVE_PATTERNS = [
  '.env', 'env.local', '.env.', 'token', 'password', 'senha', 'secret',
  'api_key', 'apikey', 'credentials', 'id_rsa', '.pem', '.pfx', '.p12',
  '.key', '.crt', '.jks', 'keystore',
];
const IGNORED_DIRS = ['node_modules', 'build', 'dist', 'out', 'target', '.next'];

export function isSensitive(path: string): string | null {
  const lower = path.toLowerCase().replace(/\\/g, '/');
  for (const d of IGNORED_DIRS) {
    if (lower.includes(`${d}/`)) return `pasta de build/dependências "${d}/"`;
  }
  for (const pat of SENSITIVE_PATTERNS) {
    if (lower.includes(pat)) return `possível arquivo sensível ("${pat}")`;
  }
  return null;
}

// ---------- Sugestão automática de mensagem de commit ----------
function suggestMessage(files: FileChange[]): string {
  const counts = { new: 0, modified: 0, deleted: 0, renamed: 0, untracked: 0 };
  for (const f of files) counts[f.category] = (counts[f.category] ?? 0) + 1;
  const parts: string[] = [];
  if (counts.new + counts.untracked > 0) parts.push(`${counts.new + counts.untracked} novo(s) arquivo(s)`);
  if (counts.modified > 0) parts.push(`${counts.modified} alteração(ões)`);
  if (counts.deleted > 0) parts.push(`${counts.deleted} exclusão(ões)`);
  return parts.length ? `Atualização: ${parts.join(', ')}` : 'Atualização do projeto';
}

const CATEGORY_META: Record<string, { label: string; icon: any; color: string }> = {
  new: { label: 'Novo', icon: FilePlus2, color: 'text-emerald-400' },
  untracked: { label: 'Não rastreado', icon: FileQuestion, color: 'text-sky-400' },
  modified: { label: 'Modificado', icon: FileCode2, color: 'text-amber-400' },
  deleted: { label: 'Excluído', icon: FileMinus2, color: 'text-red-400' },
  renamed: { label: 'Renomeado', icon: FileSymlink, color: 'text-violet-400' },
};

export function Publish({ projects, onDone }: { projects: Project[]; onDone: () => void }) {
  const [phase, setPhase] = useState<Phase>('select');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [changes, setChanges] = useState<ChangesResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [errResult, setErrResult] = useState<GitResult | null>(null);
  const [diffFile, setDiffFile] = useState<string | null>(null);
  const [diffText, setDiffText] = useState('');
  const [diverged, setDiverged] = useState(false);

  const addLog = useCallback((l: string) => {
    const t = new Date().toLocaleTimeString('pt-BR', { hour12: false });
    setLog((prev) => [...prev, `[${t}] ${l}`]);
  }, []);

  // Fluxo Etapa 2 — identificar alterações
  const loadChanges = async (project: Project) => {
    setLoading(true);
    setChanges(null);
    setResult(null);
    setErrResult(null);
    setLog([]);
    addLog(`Analisando "${project.name}"...`);
    const res = await api.getChanges(project.path);
    setChanges(res);
    if (res.success) {
      // Por padrão: tudo selecionado, exceto arquivos sensíveis (nunca credenciais automáticas)
      const safe = new Set<string>();
      res.files.forEach((f) => {
        if (!isSensitive(f.path)) safe.add(f.path);
      });
      setSelected(safe);
      setMessage(suggestMessage(res.files));
      addLog(`${res.files.length} alteração(ões) identificada(s) na branch ${res.branch || '—'}.`);
    } else {
      addLog(`Erro: ${res.error}`);
    }
    setLoading(false);
  };

  const startPublish = (project: Project) => {
    setSelectedProject(project);
    setPhase('select');
    loadChanges(project);
  };

  const selectedFiles = useMemo(
    () => (changes?.files ?? []).filter((f) => selected.has(f.path)),
    [changes, selected],
  );
  const selectedSensitive = useMemo(
    () => selectedFiles.filter((f) => isSensitive(f.path)),
    [selectedFiles],
  );

  // Etapa 6/7 — commit + push
  const doPublish = async () => {
    if (!selectedProject || !changes || selectedFiles.length === 0 || !message.trim()) return;
    setPhase('running');
    setLog([]);
    const p = selectedProject;
    try {
      addLog('Etapa 1/3 — Verificando identidade do Git...');
      const id = await api.verifyIdentity(p.path);
      if (!id.success) {
        setErrResult(id);
        setPhase('error');
        addLog('Identidade Git ausente. Configure nome/e-mail nas Configurações.');
        return;
      }
      addLog('Etapa 2/3 — Adicionando arquivos selecionados...');
      const staged = await api.stageFiles(
        p.path,
        selectedFiles.map((f) => f.path),
      );
      if (!staged.success) {
        setErrResult(staged);
        setPhase('error');
        addLog(`Falha ao adicionar arquivos: ${staged.error}`);
        return;
      }
      addLog(`Etapa 3/3 — Criando commit na branch ${changes.branch}...`);
      const c = await api.commit(p.path, message.trim());
      if (!c.success) {
        setErrResult({ success: false, output: '', error: c.error || 'Falha desconhecida no commit.' });
        setPhase('error');
        addLog(`Falha no commit: ${c.error}`);
        return;
      }
      addLog(`Commit ${c.short_hash} criado. Enviando para origin...`);
      const pushRes = await api.push(p.path, changes.branch);
      if (!pushRes.success) {
        setDiverged(
          (pushRes.error ?? '').toLowerCase().includes('recusado') ||
            (pushRes.error ?? '').toLowerCase().includes('rejected'),
      );
      setErrResult(pushRes);
      setPhase('error');
      addLog(`Falha no push: ${pushRes.error}`);
      return;
    }
    addLog('Push concluído com sucesso. ✔');
    setResult(c);
    setPhase('success');
    } catch (e) {
      // Captura qualquer exceção do backend e mostra o erro REAL
      const msg = e instanceof Error ? e.message : String(e);
      setErrResult({ success: false, output: '', error: msg });
      setPhase('error');
      addLog(`Exceção: ${msg}`);
    }
  };

  // Opção segura quando o histórico divergiu
  const safePull = async () => {
    if (!selectedProject || !changes) return;
    setPhase('running');
    addLog('Atualizando a cópia local (git pull) — nenhuma alteração será descartada...');
    try {
      const res = await api.pull(selectedProject.path, changes.branch);
      if (res.success) {
        addLog('Cópia local atualizada. Refazendo verificação de mudanças...');
        setPhase('select');
        loadChanges(selectedProject);
      } else {
        setErrResult(res);
        setDiverged(false);
        setPhase('error');
        addLog(`Falha no pull: ${res.error}`);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErrResult({ success: false, output: '', error: msg });
      setPhase('error');
      addLog(`Exceção: ${msg}`);
    }
  };

  const viewDiff = async (file: string) => {
    if (!selectedProject) return;
    const res = await api.getFileDiff(selectedProject.path, file);
    setDiffFile(file);
    setDiffText(res.success ? res.output : res.error ?? 'Erro');
  };

  const repoWeb = selectedProject?.repo_url.replace(/\.git$/, '') ?? '';

  // ================= RENDER =================
  return (
    <div className="p-6 max-w-4xl">
      {phase === 'select' && !selectedProject && (
        <>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <UploadCloud size={20} className="text-accent-500" /> Publicar atualizações
          </h2>
          <p className="text-sm text-gray-500 mb-6">Escolha o projeto que deseja publicar</p>
          <div className="space-y-2">
            {projects.map((p) => (
              <button
                key={p.name}
                onClick={() => startPublish(p)}
                className="w-full text-left bg-dark-900 border border-dark-800 rounded-xl p-4 hover:border-accent-500/50 hover:bg-dark-850 transition-colors flex items-center gap-3 group"
              >
                <UploadCloud size={16} className="text-accent-500" />
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[11px] text-gray-500">{p.repo_url}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {phase === 'select' && selectedProject && (
        <>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">
              {selectedProject.name} — alterações pendentes
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => loadChanges(selectedProject)}
                className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2"
              >
                <RefreshCw size={13} /> Recarregar
              </button>
              <button
                onClick={() => setSelectedProject(null)}
                className="text-xs text-gray-400 hover:text-gray-200 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2"
              >
                Voltar
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-gray-400 py-8">
              <Loader2 size={16} className="animate-spin" /> Analisando repositório...
            </div>
          )}

          {!loading && changes && !changes.success && (
            <div className="bg-red-400/10 border border-red-400/30 text-red-400 rounded-lg p-4 text-sm">
              {changes.error}
            </div>
          )}

          {!loading && changes?.success && (
            <>
              {changes.files.length === 0 ? (
                <div className="bg-dark-900 border border-dark-800 rounded-xl p-10 text-center">
                  <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Nenhuma alteração pendente. Tudo sincronizado! 🎉</p>
                </div>
              ) : (
                <>
                  <div className="bg-dark-900 border border-dark-800 rounded-xl divide-y divide-dark-800 mb-4">
                    {changes.files.map((f) => {
                      const meta = CATEGORY_META[f.category] ?? CATEGORY_META.modified;
                      const Icon = meta.icon;
                      const sens = isSensitive(f.path);
                      const checked = selected.has(f.path);
                      return (
                        <div key={f.path} className="flex items-center gap-3 px-4 py-2.5">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = new Set(selected);
                              e.target.checked ? next.add(f.path) : next.delete(f.path);
                              setSelected(next);
                            }}
                            className="accent-accent-500"
                          />
                          <Icon size={14} className={meta.color} />
                          <span className="text-xs text-gray-300 flex-1 truncate" title={f.path}>
                            {f.path}
                          </span>
                          <span className={`text-[10px] uppercase tracking-wide ${meta.color}`}>
                            {meta.label}
                          </span>
                          {sens && (
                            <span
                              className="flex items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full"
                              title="Desmarcado por segurança. Marque manualmente se tiver certeza."
                            >
                              <AlertTriangle size={9} /> {sens}
                            </span>
                          )}
                          <button
                            onClick={() => viewDiff(f.path)}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            title="Ver diferenças"
                          >
                            <Eye size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {diffFile && (
                    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4 mb-4">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs text-gray-400 font-mono">{diffFile}</p>
                        <button onClick={() => setDiffFile(null)} className="text-gray-500 hover:text-gray-300">
                          <XCircle size={14} />
                        </button>
                      </div>
                      <pre className="text-[11px] leading-relaxed font-mono text-gray-300 bg-dark-950 rounded-lg p-3 max-h-60 overflow-auto whitespace-pre-wrap">
                        {diffText}
                      </pre>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Mensagem do commit
                    </label>
                    <input
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full bg-dark-950 border border-dark-700 rounded-lg py-2.5 px-4 text-white text-sm focus:ring-2 focus:ring-accent-500/50 focus:border-accent-500 outline-none"
                      placeholder="Ex: Atualização da interface do ConvertMp3"
                    />
                    <button
                      onClick={() => setMessage(suggestMessage(changes.files))}
                      className="mt-2 text-[11px] text-accent-500 hover:text-accent-600 transition-colors"
                    >
                      ✨ Sugerir mensagem automática
                    </button>
                  </div>

                  <button
                    onClick={() => setPhase('review')}
                    disabled={selected.size === 0 || !message.trim()}
                    className="w-full py-2.5 bg-accent-500 hover:bg-accent-600 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-accent-glow"
                  >
                    Revisar e publicar ({selected.size} arquivo{selected.size === 1 ? '' : 's'})
                  </button>
                </>
              )}
            </>
          )}
        </>
      )}

      {phase === 'review' && selectedProject && changes && (
        <div className="bg-dark-900 border border-dark-800 rounded-2xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Revisão antes de publicar</h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm mb-5">
            <p className="text-gray-500">Projeto</p><p className="text-gray-200">{selectedProject.name}</p>
            <p className="text-gray-500">Repositório</p><p className="text-gray-200 truncate" title={selectedProject.repo_url}>{selectedProject.repo_url}</p>
            <p className="text-gray-500">Branch</p><p className="text-gray-200">{changes.branch}</p>
            <p className="text-gray-500">Arquivos</p><p className="text-gray-200">{selectedFiles.length} selecionado(s) de {changes.files.length}</p>
            <p className="text-gray-500">Mensagem</p><p className="text-gray-200">{message}</p>
          </div>
          <div className="bg-dark-950 border border-dark-800 rounded-lg p-3 mb-5 max-h-44 overflow-auto">
            {selectedFiles.map((f) => (
              <p key={f.path} className="text-[11px] text-gray-400 font-mono py-0.5">
                {f.path}
              </p>
            ))}
          </div>
          {selectedSensitive.length > 0 && (
            <div className="bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-lg p-3 text-xs mb-5 flex items-start gap-2">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              Você incluiu {selectedSensitive.length} arquivo(s) potencialmente sensível(is). Confirme que contém artefatos de verdade antes de continuar.
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => setPhase('select')}
              className="px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-gray-300 text-sm hover:bg-dark-700"
            >
              Voltar
            </button>
            <button
              onClick={doPublish}
              className="flex-1 py-2.5 bg-accent-500 hover:bg-accent-600 text-white rounded-lg font-semibold text-sm shadow-lg shadow-accent-glow"
            >
              Confirmar e publicar agora
            </button>
          </div>
        </div>
      )}

      {phase === 'running' && (
        <div className="bg-dark-900 border border-dark-800 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-white font-semibold mb-4">
            <Loader2 size={18} className="animate-spin text-accent-500" /> Publicando atualização...
          </div>
          <pre className="text-[11px] font-mono text-gray-400 bg-dark-950 rounded-lg p-4 max-h-72 overflow-auto space-y-0.5">
            {log.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </pre>
        </div>
      )}

      {phase === 'success' && selectedProject && result && (
        <div className="bg-dark-900 border border-emerald-400/30 rounded-2xl p-8 text-center">
          <CheckCircle2 size={40} className="text-emerald-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white mb-1">Atualização publicada com sucesso!</h2>
          <p className="text-sm text-gray-500 mb-5">{selectedProject.name}</p>
          <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm text-left bg-dark-850 border border-dark-800 rounded-xl p-4 mb-5">
            <p className="text-gray-500">Repositório</p>
            <p className="text-gray-200 truncate">{selectedProject.repo_url}</p>
            <p className="text-gray-500">Branch</p><p className="text-gray-200">{changes?.branch}</p>
            <p className="text-gray-500">Commit</p><p className="text-gray-200 font-mono">{result.short_hash}</p>
            <p className="text-gray-500">Mensagem</p><p className="text-gray-200">{result.message}</p>
            <p className="text-gray-500">Data</p>
            <p className="text-gray-200">{new Date().toLocaleString('pt-BR')}</p>
          </div>
          <div className="flex gap-3">
            <a
              href={`${repoWeb}/commit/${result.hash}`}
              target="_blank"
              rel="noreferrer"
              className="flex-1 py-2.5 bg-accent-500/10 border border-accent-500/30 text-accent-500 rounded-lg text-sm font-medium flex items-center justify-center gap-2 hover:bg-accent-500/20"
            >
              <ExternalLink size={14} /> Ver commit no GitHub
            </a>
            <button
              onClick={() => { onDone(); setPhase('select'); setSelectedProject(null); }}
              className="px-4 py-2.5 rounded-lg bg-dark-800 border border-dark-700 text-gray-300 text-sm"
            >
              Concluir
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="bg-dark-900 border border-red-400/30 rounded-2xl p-6">
          <div className="flex items-center gap-2 text-red-400 font-semibold mb-3">
            <XCircle size={18} /> Falha na publicação
          </div>
          <pre className="text-xs text-red-300/90 bg-dark-950 border border-dark-800 rounded-lg p-4 whitespace-pre-wrap mb-4 max-h-60 overflow-auto">
            {errResult?.error || errResult?.output || 'Erro desconhecido.'}
          </pre>
          {diverged && (
            <div className="bg-amber-400/10 border border-amber-400/30 text-amber-400 rounded-lg p-4 text-xs mb-4">
              <p className="font-semibold mb-1 flex items-center gap-1.5">
                <AlertTriangle size={13} /> Histórico divergiu do remoto
              </p>
              <p className="text-amber-300/80 mb-3">
                O remote possui commits que não estão aqui. Nenhum <code>--force</code> foi executado.
                Você pode trazer os commits do remoto de forma segura (suas alterações não são descartadas).
              </p>
              <button
                onClick={safePull}
                className="px-3 py-2 rounded-lg bg-amber-400/10 border border-amber-400/40 text-amber-400 text-xs font-medium hover:bg-amber-400/20"
              >
                Atualizar cópia local (git pull)
              </button>
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => { setPhase('select'); setDiverged(false); setSelectedProject(null); }}
              className="px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-gray-300 text-sm"
            >
              <ChevronLeft size={14} className="inline mr-1" /> Voltar
            </button>
            {selectedProject && (
              <button
                onClick={() => loadChanges(selectedProject)}
                className="px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-gray-300 text-sm"
              >
                Tentar novamente
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
