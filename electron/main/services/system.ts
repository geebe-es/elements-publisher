import { ipcMain, shell } from 'electron'

/** Abre links externos apenas com protocolos seguros. */
export function registerSystemHandlers(): void {
  ipcMain.handle('shell:open-external', async (_event, url: unknown) => {
    if (typeof url !== 'string' || !url.trim()) {
      throw new Error('URL inválida.')
    }

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new Error('URL inválida.')
    }

    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Protocolo não permitido.')
    }

    await shell.openExternal(parsed.toString())
  })
}
