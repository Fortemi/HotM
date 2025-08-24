//! Configuration management for HotM applications
//! 
//! This module provides configuration loading and management functionality
//! that can be shared between server and unified runtime modes.

use crate::models::AppConfig;
use anyhow::{Context, Result};
#[allow(unused_imports)]
use serde::{Deserialize, Serialize};
use std::env;
use std::path::PathBuf;

/// Configuration loader trait for testability
pub trait ConfigLoader: Send + Sync {
    fn load_config(&self, config_path: Option<&str>) -> Result<AppConfig>;
    fn save_config(&self, config: &AppConfig, config_path: Option<&str>) -> Result<()>;
}

/// Environment-based configuration loader
pub struct EnvConfigLoader;

impl EnvConfigLoader {
    pub fn new() -> Self {
        Self
    }
}

impl Default for EnvConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigLoader for EnvConfigLoader {
    fn load_config(&self, _config_path: Option<&str>) -> Result<AppConfig> {
        Ok(AppConfig {
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://hotm:hotm@localhost:5432/hotm_dev".to_string()),
            ollama_base_url: env::var("OLLAMA_BASE")
                .or_else(|_| env::var("OLLAMA_URL"))
                .unwrap_or_else(|_| "http://localhost:11434".to_string()),
            embed_model: env::var("OLLAMA_EMBED_MODEL")
                .or_else(|_| env::var("OLLAMA_EMBEDDING_MODEL"))
                .unwrap_or_else(|_| "nomic-embed-text".to_string()),
            generation_model: env::var("OLLAMA_GEN_MODEL")
                .or_else(|_| env::var("OLLAMA_GENERATION_MODEL"))
                .unwrap_or_else(|_| "gpt-oss:20b".to_string()),
            bind_address: env::var("BIND_ADDRESS")
                .unwrap_or_else(|_| "127.0.0.1".to_string()),
            bind_port: env::var("BIND_PORT")
                .unwrap_or_else(|_| "53211".to_string())
                .parse()
                .context("Invalid BIND_PORT")?,
        })
    }

    fn save_config(&self, _config: &AppConfig, _config_path: Option<&str>) -> Result<()> {
        // Environment-based config doesn't support saving
        Err(anyhow::anyhow!("Environment configuration doesn't support saving"))
    }
}

/// File-based configuration loader
pub struct FileConfigLoader {
    default_path: PathBuf,
}

impl FileConfigLoader {
    pub fn new() -> Self {
        let mut default_path = dirs::config_dir().unwrap_or_else(|| PathBuf::from("."));
        default_path.push("hotm");
        default_path.push("config.json");
        
        Self { default_path }
    }

    pub fn with_path(path: PathBuf) -> Self {
        Self { default_path: path }
    }

    fn get_config_path(&self, config_path: Option<&str>) -> PathBuf {
        config_path
            .map(PathBuf::from)
            .unwrap_or_else(|| self.default_path.clone())
    }
}

impl Default for FileConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigLoader for FileConfigLoader {
    fn load_config(&self, config_path: Option<&str>) -> Result<AppConfig> {
        let path = self.get_config_path(config_path);
        
        if path.exists() {
            let content = std::fs::read_to_string(&path)
                .with_context(|| format!("Failed to read config file: {}", path.display()))?;
            
            let config: AppConfig = serde_json::from_str(&content)
                .with_context(|| format!("Failed to parse config file: {}", path.display()))?;
            
            Ok(config)
        } else {
            // Return default config if file doesn't exist
            Ok(AppConfig::default())
        }
    }

    fn save_config(&self, config: &AppConfig, config_path: Option<&str>) -> Result<()> {
        let path = self.get_config_path(config_path);
        
        // Create parent directories if they don't exist
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("Failed to create config directory: {}", parent.display()))?;
        }
        
        let content = serde_json::to_string_pretty(config)
            .context("Failed to serialize config")?;
        
        std::fs::write(&path, content)
            .with_context(|| format!("Failed to write config file: {}", path.display()))?;
        
        Ok(())
    }
}

/// Combined configuration loader that tries file first, then environment
pub struct CombinedConfigLoader {
    file_loader: FileConfigLoader,
    env_loader: EnvConfigLoader,
}

impl CombinedConfigLoader {
    pub fn new() -> Self {
        Self {
            file_loader: FileConfigLoader::new(),
            env_loader: EnvConfigLoader::new(),
        }
    }

    pub fn with_file_path(path: PathBuf) -> Self {
        Self {
            file_loader: FileConfigLoader::with_path(path),
            env_loader: EnvConfigLoader::new(),
        }
    }
}

impl Default for CombinedConfigLoader {
    fn default() -> Self {
        Self::new()
    }
}

