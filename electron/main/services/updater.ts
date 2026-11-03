import { app, BrowserWindow, ipcMain } from 'electron'
import electronUpdater from 'electron-updater'

const { autoUpdater } = electronUpdater

/*
 * Atualizações automáticas via GitHub Releases.
 * O electron-builder gera `app-update.yml` a partir da seção `publish`,
 * e o electron-updater baixa o instalador NSIS + blockmap da release.
 *
 * Em desenvolvimento (`app.isPackaged === false`) não há app-update.yml,
 * então a verificação é ignorada silenciosamente.
 */

let registered = false

function broadcast(payload: Record<string, unknown>): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send('updater:event', payload)
  }
}

export function registerUpdaterHandlers(): void {
  if (registered) return
  registered = true

  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = true
  // Evita escritas no console (em apps GUI sem console, um pipe fechado
  // pode lançar EPIPE dentro do logger do electron-updater).
  ;(autoUpdater as any).logger = null

  autoUpdater.on('checking-for-update', () => broadcast({ event: 'checking' }))
  autoUpdater.on('update-available', (info) =>
    broadcast({
      event: 'available',
      version: info.version,
      notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : ''
    })
  )
  autoUpdater.on('update-not-available', () => broadcast({ event: 'not-available' }))
  autoUpdater.on('download-progress', (progress) =>
    broadcast({ event: 'progress', percent: Math.round(progress.percent) })
  )
  autoUpdater.on('update-downloaded', (info) =>
    broadcast({ event: 'downloaded', version: info.version })
  )
  autoUpdater.on('error', (error) =>
    broadcast({ event: 'error', message: error?.message ?? String(error) })
  )

  ipcMain.handle('updater:check', async () => {
    if (!app.isPackaged) return null

    const result = await autoUpdater.checkForUpdates()
    const info = result?.updateInfo
    if (!info || !info.version || info.version === app.getVersion()) return null

    return {
      version: info.version,
      notes: typeof info.releaseNotes === 'string' ? info.releaseNotes : undefined
    }
  })

  ipcMain.handle('updater:download', async () => {
    if (!app.isPackaged) {
      throw new Error('Atualizações automáticas disponíveis apenas na versão instalada.')
    }
    await autoUpdater.downloadUpdate()
  })

  ipcMain.handle('updater:install', async () => {
    if (!app.isPackaged) return
    // isSilent = false, isForceRunAfter = true
    autoUpdater.quitAndInstall(false, true)
  })
}
