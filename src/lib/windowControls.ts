/*
 * Controles de janela com suporte a Electron e Tauri.
 * O import do Tauri é dinâmico para que o bundle não execute o módulo
 * `@tauri-apps/api/window` (que acessa `window.__TAURI_INTERNALS__`)
 * quando o app está rodando no Electron.
 */

type ElectronBridge = {
  invoke: (channel: string, data?: unknown) => Promise<any>;
  send: (channel: string, data?: unknown) => void;
  on: (channel: string, cb: (...args: any[]) => void) => () => void;
};

export const isElectron =
  typeof window !== 'undefined' && 'electron' in window;

function bridge(): ElectronBridge {
  return (window as any).electron.ipcRenderer as ElectronBridge;
}

async function tauriWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window');
  return getCurrentWindow();
}

export async function isWindowMaximized(): Promise<boolean> {
  if (isElectron) return await bridge().invoke('win:isMaximized');
  const win = await tauriWindow();
  return await win.isMaximized();
}

export function minimizeWindow(): void {
  if (isElectron) {
    bridge().send('win:minimize');
    return;
  }
  tauriWindow().then((w) => w.minimize()).catch(() => {});
}

export function toggleMaximizeWindow(): void {
  if (isElectron) {
    bridge().send('win:maximize');
    return;
  }
  tauriWindow().then((w) => w.toggleMaximize()).catch(() => {});
}

export function closeWindow(): void {
  if (isElectron) {
    bridge().send('win:close');
    return;
  }
  tauriWindow().then((w) => w.close()).catch(() => {});
}

export function onWindowMaximizedChange(
  cb: (maximized: boolean) => void,
): () => void {
  if (isElectron) {
    return bridge().on('win:maximized-changed', (value: boolean) => cb(!!value));
  }

  let disposed = false;
  let unlisten: (() => void) | undefined;
  void (async () => {
    const win = await tauriWindow();
    const un = await win.onResized(async () => {
      try {
        cb(await win.isMaximized());
      } catch {
        // ignora
      }
    });
    if (disposed) un();
    else unlisten = un;
  })().catch(() => {});

  return () => {
    disposed = true;
    unlisten?.();
  };
}
