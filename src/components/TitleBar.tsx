import { useState, useEffect } from 'react';
import { Github, Settings, Bell, Minus, Square, X } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export function TitleBar({
  ghUser,
  onSettings,
}: {
  ghUser: string | null;
  onSettings: () => void;
}) {
  const [maximized, setMaximized] = useState(false);
  const win = getCurrentWindow();

  useEffect(() => {
    let mounted = true;
    win
      .isMaximized()
      .then((m) => mounted && setMaximized(m))
      .catch(() => {});
    const unlisten = win.onResized(async () => {
      try {
        setMaximized(await win.isMaximized());
      } catch {
        // ignora
      }
    });
    return () => {
      mounted = false;
      unlisten.then((f) => f());
    };
  }, [win]);

  return (
    <div
      data-tauri-drag-region
      className="h-11 shrink-0 flex items-center justify-between pl-4 pr-0 border-b border-accent-700/20 bg-dark-950/90 select-none"
    >
      {/* Esquerda: selo Conectado */}
      <div className="flex items-center gap-2 min-w-0" data-tauri-drag-region>
        {ghUser === null ? (
          <div
            className="flex items-center gap-1.5 text-xs text-gray-500 bg-dark-850/90 border border-dark-700/70 rounded-full px-3 py-1.5 animate-pulse"
            title="Verificando conexão com GitHub..."
          >
            <Github size={12} />
            Verificando...
          </div>
        ) : ghUser ? (
          <div
            className="flex items-center gap-1.5 text-xs text-gray-300 bg-dark-850/90 border border-dark-700/70 rounded-full px-3 py-1.5"
            title={`Conectado como ${ghUser}`}
          >
            <Github size={12} />
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
            Conectado
          </div>
        ) : (
          <div
            className="flex items-center gap-1.5 text-xs text-gray-500 bg-dark-850/90 border border-dark-700/70 rounded-full px-3 py-1.5"
            title="GitHub não conectado"
          >
            <Github size={12} />
            Desconectado
          </div>
        )}
      </div>

      {/* Direita: ações + controles de janela */}
      <div className="flex items-center h-full">
        <button
          onClick={onSettings}
          title="Configurações"
          className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-800/80 rounded-lg transition-colors"
        >
          <Settings size={15} />
        </button>
        <button
          title="Notificações"
          className="relative w-9 h-9 flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-800/80 rounded-lg transition-colors"
        >
          <Bell size={15} />
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-amber-400" />
        </button>
        <div className="w-px h-5 bg-dark-700 mx-1.5" />
        <button
          onClick={() => win.minimize()}
          title="Minimizar"
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-800/80 transition-colors"
        >
          <Minus size={15} />
        </button>
        <button
          onClick={() => win.toggleMaximize()}
          title={maximized ? 'Restaurar' : 'Maximizar'}
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-dark-800/80 transition-colors"
        >
          <Square size={maximized ? 11 : 12} fill={maximized ? 'currentColor' : 'none'} strokeWidth={maximized ? 2 : 1.8} />
        </button>
        <button
          onClick={() => win.close()}
          title="Fechar"
          className="w-11 h-full flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500/90 transition-colors"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
