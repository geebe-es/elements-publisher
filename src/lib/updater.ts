import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { logger } from './logger';

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

let currentUpdate: Update | null = null;

/** Verifica no GitHub (latest.json da release mais recente) se há versão nova */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const update = await check({ timeout: 15000 });
    if (update?.available) {
      currentUpdate = update;
      const info: UpdateInfo = { version: update.version, notes: update.body ?? undefined };
      logger.log(`Atualização disponível: v${update.version}`);
      return info;
    }
    // `check()` retornou sem update — limpa estado anterior
    currentUpdate = null;
    return null;
  } catch (e) {
    logger.log(`Verificação de atualização falhou: ${e instanceof Error ? e.message : String(e)}`);
    throw e;
  }
}

/** Baixa e instala a atualização; Progress cb em 0..100. Chame relaunch() depois. */
export async function downloadAndInstallUpdate(
  onProgress?: (pct: number) => void,
): Promise<void> {
  if (!currentUpdate) throw new Error('Nenhuma atualização em cache. Verifique novamente.');
  let received = 0;
  let total = 0;
  await currentUpdate.downloadAndInstall((event) => {
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
  currentUpdate = null;
  logger.log('Atualização instalada — reinício necessário');
}

/** Fecha o app e abre a versão nova */
export async function relaunchApp(): Promise<void> {
  await relaunch();
}
