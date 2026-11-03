import { ipcMain } from 'electron'
import { execFile, ExecFileOptions } from 'child_process'
import fs from 'fs'
import path from 'path'

/*
 * Serviço Git/GitHub — porte fiel de `src-tauri/src/git_ops.rs`.
 *
 * Regras de segurança preservadas:
 *  - executável fixo (`git`, `gh`, `curl`), argumentos sempre separados;
 *  - nunca há shell (`execFile`, não `exec`);
 *  - caminhos de projeto precisam ser absolutos e existir;
 *  - arquivos relativos não podem conter `..`, caminho absoluto ou `:`;
 *  - nomes de branch/tag passam pela mesma validação do Rust.
 */

export interface GitResult {
  success: boolean
  output: string
  error: string | null
}

interface RunResult extends GitResult {
  stdout: string
  stderr: string
}

const MAX_BUFFER = 10 * 1024 * 1024

function run(program: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const options: ExecFileOptions = {
      cwd,
      windowsHide: true,
      maxBuffer: MAX_BUFFER,
      encoding: 'utf8'
    }

    execFile(program, args, options, (error, stdout, stderr) => {
      const out = typeof stdout === 'string' ? stdout : ''
      const err = typeof stderr === 'string' ? stderr : ''
      if (error) {
        resolve({
          success: false,
          output: out,
          error: err || error.message,
          stdout: out,
          stderr: err
        })
      } else {
        resolve({ success: true, output: out, error: null, stdout: out, stderr: err })
      }
    })
  })
}

function runGit(args: string[], cwd: string): Promise<GitResult> {
  return run('git', args, cwd).then(({ success, output, error }) => ({
    success,
    output,
    error
  }))
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString)
}

/** Caminho absoluto e existente. */
function isValidPath(value: unknown): value is string {
  if (!isString(value) || !value.trim()) return false
  return path.isAbsolute(value) && fs.existsSync(value)
}

/** Rejeita travessia de diretório, caminhos absolutos e unidades do Windows. */
function isSafeRelFile(file: string): boolean {
  const f = file.trim()
  return (
    f.length > 0 &&
    !f.includes('..') &&
    !f.startsWith('/') &&
    !f.startsWith('\\') &&
    !f.includes(':')
  )
}

function isValidBranchName(name: unknown): name is string {
  if (!isString(name)) return false
  const n = name.trim()
  if (!n.length) return false
  if (n.startsWith('-')) return false
  if (!/^[\x20-\x7e]+$/.test(n)) return false
  return !(
    n.includes('..') ||
    n.includes(' ') ||
    n.includes('~') ||
    n.includes('^') ||
    n.includes(':') ||
    n.includes('?') ||
    n.includes('*') ||
    n.includes('[') ||
    n.includes('\\')
  )
}

function invalidPath(): GitResult {
  return { success: false, output: '', error: 'Caminho inválido.' }
}

function extractRepoSlug(repoUrl: unknown): string | null {
  if (!isString(repoUrl)) return null
  const clean = repoUrl.trim().replace(/\/+$/, '').replace(/\.git$/, '')
  const prefix = 'https://github.com/'
  if (!clean.startsWith(prefix)) return null
  const rest = clean.slice(prefix.length)
  const parts = rest.split('/')
  const owner = parts[0]
  const repo = parts[1]
  if (!owner || !repo) return null
  return `${owner}/${repo}`
}

interface ProjectStatus {
  is_repo: boolean
  exists: boolean
  branch: string
  remote_url: string
  remote_ok: boolean
  last_commit_hash: string
  last_commit_message: string
  last_commit_author: string
  last_commit_date: string
  pending: number
}

function defaultProjectStatus(): ProjectStatus {
  return {
    is_repo: false,
    exists: false,
    branch: '',
    remote_url: '',
    remote_ok: false,
    last_commit_hash: '',
    last_commit_message: '',
    last_commit_author: '',
    last_commit_date: '',
    pending: 0
  }
}

interface FileChange {
  path: string
  code: string
  category: 'modified' | 'new' | 'deleted' | 'renamed' | 'untracked'
  staged: boolean
}

interface ChangesResult {
  success: boolean
  branch: string
  files: FileChange[]
  error: string | null
}

interface CommitResult {
  success: boolean
  hash: string
  short_hash: string
  message: string
  error: string | null
}

