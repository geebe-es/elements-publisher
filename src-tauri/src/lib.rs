// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod git_ops;
mod project_store;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            greet,
            git_ops::check_git_installation,
            git_ops::get_git_version,
            git_ops::get_git_config,
            git_ops::set_git_config,
            git_ops::get_project_status,
            git_ops::get_changes,
            git_ops::get_file_diff,
            git_ops::verify_identity,
            git_ops::stage_files,
            git_ops::commit,
            git_ops::push,
            git_ops::pull,
            git_ops::get_history,
            git_ops::get_branches,
            git_ops::create_branch,
            git_ops::switch_branch,
            git_ops::fetch,
            git_ops::list_tags,
            git_ops::create_tag,
            git_ops::push_tag,
            git_ops::check_gh_cli,
            git_ops::gh_auth_status,
            git_ops::gh_user,
            git_ops::check_remote,
            git_ops::get_remote_url,
            git_ops::set_remote_url,
            git_ops::gh_release_list,
            git_ops::gh_create_release,
            project_store::load_projects,
            project_store::save_projects
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
