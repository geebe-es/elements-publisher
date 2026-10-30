use std::process::Command;
use serde::{Serialize, Deserialize};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitResult {
    pub success: bool,
    pub output: String,
    pub error: Option<String>,
}

// Execução segura de comandos Git: executável fixo `git`, argumentos separados
// (nunca concatenados em shell), sem execução de comandos arbitrários do frontend.
pub fn run_git(args: Vec<&str>, cwd: &str) -> GitResult {
    let output = Command::new("git")
        .args(&args)
        .current_dir(cwd)
        .output();

    match output {
        Ok(o) => {
            if o.status.success() {
                GitResult {
                    success: true,
                    output: String::from_utf8_lossy(&o.stdout).to_string(),
                    error: None,
                }
            } else {
                GitResult {
                    success: false,
                    output: String::from_utf8_lossy(&o.stdout).to_string(),
                    error: Some(String::from_utf8_lossy(&o.stderr).to_string()),
                }
            }
        }
        Err(e) => GitResult {
            success: false,
            output: String::new(),
            error: Some(e.to_string()),
        },
    }
}

/// Validação básica de caminho: garante que é absoluto e que a pasta existe.
/// Bloqueia travessia para fora do repositório nos parâmetros de arquivos.
fn is_valid_path(path: &str) -> bool {
    let p = std::path::Path::new(path);
    p.is_absolute() && p.exists()
}

/// Rejeita caminhos relativos perigosos (travessia de diretório, caminho absoluto)
fn is_safe_rel_file(f: &str) -> bool {
    let f = f.trim();
    !f.is_empty()
        && !f.contains("..")
        && !f.starts_with('/')
        && !f.starts_with('\\')
        && !f.contains(':')
}

#[tauri::command]
pub fn check_git_installation() -> bool {
    let result = Command::new("git").arg("--version").output();
    result.is_ok()
}

/// Versão do Git instalado, ex.: "2.56.0"
#[tauri::command]
pub fn get_git_version() -> String {
    let out = Command::new("git").arg("--version").output();
    match out {
        Ok(o) => String::from_utf8_lossy(&o.stdout)
            .replace("git version", "")
            .trim()
            .to_string(),
        Err(_) => String::new(),
    }
}

#[tauri::command]
pub fn get_git_config(key: String, global: bool) -> String {
    let mut args = vec!["config"];
    if global { args.push("--global"); }
    args.push(&key);

    let res = run_git(args, ".");
    if res.success { res.output.trim().to_string() } else { "".to_string() }
}

#[tauri::command]
pub fn set_git_config(key: String, value: String, global: bool) -> GitResult {
    let mut args: Vec<&str> = vec!["config"];
    if global { args.push("--global"); }
    args.push(&key);
    args.push(&value);
    run_git(args, ".")
}

// ================= STATUS DO REPOSITÓRIO =================

#[derive(Serialize, Deserialize, Debug, Clone, Default)]
pub struct ProjectStatus {
    pub is_repo: bool,
    pub exists: bool,
    pub branch: String,
    pub remote_url: String,
    pub remote_ok: bool,
    pub last_commit_hash: String,
    pub last_commit_message: String,
    pub last_commit_author: String,
    pub last_commit_date: String,
    pub pending: usize,
}

#[tauri::command]
pub fn get_project_status(path: String) -> ProjectStatus {
    let mut status = ProjectStatus::default();

    if !is_valid_path(&path) {
        return status;
    }
    status.exists = true;

    let top = run_git(vec!["rev-parse", "--is-inside-work-tree"], &path);
    if !top.success || top.output.trim() != "true" {
        return status;
    }
    status.is_repo = true;

    let branch = run_git(vec!["branch", "--show-current"], &path);
    status.branch = branch.output.trim().to_string();

    let remote = run_git(vec!["remote", "get-url", "origin"], &path);
    if remote.success {
        status.remote_url = remote.output.trim().to_string();
        status.remote_ok = true;
    }

    let log = run_git(vec!["log", "-1", "--pretty=format:%h|%s|%an|%cr"], &path);
    if log.success {
        let parts: Vec<&str> = log.output.trim().splitn(4, '|').collect();
        if parts.len() >= 4 {
            status.last_commit_hash = parts[0].to_string();
            status.last_commit_message = parts[1].to_string();
            status.last_commit_author = parts[2].to_string();
            status.last_commit_date = parts[3].to_string();
        }
    }

    let st = run_git(vec!["status", "--porcelain"], &path);
    if st.success {
        status.pending = st.output.lines().filter(|l| !l.trim().is_empty()).count();
    }

    status
}

