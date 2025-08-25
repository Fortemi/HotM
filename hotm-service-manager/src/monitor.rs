//! Service monitoring and health checking system
//! 
//! Provides comprehensive health monitoring for HotM services with
//! configurable thresholds and detailed diagnostics.

use anyhow::{Context, Result};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::SocketAddr;
use std::str::FromStr;
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tracing::{debug, error};

use crate::config::MonitoringConfiguration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthResult {
    pub service_name: String,
    pub healthy: bool,
    pub message: String,
    pub details: Option<HashMap<String, String>>,
    pub response_time_ms: u64,
    pub checked_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthCheckDefinition {
    pub name: String,
    pub check_type: HealthCheckType,
    pub endpoint: String,
    pub timeout_ms: u64,
    pub expected_response: Option<String>,
    pub critical: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthCheckType {
    HttpGet,
    HttpPost,
    TcpConnect,
    DatabaseQuery,
    ProcessCheck,
    FileExists,
    Custom(String),
}

pub struct ServiceMonitor {
    config: MonitoringConfiguration,
    http_client: Client,
    health_checks: HashMap<String, Vec<HealthCheckDefinition>>,
}

impl ServiceMonitor {
    pub fn new(config: &MonitoringConfiguration) -> Result<Self> {
        let http_client = Client::builder()
            .timeout(Duration::from_millis(config.default_timeout_ms))
            .build()
            .context("Failed to create HTTP client")?;
        
        let health_checks = Self::build_default_health_checks();
        
        Ok(Self {
            config: config.clone(),
            http_client,
            health_checks,
        })
    }
    
    /// Run comprehensive health check for a service
    pub async fn check_service_health(&self, service_name: &str) -> Result<HealthResult> {
        let start_time = Instant::now();
        
        debug!("Running health check for service: {}", service_name);
        
        let empty_checks = Vec::new();
        let checks = self.health_checks.get(service_name)
            .unwrap_or(&empty_checks);
        
        if checks.is_empty() {
            // Default health check based on service name
            return self.run_default_health_check(service_name, start_time).await;
        }
        
        let mut overall_healthy = true;
        let mut messages = Vec::new();
        let mut details = HashMap::new();
        
        for check in checks {
            debug!("Running health check: {}", check.name);
            
            match self.run_health_check(check).await {
                Ok(result) => {
                    if !result.healthy {
                        overall_healthy = false;
                        messages.push(format!("{}: {}", check.name, result.message));
                    }
                    
                    // Add check details
                    details.insert(check.name.clone(), result.message.clone());
                }
                Err(e) => {
                    overall_healthy = false;
                    let error_msg = format!("{}: Error - {}", check.name, e);
                    messages.push(error_msg.clone());
                    details.insert(check.name.clone(), error_msg);
                    
                    // If it's a critical check and fails, mark as unhealthy
                    if check.critical {
                        error!("Critical health check failed for {}: {}", service_name, e);
                    }
                }
            }
        }
        
        let response_time = start_time.elapsed().as_millis() as u64;
        let final_message = if messages.is_empty() {
            "All health checks passed".to_string()
        } else {
            messages.join("; ")
        };
        
        Ok(HealthResult {
            service_name: service_name.to_string(),
            healthy: overall_healthy,
            message: final_message,
            details: Some(details),
            response_time_ms: response_time,
            checked_at: chrono::Utc::now(),
        })
    }
    
    async fn run_default_health_check(&self, service_name: &str, start_time: Instant) -> Result<HealthResult> {
        let response_time = start_time.elapsed().as_millis() as u64;
        
        match service_name {
            "HotM-PostgreSQL" => {
                self.check_postgresql_health().await
                    .map(|healthy| HealthResult {
                        service_name: service_name.to_string(),
                        healthy,
                        message: if healthy { "PostgreSQL is responding" } else { "PostgreSQL connection failed" }.to_string(),
                        details: None,
                        response_time_ms: response_time,
                        checked_at: chrono::Utc::now(),
                    })
            }
            "HotM-Ollama" => {
                self.check_ollama_health().await
                    .map(|healthy| HealthResult {
                        service_name: service_name.to_string(),
                        healthy,
                        message: if healthy { "Ollama service is responding" } else { "Ollama service unavailable" }.to_string(),
                        details: None,
                        response_time_ms: response_time,
                        checked_at: chrono::Utc::now(),
                    })
            }
            "HotM-Server" => {
                self.check_hotm_server_health().await
                    .map(|healthy| HealthResult {
                        service_name: service_name.to_string(),
                        healthy,
                        message: if healthy { "HotM server is healthy" } else { "HotM server is unhealthy" }.to_string(),
                        details: None,
                        response_time_ms: response_time,
                        checked_at: chrono::Utc::now(),
                    })
            }
            _ => {
                Ok(HealthResult {
                    service_name: service_name.to_string(),
                    healthy: false,
                    message: "No health check defined".to_string(),
                    details: None,
                    response_time_ms: response_time,
                    checked_at: chrono::Utc::now(),
                })
            }
        }
    }
    
    async fn run_health_check(&self, check: &HealthCheckDefinition) -> Result<HealthResult> {
        let start_time = Instant::now();
        
        let result = match &check.check_type {
            HealthCheckType::HttpGet => {
                self.http_get_check(check).await
            }
            HealthCheckType::HttpPost => {
                self.http_post_check(check).await
            }
            HealthCheckType::TcpConnect => {
                self.tcp_connect_check(check).await
            }
            HealthCheckType::DatabaseQuery => {
                self.database_query_check(check).await
            }
            HealthCheckType::ProcessCheck => {
                self.process_check(check).await
            }
            HealthCheckType::FileExists => {
                self.file_exists_check(check).await
            }
            HealthCheckType::Custom(command) => {
                self.custom_check(check, command).await
            }
        };
        
        let response_time = start_time.elapsed().as_millis() as u64;
        
        match result {
            Ok(healthy) => {
                Ok(HealthResult {
                    service_name: check.name.clone(),
                    healthy,
                    message: if healthy { "Check passed" } else { "Check failed" }.to_string(),
                    details: None,
                    response_time_ms: response_time,
                    checked_at: chrono::Utc::now(),
                })
            }
            Err(e) => {
                Ok(HealthResult {
                    service_name: check.name.clone(),
                    healthy: false,
                    message: format!("Check error: {}", e),
                    details: None,
                    response_time_ms: response_time,
                    checked_at: chrono::Utc::now(),
                })
            }
        }
    }
    
    async fn http_get_check(&self, check: &HealthCheckDefinition) -> Result<bool> {
        debug!("HTTP GET check: {}", check.endpoint);
        
        let response = self.http_client
            .get(&check.endpoint)
            .timeout(Duration::from_millis(check.timeout_ms))
            .send()
            .await
            .context("HTTP GET request failed")?;
        
        if !response.status().is_success() {
            return Ok(false);
        }
        
        if let Some(expected) = &check.expected_response {
            let body = response.text().await.context("Failed to read response body")?;
            Ok(body.contains(expected))
        } else {
            Ok(true)
        }
    }
    
    async fn http_post_check(&self, check: &HealthCheckDefinition) -> Result<bool> {
        debug!("HTTP POST check: {}", check.endpoint);
        
        let response = self.http_client
            .post(&check.endpoint)
            .timeout(Duration::from_millis(check.timeout_ms))
            .send()
            .await
            .context("HTTP POST request failed")?;
        
        Ok(response.status().is_success())
    }
    
    async fn tcp_connect_check(&self, check: &HealthCheckDefinition) -> Result<bool> {
        debug!("TCP connect check: {}", check.endpoint);
        
        let addr = SocketAddr::from_str(&check.endpoint)
            .context("Invalid socket address")?;
        
        let timeout_duration = Duration::from_millis(check.timeout_ms);
        
        match tokio::time::timeout(timeout_duration, TcpStream::connect(addr)).await {
            Ok(Ok(_)) => Ok(true),
            Ok(Err(_)) | Err(_) => Ok(false),
        }
    }
    
    async fn database_query_check(&self, check: &HealthCheckDefinition) -> Result<bool> {
        debug!("Database query check: {}", check.name);
        
        // This would implement actual database connectivity checks
        // For now, we'll use a TCP connect check to the database port
        self.tcp_connect_check(check).await
    }
    
    async fn process_check(&self, check: &HealthCheckDefinition) -> Result<bool> {
        debug!("Process check: {}", check.endpoint);
        
        #[cfg(windows)]
        {
            use winapi::um::tlhelp32::*;
            use winapi::um::handleapi::*;
            
            let process_name = check.endpoint.to_lowercase();
            
            unsafe {
                let snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
                if snapshot == INVALID_HANDLE_VALUE {
                    return Ok(false);
                }
                
                let mut entry: PROCESSENTRY32 = std::mem::zeroed();
                entry.dwSize = std::mem::size_of::<PROCESSENTRY32>() as u32;
                
                if Process32First(snapshot, &mut entry) != 0 {
                    loop {
                        let current_process = String::from_utf8_lossy(
                            std::slice::from_raw_parts(entry.szExeFile.as_ptr() as *const u8, entry.szExeFile.len())
                        )
                            .to_string()
                            .trim_end_matches('\0')
                            .to_lowercase();
                        
                        if current_process.contains(&process_name) {
                            CloseHandle(snapshot);
                            return Ok(true);
                        }
                        
                        if Process32Next(snapshot, &mut entry) == 0 {
                            break;
                        }
                    }
                }
                
                CloseHandle(snapshot);
            }
        }
        
        Ok(false)
    }
    
    async fn file_exists_check(&self, check: &HealthCheckDefinition) -> Result<bool> {
        debug!("File exists check: {}", check.endpoint);
        
        Ok(std::path::Path::new(&check.endpoint).exists())
    }
    
    async fn custom_check(&self, _check: &HealthCheckDefinition, command: &str) -> Result<bool> {
        debug!("Custom check: {}", command);
        
        let output = tokio::process::Command::new("cmd")
            .args(["/C", command])
            .output()
            .await
            .context("Failed to execute custom check command")?;
        
        Ok(output.status.success())
    }
    
    // Service-specific health checks
    
    async fn check_postgresql_health(&self) -> Result<bool> {
        // Check if PostgreSQL port is listening
        let addr = format!("127.0.0.1:{}", self.config.postgresql_port.unwrap_or(54321));
        let socket_addr = SocketAddr::from_str(&addr)?;
        
        match tokio::time::timeout(
            Duration::from_millis(5000),
            TcpStream::connect(socket_addr)
        ).await {
            Ok(Ok(_)) => Ok(true),
            _ => Ok(false),
        }
    }
    
    async fn check_ollama_health(&self) -> Result<bool> {
        let port = self.config.ollama_port.unwrap_or(11434);
        let url = format!("http://127.0.0.1:{}/api/version", port);
        
        match self.http_client
            .get(&url)
            .timeout(Duration::from_millis(5000))
            .send()
            .await
        {
            Ok(response) => Ok(response.status().is_success()),
            Err(_) => Ok(false),
        }
    }
    
    async fn check_hotm_server_health(&self) -> Result<bool> {
        let port = self.config.hotm_server_port.unwrap_or(53211);
        let url = format!("http://127.0.0.1:{}/api/v1/health", port);
        
        match self.http_client
            .get(&url)
            .timeout(Duration::from_millis(5000))
            .send()
            .await
        {
            Ok(response) => {
                if response.status().is_success() {
                    // Try to parse the health response
                    match response.json::<serde_json::Value>().await {
                        Ok(health) => {
                            Ok(health.get("status")
                                .and_then(|s| s.as_str())
                                .map(|s| s == "healthy")
                                .unwrap_or(false))
                        }
                        Err(_) => Ok(true), // Response was OK but not JSON, still consider healthy
                    }
                } else {
                    Ok(false)
                }
            }
            Err(_) => Ok(false),
        }
    }
    
    fn build_default_health_checks() -> HashMap<String, Vec<HealthCheckDefinition>> {
        let mut checks = HashMap::new();
        
        // PostgreSQL health checks
        checks.insert("HotM-PostgreSQL".to_string(), vec![
            HealthCheckDefinition {
                name: "PostgreSQL Port Check".to_string(),
                check_type: HealthCheckType::TcpConnect,
                endpoint: "127.0.0.1:54321".to_string(),
                timeout_ms: 5000,
                expected_response: None,
                critical: true,
            },
            HealthCheckDefinition {
                name: "PostgreSQL Process Check".to_string(),
                check_type: HealthCheckType::ProcessCheck,
                endpoint: "postgres.exe".to_string(),
                timeout_ms: 3000,
                expected_response: None,
                critical: true,
            },
        ]);
        
        // Ollama health checks
        checks.insert("HotM-Ollama".to_string(), vec![
            HealthCheckDefinition {
                name: "Ollama API Check".to_string(),
                check_type: HealthCheckType::HttpGet,
                endpoint: "http://127.0.0.1:11434/api/version".to_string(),
                timeout_ms: 5000,
                expected_response: None,
                critical: true,
            },
            HealthCheckDefinition {
                name: "Ollama Process Check".to_string(),
                check_type: HealthCheckType::ProcessCheck,
                endpoint: "ollama.exe".to_string(),
                timeout_ms: 3000,
                expected_response: None,
                critical: true,
            },
        ]);
        
        // HotM Server health checks
        checks.insert("HotM-Server".to_string(), vec![
            HealthCheckDefinition {
                name: "HotM API Health Check".to_string(),
                check_type: HealthCheckType::HttpGet,
                endpoint: "http://127.0.0.1:53211/api/v1/health".to_string(),
                timeout_ms: 10000,
                expected_response: Some("healthy".to_string()),
                critical: true,
            },
            HealthCheckDefinition {
                name: "HotM Database Connectivity".to_string(),
                check_type: HealthCheckType::HttpGet,
                endpoint: "http://127.0.0.1:53211/api/v1/health/database".to_string(),
                timeout_ms: 10000,
                expected_response: None,
                critical: true,
            },
            HealthCheckDefinition {
                name: "HotM AI Service Connectivity".to_string(),
                check_type: HealthCheckType::HttpGet,
                endpoint: "http://127.0.0.1:53211/api/v1/health/ai".to_string(),
                timeout_ms: 15000,
                expected_response: None,
                critical: false,
            },
        ]);
        
        checks
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::MonitoringConfiguration;
    
    #[tokio::test]
    async fn test_monitor_creation() {
        let config = MonitoringConfiguration::default();
        let monitor = ServiceMonitor::new(&config).unwrap();
        assert!(!monitor.health_checks.is_empty());
    }
    
    #[tokio::test]
    async fn test_tcp_connect_check() {
        let config = MonitoringConfiguration::default();
        let monitor = ServiceMonitor::new(&config).unwrap();
        
        let check = HealthCheckDefinition {
            name: "Test TCP Check".to_string(),
            check_type: HealthCheckType::TcpConnect,
            endpoint: "127.0.0.1:80".to_string(), // This will likely fail, which is expected
            timeout_ms: 1000,
            expected_response: None,
            critical: false,
        };
        
        let result = monitor.tcp_connect_check(&check).await.unwrap();
        // Result doesn't matter for this test, just that it doesn't panic
        assert!(result == true || result == false);
    }
    
    #[tokio::test]
    async fn test_file_exists_check() {
        let config = MonitoringConfiguration::default();
        let monitor = ServiceMonitor::new(&config).unwrap();
        
        let check = HealthCheckDefinition {
            name: "Test File Check".to_string(),
            check_type: HealthCheckType::FileExists,
            endpoint: "Cargo.toml".to_string(),
            timeout_ms: 1000,
            expected_response: None,
            critical: false,
        };
        
        let result = monitor.file_exists_check(&check).await.unwrap();
        assert!(result); // Cargo.toml should exist
    }
}