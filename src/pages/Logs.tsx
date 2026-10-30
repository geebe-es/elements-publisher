import { useState, useRef, useEffect } from 'react';
import { ScrollText, Copy, Check, Trash2 } from 'lucide-react';
import { logger } from '../lib/logger';
import { api } from '../lib/api';

export function LogsPage() {
  const [lines, setLines] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLines(logger.getBuffer());
    const unsub = logger.subscribe((line) =>
      line === '__CLEARED__' ? setLines([]) : setLines((prev) => [...prev, line]),
    );
    return unsub;
  }, []);

  useEffect(() => {
    if (boxRef.current) boxRef.current.scrollTop = boxRef.current.scrollHeight;
  }, [lines]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard indisponível no contexto
    }
  };

  const gitInfo = async () => {
    const v = await api.gitVersion().catch(() => 'indisponível');
    logger.log(`Git: ${v}`);
    const gh = await api.checkGhCli().catch(() => false);
    logger.log(`GitHub CLI (gh): ${gh ? 'encontrado' : 'não encontrado'}`);
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
            <ScrollText size={20} className="text-accent-500" /> Logs e Diagnóstico
          </h2>
          <p className="text-sm text-gray-500">Operações realizadas — sem tokens ou credenciais</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={copy}
            className="flex items-center gap-1.5 text-xs text-gray-400 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 hover:text-gray-200"
          >
            {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
          <button
            onClick={gitInfo}
            className="text-xs text-gray-400 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 hover:text-gray-200"
          >
            Diagnóstico Git
          </button>
          <button
            onClick={() => logger.clear()}
            className="flex items-center gap-1.5 text-xs text-gray-400 bg-dark-800 border border-dark-700 rounded-lg px-3 py-2 hover:text-red-400"
          >
            <Trash2 size={13} /> Limpar
          </button>
        </div>
      </div>

      <div
        ref={boxRef}
        className="bg-dark-950 border border-dark-800 rounded-xl p-4 h-80 overflow-auto font-mono text-[11px] leading-relaxed text-gray-400"
      >
        {lines.length === 0 ? (
          <p className="text-gray-600">Sem operações registradas nesta sessão. Faça uma publicação para ver os logs aqui.</p>
        ) : (
          lines.map((l, i) => (
            <div key={i} className={l.startsWith('[') ? '' : 'text-accent-500'}>
              {l}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
