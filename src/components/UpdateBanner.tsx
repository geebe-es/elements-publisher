import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, Rocket, ArrowDownToLine } from 'lucide-react';
import { checkForUpdate, downloadAndInstallUpdate, relaunchApp, type UpdateInfo, type UpdatePhase } from '../lib/updater';

export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [phase, setPhase] = useState<UpdatePhase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const runCheck = useCallback(async (silent: boolean) => {
    if (!silent) setPhase('checking');
    try {
      const found = await checkForUpdate();
      setInfo(found);
      if (!found && !silent) setPhase('done');
      if (found) setPhase('idle');
    } catch {
      if (!silent) setPhase('error');
    }
  }, []);

  useEffect(() => {
    // Verificação automática: 4s após abrir e depois a cada 30 min
    const t1 = setTimeout(() => runCheck(true), 4000);
    const t2 = setInterval(() => runCheck(true), 30 * 60 * 1000);
    return () => {
      clearTimeout(t1);
      clearInterval(t2);
    };
  }, [runCheck]);

  const install = async () => {
    setPhase('downloading');
    setError('');
    try {
      await downloadAndInstallUpdate(setProgress);
      setPhase('installing');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  };

  if (!info && phase !== 'checking'){
    return null;
  }

  return (
    <div className="fixed top-14 right-4 z-50 w-80 rounded-2xl border border-accent-500/40 bg-dark-900/95 backdrop-blur p-4 shadow-[0_0_40px_rgba(124,58,237,0.25)]">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-accent-gradient flex items-center justify-center shadow-accent-glow-sm shrink-0">
          <ArrowDownToLine size={16} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          {phase === 'checking' && (
            <p className="text-sm text-gray-300 flex items-center gap-2">
              <RefreshCw size={13} className="animate-spin text-accent-400" />
              Verificando atualizações...
            </p>
          )}

          {info && phase !== 'checking' && (
            <>
              <p className="text-sm font-semibold text-white">
                Nova versão <span className="brand-text">v{info.version}</span> disponível!
              </p>
              <div className="mt-3">
                {phase === 'downloading' && (
                  <div>
                    <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                      <span>Baixando atualização…</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-dark-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-accent-gradient transition-all"
                        style={{ width: `${Math.max(4, progress)}%`, boxShadow: '0 0 8px rgba(139,92,246,.8)' }}
                      />
                    </div>
                  </div>
                )}
                {phase === 'installing' && (
                  <button
                    onClick={() => relaunchApp()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent-gradient text-white text-xs font-semibold shadow-accent-glow hover:brightness-110 transition-all"
                  >
                    <Rocket size={13} />
                    Reiniciar e abrir a nova versão
                  </button>
                )}
                {(phase === 'idle' || phase === 'error') && (
                  <>
                    <button
                      onClick={install}
                      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-accent-gradient text-white text-xs font-semibold shadow-accent-glow-sm hover:brightness-110 transition-all"
                    >
                      <Download size={13} />
                      Baixar e instalar agora
                    </button>
                    {error && <p className="text-[10px] text-red-400 mt-1.5 break-words">{error}</p>}
                    <button
                      onClick={() => setInfo(null)}
                      className="w-full text-[10px] text-gray-500 hover:text-gray-300 mt-2 transition-colors"
                    >
                      Agora não
                    </button>
                  </>
                )}
                {phase === 'done' && (
                  <p className="text-[11px] text-emerald-400">Você já está na versão mais recente.</p>
                )}
              </div>
              {info.notes && phase !== 'downloading' && (
                <p className="text-[10px] text-gray-500 mt-2 line-clamp-3">{info.notes}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