impl ConfigLoader for CombinedConfigLoader {
    fn load_config(&self, config_path: Option<&str>) -> Result<AppConfig> {
        // Try to load from file first
        match self.file_loader.load_config(config_path) {
            Ok(mut config) => {
                // Override with environment variables if present
                if let Ok(env_config) = self.env_loader.load_config(None) {
                    // Only override if env vars are actually set
                    if env::var("DATABASE_URL").is_ok() {
                        config.database_url = env_config.database_url;
                    }
                    if env::var("OLLAMA_BASE").is_ok() || env::var("OLLAMA_URL").is_ok() {
                        config.ollama_base_url = env_config.ollama_base_url;
                    }
                    if env::var("OLLAMA_EMBED_MODEL").is_ok() || env::var("OLLAMA_EMBEDDING_MODEL").is_ok() {
                        config.embed_model = env_config.embed_model;
                    }
                    if env::var("OLLAMA_GEN_MODEL").is_ok() || env::var("OLLAMA_GENERATION_MODEL").is_ok() {
                        config.generation_model = env_config.generation_model;
                    }
                    if env::var("BIND_ADDRESS").is_ok() {
                        config.bind_address = env_config.bind_address;
                    }
                    if env::var("BIND_PORT").is_ok() {
                        config.bind_port = env_config.bind_port;
                    }
                }
                Ok(config)
            }
            Err(_) => {
                // Fall back to environment-only if file loading fails
                self.env_loader.load_config(None)
            }
        }
    }

    fn save_config(&self, config: &AppConfig, config_path: Option<&str>) -> Result<()> {
        self.file_loader.save_config(config, config_path)
    }
}

/// Configuration validation
pub fn validate_config(config: &AppConfig) -> Result<()> {
    // Validate database URL format
    if !config.database_url.starts_with("postgres://") && !config.database_url.starts_with("postgresql://") {
        return Err(anyhow::anyhow!("Invalid database URL format"));
    }

    // Validate Ollama URL format
    if !config.ollama_base_url.starts_with("http://") && !config.ollama_base_url.starts_with("https://") {
        return Err(anyhow::anyhow!("Invalid Ollama base URL format"));
    }

    // Validate port range
    if config.bind_port == 0 {
        return Err(anyhow::anyhow!("Invalid bind port: {}", config.bind_port));
    }

    // Validate model names are not empty
    if config.embed_model.is_empty() {
        return Err(anyhow::anyhow!("Embedding model name cannot be empty"));
    }

    if config.generation_model.is_empty() {
        return Err(anyhow::anyhow!("Generation model name cannot be empty"));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use tempfile::tempdir;

    #[test]
    fn test_env_config_loader() {
        // Clean up any leftover env vars from other tests
        env::remove_var("BIND_PORT");
        env::remove_var("DATABASE_URL");
        
        let loader = EnvConfigLoader::new();
        
        // Test with default values when no env vars are set
        let config = loader.load_config(None).unwrap();
        assert_eq!(config.bind_port, 53211);
        assert_eq!(config.bind_address, "127.0.0.1");
    }

    #[test]
    fn test_env_config_loader_with_vars() {
        // Clean up first
        env::remove_var("DATABASE_URL");
        env::remove_var("BIND_PORT");
        
        env::set_var("DATABASE_URL", "postgres://test:test@localhost:5432/test");
        env::set_var("BIND_PORT", "8080");
        
        let loader = EnvConfigLoader::new();
        let config = loader.load_config(None).unwrap();
        
        assert_eq!(config.database_url, "postgres://test:test@localhost:5432/test");
        assert_eq!(config.bind_port, 8080);
        
        // Clean up after test
        env::remove_var("DATABASE_URL");
        env::remove_var("BIND_PORT");
        
        env::remove_var("DATABASE_URL");
        env::remove_var("BIND_PORT");
    }

    #[test]
    fn test_file_config_loader() {
        let dir = tempdir().unwrap();
        let config_path = dir.path().join("config.json");
        let loader = FileConfigLoader::with_path(config_path.clone());
        
        // Test loading non-existent file returns default
        let config = loader.load_config(None).unwrap();
        assert_eq!(config.bind_port, 53211);
        
        // Test saving and loading
        let mut modified_config = config;
        modified_config.bind_port = 9090;
        
        loader.save_config(&modified_config, None).unwrap();
        let loaded_config = loader.load_config(None).unwrap();
        
        assert_eq!(loaded_config.bind_port, 9090);
    }

    #[test]
    fn test_combined_config_loader() {
        let dir = tempdir().unwrap();
        let config_path = dir.path().join("config.json");
        let loader = CombinedConfigLoader::with_file_path(config_path.clone());
        
        // Create a config file with specific values
        let file_config = AppConfig {
            bind_port: 8080,
            database_url: "postgres://file:file@localhost:5432/file".to_string(),
            ..AppConfig::default()
        };
        
        std::fs::create_dir_all(config_path.parent().unwrap()).unwrap();
        let content = serde_json::to_string_pretty(&file_config).unwrap();
        std::fs::write(&config_path, content).unwrap();
        
        // Set an environment variable that should override the file
        env::set_var("DATABASE_URL", "postgres://env:env@localhost:5432/env");
        
        let config = loader.load_config(None).unwrap();
        
        // Should use env var for database_url, but file value for bind_port
        assert_eq!(config.database_url, "postgres://env:env@localhost:5432/env");
        assert_eq!(config.bind_port, 8080);
        
        env::remove_var("DATABASE_URL");
    }

    #[test]
    fn test_validate_config() {
        let valid_config = AppConfig::default();
        assert!(validate_config(&valid_config).is_ok());
        
        let invalid_db_url = AppConfig {
            database_url: "invalid://url".to_string(),
            ..AppConfig::default()
        };
        assert!(validate_config(&invalid_db_url).is_err());
        
        let invalid_port = AppConfig {
            bind_port: 0,
            ..AppConfig::default()
        };
        assert!(validate_config(&invalid_port).is_err());
        
        let empty_model = AppConfig {
            embed_model: "".to_string(),
            ..AppConfig::default()
        };
        assert!(validate_config(&empty_model).is_err());
    }
}