import { app, ipcMain } from 'electron'
import fs from 'fs'
import path from 'path'

export interface Project {
  name: string
  path: string
  repo_url: string
}

function get_config_path() {
  const userDataPath = app.getPath('userData')
  const configDir = path.join(userDataPath, '..', 'elements-publisher')
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }
  return path.join(configDir, 'projects.json')
}

function default_projects(): Project[] {
  return [
    {
      name: 'Elements Launcher',
      path: 'D:\\APPS\\Elements Launcher',
      repo_url: 'https://github.com/geebe-es/elements-launcher.git'
    },
    {
      name: 'ConvertMp3',
      path: 'D:\\APPS\\ConvertMP3',
      repo_url: 'https://github.com/geebe-es/ConvertMp3.git'
    },
    {
      name: 'InstaSave',
      path: 'D:\\APPS\\InstaSave',
      repo_url: 'https://github.com/geebe-es/Instasave.git'
    }
  ]
}

export function loadProjects(): Project[] {
  const filePath = get_config_path()
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return JSON.parse(content)
    }
  } catch (e) {
    console.error('Error loading projects:', e)
  }
  return default_projects()
}

export function saveProjects(projects: Project[]): boolean {
  const filePath = get_config_path()
  try {
    fs.writeFileSync(filePath, JSON.stringify(projects, null, 2), 'utf-8')
    return true
  } catch (e) {
    console.error('Error saving projects:', e)
    return false
  }
}

function isProject(value: unknown): value is Project {
  if (!value || typeof value !== 'object') return false
  const p = value as Record<string, unknown>
  return (
    typeof p.name === 'string' &&
    typeof p.path === 'string' &&
    typeof p.repo_url === 'string'
  )
}

export function registerProjectHandlers(): void {
  ipcMain.handle('projects:load', () => loadProjects())

  ipcMain.handle('projects:save', (_event, projects: unknown) => {
    if (!Array.isArray(projects) || !projects.every(isProject)) {
      throw new Error('Lista de projetos inválida.')
    }
    return saveProjects(projects)
  })
}