interface CommitLog {
  hash: string
  short_hash: string
  message: string
  author: string
  date: string
}

interface BranchesResult {
  current: string
  local: string[]
  remote: string[]
}

async function getProjectStatus(projectPath: string): Promise<ProjectStatus> {
  const status = defaultProjectStatus()
  if (!isValidPath(projectPath)) return status
  status.exists = true

  const top = await runGit(['rev-parse', '--is-inside-work-tree'], projectPath)
  if (!top.success || top.output.trim() !== 'true') return status
  status.is_repo = true

  const branch = await runGit(['branch', '--show-current'], projectPath)
  status.branch = branch.output.trim()

  const remote = await runGit(['remote', 'get-url', 'origin'], projectPath)
  if (remote.success) {
    status.remote_url = remote.output.trim()
    status.remote_ok = true
  }

  const log = await runGit(['log', '-1', '--pretty=format:%h|%s|%an|%cr'], projectPath)
  if (log.success) {
    const parts = log.output.trim().split('|')
    // A mensagem pode conter "|"; os 3 últimos campos são autor/data.
    if (parts.length >= 4) {
      status.last_commit_hash = parts[0]
      status.last_commit_message = parts.slice(1, parts.length - 2).join('|')
      status.last_commit_author = parts[parts.length - 2]
      status.last_commit_date = parts[parts.length - 1]
    }
  }

  const st = await runGit(['status', '--porcelain'], projectPath)
  if (st.success) {
    status.pending = st.output.split(/\r?\n/).filter((l) => l.trim().length > 0).length
  }

  return status
}

async function getChanges(projectPath: string): Promise<ChangesResult> {
  const result: ChangesResult = { success: false, branch: '', files: [], error: null }

  if (!isValidPath(projectPath)) {
    result.error = 'Caminho do projeto inválido ou inexistente.'
    return result
  }

  const out = await runGit(['status', '--porcelain', '-z', '-b'], projectPath)
  if (!out.success) {
    result.error = out.error
    return result
  }

  if (out.output.length > 0) {
    const entries = out.output.split('\0')
    let i = 0
    while (i < entries.length) {
      const entry = entries[i]
      if (!entry) {
        i++
        continue
      }
      if (entry.startsWith('## ')) {
        const raw = entry.slice(3)
        result.branch = (raw.split('...')[0] ?? raw).replace(/[\[\]]/g, '').trim()
        i++
        continue
      }
      if (entry.length < 4) {
        i++
        continue
      }

      const x = entry[0]
      const y = entry[1]
      const filePath = entry.slice(3)
      i++

      const isRename = x === 'R' || y === 'R'
      if (isRename) {
        // Em -z, renomeações trazem "novo\0antigo" — descarta o antigo.
        if (i < entries.length) i++
      }

      let category: FileChange['category'] = 'modified'
      if (x === '?') category = 'untracked'
      else if (isRename) category = 'renamed'
      else if (x === 'D' || y === 'D') category = 'deleted'
      else if (x === 'A') category = 'new'

      result.files.push({
        path: filePath,
        code: `${x}${y}`,
        category,
        staged: y === ' '
      })
    }
  }

  result.success = true
  return result
}

async function getFileDiff(projectPath: string, file: string): Promise<GitResult> {
  if (!isValidPath(projectPath) || !isSafeRelFile(file)) {
    return { success: false, output: '', error: 'Caminho inválido.' }
  }

  const res = await runGit(['diff', '--', file], projectPath)
  if (res.success && res.output.trim() === '') {
    const fsPath = path.join(projectPath, file)
    if (fs.existsSync(fsPath)) {
      try {
        const stats = fs.statSync(fsPath)
        if (!stats.isFile()) return res
        if (stats.size === 0) {
          return { success: true, output: '(arquivo vazio)', error: null }
        }
        if (stats.size > 60_000) {
          return { success: true, output: '(arquivo muito grande para visualização)', error: null }
        }
        const bytes = fs.readFileSync(fsPath)
        if (bytes.includes(0)) {
          return { success: true, output: '(arquivo binário)', error: null }
        }
        const content = bytes.toString('utf8')
        const diff = content
          .split(/\r?\n/)
          .slice(0, 400)
          .map((line) => `+ ${line}`)
          .join('\n')
        return { success: true, output: diff, error: null }
      } catch {
        // Cai no retorno do git diff
      }
    }
  }
  return res
}

