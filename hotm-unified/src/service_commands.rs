//! Service management commands for desktop mode
//! 
//! Provides Tauri commands for managing HotM services including
//! status monitoring, service control, and health checks.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{info, error, debug};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub name: String,
    pub display_name: String,
    pub status: String, // NotInstalled, Stopped, Starting, Running, Stopping, Error
    pub health: String, // Healthy, Unhealthy, Unknown
    pub uptime: Option<String>,
    pub port: Option<u16>,
    pub dependencies: Vec<String>,
    pub response_time: Option<f64>,
    pub cpu_usage: Option<f64>,
    pub memory_usage: Option<f64>,
    pub error_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemCheck {
    pub check: String,
    pub healthy: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemHealth {
    pub overall_healthy: bool,
    pub service_results: Vec<ServiceStatus>,
    pub system_checks: Vec<SystemCheck>,
    pub check_time: String,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceOperation {
    pub service_name: String,
    pub action: String, // start, stop, restart
    pub success: bool,
    pub message: String,
}

/// Get the status of all HotM services
#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn get_service_status() -> Result<Vec<ServiceStatus>, String> {
    debug!("Getting service status");
    
    let service_configs = get_service_configs();
    let mut services = Vec::new();
    
    for (name, config) in service_configs {
        let status = get_windows_service_status(&name).await;
        let health = if status == "Running" {
            check_service_health(&name, config.port).await
        } else {
            "Unknown".to_string()
        };
        
        services.push(ServiceStatus {
            name: name.clone(),
            display_name: config.display_name,
            status,
            health,
            uptime: get_service_uptime(&name).await,
            port: config.port,
            dependencies: config.dependencies,
            response_time: None, // Would be filled by health check
            cpu_usage: None,     // Would be filled by performance monitoring
            memory_usage: None,  // Would be filled by performance monitoring
            error_count: 0,      // Would be filled by log analysis
        });
    }
    
    Ok(services)
}

/// Start a specific HotM service
#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn start_service(service_name: String) -> Result<ServiceOperation, String> {
    info!("Starting service: {}", service_name);
    
    if !is_admin_privileges() {
        return Err("Administrator privileges required to control services".to_string());
    }
    
    // Check if service is already running
    let status = get_windows_service_status(&service_name).await;
    if status == "Running" {
        return Ok(ServiceOperation {
            service_name,
            action: "start".to_string(),
            success: true,
            message: "Service is already running".to_string(),
        });
    }
    
    // Start the service
    let result = execute_powershell_command(&format!(
        "Start-Service -Name '{}' -ErrorAction Stop", 
        service_name
    )).await;
    
    match result {
        Ok(output) => {
            info!("Service started successfully: {}", service_name);
            Ok(ServiceOperation {
                service_name,
                action: "start".to_string(),
                success: true,
                message: format!("Service started: {}", output),
            })
        }
        Err(e) => {
            error!("Failed to start service {}: {}", service_name, e);
            Ok(ServiceOperation {
                service_name,
                action: "start".to_string(),
                success: false,
                message: format!("Failed to start service: {}", e),
            })
        }
    }
}

/// Stop a specific HotM service
#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn stop_service(service_name: String) -> Result<ServiceOperation, String> {
    info!("Stopping service: {}", service_name);
    
    if !is_admin_privileges() {
        return Err("Administrator privileges required to control services".to_string());
    }
    
    // Check if service is already stopped
    let status = get_windows_service_status(&service_name).await;
    if status == "Stopped" || status == "NotInstalled" {
        return Ok(ServiceOperation {
            service_name,
            action: "stop".to_string(),
            success: true,
            message: "Service is already stopped".to_string(),
        });
    }
    
    // Stop the service
    let result = execute_powershell_command(&format!(
        "Stop-Service -Name '{}' -Force -ErrorAction Stop", 
        service_name
    )).await;
    
    match result {
        Ok(output) => {
            info!("Service stopped successfully: {}", service_name);
            Ok(ServiceOperation {
                service_name,
                action: "stop".to_string(),
                success: true,
                message: format!("Service stopped: {}", output),
            })
        }
        Err(e) => {
            error!("Failed to stop service {}: {}", service_name, e);
            Ok(ServiceOperation {
                service_name,
                action: "stop".to_string(),
                success: false,
                message: format!("Failed to stop service: {}", e),
            })
        }
    }
}

