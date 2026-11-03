# Migração Tauri → Electron — Elements Publisher

> Documento técnico da migração para Electron + Node.js, mantendo o frontend
> React/TypeScript/Tailwind, a identidade visual e todo o fluxo Git/GitHub.
>
> Versão Electron: **0.5.0** · Backend Tauri original preservado em `src-tauri/`.

---

## 1. Visão geral

O Elements Publisher passou a ter duas implementações que compartilham o mesmo
frontend:

| Camada | Tauri (legado) | Electron (atual) |
|---|---|---|
| Shell desktop | Tauri 2 (Rust) | Electron 45 |
| Backend | `src-tauri/src/*.rs` | `electron/main/**` (Node.js) |
| Ponte com o React | `invoke()` | IPC via `contextBridge` |
| Build | Vite + `tauri build` | electron-vite + electron-builder |
| Instalador | NSIS (Tauri) | NSIS (electron-builder) |
| Atualizações | `tauri-plugin-updater` + `latest.json` | `electron-updater` + `latest.yml` |

O código Tauri **não foi removido nem alterado**. A camada `src/lib/api.ts`
detecta o ambiente em tempo de execução (`'electron' in window`) e escolhe o
backend correto, permitindo validar o Electron sem quebrar a versão antiga.

```
┌────────────────────────────────┐
│ React 19 + TS + Tailwind       │
│ src/components, src/pages      │
└───────────────┬────────────────┘
                │ src/lib/api.ts
        ┌───────┴────────┐
        │                │
  window.electron    invoke() Tauri
        │                │
┌───────▼─────────┐  ┌───▼──────────────────┐
│ Electron main   │  │ Rust (src-tauri)     │
│ IPC + services  │  │ git_ops.rs, store.rs │
└───────┬─────────┘  └───┬──────────────────┘
        │                │
        └────── git / gh / curl / fs ───────
```

---

## 2. Estrutura criada

```
electron/
  main/
    index.ts              # BrowserWindow, CSP, controles da janela, bootstrap
    services/
      git.ts              # todos os comandos Git/GitHub (porte de git_ops.rs)
      projects.ts         # projects.json (porte de project_store.rs)
      system.ts           # abertura segura de links externos
      updater.ts          # electron-updater (GitHub Releases)
  preload/
    index.ts              # contextBridge + whitelist de canais IPC

electron.vite.config.ts   # build main/preload/renderer
electron-builder.yml      # instalador NSIS + provider GitHub
src/lib/windowControls.ts # controles da janela (Electron e Tauri)
src/lib/openExternal.ts   # links externos (Electron e Tauri)
```

O frontend permaneceu em `src/` — nenhum componente, página, estilo ou asset
foi movido.

---

## 3. Mapeamento dos comandos

Todos os 29 comandos Tauri possuem handler IPC equivalente:

| Comando Tauri | Canal IPC | Observações |
|---|---|---|
| `check_git_installation` | `git:check-installation` | `git --version` |
| `get_git_version` | `git:version` | |
| `get_git_config` | `git:get-config` | argumentos posicionais |
| `set_git_config` | `git:set-config` | |
| `get_project_status` | `git:project-status` | mesmo formato snake_case |
| `get_changes` | `git:get-changes` | `status --porcelain -z -b` |
| `get_file_diff` | `git:get-diff` | fallback para arquivo não rastreado |
| `verify_identity` | `git:verify-identity` | `git var GIT_COMMITTER_IDENT` |
| `stage_files` | `git:stage` | |
| `commit` | `git:commit` | bloqueia identidade ausente |
| `push` | `git:push` | sem `--force`; mensagem para non-fast-forward |
| `pull` | `git:pull` | recusa worktree sujo; explica conflitos |
| `get_history` | `git:get-history` | limite 1..200 |
| `get_branches` | `git:get-branches` | locais + remotas |
| `create_branch` | `git:create-branch` | nome validado |
| `switch_branch` | `git:switch-branch` | não descarta alterações |
| `fetch` | `git:fetch` | `fetch --all` |
| `list_tags` | `git:list-tags` | |
| `create_tag` | `git:create-tag` | tag anotada, mensagem obrigatória |
| `push_tag` | `git:push-tag` | |
| `check_gh_cli` | `gh:check-installation` | |
| `gh_auth_status` | `gh:auth-status` | mensagens equivalentes |
| `gh_user` | `gh:user` | `gh api user --jq .login` |
| `check_remote` | `git:check-remote` | `ls-remote --heads origin` |
| `get_remote_url` | `git:get-remote-url` | |
| `set_remote_url` | `git:set-remote-url` | exige URL GitHub; nunca duplica origin |
| `gh_release_list` | `gh:release-list` | fallback anônimo via `curl` |
| `gh_create_release` | `gh:create-release` | anexos opcionais validados |
| `load_projects` | `projects:load` | `%APPDATA%\elements-publisher\projects.json` |
| `save_projects` | `projects:save` | mesma localização da versão Tauri |