async function verifyIdentity(projectPath: string): Promise<GitResult> {
  return runGit(['var', 'GIT_COMMITTER_IDENT'], projectPath)
}

async function stageFiles(projectPath: string, files: string[]): Promise<GitResult> {
  if (!isValidPath(projectPath)) return invalidPath()
  for (const f of files) {
    if (!isSafeRelFile(f)) {
      return { success: false, output: '', error: `Caminho não permitido: ${f}` }
    }
  }
  return runGit(['add', '--', ...files], projectPath)
}

async function commit(projectPath: string, message: string): Promise<CommitResult> {
  const base: CommitResult = {
    success: false,
    hash: '',
    short_hash: '',
    message,
    error: null
  }

  if (!isValidPath(projectPath)) {
    return { ...base, error: 'Caminho inválido.' }
  }
  if (!message.trim()) {
    return { ...base, error: 'A mensagem do commit não pode estar vazia.' }
  }

  const identity = await verifyIdentity(projectPath)
  if (!identity.success) {
    return {
      ...base,
      error: `Identidade Git não configurada neste repositório. Configure nome e e-mail. Detalhes: ${
        identity.error ?? ''
      }`
    }
  }

  const created = await runGit(['commit', '-m', message], projectPath)
  if (!created.success) {
    return {
      ...base,
      error: created.error || 'Falha ao criar commit.'
    }
  }

  const hashOut = await runGit(['rev-parse', 'HEAD'], projectPath)
  const hash = hashOut.output.trim()
  return {
    success: true,
    hash,
    short_hash: hash.slice(0, 7),
    message,
    error: null
  }
}

async function push(projectPath: string, branch: string): Promise<GitResult> {
  if (
    !isValidPath(projectPath) ||
    !isString(branch) ||
    !branch.trim() ||
    branch.includes('..') ||
    branch.includes(' ')
  ) {
    return { success: false, output: '', error: 'Parâmetros inválidos para push.' }
  }

  const res = await runGit(['push', 'origin', branch], projectPath)
  const errl = (res.error ?? '').toLowerCase()
  if (
    !res.success &&
    (errl.includes('rejected') ||
      errl.includes('non-fast-forward') ||
      errl.includes('non-fast forward'))
  ) {
    return {
      success: false,
      output: res.output,
      error: `O PUSH FOI RECUSADO: o repositório remoto possui commits que não estão na sua cópia local (histórico divergiu).\n\n${
        res.error ?? ''
      }\n\nNenhum --force foi executado. Você pode: 1) Trazer os commits do remoto com 'git pull' (manterá suas alterações commitadas); 2) Revisar manualmente no terminal.`
    }
  }
  return res
}

async function pull(projectPath: string, branch: string): Promise<GitResult> {
  if (!isValidPath(projectPath) || !isString(branch) || !branch.trim()) {
    return { success: false, output: '', error: 'Parâmetros inválidos.' }
  }

  const st = await runGit(['status', '--porcelain'], projectPath)
  if (st.success && st.output.trim()) {
    return {
      success: false,
      output: '',
      error:
        'Existem alterações NÃO commitadas. Faça o commit (ou guarde com git stash) antes de atualizar a cópia local — nada será descartado.'
    }
  }

  const res = await runGit(['pull', 'origin', branch], projectPath)
  const errl = (res.error ?? '').toLowerCase()
  if (!res.success && (errl.includes('conflict') || errl.includes('conflicts'))) {
    return {
      success: false,
      output: res.output,
      error: `CONFLITOS detectados durante o pull. Os arquivos envolvidos:\n\n${
        res.error ?? ''
      }\n\nResolva manualmente e faça commit. Nenhuma alteração foi apagada.`
    }
  }
  return res
}

async function getHistory(projectPath: string, limit: number): Promise<CommitLog[]> {
  const n = Math.max(1, Math.min(200, Number.isFinite(limit) ? Math.trunc(limit) : 50))
  const res = await runGit(
    ['log', `-n${n}`, '--pretty=format:%H|%h|%s|%an|%cr', '--date=short'],
    projectPath
  )
  if (!res.success) return []

  const out: CommitLog[] = []
  for (const line of res.output.split(/\r?\n/)) {
    const parts = line.split('|')
    if (parts.length >= 5) {
      out.push({
        hash: parts[0],
        short_hash: parts[1],
        message: parts.slice(2, parts.length - 2).join('|'),
        author: parts[parts.length - 2],
        date: parts[parts.length - 1]
      })
    }
  }
  return out
}

