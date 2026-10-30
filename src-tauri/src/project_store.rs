use serde::{Serialize, Deserialize};
use std::fs;
use std::path::PathBuf;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Project {
    pub name: String,
    pub path: String,
    pub repo_url: String,
}

pub fn get_config_path() -> PathBuf {
    // Usa %APPDATA% no Windows; fallback para o diretório atual
    let mut path = std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    path.push("elements-publisher");
    if !path.exists() {
        fs::create_dir_all(&path).ok();
    }
    path.push("projects.json");
    path
}

#[tauri::command]
pub fn load_projects() -> Vec<Project> {
    let path = get_config_path();
    if let Ok(content) = fs::read_to_string(path) {
        serde_json::from_str(&content).unwrap_or_else(|_| default_projects())
    } else {
        default_projects()
    }
}

#[tauri::command]
pub fn save_projects(projects: Vec<Project>) -> bool {
    let path = get_config_path();
    if let Ok(content) = serde_json::to_string_pretty(&projects) {
        fs::write(path, content).is_ok()
    } else {
        false
    }
}

fn default_projects() -> Vec<Project> {
    vec![
        Project {
            name: "Elements Launcher".to_string(),
            path: "D:\\APPS\\Elements Launcher".to_string(),
            repo_url: "https://github.com/geebe-es/elements-launcher.git".to_string(),
        },
        Project {
            name: "ConvertMp3".to_string(),
            path: "D:\\APPS\\ConvertMP3".to_string(),
            repo_url: "https://github.com/geebe-es/ConvertMp3.git".to_string(),
        },
        Project {
            name: "InstaSave".to_string(),
            path: "D:\\APPS\\InstaSave".to_string(),
            repo_url: "https://github.com/geebe-es/Instasave.git".to_string(),
        },
    ]
}