Comandos novos, específicos do Electron:

| Canal | Função |
|---|---|
| `win:minimize` / `win:maximize` / `win:close` / `win:isMaximized` | janela sem moldura |
| `shell:open-external` | abre apenas `http:` / `https:` |
| `updater:check` / `updater:download` / `updater:install` | atualizações |

---

## 4. Segurança

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true` (preload compilado como CommonJS `index.cjs`)
- `contextBridge` expõe apenas `invoke`, `send` e `on`, com **whitelist de canais**;
  canais desconhecidos são rejeitados.
- IPC valida tipo e conteúdo de todos os argumentos.
- `execFile` (nunca `exec`/shell) com `windowsHide: true`; binários fixos
  (`git`, `gh`, `curl`).
- Caminhos de projeto: absolutos e existentes.
- Arquivos relativos: sem `..`, sem início `/` ou `\`, sem `:`.
- Branches/tags: sem espaços, `..`, `~ ^ : ? * [ \`, sem iniciar com `-`.
- `set_remote_url`: apenas `https://github.com/...` ou `git@github.com:...`.
- `shell:open-external`: apenas `http`/`https`.
- CSP restritiva em produção, aplicada por cabeçalho HTTP (`onHeadersReceived`) e
  por `<meta http-equiv="Content-Security-Policy">` no HTML compilado:
  `default-src 'self'; script-src 'self'; ...; object-src 'none'`.
- Nenhum token, senha ou credencial passa pelo renderer.
- Navegação da janela bloqueada para URLs externas.

---

## 5. Atualizações automáticas

`electron/main/services/updater.ts` usa `electron-updater` com provider GitHub
(`geebe-es/elements-publisher`). O fluxo no renderer (`src/lib/updater.ts`)
continua o mesmo da interface antiga: verificar → baixar com progresso →
reiniciar para instalar.

Requisitos para o primeiro release Electron funcionar:

1. Gerar o instalador com `npm run build:win`.
2. Publicar na release **os três artefatos**:
   - `Elements-Publisher-<versão>-setup.exe`
   - `Elements-Publisher-<versão>-setup.exe.blockmap`
   - `latest.yml`
3. O `latest.yml` é gerado automaticamente em `release/`.
4. **Não** reaproveitar nem alterar o `latest.json` das releases Tauri.

Enquanto a release mais recente do GitHub for uma release Tauri (sem
`latest.yml`), a verificação do Electron falha silenciosamente (o erro é
capturado pela interface e não aparece ao usuário).

> A assinatura de código (Authenticode) ainda não está configurada. O
> instalador é gerado sem assinatura; o Windows pode exibir o aviso do
> SmartScreen. Configurar um certificado é recomendado antes de distribuir.

---

## 6. Como rodar e compilar

### Electron (novo)

```powershell
npm run dev:electron      # desenvolvimento com HMR
npm run build:electron    # build em out/
npm run build:win         # instalador NSIS em release/
npm run release:win       # build + publicação (requer gh/token configurado)
```

### Tauri (legado, preservado)

```powershell
.\run-dev.bat             # npm run tauri dev
.\run-build.bat           # npm run tauri build
.\scripts\publish-update.ps1 -Notes "..."
```

Os scripts `dev`, `build`, `preview` e `tauri` do `package.json` continuam
apontando para o fluxo Tauri original. Por isso os comandos Electron usam o
sufixo `:electron`.

---

## 7. Validação executada

Testes realizados em 03/11/2026, Windows, com Git 2.56 e GitHub CLI autenticado:

- Build de produção: `out/main/index.js`, `out/preload/index.cjs`,
  `out/renderer/index.html` + assets.
- Execução empacotada (`release/win-unpacked`): interface renderizada, tema,
  gradientes, sidebar, cards e status dos projetos corretos; **zero erros no
  console**; CSP ativa (`meta` presente) sem violações.
- IPC validado via Chrome DevTools Protocol:
  - `git:version`, `git:check-installation`, `gh:check-installation`, `gh:user`
  - `git:project-status`, `git:get-changes`, `git:get-diff`
  - `git:stage`, `git:commit`, `git:get-history`
  - `git:get-branches`, `git:create-branch`, `git:switch-branch`
  - `git:create-tag`, `git:list-tags`
  - `projects:load`
- Testes destrutivos foram feitos em repositório temporário isolado
  (`%TEMP%\opencode\ep-test-repo`), nunca nos projetos reais.
- Fluxo de publicação validado ponta a ponta contra um remote local (bare repo):
  - `check-remote`, `fetch`, `stage`, `commit`, `push` (commit enviado ao origin);
  - `pull` fast-forward trazendo commit de outro clone;
  - `pull` recusado com worktree sujo (mensagem de segurança);
  - `push` divergente recusado sem `--force`, com orientação ao usuário.
- Validações de segurança confirmadas:
  - `git:run` (canal arbitrário) → bloqueado pela whitelist;
  - `git:get-diff` com `../../` → recusado;
  - branch com espaço → recusada;
  - `set_remote_url` com domínio não-GitHub → recusado;
  - `shell:open-external` com `file://` → recusado;
  - lista de projetos malformada → recusada.
- Tauri: `npm run build` (frontend) continua compilando para `dist/`.
- Instalador NSIS gerado: `release/Elements-Publisher-0.5.0-setup.exe`
  (~127 MB) + `.blockmap` + `latest.yml`.

---

## 8. Pendências / próximos passos

1. Publicar a primeira release Electron (0.5.0) com `latest.yml`, `.exe` e
   `.blockmap` — somente após autorização; não alterar releases Tauri.
2. Testar o ciclo real de atualização (0.5.0 → 0.5.1) em máquina limpa.
3. Definir a transição dos usuários da versão Tauri: o updater Tauri procura
   `latest.json`, enquanto o Electron usa `latest.yml`. Publicar apenas a
   release Electron fará o app Tauri não encontrar atualização. Opções:
   release-ponte Tauri com `latest.json`, ou instalação manual do Electron.
4. Configurar assinatura de código Authenticode.
5. Executar o instalador NSIS em ambiente controlado. Ele não foi instalado
   nesta máquina para não sobrescrever os atalhos da versão Tauri em uso; a
   execução de produção foi validada diretamente pelo `release/win-unpacked`.
6. Definir se o instalador Electron substituirá o Tauri no mesmo diretório ou
   coexistirá com ele (atualmente o NSIS instala em
   `%LOCALAPPDATA%\Programs\Elements Publisher`, separado do Tauri).
7. Migrar/limpar dependências `@tauri-apps/*` do bundle Electron quando a
   versão Tauri for aposentada (mantidas agora para não quebrar o legado).

---

## 9. O que **não** foi alterado

- Repositórios, remotes, credenciais e autenticação do Git/GitHub.
- Configurações globais do Git e do GitHub CLI.
- Tags e releases existentes (v0.1.0 … v0.4.2).
- `scripts/publish-update.ps1` e `run-build.bat` / `run-dev.bat`.
- Código-fonte Rust em `src-tauri/` e a chave de assinatura Tauri.
- Layout, cores, gradientes, animações, ícones e tipografia do app.
