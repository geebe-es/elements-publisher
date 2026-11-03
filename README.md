<div align="center">

# Elements Publisher

**Central de gerenciamento de projetos locais e publicações no GitHub — sem usar comandos Git no terminal.**

Tauri 2 · Electron 45 · React 19 · TypeScript · Rust · Node.js · Tailwind CSS

> **v0.5.0 — migração para Electron.** O app agora roda em Electron + Node.js,
> mantendo o frontend e todo o fluxo Git/GitHub. A implementação Tauri original
> foi preservada em `src-tauri/` e continua compilando. Veja
> [`docs/migracao-electron.md`](docs/migracao-electron.md).

</div>

---

## O que é

O **Elements Publisher** é um aplicativo desktop para Windows que centraliza o ciclo de publicação dos seus projetos:

- Cadastro de múltiplos projetos locais, cada um ligado ao seu repositório GitHub.
- Detecção automática de alterações (novos, modificados, excluídos, renomeados, não rastreados).
- Seleção de arquivos com **avisos de segurança** para `.env`, tokens, senhas, chaves e pastas de build — arquivos sensíveis **nunca** são adicionados automaticamente.
- Visualização de diferenças antes de publicar.
- Fluxo completo de publicação: **verificação → seleção → mensagem de commit → revisão → commit → push → confirmação**, com log detalhado.
- Tratamento seguro de falhas: remote divergente (nunca `--force`), conflitos explicados, identidade Git ausente bloqueada, remotes validados.
- Histórico de commits com link direto para o GitHub.
- Gerenciamento de branches (criar, trocar, atualizar referências remotas).
- Tags e **GitHub Releases** (com GitHub CLI quando disponível).
- Dashboard, diagnóstico de ambiente e logs.

## Segurança por design

- O frontend **nunca** envia comandos de shell arbitrários: cada operação é um comando tipado que chama o executável `git` com **argumentos separados e validados** (Electron: IPC + whitelist; Tauri: comandos Rust).
- URLs, caminhos, nomes de branch e de tag são validados no backend (Node.js ou Rust).
- Nenhuma senha ou token é solicitado ou armazenado pelo app. A autenticação usa:
  - **Git Credential Manager** do Windows (nativo, no primeiro push), ou
  - **GitHub CLI** (`gh`), opcional, para recursos avançados (Releases com anexos).
- Nunca são executados automaticamente: `push --force`, `reset --hard`, `clean -fd`.
- Logs não registram credenciais.

## Requisitos

- Windows 10 ou 11
- [Git para Windows](https://git-scm.com/download/win) (obrigatório)
- [GitHub CLI](https://cli.github.com) (opcional — recommended para Releases)
- Acesso de escrita aos repositórios (Credential Manager autentica no primeiro push)

## Instalação

1. Baixe o instalador (`Elements Publisher_0.1.0_x64-setup.exe`) e execute-o.
2. Na primeira execução, o assistente verifica o ambiente (Git, versão, configuração de nome/e-mail, GitHub).
3. Configure nome e e-mail do Git e confirme.

Os projetos são cadastrados em *Meus Projetos*: caminho local + URL do repositório.

## Para desenvolvedores — rodar e compilar

### Electron (versão atual)

```powershell
# 1. Dependências
npm install

# 2. Desenvolvimento (HMR)
npm run dev:electron

# 3. Instalador Windows (NSIS) — saída em release\
npm run build:win
```

### Tauri (legado preservado)

```powershell
# Desenvolvimento (requer Rust/Cargo no PATH)
.\run-dev.bat        # ou: $env:Path += ";$env:USERPROFILE\.cargo\bin"; npm.cmd run tauri dev

# Instalador Windows (NSIS)
.\run-build.bat      # saída em src-tauri\target\release\bundle\nsis\
```

## Estrutura

```
├── electron/               # Backend Electron (Node.js) — versão 0.5.0
│   ├── main/
│   │   ├── index.ts        # janela, CSP, controles, bootstrap
│   │   └── services/       # git, projects, system, updater
│   └── preload/index.ts    # contextBridge + whitelist IPC
├── src/                    # Frontend React + TypeScript + Tailwind
│   ├── components/         # Sidebar, SetupWizard, ProjectCard
│   ├── pages/              # Dashboard, Projects, Publish, History,
│   │                       # Branches, Releases, Github, Settings, Logs
│   └── lib/                # api (Electron/Tauri), logger, tipos
├── src-tauri/              # Backend Rust (Tauri 2) — legado preservado
│   └── src/
│       ├── git_ops.rs      # Operações Git + GitHub CLI (validadas)
│       ├── project_store.rs# Persistência local dos projetos (JSON)
│       └── lib.rs          # Registro dos comandos
├── electron.vite.config.ts # Build main/preload/renderer
├── electron-builder.yml    # Instalador NSIS + provider GitHub
└── docs/                   # Documentação de uso e migração
```

## Performance

- Consultas ao Git/Remote **sob demanda** (sem polling contínuo).
- Sem processos Git persistentes; cada operação encerra o processo.
- Frontend enxuto ( sem dependências pesadas de UI).

---

*Elements Publisher — v0.5.0 · Electron*