// ================= MUDANÇAS PENDENTES =================

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FileChange {
    pub path: String,
    /// código git status: "M ","??","D", etc.
    pub code: String,
    pub category: &'static str, // "modified" | "new" | "deleted" | "renamed" | "untracked"
    pub staged: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct ChangesResult {
    pub success: bool,
    pub branch: String,
    pub files: Vec<FileChange>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn get_changes(path: String) -> ChangesResult {
    let mut result = ChangesResult {
        success: false,
        branch: String::new(),
        files: Vec::new(),
        error: None,
    };

    if !is_valid_path(&path) {
        result.error = Some("Caminho do projeto inválido ou inexistente.".to_string());
        return result;
    }

    let out = run_git(vec!["status", "--porcelain", "-z", "-b"], &path);
    if !out.success {
        result.error = out.error;
        return result;
    }

    if !out.output.is_empty() {
        let mut entries = out.output.split('\0').peekable();
        while let Some(entry) = entries.peek() {
            if entry.is_empty() { entries.next(); continue; }
            if entry.starts_with("## ") {
                // "## branch...origin/branch"
                let raw = &entry[3..];
                result.branch = raw
                    .split("...")
                    .next()
                    .unwrap_or(raw)
                    .replace('[', "")
                    .replace(']', "")
                    .trim()
                    .to_string();
                entries.next();
                continue;
            }
            if entry.len() < 4 { entries.next(); continue; }

            let x = entry.as_bytes()[0] as char;
            let y = entry.as_bytes()[1] as char;
            let mut file_path = entry[3..].to_string();
            entries.next();

            let is_rename = x == 'R' || y == 'R';
            // Em modo -z, renomeação traz "novo<nul>antigo": o próximo item é o antigo
            if is_rename {
                if let Some(_old) = entries.next() { /* descarta */ }
            }

            let category: &'static str = if x == '?' {
                "untracked"
            } else if is_rename {
                "renamed"
            } else if x == 'D' || y == 'D' {
                "deleted"
            } else if x == 'A' {
                "new"
            } else {
                "modified"
            };

            result.files.push(FileChange {
                path: file_path,
                code: format!("{}{}", x, y),
                category,
                staged: y == ' ',
            });
        }
    }

    result.success = true;
    result
}

// ================= DIFERENÇAS (VISUALIZAÇÃO) =================

#[tauri::command]
pub fn get_file_diff(path: String, file: String) -> GitResult {
    if !is_valid_path(&path) || !is_safe_rel_file(&file) {
        return GitResult { success: false, output: String::new(), error: Some("Caminho inválido.".to_string()) };
    }
    // Arquivo não rastreado: mostra o conteúdo atual como "adições"
    let res = run_git(vec!["diff", "--", &file], &path);
    if res.success && res.output.trim().is_empty() {
        // Arquivo não rastreado: mostra conteúdo como adições
        let fs_path = std::path::Path::new(&path).join(&file);
        if fs_path.exists() {
            if let Ok(bytes) = std::fs::read(&fs_path) {
                if bytes.is_empty() {
                    return GitResult { success: true, output: "(arquivo vazio)".to_string(), error: None };
                }
                if bytes.len() > 60_000 {
                    return GitResult { success: true, output: "(arquivo muito grande para visualização)".to_string(), error: None };
                }
                if bytes.contains(&0) {
                    return GitResult { success: true, output: "(arquivo binário)".to_string(), error: None };
                }
                let content = String::from_utf8_lossy(&bytes);
                let diff: String = content
                    .lines()
                    .take(400)
                    .map(|l| format!("+ {l}"))
                    .collect::<Vec<_>>()
                    .join("\n");
                return GitResult { success: true, output: diff, error: None };
            }
        }
    }
    res
}

// ================= COMMIT E PUSH =================

#[derive(Serialize, Debug)]
pub struct CommitResult {
    pub success: bool,
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub error: Option<String>,
}

#[tauri::command]
pub fn verify_identity(path: String) -> GitResult {
    run_git(vec!["var", "GIT_COMMITTER_IDENT"], &path)
}

#[tauri::command]
pub fn stage_files(path: String, files: Vec<String>) -> GitResult {
    if !is_valid_path(&path) {
        return GitResult { success: false, output: String::new(), error: Some("Caminho inválido.".to_string()) };
    }
    for f in &files {
        if !is_safe_rel_file(f) {
            return GitResult {
                success: false,
                output: String::new(),
                error: Some(format!("Caminho não permitido: {f}")),
            };
        }
    }
    let refs: Vec<&str> = files.iter().map(|s| s.as_str()).collect();
    let mut args = vec!["add", "--"];
    args.extend(refs);
    run_git(args, &path)
}

#[tauri::command]
pub fn commit(path: String, message: String) -> CommitResult {
    let r = CommitResult {
        success: false,
        hash: String::new(),
        short_hash: String::new(),
        message: message.clone(),
        error: None,
    };
    if !is_valid_path(&path) {
        return CommitResult { error: Some("Caminho inválido.".to_string()), ..r };
    }
    if message.trim().is_empty() {
        return CommitResult { error: Some("A mensagem do commit não pode estar vazia.".to_string()), ..r };
    }

    // Falha de identidade: interromper antes do commit
    let id = verify_identity(path.clone());
    if !id.success {
        return CommitResult {
            error: Some(format!(
                "Identidade Git não configurada neste repositório. Configure nome e e-mail. Detalhes: {}",
                id.error.unwrap_or_default()
            )),
            ..r
        };
    }

    let c = run_git(vec!["commit", "-m", &message], &path);
    if !c.success {
        return CommitResult {
            error: Some(c.error.unwrap_or_else(|| "Falha ao criar commit.".to_string())),
            ..r
        };
    }

    let hash_out = run_git(vec!["rev-parse", "HEAD"], &path);
    let hash = hash_out.output.trim().to_string();
    let short = hash.chars().take(7).collect::<String>();
    CommitResult { success: true, hash, short_hash: short, message, error: None }
}

#[tauri::command]
pub fn push(path: String, branch: String) -> GitResult {
    if !is_valid_path(&path) || branch.trim().is_empty() || branch.contains("..") || branch.contains(' ')
    {
        return GitResult { success: false, output: String::new(), error: Some("Parâmetros inválidos para push.".to_string()) };
    }
    let res = run_git(vec!["push", "origin", &branch], &path);
    let errl = res.error.clone().unwrap_or_default().to_lowercase();
    if !res.success && (errl.contains("rejected") || errl.contains("non-fast-forward") || errl.contains("non-fast forward")) {
        return GitResult {
            success: false,
            output: res.output,
            error: Some(format!(
                "O PUSH FOI RECUSADO: o repositório remoto possui commits que não estão na sua cópia local (histórico divergiu).\n\n{}\n\nNenhum --force foi executado. Você pode: 1) Trazer os commits do remoto com 'git pull' (manterá suas alterações commitadas); 2) Revisar manualmente no terminal.",
                res.error.unwrap_or_default()
            )),
        };
    }
    res
}

#[tauri::command]
pub fn pull(path: String, branch: String) -> GitResult {
    if !is_valid_path(&path) || branch.trim().is_empty() {
        return GitResult { success: false, output: String::new(), error: Some("Parâmetros inválidos.".to_string()) };
    }
    // Impede pull com trabalho não comitado (evita conflitos destrutivos)
    let st = run_git(vec!["status", "--porcelain"], &path);
    if st.success && !st.output.trim().is_empty() {
        return GitResult {
            success: false,
            output: String::new(),
            error: Some(
                "Existem alterações NÃO commitadas. Faça o commit (ou guarde com git stash) antes de atualizar a cópia local — nada será descartado.".to_string(),
            ),
        };
    }
    let res = run_git(vec!["pull", "origin", &branch], &path);
    let errl = res.error.clone().unwrap_or_default().to_lowercase();
    if !res.success && (errl.contains("conflict") || errl.contains("conflicts")) {
        return GitResult {
            success: false,
            output: res.output,
            error: Some(format!(
                "CONFLITOS detectados durante o pull. Os arquivos envolvidos:\n\n{}\n\nResolva manualmente e faça commit. Nenhuma alteração foi apagada.",
                res.error.unwrap_or_default()
            )),
        };
    }
    res
}

// ================= HISTÓRICO =================

#[derive(Serialize, Debug, Clone)]
pub struct CommitLog {
    pub hash: String,
    pub short_hash: String,
    pub message: String,
    pub author: String,
    pub date: String,
}

#[tauri::command]
pub fn get_history(path: String, limit: i32) -> Vec<CommitLog> {
    let n = limit.clamp(1, 200);
    let mut out = Vec::new();
    let res = run_git(
        vec![
            "log",
            format!("-n{}", n).as_str(),
            "--pretty=format:%H|%h|%s|%an|%cr",
            "--date=short",
        ],
        &path,
    );
    if res.success {
        for line in res.output.lines() {
            let parts: Vec<&str> = line.splitn(5, '|').collect();
            if parts.len() >= 5 {
                out.push(CommitLog {
                    hash: parts[0].to_string(),
                    short_hash: parts[1].to_string(),
                    message: parts[2].to_string(),
                    author: parts[3].to_string(),
                    date: parts[4].to_string(),
                });
            }
        }
    }
    out
}

// ================= BRANCHES =================

#[derive(Serialize, Debug)]
pub struct BranchesResult {
    pub current: String,
    pub local: Vec<String>,
    pub remote: Vec<String>,
}

#[tauri::command]
pub fn get_branches(path: String) -> BranchesResult {
    let mut res = BranchesResult { current: String::new(), local: Vec::new(), remote: Vec::new() };
    let cur = run_git(vec!["branch", "--show-current"], &path);
    res.current = cur.output.trim().to_string();

    let local = run_git(vec!["branch", "--format=%(refname:short)"], &path);
    if local.success {
        res.local = local.output.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    }
    let remote = run_git(vec!["branch", "-r", "--format=%(refname:short)"], &path);
    if remote.success {
        res.remote = remote.output.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
    }
    res
}

#[tauri::command]
pub fn create_branch(path: String, name: String) -> GitResult {
    if !is_valid_path(&path) || !is_valid_branch_name(&name) {
        return GitResult { success: false, output: String::new(), error: Some("Nome de branch inválido (evite espaços, .. e caracteres especiais).".to_string()) };
    }
    run_git(vec!["checkout", "-b", &name], &path)
}

#[tauri::command]
pub fn switch_branch(path: String, name: String) -> GitResult {
    if !is_valid_path(&path) || !is_valid_branch_name(&name) {
        return GitResult { success: false, output: String::new(), error: Some("Nome de branch inválido.".to_string()) };
    }
    // Não descartar alterações automaticamente: Git recusa checkout com mudanças conflitantes
    run_git(vec!["switch", &name], &path)
}

#[tauri::command]
pub fn fetch(path: String) -> GitResult {
    if !is_valid_path(&path) {
        return GitResult { success: false, output: String::new(), error: Some("Caminho inválido.".to_string()) };
    }
    run_git(vec!["fetch", "--all"], &path)
}

fn is_valid_branch_name(name: &str) -> bool {
    let n = name.trim();
    !n.is_empty()
        && !n.starts_with('-')
        && !n.contains("..")
        && !n.contains(' ')
        && n.is_ascii()
        && !n.contains('~')
        && !n.contains('^')
        && !n.contains(':')
        && !n.contains('?')
        && !n.contains('*')
        && !n.contains('[')
        && !n.contains('\\')
}

// ================= TAGS (para GitHub Releases) =================

#[tauri::command]
pub fn list_tags(path: String) -> Vec<String> {
    let res = run_git(vec!["tag", "--sort=-creatordate"], &path);
    if res.success {
        res.output.lines().map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect()
    } else {
        Vec::new()
    }
}

#[tauri::command]
pub fn create_tag(path: String, name: String, message: String) -> GitResult {
    if !is_valid_path(&path) || !is_valid_tag_name(&name) {
        return GitResult { success: false, output: String::new(), error: Some("Nome de tag inválido (ex.: v1.0.0 — sem espaços).".to_string()) };
    }
    if message.trim().is_empty() {
        return GitResult { success: false, output: String::new(), error: Some("Escreva as notas da versão (message obrigatória).".to_string()) };
    }
    run_git(vec!["tag", "-a", &name, "-m", &message], &path)
}

#[tauri::command]
pub fn push_tag(path: String, name: String) -> GitResult {
    if !is_valid_path(&path) || !is_valid_tag_name(&name) {
        return GitResult { success: false, output: String::new(), error: Some("Nome de tag inválido.".to_string()) };
    }
    run_git(vec!["push", "origin", &name], &path)
}

fn is_valid_tag_name(name: &str) -> bool {
    is_valid_branch_name(name)
}

// ================= INTEGRAÇÃO GITHUB =================

/// Verifica se o GitHub CLI está instalado e autenticado (`gh auth status`)
#[tauri::command]
pub fn gh_auth_status() -> GitResult {
    let installed = Command::new("gh").arg("--version").output().is_ok();
    if !installed {
        return GitResult {
            success: false,
            output: String::new(),
            error: Some("GitHub CLI (gh) não está instalado. Baixe em https://cli.github.com — sem ele a autenticação é feita pelo Git Credential Manager durante o push (janelinha de login do GitHub na primeira vez).".to_string()),
        };
    }
    let out = Command::new("gh").args(["auth", "status"]).output();
    match out {
        Ok(o) if o.status.success() => GitResult {
            success: true,
            output: String::from_utf8_lossy(&o.stdout).to_string(),
            error: None,
        },
        Ok(o) => GitResult {
            success: false,
            output: String::from_utf8_lossy(&o.stdout).to_string(),
            error: Some(format!(
                "GitHub CLI instalado, mas NÃO autenticado. Execute 'gh auth login' no terminal (ou use o Git Credential Manager ao publicar). Saída: {}",
                String::from_utf8_lossy(&o.stderr)
            )),
        },
        Err(e) => GitResult { success: false, output: String::new(), error: Some(e.to_string()) },
    }
}

/// Expõe o usuário autenticado no GitHub (se gh disponível)
#[tauri::command]
pub fn gh_user() -> String {
    let out = Command::new("gh").args(["api", "user", "--jq", ".login"]).output();
    match out {
        Ok(o) if o.status.success() => String::from_utf8_lossy(&o.stdout).trim().to_string(),
        _ => String::new(),
    }
}

/// Valida conexão com o remote: lista heads do origin (leitura, não altera nada)
#[tauri::command]
pub fn check_remote(path: String) -> GitResult {
    if !is_valid_path(&path) {
        return GitResult { success: false, output: String::new(), error: Some("Caminho inválido.".to_string()) };
    }
    run_git(vec!["ls-remote", "--heads", "origin"], &path)
}

/// Retorna a URL atual do remote origin
#[tauri::command]
pub fn get_remote_url(path: String) -> GitResult {
    if !is_valid_path(&path) {
        return GitResult { success: false, output: String::new(), error: Some("Caminho inválido.".to_string()) };
    }
    run_git(vec!["remote", "get-url", "origin"], &path)
}

/// Altera a URL do remote origin (requer validação prévia de parâmetros)
#[tauri::command]
pub fn set_remote_url(path: String, url: String) -> GitResult {
    if !is_valid_path(&path) {
        return GitResult { success: false, output: String::new(), error: Some("Caminho inválido.".to_string()) };
    }
    let ok_url = url.starts_with("https://github.com/") || url.starts_with("git@github.com:");
    if !ok_url {
        return GitResult { success: false, output: String::new(), error: Some("URL deve ser do GitHub (https://github.com/... ou git@github.com:...).".to_string()) };
    }
    let exists = run_git(vec!["remote", "get-url", "origin"], &path);
    if exists.success {
        // origin já existe: apenas atualiza a URL (nunca adiciona um segundo "origin")
        run_git(vec!["remote", "set-url", "origin", &url], &path)
    } else {
        run_git(vec!["remote", "add", "origin", &url], &path)
    }
}

// ================= GITHUB CLI (opcional) =================

#[tauri::command]
pub fn check_gh_cli() -> bool {
    Command::new("gh").arg("--version").output().is_ok()
}

#[tauri::command]
pub fn gh_release_list(repo_url: String) -> GitResult {
    let repo_slug = match extract_repo_slug(&repo_url) {
        Some(s) => s,
        None => return GitResult { success: false, output: String::new(), error: Some("URL de repositório GitHub inválida.".to_string()) },
    };
    // Consulta pública: usa os releases visíveis do repositório
    let out = Command::new("gh")
        .args(["api", "-X", "GET", &format!("repos/{repo_slug}/releases?per_page=10")])
        .output();
    match out {
        Ok(o) if o.status.success() => GitResult {
            success: true,
            output: String::from_utf8_lossy(&o.stdout).to_string(),
            error: None,
        },
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr).to_string();
            // Fallback: se gh falhar (ex.: não autenticado), tenta consulta anônima via REST
            let url = format!("https://api.github.com/repos/{repo_slug}/releases?per_page=10");
            let with_header = Command::new("curl")
                .args(["-s", "-H", "Accept: application/vnd.github+json", &url])
                .output();
            match with_header {
                Ok(o2) if o2.status.success() => GitResult {
                    success: true,
                    output: String::from_utf8_lossy(&o2.stdout).to_string(),
                    error: None,
                },
                _ => GitResult { success: false, output: stderr, error: Some("Não foi possível consultar os releases (gh CLI indisponível ou falha de rede).".to_string()) },
            }
        }
        Err(_) => GitResult { success: false, output: String::new(), error: Some("GitHub CLI (gh) não encontrado. Instale em https://cli.github.com".to_string()) },
    }
}

