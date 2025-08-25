//! Service recovery and automatic remediation system
//! 
//! Implements intelligent recovery strategies for HotM services with
//! escalation paths, retry logic, and comprehensive error handling.

use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tokio::time::{sleep, timeout};
use tracing::{info, warn, error, debug};

use crate::config::RecoveryConfiguration;
use crate::monitor::HealthResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecoveryAction {
    ServiceRestart { service_name: String },
    DependencyRestart { service_name: String },
    DatabaseReconnect { connection_string: String },
    AiModelReload { models: Vec<String> },
    ClearCache { cache_paths: Vec<String> },
    CleanupTempFiles { paths: Vec<String>, max_age_hours: u64 },
    RestartSystem,
    NotifyAdministrator { message: String },
    Custom { command: String, arguments: Vec<String> },
}

#[derive(Debug, Clone)]
pub struct RecoveryAttempt {
    pub service_name: String,
    pub action: RecoveryAction,
    pub attempt_number: u32,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub success: Option<bool>,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone)]
pub struct RecoveryStrategy {
    pub service_name: String,
    pub actions: Vec<RecoveryAction>,
    pub max_attempts: u32,
    pub escalation_delay: Duration,
    pub success_threshold: f32,
}

pub struct RecoveryManager {
    config: RecoveryConfiguration,
    recovery_strategies: HashMap<String, RecoveryStrategy>,
    recovery_history: Vec<RecoveryAttempt>,
    current_attempts: HashMap<String, u32>,
}

impl RecoveryManager {
    pub fn new(config: &RecoveryConfiguration) -> Result<Self> {
        let recovery_strategies = Self::build_recovery_strategies(config);
        
        Ok(Self {
            config: config.clone(),
            recovery_strategies,
            recovery_history: Vec::new(),
            current_attempts: HashMap::new(),
        })
    }
    
    /// Attempt recovery for a failed service based on health check results
    pub async fn attempt_recovery(
        &mut self,
        service_name: &str,
        health_result: &HealthResult
    ) -> Result<RecoveryAction> {
        info!("Attempting recovery for service: {}", service_name);
        
        if !self.config.enabled {
            return Err(anyhow!("Recovery is disabled"));
        }
        
        // Check if we've exceeded max attempts for this service
        let current_attempts = *self.current_attempts.get(service_name).unwrap_or(&0);
        if current_attempts >= self.config.max_restart_attempts {
            error!("Max recovery attempts exceeded for service: {}", service_name);
            return self.escalate_recovery(service_name).await;
        }
        
        // Get recovery strategy for this service
        let strategy = self.recovery_strategies.get(service_name)
            .ok_or_else(|| anyhow!("No recovery strategy defined for service: {}", service_name))?;
        
        // Select appropriate recovery action based on the health check result
        let action = self.select_recovery_action(service_name, health_result, &strategy).await?;
        
        // Record recovery attempt
        let attempt = RecoveryAttempt {
            service_name: service_name.to_string(),
            action: action.clone(),
            attempt_number: current_attempts + 1,
            started_at: chrono::Utc::now(),
            completed_at: None,
            success: None,
            error_message: None,
        };
        
        // Execute recovery action
        let result = self.execute_recovery_action(&action).await;
        
        // Update attempt record
        let mut completed_attempt = attempt;
        completed_attempt.completed_at = Some(chrono::Utc::now());
        completed_attempt.success = Some(result.is_ok());
        if let Err(ref e) = result {
            completed_attempt.error_message = Some(e.to_string());
        }
        
        // Update tracking
        self.recovery_history.push(completed_attempt);
        self.current_attempts.insert(service_name.to_string(), current_attempts + 1);
        
        // If recovery succeeded, reset attempt counter
        if result.is_ok() {
            info!("Recovery successful for service: {}", service_name);
            self.current_attempts.insert(service_name.to_string(), 0);
        } else {
            error!("Recovery failed for service {}: {}", service_name, result.as_ref().unwrap_err());
        }
        
        result.map(|_| action)
    }
    
