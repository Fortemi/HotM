//! Configuration management for HotM service manager
//! 
//! Handles loading, validation, and management of service configurations
//! with support for TOML files and environment variable overrides.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;
use tracing::{info, warn};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceConfiguration {
    pub services: HashMap<String, ServiceDefinition>,
    pub monitoring: MonitoringConfiguration,
    pub recovery: RecoveryConfiguration,
    pub logging: LoggingConfiguration,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceDefinition {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub executable_path: String,
    pub arguments: Vec<String>,
    pub working_directory: Option<String>,
    pub dependencies: Vec<String>,
    pub startup_type: String,
    pub account: String,
    pub priority: u32,
    pub ports: Vec<u16>,
    pub environment: HashMap<String, String>,
    pub health_checks: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringConfiguration {
    pub enabled: bool,
    pub interval_seconds: u64,
    pub default_timeout_ms: u64,
    pub health_check_retries: u32,
    pub metrics_collection: bool,
    pub performance_counters: bool,
    
    // Service-specific port configurations
    pub postgresql_port: Option<u16>,
    pub ollama_port: Option<u16>,
    pub hotm_server_port: Option<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryConfiguration {
    pub enabled: bool,
    pub max_restart_attempts: u32,
    pub restart_delay_seconds: u64,
    pub escalation_threshold: u32,
    pub recovery_actions: HashMap<String, RecoveryAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RecoveryAction {
    pub name: String,
    pub action_type: String,
    pub parameters: HashMap<String, String>,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoggingConfiguration {
    pub level: String,
    pub file_path: Option<String>,
    pub max_file_size: u64,
    pub max_files: u32,
    pub console_output: bool,
    pub event_log: bool,
}

impl Default for ServiceConfiguration {
    fn default() -> Self {
        Self {
            services: Self::default_services(),
            monitoring: MonitoringConfiguration::default(),
            recovery: RecoveryConfiguration::default(),
            logging: LoggingConfiguration::default(),
        }
    }
}

impl ServiceConfiguration {
    pub async fn load(config_path: &Path) -> Result<Self> {
        if config_path.exists() {
            info!("Loading service configuration from: {}", config_path.display());
            
            let config_content = tokio::fs::read_to_string(config_path)
                .await
                .context("Failed to read configuration file")?;
            
            let mut config: ServiceConfiguration = toml::from_str(&config_content)
                .context("Failed to parse configuration file")?;
            
            // Apply environment variable overrides
            config.apply_environment_overrides()?;
            
            // Validate configuration
            config.validate()?;
            
            Ok(config)
        } else {
            warn!("Configuration file not found, using defaults: {}", config_path.display());
            let mut config = Self::default();
            config.apply_environment_overrides()?;
            config.validate()?;
            Ok(config)
        }
    }
    
    pub async fn save(&self, config_path: &Path) -> Result<()> {
        info!("Saving service configuration to: {}", config_path.display());
        
        // Ensure parent directory exists
        if let Some(parent) = config_path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .context("Failed to create configuration directory")?;
        }
        
        let config_content = toml::to_string_pretty(self)
            .context("Failed to serialize configuration")?;
        
        tokio::fs::write(config_path, config_content)
            .await
            .context("Failed to write configuration file")?;
        
        info!("Configuration saved successfully");
        Ok(())
    }
    
    fn apply_environment_overrides(&mut self) -> Result<()> {
        // Override service configurations from environment variables
        if let Ok(db_port) = std::env::var("HOTM_POSTGRES_PORT") {
            if let Ok(port) = db_port.parse::<u16>() {
                self.monitoring.postgresql_port = Some(port);
            }
        }
        
        if let Ok(ollama_port) = std::env::var("HOTM_OLLAMA_PORT") {
            if let Ok(port) = ollama_port.parse::<u16>() {
                self.monitoring.ollama_port = Some(port);
            }
        }
        
        if let Ok(server_port) = std::env::var("HOTM_SERVER_PORT") {
            if let Ok(port) = server_port.parse::<u16>() {
                self.monitoring.hotm_server_port = Some(port);
            }
        }
        
        if let Ok(log_level) = std::env::var("HOTM_LOG_LEVEL") {
            self.logging.level = log_level;
        }
        
        if let Ok(monitoring_enabled) = std::env::var("HOTM_MONITORING_ENABLED") {
            if let Ok(enabled) = monitoring_enabled.parse::<bool>() {
                self.monitoring.enabled = enabled;
            }
        }
        
        if let Ok(recovery_enabled) = std::env::var("HOTM_RECOVERY_ENABLED") {
            if let Ok(enabled) = recovery_enabled.parse::<bool>() {
                self.recovery.enabled = enabled;
            }
        }
        
        Ok(())
    }
    
    fn validate(&self) -> Result<()> {
        // Validate service definitions
        for (name, service) in &self.services {
            if service.name.is_empty() {
                return Err(anyhow::anyhow!("Service name cannot be empty for service: {}", name));
            }
            
            if service.executable_path.is_empty() {
                return Err(anyhow::anyhow!("Executable path cannot be empty for service: {}", name));
            }
            
            // Validate dependencies exist
            for dependency in &service.dependencies {
                if !self.services.contains_key(dependency) {
                    return Err(anyhow::anyhow!(
                        "Service {} has dependency {} which is not defined", 
                        name, dependency
                    ));
                }
            }
        }
        
        // Validate monitoring configuration
        if self.monitoring.interval_seconds == 0 {
            return Err(anyhow::anyhow!("Monitoring interval cannot be zero"));
        }
        
        if self.monitoring.default_timeout_ms == 0 {
            return Err(anyhow::anyhow!("Default timeout cannot be zero"));
        }
        
        // Validate recovery configuration
        if self.recovery.max_restart_attempts == 0 {
            return Err(anyhow::anyhow!("Max restart attempts cannot be zero"));
        }
        
        // Validate logging configuration
        match self.logging.level.as_str() {
            "trace" | "debug" | "info" | "warn" | "error" => {},
            _ => return Err(anyhow::anyhow!("Invalid log level: {}", self.logging.level)),
        }
        
        Ok(())
    }
    
    fn default_services() -> HashMap<String, ServiceDefinition> {
        let mut services = HashMap::new();
        
        // PostgreSQL service
        services.insert("HotM-PostgreSQL".to_string(), ServiceDefinition {
            name: "HotM-PostgreSQL".to_string(),
            display_name: "HotM PostgreSQL Database Service".to_string(),
            description: "Embedded PostgreSQL database server for Hall of the Mind".to_string(),
            executable_path: "database\\postgresql\\bin\\postgres.exe".to_string(),
            arguments: vec![
                "-D".to_string(),
                "{DATA_PATH}\\database\\cluster".to_string(),
                "-p".to_string(),
                "54321".to_string(),
            ],
            working_directory: Some("{DATA_PATH}\\database".to_string()),
            dependencies: vec![],
            startup_type: "Automatic".to_string(),
            account: "NetworkService".to_string(),
            priority: 1,
            ports: vec![54321],
            environment: HashMap::from([
                ("PGDATA".to_string(), "{DATA_PATH}\\database\\cluster".to_string()),
                ("PGPORT".to_string(), "54321".to_string()),
            ]),
            health_checks: vec!["tcp".to_string(), "process".to_string()],
        });
        
        // Ollama service
        services.insert("HotM-Ollama".to_string(), ServiceDefinition {
            name: "HotM-Ollama".to_string(),
            display_name: "HotM Ollama AI Service".to_string(),
            description: "Local AI service for Hall of the Mind natural language processing".to_string(),
            executable_path: "ollama\\ollama.exe".to_string(),
            arguments: vec![
                "serve".to_string(),
                "--host".to_string(),
                "127.0.0.1".to_string(),
                "--port".to_string(),
                "11434".to_string(),
            ],
            working_directory: Some("{DATA_PATH}\\ollama".to_string()),
            dependencies: vec![],
            startup_type: "AutomaticDelayed".to_string(),
            account: "NetworkService".to_string(),
            priority: 2,
            ports: vec![11434],
            environment: HashMap::from([
                ("OLLAMA_HOST".to_string(), "127.0.0.1:11434".to_string()),
                ("OLLAMA_MODELS".to_string(), "{DATA_PATH}\\ollama\\models".to_string()),
                ("OLLAMA_KEEP_ALIVE".to_string(), "5m".to_string()),
            ]),
            health_checks: vec!["http".to_string(), "process".to_string()],
        });
        
        // HotM Server service
        services.insert("HotM-Server".to_string(), ServiceDefinition {
            name: "HotM-Server".to_string(),
            display_name: "Hall of the Mind Server".to_string(),
            description: "Local HTTP API server for Hall of the Mind notes and analysis".to_string(),
            executable_path: "bin\\hotm-unified.exe".to_string(),
            arguments: vec![
                "server".to_string(),
                "--config".to_string(),
                "{DATA_PATH}\\config\\runtime.toml".to_string(),
                "--bind-port".to_string(),
                "53211".to_string(),
            ],
            working_directory: Some("{DATA_PATH}".to_string()),
            dependencies: vec!["HotM-PostgreSQL".to_string(), "HotM-Ollama".to_string()],
            startup_type: "AutomaticDelayed".to_string(),
            account: "NetworkService".to_string(),
            priority: 3,
            ports: vec![53211],
            environment: HashMap::from([
                ("DATABASE_URL".to_string(), "postgres://hotm:hotm@localhost:54321/hotm".to_string()),
                ("OLLAMA_URL".to_string(), "http://127.0.0.1:11434".to_string()),
                ("RUST_LOG".to_string(), "hotm=info,axum=info".to_string()),
                ("HOTM_DATA_PATH".to_string(), "{DATA_PATH}".to_string()),
            ]),
            health_checks: vec!["http".to_string(), "health-api".to_string()],
        });
        
        services
    }
}

impl Default for MonitoringConfiguration {
    fn default() -> Self {
        Self {
            enabled: true,
            interval_seconds: 30,
            default_timeout_ms: 10000,
            health_check_retries: 3,
            metrics_collection: true,
            performance_counters: true,
            postgresql_port: Some(54321),
            ollama_port: Some(11434),
            hotm_server_port: Some(53211),
        }
    }
}

impl Default for RecoveryConfiguration {
    fn default() -> Self {
        let mut recovery_actions = HashMap::new();
        
        recovery_actions.insert("restart_service".to_string(), RecoveryAction {
            name: "Restart Service".to_string(),
            action_type: "service_restart".to_string(),
            parameters: HashMap::new(),
            timeout_seconds: 60,
        });
        
        recovery_actions.insert("restart_dependencies".to_string(), RecoveryAction {
            name: "Restart Service and Dependencies".to_string(),
            action_type: "dependency_restart".to_string(),
            parameters: HashMap::new(),
            timeout_seconds: 120,
        });
        
        recovery_actions.insert("reinitialize_database".to_string(), RecoveryAction {
            name: "Reinitialize Database Connection".to_string(),
            action_type: "database_reconnect".to_string(),
            parameters: HashMap::from([
                ("max_attempts".to_string(), "5".to_string()),
                ("retry_delay".to_string(), "10".to_string()),
            ]),
            timeout_seconds: 60,
        });
        
        recovery_actions.insert("reload_ai_models".to_string(), RecoveryAction {
            name: "Reload AI Models".to_string(),
            action_type: "ai_reload".to_string(),
            parameters: HashMap::from([
                ("models".to_string(), "gpt-oss:20b,nomic-embed-text".to_string()),
            ]),
            timeout_seconds: 300,
        });
        
        recovery_actions.insert("clear_temp_files".to_string(), RecoveryAction {
            name: "Clear Temporary Files".to_string(),
            action_type: "cleanup".to_string(),
            parameters: HashMap::from([
                ("paths".to_string(), "temp,cache,logs".to_string()),
                ("max_age_hours".to_string(), "24".to_string()),
            ]),
            timeout_seconds: 30,
        });
        
        Self {
            enabled: true,
            max_restart_attempts: 3,
            restart_delay_seconds: 10,
            escalation_threshold: 5,
            recovery_actions,
        }
    }
}

impl Default for LoggingConfiguration {
    fn default() -> Self {
        Self {
            level: "info".to_string(),
            file_path: Some("C:\\ProgramData\\HotM\\logs\\service-manager.log".to_string()),
            max_file_size: 10 * 1024 * 1024, // 10MB
            max_files: 10,
            console_output: true,
            event_log: true,
        }
    }
}

// Configuration validation and helper functions
impl ServiceDefinition {
    pub fn get_full_executable_path(&self, install_path: &Path) -> std::path::PathBuf {
        install_path.join(&self.executable_path)
    }
    
    pub fn get_working_directory(&self, data_path: &Path) -> std::path::PathBuf {
        match &self.working_directory {
            Some(dir) => {
                let expanded = dir.replace("{DATA_PATH}", &data_path.to_string_lossy());
                std::path::PathBuf::from(expanded)
            }
            None => data_path.join(&self.name),
        }
    }
    
    pub fn get_expanded_arguments(&self, install_path: &Path, data_path: &Path) -> Vec<String> {
        self.arguments.iter().map(|arg| {
            arg.replace("{DATA_PATH}", &data_path.to_string_lossy())
               .replace("{INSTALL_PATH}", &install_path.to_string_lossy())
        }).collect()
    }
    
    pub fn get_expanded_environment(&self, install_path: &Path, data_path: &Path) -> HashMap<String, String> {
        self.environment.iter().map(|(key, value)| {
            let expanded_value = value
                .replace("{DATA_PATH}", &data_path.to_string_lossy())
                .replace("{INSTALL_PATH}", &install_path.to_string_lossy());
            (key.clone(), expanded_value)
        }).collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::NamedTempFile;
    
    #[tokio::test]
    async fn test_default_configuration() {
        let config = ServiceConfiguration::default();
        assert!(!config.services.is_empty());
        assert!(config.services.contains_key("HotM-PostgreSQL"));
        assert!(config.services.contains_key("HotM-Ollama"));
        assert!(config.services.contains_key("HotM-Server"));
    }
    
    #[tokio::test]
    async fn test_configuration_validation() {
        let mut config = ServiceConfiguration::default();
        assert!(config.validate().is_ok());
        
        // Test invalid dependency
        config.services.get_mut("HotM-Server").unwrap()
            .dependencies.push("NonExistent".to_string());
        
        assert!(config.validate().is_err());
    }
    
    #[tokio::test]
    async fn test_configuration_serialization() {
        let config = ServiceConfiguration::default();
        let toml_str = toml::to_string(&config).unwrap();
        let deserialized: ServiceConfiguration = toml::from_str(&toml_str).unwrap();
        
        assert_eq!(config.services.len(), deserialized.services.len());
        assert_eq!(config.monitoring.enabled, deserialized.monitoring.enabled);
    }
    
    #[tokio::test]
    async fn test_save_and_load_configuration() {
        let temp_file = NamedTempFile::new().unwrap();
        let config_path = temp_file.path();
        
        let original_config = ServiceConfiguration::default();
        original_config.save(config_path).await.unwrap();
        
        let loaded_config = ServiceConfiguration::load(config_path).await.unwrap();
        assert_eq!(original_config.services.len(), loaded_config.services.len());
    }
}