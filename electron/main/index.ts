import { app, shell, session, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { registerGitHandlers } from './services/git'
import { registerProjectHandlers } from './services/projects'
import { registerSystemHandlers } from './services/system'
import { registerUpdaterHandlers } from './services/updater'

app.setName('Elements Publisher')

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    show: false,
    frame: false, // identidade visual sem bordas padrão
    autoHideMenuBar: true,
    backgroundColor: '#06030f',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  const sendMaximizedState = (maximized: boolean) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('win:maximized-changed', maximized)
    }
  }
  mainWindow.on('maximize', () => sendMaximizedState(true))
  mainWindow.on('unmaximize', () => sendMaximizedState(false))

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://') || details.url.startsWith('http://')) {
      shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // Impede navegação da janela do app para sites externos.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (is.dev && devUrl && url.startsWith(devUrl)) return
    if (url.startsWith('file://')) return
    event.preventDefault()
  })

  // HMR para desenvolvimento
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const loadWithRetry = () => {
      mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] as string).catch(() => {
        setTimeout(loadWithRetry, 500)
      })
    }
    loadWithRetry()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.gabri.elements-publisher')

  // CSP restritiva em produção (o dev server do Vite precisa de mais liberdade).
  if (!is.dev) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'"
          ]
        }
      })
    })
  }

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Serviços migrados do Rust.
  registerGitHandlers()
  registerProjectHandlers()
  registerSystemHandlers()
  registerUpdaterHandlers()

  // Controles da janela (TitleBar customizada)
  ipcMain.on('win:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })
  ipcMain.on('win:maximize', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('win:close', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
  })
  ipcMain.handle('win:isMaximized', (event) => {
    return BrowserWindow.fromWebContents(event.sender)?.isMaximized() ?? false
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