    /// Execute a specific recovery action
    pub async fn execute_recovery_action(&self, action: &RecoveryAction) -> Result<()> {
        debug!("Executing recovery action: {:?}", action);
        
        match action {
            RecoveryAction::ServiceRestart { service_name } => {
                self.restart_service(service_name).await
            }
            RecoveryAction::DependencyRestart { service_name } => {
                self.restart_service_with_dependencies(service_name).await
            }
            RecoveryAction::DatabaseReconnect { connection_string } => {
                self.reconnect_database(connection_string).await
            }
            RecoveryAction::AiModelReload { models } => {
                self.reload_ai_models(models).await
            }
            RecoveryAction::ClearCache { cache_paths } => {
                self.clear_cache_directories(cache_paths).await
            }
            RecoveryAction::CleanupTempFiles { paths, max_age_hours } => {
                self.cleanup_temporary_files(paths, *max_age_hours).await
            }
            RecoveryAction::RestartSystem => {
                self.restart_system().await
            }
            RecoveryAction::NotifyAdministrator { message } => {
                self.notify_administrator(message).await
            }
            RecoveryAction::Custom { command, arguments } => {
                self.execute_custom_command(command, arguments).await
            }
        }
    }
    
    /// Select the most appropriate recovery action based on service state and health
    async fn select_recovery_action(
        &self,
        service_name: &str,
        health_result: &HealthResult,
        strategy: &RecoveryStrategy
    ) -> Result<RecoveryAction> {
        // Analyze health result to determine best recovery action
        let current_attempts = *self.current_attempts.get(service_name).unwrap_or(&0);
        
        // Progressive recovery strategy
        match current_attempts {
            0 => {
                // First attempt: Try simple service restart
                if health_result.message.contains("connection") || health_result.message.contains("timeout") {
                    Ok(RecoveryAction::ServiceRestart { service_name: service_name.to_string() })
                } else {
                    Ok(RecoveryAction::ServiceRestart { service_name: service_name.to_string() })
                }
            }
            1 => {
                // Second attempt: Try dependency restart or more aggressive action
                if service_name == "HotM-Server" {
                    Ok(RecoveryAction::DependencyRestart { service_name: service_name.to_string() })
                } else if service_name == "HotM-PostgreSQL" {
                    Ok(RecoveryAction::DatabaseReconnect { 
                        connection_string: "postgres://hotm:hotm@localhost:54321/hotm".to_string() 
                    })
                } else if service_name == "HotM-Ollama" {
                    Ok(RecoveryAction::AiModelReload { 
                        models: vec!["gpt-oss:20b".to_string(), "nomic-embed-text".to_string()] 
                    })
                } else {
                    Ok(RecoveryAction::ServiceRestart { service_name: service_name.to_string() })
                }
            }
            2 => {
                // Third attempt: Cleanup and restart
                Ok(RecoveryAction::CleanupTempFiles {
                    paths: vec![
                        "C:\\ProgramData\\HotM\\temp".to_string(),
                        "C:\\ProgramData\\HotM\\logs\\*.tmp".to_string(),
                    ],
                    max_age_hours: 1,
                })
            }
            _ => {
                // Final attempt: System restart
                Ok(RecoveryAction::RestartSystem)
            }
        }
    }
    
    /// Handle escalation when max attempts are exceeded
    async fn escalate_recovery(&self, service_name: &str) -> Result<RecoveryAction> {
        error!("Escalating recovery for service: {}", service_name);
        
        // Notify administrator
        let message = format!(
            "Service {} has failed recovery {} times and requires manual intervention",
            service_name, self.config.max_restart_attempts
        );
        
        self.notify_administrator(&message).await?;
        
        // Return notification action
        Ok(RecoveryAction::NotifyAdministrator { message })
    }
    
    // Recovery action implementations
    
