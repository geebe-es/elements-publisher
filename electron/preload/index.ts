import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'

/*
 * Ponte segura entre o renderer (React) e o processo principal.
 *
 * - Nenhum acesso direto ao Node.js é exposto.
 * - Só canais explicitamente listados podem ser usados.
 * - O renderer nunca recebe credenciais nem caminhos de binários.
 */

const INVOKE_CHANNELS = new Set([
  'projects:load',
  'projects:save',
  'git:check-installation',
  'git:version',
  'git:get-config',
  'git:set-config',
  'git:project-status',
  'git:get-changes',
  'git:get-diff',
  'git:verify-identity',
  'git:stage',
  'git:commit',
  'git:push',
  'git:pull',
  'git:get-history',
  'git:get-branches',
  'git:create-branch',
  'git:switch-branch',
  'git:fetch',
  'git:list-tags',
  'git:create-tag',
  'git:push-tag',
  'gh:check-installation',
  'gh:auth-status',
  'gh:user',
  'git:check-remote',
  'git:get-remote-url',
  'git:set-remote-url',
  'gh:release-list',
  'gh:create-release',
  'win:isMaximized',
  'shell:open-external',
  'updater:check',
  'updater:download',
  'updater:install'
])

const SEND_CHANNELS = new Set(['win:minimize', 'win:maximize', 'win:close'])

const RECEIVE_CHANNELS = new Set(['win:maximized-changed', 'updater:event'])

const bridge = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    if (!INVOKE_CHANNELS.has(channel)) {
      return Promise.reject(new Error(`Canal IPC não permitido: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  send: (channel: string, ...args: unknown[]): void => {
    if (!SEND_CHANNELS.has(channel)) return
    ipcRenderer.send(channel, ...args)
  },

  on: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    if (!RECEIVE_CHANNELS.has(channel)) return () => {}

    const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
      callback(...args)

    ipcRenderer.on(channel, subscription)
    return () => ipcRenderer.removeListener(channel, subscription)
  }
}

contextBridge.exposeInMainWorld('electron', { ipcRenderer: bridge })