#[tauri::command]
pub fn gh_create_release(repo_url: String, tag: String, title: String, notes: String, assets: Vec<String>) -> GitResult {
    let repo_slug = match extract_repo_slug(&repo_url) {
        Some(s) => s,
        None => return GitResult { success: false, output: String::new(), error: Some("URL de repositório GitHub inválida.".to_string()) },
    };
    if !is_valid_tag_name(&tag) {
        return GitResult { success: false, output: String::new(), error: Some("Tag inválida.".to_string()) };
    }
    // Requer criação prévia da tag e push via git (feito nos comandos create_tag/push_tag)
    // assets: caminhos absolutos de arquivos existentes (exe/msi/zip) para anexar
    for a in &assets {
        if !std::path::Path::new(a).exists() {
            return GitResult {
                success: false,
                output: String::new(),
                error: Some(format!("Arquivo de anexo não existe: {a}")),
            };
        }
    }
    let mut args: Vec<String> = vec![
        "release".to_string(),
        "create".to_string(),
        tag.clone(),
        "--repo".to_string(),
        repo_slug,
        "--title".to_string(),
        title.clone(),
        "--notes".to_string(),
        notes.clone(),
    ];
    for a in &assets {
        args.push(a.clone());
    }
    let arg_refs: Vec<&str> = args.iter().map(|s| s.as_str()).collect();
    let out = Command::new("gh")
        .args(&arg_refs)
        .output();
    match out {
        Ok(o) if o.status.success() => GitResult {
            success: true,
            output: String::from_utf8_lossy(&o.stdout).to_string(),
            error: None,
        },
        Ok(o) => GitResult {
            success: false,
            output: String::from_utf8_lossy(&o.stdout).to_string(),
            error: Some(String::from_utf8_lossy(&o.stderr).to_string()),
        },
        Err(_) => GitResult {
            success: false,
            output: String::new(),
            error: Some("GitHub CLI (gh) não encontrado. Instale em https://cli.github.com e execute 'gh auth login'.".to_string()),
        },
    }
}

/// Extrai "owner/repo" de URLs como https://github.com/owner/repo.git
fn extract_repo_slug(url: &str) -> Option<String> {
    let clean = url
        .trim()
        .trim_end_matches('/')
        .trim_end_matches(".git");
    let prefix = "https://github.com/";
    let rest = clean.strip_prefix(prefix)?;
    if rest.is_empty() || !rest.matches('/').count() == 1 && rest.matches('/').count() != 1 {
        return None;
    }
    let mut parts = rest.split('/');
    let owner = parts.next()?;
    let repo = parts.next()?;
    if owner.is_empty() || repo.is_empty() { return None; }
    Some(format!("{owner}/{repo}"))
}