    async fn restart_service(&self, service_name: &str) -> Result<()> {
        info!("Restarting service: {}", service_name);
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winsvc::*;
            use std::ptr;
            
            let service_cstr = CString::new(service_name)?;
            
            unsafe {
                let scm = OpenSCManagerA(ptr::null(), ptr::null(), SC_MANAGER_CONNECT);
                if scm.is_null() {
                    return Err(anyhow!("Failed to open service control manager"));
                }
                
                let service = OpenServiceA(scm, service_cstr.as_ptr(), SERVICE_STOP | SERVICE_START | SERVICE_QUERY_STATUS);
                if service.is_null() {
                    CloseServiceHandle(scm);
                    return Err(anyhow!("Failed to open service: {}", service_name));
                }
                
                // Stop the service
                let mut status = std::mem::zeroed();
                ControlService(service, SERVICE_CONTROL_STOP, &mut status);
                
                // Wait for service to stop
                for _ in 0..30 {
                    if QueryServiceStatus(service, &mut status) == 0 {
                        break;
                    }
                    if status.dwCurrentState == SERVICE_STOPPED {
                        break;
                    }
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
                
                // Add delay before restart
                tokio::time::sleep(Duration::from_secs(self.config.restart_delay_seconds)).await;
                
                // Start the service
                if StartServiceA(service, 0, ptr::null()) == 0 {
                    let error = winapi::um::errhandlingapi::GetLastError();
                    CloseServiceHandle(service);
                    CloseServiceHandle(scm);
                    return Err(anyhow!("Failed to start service: {} (error: {})", service_name, error));
                }
                
                // Wait for service to start
                for _ in 0..60 {
                    if QueryServiceStatus(service, &mut status) == 0 {
                        break;
                    }
                    if status.dwCurrentState == SERVICE_RUNNING {
                        CloseServiceHandle(service);
                        CloseServiceHandle(scm);
                        info!("Service {} restarted successfully", service_name);
                        return Ok(());
                    }
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
                
                CloseServiceHandle(service);
                CloseServiceHandle(scm);
                Err(anyhow!("Service {} failed to start within timeout", service_name))
            }
        }
        #[cfg(not(windows))]
        {
            Err(anyhow!("Service restart is only supported on Windows"))
        }
    }
    
    async fn restart_service_with_dependencies(&self, service_name: &str) -> Result<()> {
        info!("Restarting service with dependencies: {}", service_name);
        
        // For HotM-Server, restart PostgreSQL and Ollama first
        match service_name {
            "HotM-Server" => {
                self.restart_service("HotM-PostgreSQL").await?;
                tokio::time::sleep(Duration::from_secs(5)).await;
                
                self.restart_service("HotM-Ollama").await?;
                tokio::time::sleep(Duration::from_secs(10)).await;
                
                self.restart_service("HotM-Server").await?;
            }
            _ => {
                self.restart_service(service_name).await?;
            }
        }
        
        Ok(())
    }
    
    async fn reconnect_database(&self, connection_string: &str) -> Result<()> {
        info!("Attempting database reconnection: {}", connection_string);
        
        // First restart PostgreSQL service
        self.restart_service("HotM-PostgreSQL").await?;
        
        // Wait for PostgreSQL to be ready
        tokio::time::sleep(Duration::from_secs(10)).await;
        
        // Test connection
        let client = reqwest::Client::new();
        let health_url = "http://127.0.0.1:53211/api/v1/health/database";
        
        for attempt in 1..=5 {
            match client.get(health_url).send().await {
                Ok(response) if response.status().is_success() => {
                    info!("Database reconnection successful");
                    return Ok(());
                }
                Ok(_) => {
                    warn!("Database health check returned error status, attempt {}/5", attempt);
                }
                Err(e) => {
                    warn!("Database health check failed, attempt {}/5: {}", attempt, e);
                }
            }
            
            if attempt < 5 {
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        }
        
        Err(anyhow!("Database reconnection failed after 5 attempts"))
    }
    
    async fn reload_ai_models(&self, models: &[String]) -> Result<()> {
        info!("Reloading AI models: {:?}", models);
        
        // Restart Ollama service
        self.restart_service("HotM-Ollama").await?;
        
        // Wait for Ollama to start
        tokio::time::sleep(Duration::from_secs(15)).await;
        
        // Pull models if they're not available
        let client = reqwest::Client::new();
        
        for model in models {
            info!("Ensuring model is available: {}", model);
            
            let pull_request = serde_json::json!({
                "name": model,
                "stream": false
            });
            
            match client
                .post("http://127.0.0.1:11434/api/pull")
                .json(&pull_request)
                .send()
                .await
            {
                Ok(response) if response.status().is_success() => {
                    info!("Model {} is available", model);
                }
                Ok(response) => {
                    warn!("Failed to ensure model {} is available: {}", model, response.status());
                }
                Err(e) => {
                    warn!("Error checking model {}: {}", model, e);
                }
            }
        }
        
        Ok(())
    }
    
    async fn clear_cache_directories(&self, cache_paths: &[String]) -> Result<()> {
        info!("Clearing cache directories: {:?}", cache_paths);
        
        for path in cache_paths {
            if let Ok(entries) = tokio::fs::read_dir(path).await {
                let mut entries = entries;
                while let Ok(Some(entry)) = entries.next_entry().await {
                    if let Ok(metadata) = entry.metadata().await {
                        if metadata.is_file() {
                            if let Err(e) = tokio::fs::remove_file(entry.path()).await {
                                warn!("Failed to remove cache file {}: {}", entry.path().display(), e);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn cleanup_temporary_files(&self, paths: &[String], max_age_hours: u64) -> Result<()> {
        info!("Cleaning up temporary files older than {} hours in paths: {:?}", max_age_hours, paths);
        
        let max_age = chrono::Utc::now() - chrono::Duration::hours(max_age_hours as i64);
        
        for path in paths {
            let path_buf = std::path::PathBuf::from(path);
            if path.contains("*") {
                // Handle glob patterns
                if let Some(parent) = path_buf.parent() {
                    if let Some(pattern) = path_buf.file_name() {
                        self.cleanup_files_matching_pattern(parent, pattern, max_age).await?;
                    }
                }
            } else if path_buf.is_dir() {
                // Handle directories
                self.cleanup_directory(&path_buf, max_age).await?;
            } else {
                // Handle individual files
                if let Ok(metadata) = tokio::fs::metadata(&path_buf).await {
                    if let Ok(modified) = metadata.modified() {
                        let modified_datetime: chrono::DateTime<chrono::Utc> = modified.into();
                        if modified_datetime < max_age {
                            if let Err(e) = tokio::fs::remove_file(&path_buf).await {
                                warn!("Failed to remove old file {}: {}", path, e);
                            } else {
                                debug!("Removed old file: {}", path);
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn cleanup_files_matching_pattern(
        &self,
        directory: &std::path::Path,
        pattern: &std::ffi::OsStr,
        max_age: chrono::DateTime<chrono::Utc>
    ) -> Result<()> {
        let pattern_str = pattern.to_string_lossy();
        let pattern_without_ext = if pattern_str.contains("*.") {
            pattern_str.replace("*.", "")
        } else {
            pattern_str.to_string()
        };
        
        if let Ok(mut entries) = tokio::fs::read_dir(directory).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                let file_name = entry.file_name();
                let file_name_str = file_name.to_string_lossy();
                
                if pattern_str.starts_with("*.") {
                    if file_name_str.ends_with(&pattern_without_ext) {
                        if let Ok(metadata) = entry.metadata().await {
                            if let Ok(modified) = metadata.modified() {
                                let modified_datetime: chrono::DateTime<chrono::Utc> = modified.into();
                                if modified_datetime < max_age {
                                    if let Err(e) = tokio::fs::remove_file(entry.path()).await {
                                        warn!("Failed to remove old file {}: {}", entry.path().display(), e);
                                    } else {
                                        debug!("Removed old file: {}", entry.path().display());
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn cleanup_directory(
        &self,
        directory: &std::path::Path,
        max_age: chrono::DateTime<chrono::Utc>
    ) -> Result<()> {
        if let Ok(mut entries) = tokio::fs::read_dir(directory).await {
            while let Ok(Some(entry)) = entries.next_entry().await {
                if let Ok(metadata) = entry.metadata().await {
                    if metadata.is_file() {
                        if let Ok(modified) = metadata.modified() {
                            let modified_datetime: chrono::DateTime<chrono::Utc> = modified.into();
                            if modified_datetime < max_age {
                                if let Err(e) = tokio::fs::remove_file(entry.path()).await {
                                    warn!("Failed to remove old file {}: {}", entry.path().display(), e);
                                } else {
                                    debug!("Removed old file: {}", entry.path().display());
                                }
                            }
                        }
                    }
                }
            }
        }
        
        Ok(())
    }
    
    async fn restart_system(&self) -> Result<()> {
        warn!("Initiating system restart as recovery action");
        
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winuser::*;
            use winapi::um::processthreadsapi::*;
            use winapi::um::handleapi::*;
            use winapi::um::winnt::*;
            
            // Log the action
            self.notify_administrator("System restart initiated by HotM service recovery").await.ok();
            
            // Give services time to shut down gracefully
            tokio::time::sleep(Duration::from_secs(10)).await;
            
            unsafe {
                let mut token_handle: winapi::shared::ntdef::HANDLE = std::ptr::null_mut();
                
                // Get process token
                if OpenProcessToken(
                    GetCurrentProcess(),
                    TOKEN_ADJUST_PRIVILEGES | TOKEN_QUERY,
                    &mut token_handle
                ) != 0 {
                    // Enable shutdown privilege
                    let mut tp: TOKEN_PRIVILEGES = std::mem::zeroed();
                    tp.PrivilegeCount = 1;
                    tp.Privileges[0].Attributes = SE_PRIVILEGE_ENABLED;
                    
                    let shutdown_name = CString::new("SeShutdownPrivilege").unwrap();
                    LookupPrivilegeValueA(
                        std::ptr::null(),
                        shutdown_name.as_ptr(),
                        &mut tp.Privileges[0].Luid
                    );
                    
                    AdjustTokenPrivileges(
                        token_handle,
                        0,
                        &mut tp,
                        std::mem::size_of::<TOKEN_PRIVILEGES>() as u32,
                        std::ptr::null_mut(),
                        std::ptr::null_mut()
                    );
                    
                    CloseHandle(token_handle);
                }
                
                // Restart the system
                ExitWindowsEx(EWX_REBOOT | EWX_FORCE, SHTDN_REASON_MAJOR_APPLICATION);
            }
        }
        
        Ok(())
    }
    
    async fn notify_administrator(&self, message: &str) -> Result<()> {
        info!("Administrator notification: {}", message);
        
        // Write to Windows Event Log
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winbase::*;
            
            let source = CString::new("HotM-ServiceManager").unwrap();
            let message_cstr = CString::new(message).unwrap();
            
            unsafe {
                let event_log = RegisterEventSourceA(std::ptr::null(), source.as_ptr());
                if !event_log.is_null() {
                    let messages = [message_cstr.as_ptr()];
                    ReportEventA(
                        event_log,
                        winapi::um::winnt::EVENTLOG_WARNING_TYPE,
                        0,
                        1000, // Event ID
                        std::ptr::null_mut(),
                        1,
                        0,
                        messages.as_ptr(),
                        std::ptr::null()
                    );
                    DeregisterEventSource(event_log);
                }
            }
        }
        
        // TODO: Add email notification, Slack webhook, etc.
        
        Ok(())
    }
    
    async fn execute_custom_command(&self, command: &str, arguments: &[String]) -> Result<()> {
        info!("Executing custom recovery command: {} {:?}", command, arguments);
        
        let output = timeout(
            Duration::from_secs(60),
            tokio::process::Command::new(command)
                .args(arguments)
                .output()
        ).await
        .context("Custom command timeout")?
        .context("Failed to execute custom command")?;
        
        if output.status.success() {
            info!("Custom command executed successfully");
            Ok(())
        } else {
            let stderr = String::from_utf8_lossy(&output.stderr);
            Err(anyhow!("Custom command failed: {}", stderr))
        }
    }
    
    fn build_recovery_strategies(config: &RecoveryConfiguration) -> HashMap<String, RecoveryStrategy> {
        let mut strategies = HashMap::new();
        
        // PostgreSQL recovery strategy
        strategies.insert("HotM-PostgreSQL".to_string(), RecoveryStrategy {
            service_name: "HotM-PostgreSQL".to_string(),
            actions: vec![
                RecoveryAction::ServiceRestart { service_name: "HotM-PostgreSQL".to_string() },
                RecoveryAction::DatabaseReconnect { 
                    connection_string: "postgres://hotm:hotm@localhost:54321/hotm".to_string() 
                },
                RecoveryAction::CleanupTempFiles { 
                    paths: vec!["C:\\ProgramData\\HotM\\PostgreSQL\\temp".to_string()],
                    max_age_hours: 1 
                },
            ],
            max_attempts: config.max_restart_attempts,
            escalation_delay: Duration::from_secs(config.restart_delay_seconds),
            success_threshold: 0.8,
        });
        
        // Ollama recovery strategy
        strategies.insert("HotM-Ollama".to_string(), RecoveryStrategy {
            service_name: "HotM-Ollama".to_string(),
            actions: vec![
                RecoveryAction::ServiceRestart { service_name: "HotM-Ollama".to_string() },
                RecoveryAction::AiModelReload { 
                    models: vec!["gpt-oss:20b".to_string(), "nomic-embed-text".to_string()] 
                },
                RecoveryAction::ClearCache { 
                    cache_paths: vec!["C:\\ProgramData\\HotM\\Ollama\\cache".to_string()] 
                },
            ],
            max_attempts: config.max_restart_attempts,
            escalation_delay: Duration::from_secs(config.restart_delay_seconds),
            success_threshold: 0.7,
        });
        
        // HotM Server recovery strategy
        strategies.insert("HotM-Server".to_string(), RecoveryStrategy {
            service_name: "HotM-Server".to_string(),
            actions: vec![
                RecoveryAction::ServiceRestart { service_name: "HotM-Server".to_string() },
                RecoveryAction::DependencyRestart { service_name: "HotM-Server".to_string() },
                RecoveryAction::CleanupTempFiles { 
                    paths: vec![
                        "C:\\ProgramData\\HotM\\temp".to_string(),
                        "C:\\ProgramData\\HotM\\logs\\*.tmp".to_string(),
                    ],
                    max_age_hours: 1 
                },
            ],
            max_attempts: config.max_restart_attempts,
            escalation_delay: Duration::from_secs(config.restart_delay_seconds),
            success_threshold: 0.9,
        });
        
        strategies
    }
    
    /// Get recovery history for a service
    pub fn get_recovery_history(&self, service_name: Option<&str>) -> Vec<&RecoveryAttempt> {
        self.recovery_history.iter()
            .filter(|attempt| {
                service_name.map_or(true, |name| attempt.service_name == name)
            })
            .collect()
    }
    
    /// Reset recovery attempt counters
    pub fn reset_recovery_counters(&mut self, service_name: Option<&str>) {
        match service_name {
            Some(name) => {
                self.current_attempts.insert(name.to_string(), 0);
            }
            None => {
                self.current_attempts.clear();
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::RecoveryConfiguration;
    
    #[tokio::test]
    async fn test_recovery_manager_creation() {
        let config = RecoveryConfiguration::default();
        let recovery_manager = RecoveryManager::new(&config).unwrap();
        
        assert!(!recovery_manager.recovery_strategies.is_empty());
        assert!(recovery_manager.recovery_strategies.contains_key("HotM-PostgreSQL"));
    }
    
    #[tokio::test]
    async fn test_recovery_action_selection() {
        let config = RecoveryConfiguration::default();
        let mut recovery_manager = RecoveryManager::new(&config).unwrap();
        
        let health_result = HealthResult {
            service_name: "HotM-Server".to_string(),
            healthy: false,
            message: "connection timeout".to_string(),
            details: None,
            response_time_ms: 5000,
            checked_at: chrono::Utc::now(),
        };
        
        let strategy = recovery_manager.recovery_strategies.get("HotM-Server").unwrap();
        let action = recovery_manager.select_recovery_action("HotM-Server", &health_result, strategy).await.unwrap();
        
        match action {
            RecoveryAction::ServiceRestart { service_name } => {
                assert_eq!(service_name, "HotM-Server");
            }
            _ => panic!("Expected ServiceRestart action"),
        }
    }
}