/// Restart a specific HotM service
#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn restart_service(service_name: String) -> Result<ServiceOperation, String> {
    info!("Restarting service: {}", service_name);
    
    if !is_admin_privileges() {
        return Err("Administrator privileges required to control services".to_string());
    }
    
    // Restart the service
    let result = execute_powershell_command(&format!(
        "Restart-Service -Name '{}' -Force -ErrorAction Stop", 
        service_name
    )).await;
    
    match result {
        Ok(output) => {
            info!("Service restarted successfully: {}", service_name);
            Ok(ServiceOperation {
                service_name,
                action: "restart".to_string(),
                success: true,
                message: format!("Service restarted: {}", output),
            })
        }
        Err(e) => {
            error!("Failed to restart service {}: {}", service_name, e);
            Ok(ServiceOperation {
                service_name,
                action: "restart".to_string(),
                success: false,
                message: format!("Failed to restart service: {}", e),
            })
        }
    }
}

/// Get comprehensive system health information
#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn get_system_health() -> Result<SystemHealth, String> {
    debug!("Getting system health information");
    
    let services = get_service_status().await?;
    let system_checks = run_system_checks().await;
    
    let overall_healthy = services.iter().all(|s| s.health == "Healthy" || s.status != "Running") 
        && system_checks.iter().all(|c| c.healthy);
    
    let mut recommendations = Vec::new();
    
    // Generate recommendations based on service status
    for service in &services {
        if service.status == "Running" && service.health == "Unhealthy" {
            recommendations.push(format!("Service {} is unhealthy - consider restarting", service.name));
        }
    }
    
    // Generate recommendations based on system checks
    for check in &system_checks {
        if !check.healthy {
            match check.check.as_str() {
                s if s.contains("Disk Space") => {
                    recommendations.push("Free up disk space by cleaning temporary files".to_string());
                }
                s if s.contains("Memory") => {
                    recommendations.push("High memory usage detected - consider restarting services".to_string());
                }
                s if s.contains("Port") => {
                    recommendations.push(format!("Port conflict detected: {}", check.message));
                }
                _ => {}
            }
        }
    }
    
    Ok(SystemHealth {
        overall_healthy,
        service_results: services,
        system_checks,
        check_time: chrono::Utc::now().to_rfc3339(),
        recommendations,
    })
}

/// Run automatic service repair
#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn repair_service(service_name: String) -> Result<ServiceOperation, String> {
    info!("Attempting to repair service: {}", service_name);
    
    if !is_admin_privileges() {
        return Err("Administrator privileges required to repair services".to_string());
    }
    
    // Use the PowerShell service manager module for repair
    let script = format!(
        "Import-Module '{}'; Repair-HotMService -ServiceName '{}'",
        get_service_manager_module_path(),
        service_name
    );
    
    let result = execute_powershell_command(&script).await;
    
    match result {
        Ok(output) => {
            info!("Service repair completed: {}", service_name);
            Ok(ServiceOperation {
                service_name,
                action: "repair".to_string(),
                success: true,
                message: format!("Service repair completed: {}", output),
            })
        }
        Err(e) => {
            error!("Failed to repair service {}: {}", service_name, e);
            Ok(ServiceOperation {
                service_name,
                action: "repair".to_string(),
                success: false,
                message: format!("Service repair failed: {}", e),
            })
        }
    }
}

/// Check if current user has administrator privileges
#[cfg(feature = "desktop")]
#[tauri::command]
pub async fn check_admin_privileges() -> Result<bool, String> {
    Ok(is_admin_privileges())
}

// Helper functions

#[derive(Debug, Clone)]
struct ServiceConfig {
    display_name: String,
    port: Option<u16>,
    dependencies: Vec<String>,
}

