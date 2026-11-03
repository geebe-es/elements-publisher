# Documentação Técnica — Elements Publisher

> **Nota (v0.5.0):** esta página descreve o backend Tauri/Rust legado. A versão
> atual roda em Electron + Node.js; consulte
> [`migracao-electron.md`](migracao-electron.md) para a arquitetura, IPC,
> segurança, build e atualizações do Electron.

## Arquitetura

```
┌─────────────────────────────┐        invoke/IPC        ┌──────────────────────────────┐
│ Frontend (React/TS/Vite)    │ ───────────────────────► │ Backend Rust (Tauri 2)       │
│ páginas, hooks, api layer   │  comandos tipados        │ git_ops.rs / project_store   │
│ Tailwind, Lucide, Motion    │ ◄――――― structs serde ─── │ std::process::Command(git)   │
└─────────────────────────────┘                          └──────────────────────────────┘
```

## Comandos Tauri registrados (`src-tauri/src/lib.rs`)

| Categoria | Comando | Função |
|---|---|---|
| Ambiente | `check_git_installation`, `get_git_version` | Detecta Git e versão |
| Config | `get_git_config`, `set_git_config` | Lê/grava `user.name`, `user.email` (global) |
| Status | `get_project_status` | is_repo, branch, remote, último commit, pendências |
| Mudanças | `get_changes`, `get_file_diff` | `status --porcelain -z`, `diff` |
| Publicação | `verify_identity`, `stage_files`, `commit`, `push`, `pull` | Fluxo de publicação |
| Histórico | `get_history` | `log` parseado |
| Branches | `get_branches`, `create_branch`, `switch_branch`, `fetch` | Gestão de branches |
| Tags | `list_tags`, `create_tag`, `push_tag` | Tags anotadas |
| GitHub | `check_gh_cli`, `gh_auth_status`, `gh_user`, `gh_release_list`, `gh_create_release`, `check_remote`, `get_remote_url`, `set_remote_url` | Integração GitHub |
| Projetos | `load_projects`, `save_projects` | JSON em `%APPDATA%/elements-publisher` |

## Camadas de segurança (validação no backend — `git_ops.rs`)

- `is_valid_path`: caminho absoluto + existência.
- `is_safe_rel_file`: bloqueia `..`, caminhos absolutos e `:` (travessia de diretório).
- `is_valid_branch_name` / `is_valid_tag_name`: bloqueia `~ ^ : ? * [ \ ..` e início com `-`.
- `set_remote_url`: exige URL `https://github.com/` ou `git@github.com:`; usa `set-url` se `origin` já existir (nunca duplica).
- `pull`: recusa com trabalho não commitado; explica conflitos.
- `push`: não usa `--force` — detecta rejeição non-fast-forward e devolve mensagem didática.
- O frontend nunca constrói uma linha de comando; todos os argumentos são arrays tipados.

## Fluxo de publicação (frontend `src/pages/Publish.tsx`)

1. `get_changes` → lista com categoria (new/modified/deleted/renamed/untracked) e staged.
2. Filtro de arquivos sensíveis (`isSensitive`): desmarca por padrão.
3. Revisão → `stage_files` → `commit` → `push` — cada etapa com log e erro detalhado.
4. Quando divergir: oferta de `pull` seguro (bloqueia com sujeira no worktree).

## Persistência

- Projetos: `%APPDATA%\elements-publisher\projects.json` (não sensível: nome, caminho, URL).
- Credenciais: **não** persistidas ou manipuladas pelo app — autenticação delegada ao Git Credential Manager ou GitHub CLI.

## Compilação

- Dev: `run-dev.bat` (injeta Cargo no PATH; Vite + `tauri dev`).
- Release: `run-build.bat` → `src-tauri/target/release/bundle/nsis/*.exe` (NSIS, instala no usuário atual, PT-BR).
- Configuração do bundle: `src-tauri/tauri.conf.json` (targets `["nsis"]`).

## Testes manuais (checklist)

- Git instalado / não instalado (desistir do PATH): setup orienta download.
- Nome/e-mail ausentes: commit bloqueado com orientação.
- Remote inexistente/incorreto: página Integração GitHub valida e corrige com autorização.
- Repo sem mudanças, com arquivos novos/modificados/excluídos: categorização correta no fluxo de publicação.
- Push bem-sucedido / autenticação falha / histórico divergente / conflito: mensagens reais do stderr exibidas, sem ações destrutivas.
- Branch/tag criadas com nomes inválidos → rejeitadas no backend.
