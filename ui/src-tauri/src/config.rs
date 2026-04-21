use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub api_base_url: String,
    /// Postgres connection string for the bundled Fortemi sidecar.
    /// If empty, the sidecar is not launched (external Fortemi assumed).
    #[serde(default = "default_database_url")]
    pub database_url: String,
    /// Directory where the Fortemi sidecar stores attachment files.
    /// Defaults to <app_data>/fortemi-files.
    #[serde(default)]
    pub file_storage_path: String,
}

fn default_database_url() -> String {
    "postgres://matric:matric@localhost/matric".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_base_url: "http://127.0.0.1:3000".to_string(),
            database_url: default_database_url(),
            file_storage_path: String::new(),
        }
    }
}

fn config_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join("config.json"))
}

/// Load config from disk. Returns defaults if no config file exists.
pub fn load_config(app: &AppHandle) -> AppConfig {
    let Some(path) = config_path(app) else {
        return AppConfig::default();
    };

    match fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_default(),
        Err(_) => AppConfig::default(),
    }
}

/// Save config to disk, creating parent directories as needed.
pub fn save_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = config_path(app).ok_or("Could not determine config directory")?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create config dir: {e}"))?;
    }

    let json =
        serde_json::to_string_pretty(config).map_err(|e| format!("Failed to serialize: {e}"))?;

    fs::write(&path, json).map_err(|e| format!("Failed to write config: {e}"))?;

    Ok(())
}