fn get_service_configs() -> HashMap<String, ServiceConfig> {
    let mut configs = HashMap::new();
    
    configs.insert("HotM-PostgreSQL".to_string(), ServiceConfig {
        display_name: "HotM PostgreSQL Database Service".to_string(),
        port: Some(54321),
        dependencies: vec![],
    });
    
    configs.insert("HotM-Ollama".to_string(), ServiceConfig {
        display_name: "HotM Ollama AI Service".to_string(),
        port: Some(11434),
        dependencies: vec![],
    });
    
    configs.insert("HotM-Server".to_string(), ServiceConfig {
        display_name: "Hall of the Mind Server".to_string(),
        port: Some(53211),
        dependencies: vec!["HotM-PostgreSQL".to_string(), "HotM-Ollama".to_string()],
    });
    
    configs
}

async fn get_windows_service_status(service_name: &str) -> String {
    let script = format!(
        "try {{ $service = Get-Service -Name '{}' -ErrorAction Stop; $service.Status.ToString() }} catch {{ 'NotInstalled' }}", 
        service_name
    );
    
    match execute_powershell_command(&script).await {
        Ok(status) => status.trim().to_string(),
        Err(_) => "NotInstalled".to_string(),
    }
}

async fn get_service_uptime(service_name: &str) -> Option<String> {
    let script = format!(
        r#"
        try {{
            $service = Get-Service -Name '{}' -ErrorAction Stop
            if ($service.Status -eq 'Running') {{
                $process = Get-WmiObject -Class Win32_Service -Filter "Name='{}'" | ForEach-Object {{ Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue }}
                if ($process) {{
                    $uptime = (Get-Date) - $process.StartTime
                    "{{0}}h {{1}}m" -f [int]$uptime.TotalHours, [int]$uptime.Minutes
                }} else {{
                    "Unknown"
                }}
            }} else {{
                "Not Running"
            }}
        }} catch {{
            "Not Available"
        }}
        "#,
        service_name, service_name
    );
    
    match execute_powershell_command(&script).await {
        Ok(uptime) => {
            let uptime = uptime.trim();
            if uptime != "Not Running" && uptime != "Not Available" && uptime != "Unknown" {
                Some(uptime.to_string())
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

async fn check_service_health(service_name: &str, port: Option<u16>) -> String {
    if let Some(port) = port {
        match service_name {
            "HotM-PostgreSQL" => {
                check_tcp_health("127.0.0.1", port).await
            }
            "HotM-Ollama" => {
                check_http_health(&format!("http://127.0.0.1:{}/api/version", port)).await
            }
            "HotM-Server" => {
                check_http_health(&format!("http://127.0.0.1:{}/api/v1/health", port)).await
            }
            _ => "Unknown".to_string(),
        }
    } else {
        "Unknown".to_string()
    }
}

async fn check_tcp_health(host: &str, port: u16) -> String {
    match tokio::net::TcpStream::connect(format!("{}:{}", host, port)).await {
        Ok(_) => "Healthy".to_string(),
        Err(_) => "Unhealthy".to_string(),
    }
}

async fn check_http_health(url: &str) -> String {
    match reqwest::Client::new()
        .get(url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                "Healthy".to_string()
            } else {
                "Unhealthy".to_string()
            }
        }
        Err(_) => "Unhealthy".to_string(),
    }
}

async fn run_system_checks() -> Vec<SystemCheck> {
    let mut checks = Vec::new();
    
    // Disk space check
    if let Ok(output) = execute_powershell_command(
        r#"
        $disk = Get-WmiObject -Class Win32_LogicalDisk -Filter "DriveType=3 AND DeviceID='C:'"
        $freeGB = [math]::Round($disk.FreeSpace / 1GB, 2)
        $totalGB = [math]::Round($disk.Size / 1GB, 2)
        $freePercent = [math]::Round(($disk.FreeSpace / $disk.Size) * 100, 1)
        "$freeGB GB free ($freePercent%) of $totalGB GB"
        "#
    ).await {
        let message = output.trim();
        let healthy = output.contains('%') && 
            output.split('(').nth(1)
                .and_then(|s| s.split('%').next())
                .and_then(|s| s.parse::<f64>().ok())
                .map(|pct| pct > 10.0)
                .unwrap_or(false);
        
        checks.push(SystemCheck {
            check: "Disk Space (C:)".to_string(),
            healthy,
            message: message.to_string(),
        });
    }
    
    // Memory usage check
    if let Ok(output) = execute_powershell_command(
        r#"
        $mem = Get-WmiObject -Class Win32_OperatingSystem
        $totalGB = [math]::Round($mem.TotalVisibleMemorySize / 1MB, 2)
        $freeGB = [math]::Round($mem.FreePhysicalMemory / 1MB, 2)
        $usedPercent = [math]::Round((($totalGB - $freeGB) / $totalGB) * 100, 1)
        "$usedPercent% used ($freeGB GB free of $totalGB GB)"
        "#
    ).await {
        let message = output.trim();
        let healthy = output.split('%').next()
            .and_then(|s| s.parse::<f64>().ok())
            .map(|pct| pct < 90.0)
            .unwrap_or(false);
        
        checks.push(SystemCheck {
            check: "Memory Usage".to_string(),
            healthy,
            message: message.to_string(),
        });
    }
    
    // Port checks for each service
    let service_configs = get_service_configs();
    for (service_name, config) in service_configs {
        if let Some(port) = config.port {
            let script = format!(
                r#"
                try {{
                    $connection = Get-NetTCPConnection -LocalPort {} -ErrorAction Stop
                    $service = Get-Service -Name '{}' -ErrorAction SilentlyContinue
                    if ($service -and $service.Status -eq 'Running') {{
                        "Port {} in use by {} (expected)"
                    }} else {{
                        "Port {} in use by another process"
                    }}
                }} catch {{
                    "Port {} available"
                }}
                "#,
                port, service_name, port, service_name, port, port
            );
            
            if let Ok(output) = execute_powershell_command(&script).await {
                let message = output.trim();
                let healthy = message.contains("expected") || message.contains("available");
                
                checks.push(SystemCheck {
                    check: format!("Port {} ({})", port, service_name),
                    healthy,
                    message: message.to_string(),
                });
            }
        }
    }
    
    checks
}

async fn execute_powershell_command(script: &str) -> Result<String, String> {
    let output = tokio::process::Command::new("powershell")
        .args(["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", script])
        .output()
        .await
        .map_err(|e| format!("Failed to execute PowerShell command: {}", e))?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn is_admin_privileges() -> bool {
    #[cfg(windows)]
    {
        use winapi::um::processthreadsapi::GetCurrentProcess;
        use winapi::um::securitybaseapi::GetTokenInformation;
        use winapi::um::winnt::{TokenElevation, TOKEN_ELEVATION, TOKEN_QUERY};
        use std::mem;
        use std::ptr;
        
        unsafe {
            let mut token_handle: winapi::shared::ntdef::HANDLE = ptr::null_mut();
            
            if winapi::um::processthreadsapi::OpenProcessToken(
                GetCurrentProcess(),
                TOKEN_QUERY,
                &mut token_handle,
            ) == 0 {
                return false;
            }
            
            let mut elevation: TOKEN_ELEVATION = mem::zeroed();
            let mut return_length: u32 = 0;
            
            let result = GetTokenInformation(
                token_handle,
                TokenElevation,
                &mut elevation as *mut _ as *mut _,
                mem::size_of::<TOKEN_ELEVATION>() as u32,
                &mut return_length,
            );
            
            winapi::um::handleapi::CloseHandle(token_handle);
            
            result != 0 && elevation.TokenIsElevated != 0
        }
    }
    #[cfg(not(windows))]
    {
        false
    }
}

fn get_service_manager_module_path() -> String {
    // Get the path to the HotM-ServiceManager.psm1 module
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().map(|p| p.to_path_buf()))
        .map(|install_dir| {
            install_dir
                .join("scripts")
                .join("HotM-ServiceManager.psm1")
                .to_string_lossy()
                .to_string()
        })
        .unwrap_or_else(|| "HotM-ServiceManager.psm1".to_string())
}