async function getBranches(projectPath: string): Promise<BranchesResult> {
  const res: BranchesResult = { current: '', local: [], remote: [] }
  if (!isValidPath(projectPath)) return res

  const cur = await runGit(['branch', '--show-current'], projectPath)
  res.current = cur.output.trim()

  const local = await runGit(['branch', '--format=%(refname:short)'], projectPath)
  if (local.success) {
    res.local = local.output
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  const remote = await runGit(['branch', '-r', '--format=%(refname:short)'], projectPath)
  if (remote.success) {
    res.remote = remote.output
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean)
  }

  return res
}

async function createBranch(projectPath: string, name: string): Promise<GitResult> {
  if (!isValidPath(projectPath) || !isValidBranchName(name)) {
    return {
      success: false,
      output: '',
      error: 'Nome de branch inválido (evite espaços, .. e caracteres especiais).'
    }
  }
  return runGit(['checkout', '-b', name], projectPath)
}

async function switchBranch(projectPath: string, name: string): Promise<GitResult> {
  if (!isValidPath(projectPath) || !isValidBranchName(name)) {
    return { success: false, output: '', error: 'Nome de branch inválido.' }
  }
  return runGit(['switch', name], projectPath)
}

async function fetchAll(projectPath: string): Promise<GitResult> {
  if (!isValidPath(projectPath)) return invalidPath()
  return runGit(['fetch', '--all'], projectPath)
}

async function listTags(projectPath: string): Promise<string[]> {
  if (!isValidPath(projectPath)) return []
  const res = await runGit(['tag', '--sort=-creatordate'], projectPath)
  if (!res.success) return []
  return res.output
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
}

async function createTag(projectPath: string, name: string, message: string): Promise<GitResult> {
  if (!isValidPath(projectPath) || !isValidBranchName(name)) {
    return {
      success: false,
      output: '',
      error: 'Nome de tag inválido (ex.: v1.0.0 — sem espaços).'
    }
  }
  if (!message.trim()) {
    return { success: false, output: '', error: 'Escreva as notas da versão (message obrigatória).' }
  }
  return runGit(['tag', '-a', name, '-m', message], projectPath)
}

async function pushTag(projectPath: string, name: string): Promise<GitResult> {
  if (!isValidPath(projectPath) || !isValidBranchName(name)) {
    return { success: false, output: '', error: 'Nome de tag inválido.' }
  }
  return runGit(['push', 'origin', name], projectPath)
}

async function ghAuthStatus(): Promise<GitResult> {
  const installed = await run('gh', ['--version'], '.')
  if (!installed.success) {
    return {
      success: false,
      output: '',
      error:
        'GitHub CLI (gh) não está instalado. Baixe em https://cli.github.com — sem ele a autenticação é feita pelo Git Credential Manager durante o push (janelinha de login do GitHub na primeira vez).'
    }
  }

  const out = await run('gh', ['auth', 'status'], '.')
  if (out.success) {
    return { success: true, output: out.stdout, error: null }
  }
  return {
    success: false,
    output: out.stdout,
    error: `GitHub CLI instalado, mas NÃO autenticado. Execute 'gh auth login' no terminal (ou use o Git Credential Manager ao publicar). Saída: ${out.stderr}`
  }
}

async function ghUser(): Promise<string> {
  const out = await run('gh', ['api', 'user', '--jq', '.login'], '.')
  return out.success ? out.stdout.trim() : ''
}

async function checkRemote(projectPath: string): Promise<GitResult> {
  if (!isValidPath(projectPath)) return invalidPath()
  return runGit(['ls-remote', '--heads', 'origin'], projectPath)
}

async function getRemoteUrl(projectPath: string): Promise<GitResult> {
  if (!isValidPath(projectPath)) return invalidPath()
  return runGit(['remote', 'get-url', 'origin'], projectPath)
}

