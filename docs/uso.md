# Guia de Uso — Elements Publisher

## 1. Primeira execução

O assistente verifica automaticamente e exibe o status de cada item:

| Verificação | O que significa |
|---|---|
| Git instalado | Git disponível no PATH e com versão identificada |
| Nome / E-mail | Configuração global `user.name` / `user.email` |
| GitHub | GitHub CLI instalado (opcional) e autenticação |

- Se uma verificação falhar, o app mostra o problema e o **link oficial para baixar** (git-scm.com ou cli.github.com). O app **não instala** nada silenciosamente.
- Configure **Nome** e **E-mail** — nada é gravado na configuração do Git sem que você clique em *Confirmar e Salvar*.

## 2. Meus Projetos

Cada projeto tem: nome, caminho local, URL do repositório, branch atual, último commit, quantidade de alterações pendentes e status da conexão.

- **Atualizar status**: consulta o Git local de cada pasta.
- Se a pasta não for um repositório, o app informa o erro real ("not a git repository") em vez de tentar forçar algo.

## 3. Publicar atualizações

1. Abra **Publicar** e escolha o projeto.
2. O app lista as alterações por tipo com checkboxes.
   - Arquivos sensíveis (`.env`, `*token*`, `*password*`, `.pem`, `.key`, `node_modules/`, `dist/`...) vêm **desmarcados** com aviso laranja.
3. Clique no ícone de olho para **ver as diferenças** de um arquivo.
4. Escreva a mensagem do commit (ou use a sugestão automática).
5. **Revisão**: confirme projeto, repo, branch, arquivos e mensagem.
6. Publique. O log mostra cada etapa: identidade → add → commit → push.
7. Sucesso: hash, data e **link do commit no GitHub**.

### Erros comuns

| Erro | Significado | Ação |
|---|---|---|
| PUSH FOI RECUSADO / histórico divergiu | O GitHub tem commits fora da sua cópia | Use *Atualizar cópia local (git pull)* — o app recusa se haver mudanças não commitadas |
| Identidade não configurada | `user.name`/`user.email` ausentes | Configure em *Configurações* |
| Conflitos no pull | Mesmo arquivo alterado dos dois lados | Resolva no editor; nada é descartado |
| Identidade categoria Janela login do GitHub | Credential Manager pedindo autenticação | Faça login pelo navegador — token fica no Gerenciador de Credenciais do Windows |

## 4. Branches e Releases

- **Branches**: clique numa local para trocar; **Criar** com nome validado; `git fetch` atualiza as referências; nunca descarta alterações automaticamente.
- **Releases**: versão + notas → cria tag anotada (`git tag -a`) → envia ao GitHub → cria a **Release** completa com o `gh` CLI (se instalado e autenticado). Consulte releases existentes via API.

## 5. Integração GitHub

- Mostra se o `gh` CLI está instalado e autenticado (`gh auth status`) e o usuário conectado.
- Valida a conexão com o `origin` de cada projeto (`git ls-remote`).
- Permite corrigir a URL do remote com autorização — **nunca** cria um segundo `origin`.

## 6. Logs e Diagnóstico

- Toda operação relevante gera uma linha com horário, sem tokens/credenciais.
- Botão **Copiar** para colar em relatórios/bugs.
- "Diagnóstico Git" registra a versão do Git e presença do `gh`.
