//! Core Windows service management implementation
//! 
//! Provides comprehensive service lifecycle management, dependency handling,
//! and Windows service integration for HotM components.

use anyhow::{Context, Result, anyhow};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::time::timeout;
use tracing::{debug, info, warn, error};

use crate::config::{ServiceConfiguration, ServiceDefinition};
use crate::monitor::{HealthResult, ServiceMonitor};
use crate::recovery::RecoveryManager;
use crate::registry::RegistryManager;

#[cfg(windows)]
use winapi::um::{
    winnt::*,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ServiceState {
    NotInstalled,
    Stopped,
    Starting,
    Running,
    Stopping,
    Error(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceStatus {
    pub name: String,
    pub display_name: String,
    pub state: ServiceState,
    pub health: Option<HealthResult>,
    pub uptime: Option<Duration>,
    pub last_restart: Option<chrono::DateTime<chrono::Utc>>,
    pub cpu_usage: Option<f32>,
    pub memory_usage: Option<u64>,
    pub error_count: u32,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct ServiceInstallInfo {
    pub name: String,
    pub executable_path: PathBuf,
    #[allow(dead_code)]
    pub working_directory: PathBuf,
    pub arguments: Vec<String>,
    #[allow(dead_code)]
    pub dependencies: Vec<String>,
    pub description: String,
    #[allow(dead_code)]
    pub startup_type: ServiceStartupType,
    #[allow(dead_code)]
    pub account: ServiceAccount,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum ServiceStartupType {
    Automatic,
    #[allow(dead_code)]
    AutomaticDelayed,
    #[allow(dead_code)]
    Manual,
    #[allow(dead_code)]
    Disabled,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub enum ServiceAccount {
    #[allow(dead_code)]
    LocalSystem,
    #[allow(dead_code)]
    LocalService,
    NetworkService,
    #[allow(dead_code)]
    User { username: String, password: String },
}

pub struct ServiceManager {
    #[allow(dead_code)]
    config: ServiceConfiguration,
    registry: RegistryManager,
    monitor: ServiceMonitor,
    recovery: RecoveryManager,
    services: HashMap<String, ServiceDefinition>,
}

impl ServiceManager {
    pub async fn new(config: ServiceConfiguration) -> Result<Self> {
        let registry = RegistryManager::new()
            .context("Failed to initialize registry manager")?;
        
        let monitor = ServiceMonitor::new(&config.monitoring)
            .context("Failed to initialize service monitor")?;
        
        let recovery = RecoveryManager::new(&config.recovery)
            .context("Failed to initialize recovery manager")?;
        
        // Load service definitions from configuration
        let services = config.services.clone();
        
        Ok(Self {
            config,
            registry,
            monitor,
            recovery,
            services,
        })
    }
    
    /// Install all HotM services with proper dependencies
    pub async fn install_services(
        &self,
        install_path: &Path,
        data_path: &Path,
        force: bool
    ) -> Result<()> {
        info!("Installing HotM services to: {}", install_path.display());
        
        // Validate paths exist
        if !install_path.exists() {
            return Err(anyhow!("Install path does not exist: {}", install_path.display()));
        }
        
        if !data_path.exists() {
            std::fs::create_dir_all(data_path)
                .context("Failed to create data directory")?;
        }
        
        // Get services in dependency order
        let service_order = self.get_service_dependency_order()?;
        
        for service_name in service_order {
            let service_def = self.services.get(&service_name)
                .ok_or_else(|| anyhow!("Service definition not found: {}", service_name))?;
            
            info!("Installing service: {}", service_name);
            
            // Check if service already exists
            if self.is_service_installed(&service_name).await? && !force {
                warn!("Service {} already exists, skipping (use --force to reinstall)", service_name);
                continue;
            }
            
            // Build install info for this service
            let install_info = self.build_service_install_info(
                service_def,
                install_path,
                data_path
            )?;
            
            // Install the service
            self.install_single_service(&install_info, force)
                .await
                .context(format!("Failed to install service {}", service_name))?;
            
            info!("Successfully installed service: {}", service_name);
        }
        
        // Register with Windows Event Log
        self.registry.register_event_source()
            .context("Failed to register event log source")?;
        
        info!("All services installed successfully");
        Ok(())
    }
    
    /// Uninstall all HotM services
    pub async fn uninstall_services(&self, remove_data: bool) -> Result<()> {
        info!("Uninstalling HotM services");
        
        // Get services in reverse dependency order for uninstallation
        let mut service_order = self.get_service_dependency_order()?;
        service_order.reverse();
        
        for service_name in service_order {
            if self.is_service_installed(&service_name).await? {
                info!("Uninstalling service: {}", service_name);
                
                // Stop service first
                if let Ok(state) = self.get_service_state(&service_name).await {
                    if matches!(state, ServiceState::Running) {
                        info!("Stopping service {} before uninstall", service_name);
                        self.stop_single_service(&service_name, Duration::from_secs(30))
                            .await
                            .unwrap_or_else(|e| warn!("Failed to stop service {}: {}", service_name, e));
                    }
                }
                
                // Uninstall the service
                self.uninstall_single_service(&service_name)
                    .await
                    .context(format!("Failed to uninstall service {}", service_name))?;
                
                info!("Successfully uninstalled service: {}", service_name);
            } else {
                info!("Service {} not installed, skipping", service_name);
            }
        }
        
        // Remove data directories if requested
        if remove_data {
            info!("Removing data directories");
            // Implementation would remove data directories safely
        }
        
        // Unregister event log source
        self.registry.unregister_event_source()
            .unwrap_or_else(|e| warn!("Failed to unregister event log source: {}", e));
        
        info!("All services uninstalled successfully");
        Ok(())
    }
    
    /// Start all services in dependency order
    pub async fn start_all_services(&self, service_timeout: Duration) -> Result<()> {
        info!("Starting all HotM services");
        
        let service_order = self.get_service_dependency_order()?;
        
        for service_name in service_order {
            info!("Starting service: {}", service_name);
            
            // Check if service is already running
            let state = self.get_service_state(&service_name).await?;
            if matches!(state, ServiceState::Running) {
                info!("Service {} is already running", service_name);
                continue;
            }
            
            // Check dependencies are running
            let service_def = self.services.get(&service_name)
                .ok_or_else(|| anyhow!("Service definition not found: {}", service_name))?;
            
            for dependency in &service_def.dependencies {
                let dep_state = self.get_service_state(dependency).await?;
                if !matches!(dep_state, ServiceState::Running) {
                    return Err(anyhow!(
                        "Dependency service {} is not running for service {}", 
                        dependency, service_name
                    ));
                }
            }
            
            // Start the service
            self.start_single_service(&service_name, service_timeout)
                .await
                .context(format!("Failed to start service {}", service_name))?;
            
            info!("Successfully started service: {}", service_name);
        }
        
        info!("All services started successfully");
        Ok(())
    }
    
    /// Stop all services in reverse dependency order
    pub async fn stop_all_services(&self, _force: bool, service_timeout: Duration) -> Result<()> {
        info!("Stopping all HotM services");
        
        let mut service_order = self.get_service_dependency_order()?;
        service_order.reverse();
        
        for service_name in service_order {
            let state = self.get_service_state(&service_name).await?;
            if matches!(state, ServiceState::Running) {
                info!("Stopping service: {}", service_name);
                
                self.stop_single_service(&service_name, service_timeout)
                    .await
                    .context(format!("Failed to stop service {}", service_name))?;
                
                info!("Successfully stopped service: {}", service_name);
            } else {
                info!("Service {} is not running", service_name);
            }
        }
        
        info!("All services stopped successfully");
        Ok(())
    }
    
    /// Get comprehensive status of all services
    pub async fn get_service_status(&self, detailed: bool) -> Result<Vec<ServiceStatus>> {
        let mut statuses = Vec::new();
        
        for (service_name, service_def) in &self.services {
            let state = self.get_service_state(service_name).await?;
            
            let health = if detailed && matches!(state, ServiceState::Running) {
                Some(self.monitor.check_service_health(service_name).await?)
            } else {
                None
            };
            
            let status = ServiceStatus {
                name: service_name.clone(),
                display_name: service_def.display_name.clone(),
                state,
                health,
                uptime: self.get_service_uptime(service_name).await.ok(),
                last_restart: None, // Would be populated from registry/logs
                cpu_usage: None,   // Would be populated from performance counters
                memory_usage: None, // Would be populated from performance counters
                error_count: 0,    // Would be populated from event logs
            };
            
            statuses.push(status);
        }
        
        Ok(statuses)
    }
    
    /// Print service status in human-readable format
    pub async fn print_service_status(&self, statuses: &[ServiceStatus]) {
        println!();
        println!("{:<25} {:<12} {:<12} {:<10}", "Service Name", "Status", "Health", "Uptime");
        println!("{}", "=".repeat(70));
        
        for status in statuses {
            let state_str = match &status.state {
                ServiceState::NotInstalled => "Not Installed".to_string(),
                ServiceState::Stopped => "Stopped".to_string(),
                ServiceState::Starting => "Starting".to_string(),
                ServiceState::Running => "Running".to_string(),
                ServiceState::Stopping => "Stopping".to_string(),
                ServiceState::Error(msg) => format!("Error: {}", msg),
            };
            
            let health_str = status.health.as_ref()
                .map(|h| if h.healthy { "Healthy" } else { "Unhealthy" })
                .unwrap_or("N/A");
            
            let uptime_str = status.uptime
                .map(|d| format!("{}h {}m", d.as_secs() / 3600, (d.as_secs() % 3600) / 60))
                .unwrap_or_else(|| "N/A".to_string());
            
            println!("{:<25} {:<12} {:<12} {:<10}", 
                status.name, state_str, health_str, uptime_str);
        }
        println!();
    }
    
    /// Run health checks on all services
    pub async fn run_health_checks(&mut self, repair: bool) -> Result<Vec<HealthResult>> {
        let mut results = Vec::new();
        
        for service_name in self.services.keys() {
            info!("Running health check for service: {}", service_name);
            
            let result = self.monitor.check_service_health(service_name).await?;
            
            if !result.healthy && repair {
                info!("Service {} is unhealthy, attempting repair", service_name);
                
                match self.recovery.attempt_recovery(service_name, &result).await {
                    Ok(action) => {
                        info!("Recovery action completed for {}: {:?}", service_name, action);
                        
                        // Re-run health check after recovery
                        let new_result = self.monitor.check_service_health(service_name).await?;
                        results.push(new_result);
                    }
                    Err(e) => {
                        error!("Recovery failed for service {}: {}", service_name, e);
                        results.push(result);
                    }
                }
            } else {
                results.push(result);
            }
        }
        
        Ok(results)
    }
    
    /// Print health check results
    pub async fn print_health_results(&self, results: &[HealthResult]) {
        println!();
        println!("Health Check Results:");
        println!("{}", "=".repeat(50));
        
        for result in results {
            let status = if result.healthy { "✓ HEALTHY" } else { "✗ UNHEALTHY" };
            println!("{:<25} {}", result.service_name, status);
            
            if !result.message.is_empty() {
                println!("  Message: {}", result.message);
            }
            
            if let Some(details) = &result.details {
                for (key, value) in details {
                    println!("  {}: {}", key, value);
                }
            }
            
            println!();
        }
    }
    
    /// Run continuous monitoring with optional auto-recovery
    pub async fn run_monitor(&mut self, interval: Duration, auto_recover: bool) -> Result<()> {
        info!("Starting continuous service monitoring (interval: {:?})", interval);
        
        let mut monitoring_interval = tokio::time::interval(interval);
        
        loop {
            monitoring_interval.tick().await;
            
            debug!("Running monitoring cycle");
            
            for service_name in self.services.keys() {
                let state = self.get_service_state(service_name).await?;
                
                match state {
                    ServiceState::Running => {
                        // Check health for running services
                        match self.monitor.check_service_health(service_name).await {
                            Ok(health) => {
                                if !health.healthy {
                                    warn!("Service {} is unhealthy: {}", service_name, health.message);
                                    
                                    if auto_recover {
                                        info!("Attempting automatic recovery for {}", service_name);
                                        match self.recovery.attempt_recovery(service_name, &health).await {
                                            Ok(action) => {
                                                info!("Recovery action completed: {:?}", action);
                                            }
                                            Err(e) => {
                                                error!("Automatic recovery failed for {}: {}", service_name, e);
                                            }
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                error!("Health check failed for service {}: {}", service_name, e);
                            }
                        }
                    }
                    ServiceState::Error(ref msg) => {
                        error!("Service {} is in error state: {}", service_name, msg);
                        
                        if auto_recover {
                            info!("Attempting to restart failed service: {}", service_name);
                            if let Err(e) = self.start_single_service(service_name, Duration::from_secs(60)).await {
                                error!("Failed to restart service {}: {}", service_name, e);
                            }
                        }
                    }
                    _ => {
                        // Service is stopped or not installed - might need action depending on configuration
                        debug!("Service {} is in state: {:?}", service_name, state);
                    }
                }
            }
        }
    }
    
    /// Show service configuration
    pub async fn show_configuration(&self, service_name: Option<&str>) -> Result<()> {
        match service_name {
            Some(name) => {
                if let Some(service_def) = self.services.get(name) {
                    println!("Configuration for service: {}", name);
                    println!("{:#?}", service_def);
                } else {
                    return Err(anyhow!("Service not found: {}", name));
                }
            }
            None => {
                println!("All service configurations:");
                for (name, service_def) in &self.services {
                    println!("\n{}: {:#?}", name, service_def);
                }
            }
        }
        Ok(())
    }
    
    /// Reset service configuration to defaults
    pub async fn reset_configuration(&self, service_name: Option<&str>) -> Result<()> {
        // Implementation would reset registry settings to defaults
        info!("Resetting configuration for: {:?}", service_name);
        Ok(())
    }
    
    /// Interactive service configuration
    pub async fn configure_interactive(&self, service_name: Option<&str>) -> Result<()> {
        // Implementation would provide interactive configuration interface
        info!("Interactive configuration for: {:?}", service_name);
        Ok(())
    }
    
    // Private helper methods
    
    async fn is_service_installed(&self, service_name: &str) -> Result<bool> {
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winsvc::{OpenSCManagerA, OpenServiceA, CloseServiceHandle, SC_MANAGER_CONNECT};
            use std::ptr;
            
            let service_cstr = CString::new(service_name)?;
            
            unsafe {
                let scm = OpenSCManagerA(ptr::null(), ptr::null(), SC_MANAGER_CONNECT);
                if scm.is_null() {
                    return Ok(false);
                }
                
                let service = OpenServiceA(scm, service_cstr.as_ptr(), 0);
                let installed = !service.is_null();
                
                if !service.is_null() {
                    CloseServiceHandle(service);
                }
                CloseServiceHandle(scm);
                
                Ok(installed)
            }
        }
        #[cfg(not(windows))]
        Ok(false)
    }
    
    async fn get_service_state(&self, service_name: &str) -> Result<ServiceState> {
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use std::mem;
            use winapi::um::winsvc::*;
            use std::ptr;
            
            let service_cstr = CString::new(service_name)?;
            
            unsafe {
                let scm = OpenSCManagerA(ptr::null(), ptr::null(), SC_MANAGER_CONNECT);
                if scm.is_null() {
                    return Ok(ServiceState::NotInstalled);
                }
                
                let service = OpenServiceA(scm, service_cstr.as_ptr(), SERVICE_QUERY_STATUS);
                if service.is_null() {
                    CloseServiceHandle(scm);
                    return Ok(ServiceState::NotInstalled);
                }
                
                let mut status: SERVICE_STATUS = mem::zeroed();
                if QueryServiceStatus(service, &mut status) == 0 {
                    CloseServiceHandle(service);
                    CloseServiceHandle(scm);
                    return Ok(ServiceState::Error("Failed to query status".to_string()));
                }
                
                CloseServiceHandle(service);
                CloseServiceHandle(scm);
                
                let state = match status.dwCurrentState {
                    SERVICE_STOPPED => ServiceState::Stopped,
                    SERVICE_START_PENDING => ServiceState::Starting,
                    SERVICE_STOP_PENDING => ServiceState::Stopping,
                    SERVICE_RUNNING => ServiceState::Running,
                    _ => ServiceState::Error("Unknown state".to_string()),
                };
                
                Ok(state)
            }
        }
        #[cfg(not(windows))]
        Ok(ServiceState::NotInstalled)
    }
    
    async fn get_service_uptime(&self, _service_name: &str) -> Result<Duration> {
        // Implementation would query service start time and calculate uptime
        Ok(Duration::from_secs(0))
    }
    
    fn get_service_dependency_order(&self) -> Result<Vec<String>> {
        let mut ordered = Vec::new();
        let mut visited = std::collections::HashSet::new();
        let mut visiting = std::collections::HashSet::new();
        
        for service_name in self.services.keys() {
            self.visit_service_dependencies(
                service_name,
                &mut ordered,
                &mut visited,
                &mut visiting
            )?;
        }
        
        Ok(ordered)
    }
    
    fn visit_service_dependencies(
        &self,
        service_name: &str,
        ordered: &mut Vec<String>,
        visited: &mut std::collections::HashSet<String>,
        visiting: &mut std::collections::HashSet<String>
    ) -> Result<()> {
        if visited.contains(service_name) {
            return Ok(());
        }
        
        if visiting.contains(service_name) {
            return Err(anyhow!("Circular dependency detected involving service: {}", service_name));
        }
        
        visiting.insert(service_name.to_string());
        
        if let Some(service_def) = self.services.get(service_name) {
            for dependency in &service_def.dependencies {
                self.visit_service_dependencies(dependency, ordered, visited, visiting)?;
            }
        }
        
        visiting.remove(service_name);
        visited.insert(service_name.to_string());
        ordered.push(service_name.to_string());
        
        Ok(())
    }
    
    fn build_service_install_info(
        &self,
        service_def: &ServiceDefinition,
        install_path: &Path,
        data_path: &Path
    ) -> Result<ServiceInstallInfo> {
        let executable_path = install_path.join(&service_def.executable_path);
        let working_directory = data_path.join(&service_def.name);
        
        // Create working directory if it doesn't exist
        if !working_directory.exists() {
            std::fs::create_dir_all(&working_directory)
                .context("Failed to create working directory")?;
        }
        
        let mut arguments = service_def.arguments.clone();
        
        // Replace placeholders in arguments
        for arg in &mut arguments {
            *arg = arg
                .replace("{DATA_PATH}", &data_path.to_string_lossy())
                .replace("{INSTALL_PATH}", &install_path.to_string_lossy())
                .replace("{WORKING_DIR}", &working_directory.to_string_lossy());
        }
        
        Ok(ServiceInstallInfo {
            name: service_def.name.clone(),
            executable_path,
            working_directory,
            arguments,
            dependencies: service_def.dependencies.clone(),
            description: service_def.description.clone(),
            startup_type: ServiceStartupType::Automatic, // Could be configurable
            account: ServiceAccount::NetworkService,     // Could be configurable
        })
    }
    
    async fn install_single_service(&self, install_info: &ServiceInstallInfo, force: bool) -> Result<()> {
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winsvc::*;
            use std::ptr;
            
            // Build command line
            let mut cmd_line = format!("\"{}\"", install_info.executable_path.display());
            if !install_info.arguments.is_empty() {
                cmd_line.push(' ');
                cmd_line.push_str(&install_info.arguments.join(" "));
            }
            
            let service_name = CString::new(install_info.name.as_str())?;
            let display_name = CString::new(format!("HotM {}", install_info.name))?;
            let description = CString::new(install_info.description.as_str())?;
            let cmd_line_cstr = CString::new(cmd_line)?;
            
            unsafe {
                let scm = OpenSCManagerA(
                    ptr::null(),
                    ptr::null(),
                    SC_MANAGER_CREATE_SERVICE
                );
                
                if scm.is_null() {
                    return Err(anyhow!("Failed to open service control manager"));
                }
                
                // Remove existing service if force is specified
                if force {
                    let existing_service = OpenServiceA(
                        scm,
                        service_name.as_ptr(),
                        SERVICE_STOP | DELETE
                    );
                    
                    if !existing_service.is_null() {
                        // Stop the service first
                        let mut status = std::mem::zeroed();
                        ControlService(existing_service, SERVICE_CONTROL_STOP, &mut status);
                        
                        // Delete the service
                        DeleteService(existing_service);
                        CloseServiceHandle(existing_service);
                    }
                }
                
                let service = CreateServiceA(
                    scm,
                    service_name.as_ptr(),
                    display_name.as_ptr(),
                    SERVICE_ALL_ACCESS,
                    SERVICE_WIN32_OWN_PROCESS,
                    SERVICE_AUTO_START,
                    SERVICE_ERROR_NORMAL,
                    cmd_line_cstr.as_ptr(),
                    ptr::null(),
                    ptr::null_mut(),
                    ptr::null(),
                    ptr::null(),
                    ptr::null()
                );
                
                if service.is_null() {
                    CloseServiceHandle(scm);
                    return Err(anyhow!("Failed to create service: {}", install_info.name));
                }
                
                // Set service description
                let mut desc_info = SERVICE_DESCRIPTIONA {
                    lpDescription: description.as_ptr() as *mut _,
                };
                
                ChangeServiceConfig2A(
                    service,
                    SERVICE_CONFIG_DESCRIPTION,
                    &mut desc_info as *mut _ as *mut _
                );
                
                // Set recovery actions
                let actions = [
                    SC_ACTION {
                        Type: SC_ACTION_RESTART,
                        Delay: 10000, // 10 seconds
                    },
                    SC_ACTION {
                        Type: SC_ACTION_RESTART,
                        Delay: 20000, // 20 seconds
                    },
                    SC_ACTION {
                        Type: SC_ACTION_RESTART,
                        Delay: 30000, // 30 seconds
                    },
                ];
                
                let mut failure_actions = SERVICE_FAILURE_ACTIONSW {
                    dwResetPeriod: 86400, // 24 hours
                    lpRebootMsg: ptr::null_mut(),
                    lpCommand: ptr::null_mut(),
                    cActions: 3,
                    lpsaActions: actions.as_ptr() as *mut _,
                };
                
                ChangeServiceConfig2A(
                    service,
                    SERVICE_CONFIG_FAILURE_ACTIONS,
                    &mut failure_actions as *mut _ as *mut _
                );
                
                CloseServiceHandle(service);
                CloseServiceHandle(scm);
            }
            
            info!("Service {} installed successfully", install_info.name);
            Ok(())
        }
        #[cfg(not(windows))]
        {
            Err(anyhow!("Service installation is only supported on Windows"))
        }
    }
    
    async fn uninstall_single_service(&self, service_name: &str) -> Result<()> {
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winsvc::*;
            use std::ptr;
            
            let service_cstr = CString::new(service_name)?;
            
            unsafe {
                let scm = OpenSCManagerA(
                    ptr::null(),
                    ptr::null(),
                    SC_MANAGER_CONNECT
                );
                
                if scm.is_null() {
                    return Err(anyhow!("Failed to open service control manager"));
                }
                
                let service = OpenServiceA(scm, service_cstr.as_ptr(), DELETE);
                if service.is_null() {
                    CloseServiceHandle(scm);
                    return Err(anyhow!("Failed to open service for deletion: {}", service_name));
                }
                
                if DeleteService(service) == 0 {
                    CloseServiceHandle(service);
                    CloseServiceHandle(scm);
                    return Err(anyhow!("Failed to delete service: {}", service_name));
                }
                
                CloseServiceHandle(service);
                CloseServiceHandle(scm);
            }
            
            Ok(())
        }
        #[cfg(not(windows))]
        {
            Err(anyhow!("Service uninstallation is only supported on Windows"))
        }
    }
    
    async fn start_single_service(&self, service_name: &str, timeout_duration: Duration) -> Result<()> {
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winsvc::*;
            use std::ptr;
            
            let service_cstr = CString::new(service_name)?;
            
            let result = timeout(timeout_duration, async {
                unsafe {
                    let scm = OpenSCManagerA(ptr::null(), ptr::null(), SC_MANAGER_CONNECT);
                    if scm.is_null() {
                        return Err(anyhow!("Failed to open service control manager"));
                    }
                    
                    let service = OpenServiceA(scm, service_cstr.as_ptr(), SERVICE_START | SERVICE_QUERY_STATUS);
                    if service.is_null() {
                        CloseServiceHandle(scm);
                        return Err(anyhow!("Failed to open service: {}", service_name));
                    }
                    
                    if StartServiceA(service, 0, core::ptr::null_mut()) == 0 {
                        let error = winapi::um::errhandlingapi::GetLastError();
                        if error != winapi::shared::winerror::ERROR_SERVICE_ALREADY_RUNNING {
                            CloseServiceHandle(service);
                            CloseServiceHandle(scm);
                            return Err(anyhow!("Failed to start service: {} (error: {})", service_name, error));
                        }
                    }
                    
                    // Wait for service to start
                    loop {
                        let mut status = std::mem::zeroed();
                        if QueryServiceStatus(service, &mut status) == 0 {
                            CloseServiceHandle(service);
                            CloseServiceHandle(scm);
                            return Err(anyhow!("Failed to query service status"));
                        }
                        
                        match status.dwCurrentState {
                            SERVICE_RUNNING => {
                                CloseServiceHandle(service);
                                CloseServiceHandle(scm);
                                return Ok(());
                            }
                            SERVICE_STOPPED => {
                                CloseServiceHandle(service);
                                CloseServiceHandle(scm);
                                return Err(anyhow!("Service failed to start"));
                            }
                            _ => {
                                // Still starting, wait a bit
                                tokio::time::sleep(Duration::from_millis(100)).await;
                            }
                        }
                    }
                }
            }).await;
            
            match result {
                Ok(inner_result) => inner_result,
                Err(_) => Err(anyhow!("Service start timeout after {:?}", timeout_duration)),
            }
        }
        #[cfg(not(windows))]
        {
            Err(anyhow!("Service control is only supported on Windows"))
        }
    }
    
    async fn stop_single_service(&self, service_name: &str, timeout_duration: Duration) -> Result<()> {
        #[cfg(windows)]
        {
            use std::ffi::CString;
            use winapi::um::winsvc::*;
            use std::ptr;
            
            let service_cstr = CString::new(service_name)?;
            
            let result = timeout(timeout_duration, async {
                unsafe {
                    let scm = OpenSCManagerA(ptr::null(), ptr::null(), SC_MANAGER_CONNECT);
                    if scm.is_null() {
                        return Err(anyhow!("Failed to open service control manager"));
                    }
                    
                    let service = OpenServiceA(scm, service_cstr.as_ptr(), SERVICE_STOP | SERVICE_QUERY_STATUS);
                    if service.is_null() {
                        CloseServiceHandle(scm);
                        return Err(anyhow!("Failed to open service: {}", service_name));
                    }
                    
                    let mut status = std::mem::zeroed();
                    if ControlService(service, SERVICE_CONTROL_STOP, &mut status) == 0 {
                        let error = winapi::um::errhandlingapi::GetLastError();
                        if error != winapi::shared::winerror::ERROR_SERVICE_NOT_ACTIVE {
                            CloseServiceHandle(service);
                            CloseServiceHandle(scm);
                            return Err(anyhow!("Failed to stop service: {} (error: {})", service_name, error));
                        }
                    }
                    
                    // Wait for service to stop
                    loop {
                        if QueryServiceStatus(service, &mut status) == 0 {
                            CloseServiceHandle(service);
                            CloseServiceHandle(scm);
                            return Err(anyhow!("Failed to query service status"));
                        }
                        
                        match status.dwCurrentState {
                            SERVICE_STOPPED => {
                                CloseServiceHandle(service);
                                CloseServiceHandle(scm);
                                return Ok(());
                            }
                            SERVICE_RUNNING => {
                                // Still running, continue waiting
                                tokio::time::sleep(Duration::from_millis(100)).await;
                            }
                            _ => {
                                // Stopping, wait a bit
                                tokio::time::sleep(Duration::from_millis(100)).await;
                            }
                        }
                    }
                }
            }).await;
            
            match result {
                Ok(inner_result) => inner_result,
                Err(_) => Err(anyhow!("Service stop timeout after {:?}", timeout_duration)),
            }
        }
        #[cfg(not(windows))]
        {
            Err(anyhow!("Service control is only supported on Windows"))
        }
    }
}

/// Run as Windows service (internal use)
#[cfg(windows)]
pub async fn run_windows_service(service_manager: ServiceManager) -> Result<()> {
    use windows_service::{
        service::{ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus, ServiceType},
        service_control_handler::{self, ServiceControlHandlerResult},
    };
    use std::sync::{Arc, Mutex};
    use std::time::Duration;
    
    const SERVICE_NAME: &str = "HotM-Monitor";
    
    let service_manager = Arc::new(Mutex::new(service_manager));
    let service_manager_clone = service_manager.clone();
    
    let event_handler = move |control_event| -> ServiceControlHandlerResult {
        match control_event {
            ServiceControl::Stop => {
                // Handle stop request
                ServiceControlHandlerResult::NoError
            }
            ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
            _ => ServiceControlHandlerResult::NotImplemented,
        }
    };
    
    let status_handle = service_control_handler::register(SERVICE_NAME, event_handler)?;
    
    // Tell the system that the service is running now
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Running,
        controls_accepted: ServiceControlAccept::STOP,
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;
    
    // Main service loop - run monitoring
    let mut manager = service_manager_clone.lock().unwrap();
    manager.run_monitor(Duration::from_secs(30), true).await?;
    
    // Tell the system that service has stopped
    status_handle.set_service_status(ServiceStatus {
        service_type: ServiceType::OWN_PROCESS,
        current_state: ServiceState::Stopped,
        controls_accepted: ServiceControlAccept::empty(),
        exit_code: ServiceExitCode::Win32(0),
        checkpoint: 0,
        wait_hint: Duration::default(),
        process_id: None,
    })?;
    
    Ok(())
}