async function setRemoteUrl(projectPath: string, url: string): Promise<GitResult> {
  if (!isValidPath(projectPath)) return invalidPath()
  const okUrl =
    isString(url) &&
    (url.startsWith('https://github.com/') || url.startsWith('git@github.com:'))
  if (!okUrl) {
    return {
      success: false,
      output: '',
      error: 'URL deve ser do GitHub (https://github.com/... ou git@github.com:...).'
    }
  }

  const exists = await runGit(['remote', 'get-url', 'origin'], projectPath)
  if (exists.success) return runGit(['remote', 'set-url', 'origin', url], projectPath)
  return runGit(['remote', 'add', 'origin', url], projectPath)
}

async function ghReleaseList(repoUrl: string): Promise<GitResult> {
  const slug = extractRepoSlug(repoUrl)
  if (!slug) {
    return { success: false, output: '', error: 'URL de repositório GitHub inválida.' }
  }

  const out = await run('gh', ['api', '-X', 'GET', `repos/${slug}/releases?per_page=10`], '.')
  if (out.success) {
    return { success: true, output: out.stdout, error: null }
  }

  // Fallback anônimo via REST (curl já vem no Windows 10+).
  const url = `https://api.github.com/repos/${slug}/releases?per_page=10`
  const fallback = await run(
    'curl',
    ['-s', '-H', 'Accept: application/vnd.github+json', url],
    '.'
  )
  if (fallback.success) {
    return { success: true, output: fallback.stdout, error: null }
  }

  return {
    success: false,
    output: out.stderr,
    error: 'Não foi possível consultar os releases (gh CLI indisponível ou falha de rede).'
  }
}

async function ghCreateRelease(
  repoUrl: string,
  tag: string,
  title: string,
  notes: string,
  assets: string[]
): Promise<GitResult> {
  const slug = extractRepoSlug(repoUrl)
  if (!slug) {
    return { success: false, output: '', error: 'URL de repositório GitHub inválida.' }
  }
  if (!isValidBranchName(tag)) {
    return { success: false, output: '', error: 'Tag inválida.' }
  }

  for (const asset of assets) {
    if (!isString(asset) || !path.isAbsolute(asset) || !fs.existsSync(asset)) {
      return { success: false, output: '', error: `Arquivo de anexo não existe: ${asset}` }
    }
  }

  const args = ['release', 'create', tag, '--repo', slug, '--title', title, '--notes', notes, ...assets]
  const out = await run('gh', args, '.')
  if (out.success) {
    return { success: true, output: out.stdout, error: null }
  }
  return {
    success: false,
    output: out.stdout,
    error: out.stderr || 'GitHub CLI (gh) não encontrado. Instale em https://cli.github.com e execute \'gh auth login\'.'
  }
}

