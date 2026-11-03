const isElectron = typeof window !== 'undefined' && 'electron' in window;

/** Abre um link no navegador padrão, com validação no processo principal. */
export async function openExternal(url: string): Promise<void> {
  if (isElectron) {
    await (window as any).electron.ipcRenderer.invoke('shell:open-external', url);
    return;
  }
  const { openUrl } = await import('@tauri-apps/plugin-opener');
  await openUrl(url);
}
