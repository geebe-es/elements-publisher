import { logger } from './logger';

/*
 * Atualizações automáticas com dois backends:
 *  - Electron: electron-updater (GitHub Releases + instalador NSIS)
 *  - Tauri: plugin-updater (mantido para a versão antiga continuar funcionando)
 */

const isElectron = typeof window !== 'undefined' && 'electron' in window;

type IpcRenderer = {
  invoke: (channel: string, ...args: unknown[]) => Promise<any>;
  on: (channel: string, callback: (...args: any[]) => void) => () => void;
};

function ipc(): IpcRenderer {
  return (window as any).electron.ipcRenderer as IpcRenderer;
}

export interface UpdateInfo {
  version: string;
  notes?: string;
}

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'downloading'
  | 'installing'
  | 'done'
  | 'error';

interface ElectronUpdaterEvent {
  event: 'checking' | 'available' | 'not-available' | 'progress' | 'downloaded' | 'error';
  version?: string;
  notes?: string;
  percent?: number;
  message?: string;
}

// Estado do Tauri (a versão Electron não precisa guardar objeto de update).
let currentTauriUpdate: any = null;

/** Verifica no GitHub se há versão nova. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    if (isElectron) {
      const info = await ipc().invoke('updater:check');
      if (!info?.version) return null;
      const result: UpdateInfo = { version: info.version, notes: info.notes ?? undefined };
      logger.log(`Atualização disponível: v${info.version}`);
      return result;
    }

    const { check } = await import('@tauri-apps/plugin-updater');
    const update = await check({ timeout: 15000 });
    if (update?.available) {
      currentTauriUpdate = update;
      const info: UpdateInfo = { version: update.version, notes: update.body ?? undefined };
      logger.log(`Atualização disponível: v${update.version}`);
      return info;
    }

    currentTauriUpdate = null;
    return null;
  } catch (e) {
    logger.log(`Verificação de atualização falhou: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

/** Baixa a atualização; `onProgress` recebe 0..100. */
export async function downloadAndInstallUpdate(
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (isElectron) {
    const bridge = ipc();
    const unsubscribe = bridge.on('updater:event', (payload: ElectronUpdaterEvent) => {
      if (payload?.event === 'progress' && typeof payload.percent === 'number') {
        onProgress?.(payload.percent);
      }
    });

    try {
      onProgress?.(0);
      await bridge.invoke('updater:download');
      onProgress?.(100);
      logger.log('Atualização baixada — reinício necessário');
    } finally {
      unsubscribe();
    }
    return;
  }

  if (!currentTauriUpdate) {
    throw new Error('Nenhuma atualização em cache. Verifique novamente.');
  }

  let received = 0;
  let total = 0;
  await currentTauriUpdate.downloadAndInstall((event: any) => {
    switch (event.event) {
      case 'Started':
        total = event.data.contentLength ?? 0;
        onProgress?.(0);
        break;
      case 'Progress':
        received += event.data.chunkLength;
        if (total > 0) onProgress?.(Math.min(100, Math.round((received / total) * 100)));
        break;
      case 'Finished':
        onProgress?.(100);
        break;
    }
  });
  currentTauriUpdate = null;
  logger.log('Atualização instalada — reinício necessário');
}

/** Fecha o app e aplica a atualização baixada. */
export async function relaunchApp(): Promise<void> {
  if (isElectron) {
    await ipc().invoke('updater:install');
    return;
  }
  const { relaunch } = await import('@tauri-apps/plugin-process');
  await relaunch();
}
