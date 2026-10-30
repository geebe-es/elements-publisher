<div align="center">

# Elements Publisher

**Central de gerenciamento de projetos locais e publicações no GitHub — sem usar comandos Git no terminal.**

Tauri 2 · React 19 · TypeScript · Rust · Tailwind CSS

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

- O frontend **nunca** envia comandos de shell arbitrários: cada operação é um comando Tauri tipado que chama o executável `git` com **argumentos separados e validados**.
- URLs, caminhos, nomes de branch e de tag são validados no backend Rust.
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

```powershell
# 1. Dependências
npm install

# 2. Desenvolvimento (requer Rust/Cargo no PATH)
.\run-dev.bat        # ou: $env:Path += ";$env:USERPROFILE\.cargo\bin"; npm.cmd run tauri dev

# 3. Gerar instalador Windows (NSIS)
.\run-build.bat      # saída em src-tauri\target\release\bundle\nsis\
```

## Estrutura

```
├── src/                    # Frontend React + TypeScript + Tailwind
│   ├── components/         # Sidebar, SetupWizard, ProjectCard
│   ├── pages/              # Dashboard, Projects, Publish, History,
│   │                       # Branches, Releases, Github, Settings, Logs
│   └── lib/                # api (comandos Tauri), logger, tipos
├── src-tauri/              # Backend Rust (Tauri 2)
│   └── src/
│       ├── git_ops.rs      # Operações Git + GitHub CLI (validadas)
│       ├── project_store.rs# Persistência local dos projetos (JSON)
│       └── lib.rs          # Registro dos comandos
└── docs/                   # Documentação de uso
```

## Performance

- Consultas ao Git/Remote **sob demanda** (sem polling contínuo).
- Sem processos Git persistentes; cada operação encerra o processo.
- Frontend enxuto ( sem dependências pesadas de UI).

---

*Elements Publisher — v0.1.0*