/** Registra todos os handlers IPC equivalentes aos comandos Tauri. */
export function registerGitHandlers(): void {
  ipcMain.handle('git:check-installation', async () => {
    const res = await run('git', ['--version'], '.')
    return res.success
  })

  ipcMain.handle('git:version', async () => {
    const res = await run('git', ['--version'], '.')
    return res.success ? res.stdout.replace('git version', '').trim() : ''
  })

  ipcMain.handle('git:get-config', async (_event, key: unknown, global?: unknown) => {
    if (!isString(key) || !key.trim()) return ''
    const args = ['config']
    if (global === true) args.push('--global')
    args.push(key)
    const res = await runGit(args, '.')
    return res.success ? res.output.trim() : ''
  })

  ipcMain.handle(
    'git:set-config',
    async (_event, key: unknown, value: unknown, global?: unknown) => {
      if (!isString(key) || !key.trim() || !isString(value)) return invalidPath()
      const args = ['config']
      if (global === true) args.push('--global')
      args.push(key, value)
      return runGit(args, '.')
    }
  )

  ipcMain.handle('git:project-status', async (_event, projectPath: unknown) => {
    return getProjectStatus(isString(projectPath) ? projectPath : '')
  })

  ipcMain.handle('git:get-changes', async (_event, projectPath: unknown) => {
    return getChanges(isString(projectPath) ? projectPath : '')
  })

  ipcMain.handle('git:get-diff', async (_event, projectPath: unknown, file: unknown) => {
    if (!isString(projectPath) || !isString(file)) return invalidPath()
    return getFileDiff(projectPath, file)
  })

  ipcMain.handle('git:verify-identity', async (_event, projectPath: unknown) => {
    if (!isValidPath(projectPath)) return invalidPath()
    return verifyIdentity(projectPath)
  })

  ipcMain.handle(
    'git:stage',
    async (_event, projectPath: unknown, files: unknown) => {
      if (!isString(projectPath) || !isStringArray(files)) return invalidPath()
      return stageFiles(projectPath, files)
    }
  )

  ipcMain.handle('git:commit', async (_event, projectPath: unknown, message: unknown) => {
    if (!isString(projectPath) || !isString(message)) {
      return {
        success: false,
        hash: '',
        short_hash: '',
        message: '',
        error: 'Parâmetros inválidos.'
      } satisfies CommitResult
    }
    return commit(projectPath, message)
  })

  ipcMain.handle('git:push', async (_event, projectPath: unknown, branch: unknown) => {
    if (!isString(projectPath) || !isString(branch)) return invalidPath()
    return push(projectPath, branch)
  })

  ipcMain.handle('git:pull', async (_event, projectPath: unknown, branch: unknown) => {
    if (!isString(projectPath) || !isString(branch)) return invalidPath()
    return pull(projectPath, branch)
  })

  ipcMain.handle('git:get-history', async (_event, projectPath: unknown, limit: unknown) => {
    if (!isString(projectPath)) return []
    return getHistory(projectPath, typeof limit === 'number' ? limit : 50)
  })

  ipcMain.handle('git:get-branches', async (_event, projectPath: unknown) => {
    return getBranches(isString(projectPath) ? projectPath : '')
  })

  ipcMain.handle('git:create-branch', async (_event, projectPath: unknown, name: unknown) => {
    if (!isString(projectPath) || !isString(name)) return invalidPath()
    return createBranch(projectPath, name)
  })

  ipcMain.handle('git:switch-branch', async (_event, projectPath: unknown, name: unknown) => {
    if (!isString(projectPath) || !isString(name)) return invalidPath()
    return switchBranch(projectPath, name)
  })

  ipcMain.handle('git:fetch', async (_event, projectPath: unknown) => {
    if (!isString(projectPath)) return invalidPath()
    return fetchAll(projectPath)
  })

  ipcMain.handle('git:list-tags', async (_event, projectPath: unknown) => {
    return listTags(isString(projectPath) ? projectPath : '')
  })

  ipcMain.handle(
    'git:create-tag',
    async (_event, projectPath: unknown, name: unknown, message: unknown) => {
      if (!isString(projectPath) || !isString(name) || !isString(message)) return invalidPath()
      return createTag(projectPath, name, message)
    }
  )

  ipcMain.handle('git:push-tag', async (_event, projectPath: unknown, name: unknown) => {
    if (!isString(projectPath) || !isString(name)) return invalidPath()
    return pushTag(projectPath, name)
  })

  ipcMain.handle('gh:check-installation', async () => {
    const res = await run('gh', ['--version'], '.')
    return res.success
  })

  ipcMain.handle('gh:auth-status', async () => ghAuthStatus())

  ipcMain.handle('gh:user', async () => ghUser())

  ipcMain.handle('git:check-remote', async (_event, projectPath: unknown) => {
    if (!isString(projectPath)) return invalidPath()
    return checkRemote(projectPath)
  })

  ipcMain.handle('git:get-remote-url', async (_event, projectPath: unknown) => {
    if (!isString(projectPath)) return invalidPath()
    return getRemoteUrl(projectPath)
  })

  ipcMain.handle(
    'git:set-remote-url',
    async (_event, projectPath: unknown, url: unknown) => {
      if (!isString(projectPath) || !isString(url)) return invalidPath()
      return setRemoteUrl(projectPath, url)
    }
  )

  ipcMain.handle('gh:release-list', async (_event, repoUrl: unknown) => {
    if (!isString(repoUrl)) {
      return { success: false, output: '', error: 'URL de repositório GitHub inválida.' }
    }
    return ghReleaseList(repoUrl)
  })

  ipcMain.handle(
    'gh:create-release',
    async (_event, repoUrl: unknown, tag: unknown, title: unknown, notes: unknown, assets: unknown) => {
      if (!isString(repoUrl) || !isString(tag) || !isString(title) || !isString(notes)) {
        return { success: false, output: '', error: 'Parâmetros inválidos.' }
      }
      const list = isStringArray(assets) ? assets : []
      return ghCreateRelease(repoUrl, tag, title, notes, list)
    }
  )
}
