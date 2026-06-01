use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComponentConfig {
    /// Enable the local Ollama runtime configuration for the bundled sidecar.
    #[serde(default = "default_enabled")]
    pub ollama: bool,
    /// Enable the Whisper-compatible transcription service for audio/video jobs.
    #[serde(default = "default_enabled")]
    pub whisper: bool,
}

impl Default for ComponentConfig {
    fn default() -> Self {
        Self {
            ollama: true,
            whisper: true,
        }
    }
}

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
    /// Local service component toggles. Installers enable all by default;
    /// deployment-specific configs can opt out of expensive processors.
    #[serde(default)]
    pub components: ComponentConfig,
    /// Ollama API base used by the bundled sidecar when components.ollama is true.
    #[serde(default = "default_ollama_base_url")]
    pub ollama_base_url: String,
    /// Whisper-compatible API base used by the bundled sidecar when components.whisper is true.
    #[serde(default = "default_whisper_base_url")]
    pub whisper_base_url: String,
}

fn default_enabled() -> bool {
    true
}

fn default_database_url() -> String {
    "postgres://matric:matric@localhost/matric".to_string()
}

fn default_ollama_base_url() -> String {
    "http://127.0.0.1:11434".to_string()
}

fn default_whisper_base_url() -> String {
    "http://127.0.0.1:8000".to_string()
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            api_base_url: "http://127.0.0.1:3000".to_string(),
            database_url: default_database_url(),
            file_storage_path: String::new(),
            components: ComponentConfig::default(),
            ollama_base_url: default_ollama_base_url(),
            whisper_base_url: default_whisper_base_url(),
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
