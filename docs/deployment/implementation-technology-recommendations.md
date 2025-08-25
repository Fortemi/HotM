# HotM Windows Service Implementation Technology Recommendations

## Overview

This document provides comprehensive technology recommendations for implementing the HotM Windows service integration, covering service wrapper technologies, management interfaces, deployment strategies, and tooling choices with detailed analysis of trade-offs, implementation complexity, and maintenance considerations.

## Service Implementation Technology Stack

### Primary Recommendation: Hybrid Rust + PowerShell Approach

**Architecture Decision:**
After analyzing multiple implementation approaches, the recommended solution combines Rust for core service logic with PowerShell for Windows integration and management tasks.

#### Core Service Implementation (Rust)

**Windows Service Crate Stack:**
```toml
# Cargo.toml dependencies
[dependencies]
windows-service = "0.6"           # Native Windows service integration
tokio = { version = "1.0", features = ["full"] }
tracing = "0.1"                   # Structured logging
tracing-subscriber = { version = "0.3", features = ["env-filter", "json"] }
serde = { version = "1.0", features = ["derive"] }
config = "0.14"                   # Configuration management
clap = { version = "4.0", features = ["derive"] }
anyhow = "1.0"                    # Error handling
thiserror = "1.0"                 # Custom error types
winreg = "0.52"                   # Registry access
wmi = "0.13"                      # WMI for system information
windows = { version = "0.52", features = [
    "Win32_Foundation",
    "Win32_System_Services", 
    "Win32_System_Registry",
    "Win32_System_ProcessStatus",
    "Win32_System_Diagnostics_Debug"
] }

[dependencies.sqlx]
version = "0.7"
features = ["runtime-tokio-rustls", "postgres", "json", "uuid", "chrono"]

[dependencies.reqwest]
version = "0.11"
features = ["json", "stream"]
```

**Service Manager Implementation:**
```rust
// src/service_manager.rs
use windows_service::{
    define_windows_service,
    service::{
        ServiceControl, ServiceControlAccept, ServiceExitCode, 
        ServiceState, ServiceStatus, ServiceType
    },
    service_control_handler::{self, ServiceControlHandlerResult},
    service_dispatcher, Result,
};
use std::ffi::OsString;
use tokio::sync::mpsc;

define_windows_service!(ffi_service_main, hotm_service_main);

pub struct HotMServiceManager {
    services: Vec<Box<dyn ManagedService + Send + Sync>>,
    shutdown_tx: Option<mpsc::UnboundedSender<()>>,
    status_handle: service_control_handler::ServiceStatusHandle,
}

#[async_trait::async_trait]
pub trait ManagedService {
    fn name(&self) -> &str;
    async fn start(&mut self) -> anyhow::Result<()>;
    async fn stop(&mut self) -> anyhow::Result<()>;
    async fn health_check(&self) -> HealthStatus;
    async fn get_status(&self) -> ServiceStatus;
}

impl HotMServiceManager {
    pub fn new() -> Self {
        Self {
            services: Vec::new(),
            shutdown_tx: None,
            status_handle: Default::default(),
        }
    }
    
    pub fn add_service<S: ManagedService + Send + Sync + 'static>(
        &mut self, 
        service: S
    ) {
        self.services.push(Box::new(service));
    }
    
    pub async fn run_service(&mut self) -> Result<()> {
        let (shutdown_tx, mut shutdown_rx) = mpsc::unbounded_channel();
        self.shutdown_tx = Some(shutdown_tx);
        
        // Set up service control handler
        let event_handler = move |control_event| -> ServiceControlHandlerResult {
            match control_event {
                ServiceControl::Stop => {
                    if let Some(tx) = &shutdown_tx {
                        let _ = tx.send(());
                    }
                    ServiceControlHandlerResult::NoError
                }
                ServiceControl::Interrogate => ServiceControlHandlerResult::NoError,
                _ => ServiceControlHandlerResult::NotImplemented,
            }
        };
        
        let status_handle = service_control_handler::register("hotm-service-manager", event_handler)?;
        self.status_handle = status_handle;
        
        // Report service as starting
        status_handle.set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: ServiceState::StartPending,
            controls_accepted: ServiceControlAccept::STOP,
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: std::time::Duration::from_secs(30),
        })?;
        
        // Start all managed services
        match self.start_all_services().await {
            Ok(()) => {
                // Report service as running
                status_handle.set_service_status(ServiceStatus {
                    service_type: ServiceType::OWN_PROCESS,
                    current_state: ServiceState::Running,
                    controls_accepted: ServiceControlAccept::STOP,
                    exit_code: ServiceExitCode::Win32(0),
                    checkpoint: 0,
                    wait_hint: std::time::Duration::default(),
                })?;
                
                tracing::info!("All HotM services started successfully");
                
                // Wait for shutdown signal
                shutdown_rx.recv().await;
                
                // Stop all services
                self.stop_all_services().await?;
            }
            Err(e) => {
                tracing::error!("Failed to start services: {}", e);
                
                // Report service as stopped with error
                status_handle.set_service_status(ServiceStatus {
                    service_type: ServiceType::OWN_PROCESS,
                    current_state: ServiceState::Stopped,
                    controls_accepted: ServiceControlAccept::empty(),
                    exit_code: ServiceExitCode::Win32(1),
                    checkpoint: 0,
                    wait_hint: std::time::Duration::default(),
                })?;
                
                return Err(windows_service::Error::Winapi(e.into()));
            }
        }
        
        // Report service as stopped
        status_handle.set_service_status(ServiceStatus {
            service_type: ServiceType::OWN_PROCESS,
            current_state: ServiceState::Stopped,
            controls_accepted: ServiceControlAccept::empty(),
            exit_code: ServiceExitCode::Win32(0),
            checkpoint: 0,
            wait_hint: std::time::Duration::default(),
        })?;
        
        Ok(())
    }
    
    async fn start_all_services(&mut self) -> anyhow::Result<()> {
        for service in &mut self.services {
            tracing::info!("Starting service: {}", service.name());
            
            match tokio::time::timeout(
                std::time::Duration::from_secs(60),
                service.start()
            ).await {
                Ok(Ok(())) => {
                    tracing::info!("Service {} started successfully", service.name());
                }
                Ok(Err(e)) => {
                    tracing::error!("Service {} failed to start: {}", service.name(), e);
                    return Err(e);
                }
                Err(_) => {
                    let error = anyhow::anyhow!("Service {} startup timeout", service.name());
                    tracing::error!("{}", error);
                    return Err(error);
                }
            }
            
            // Brief pause between service starts
            tokio::time::sleep(std::time::Duration::from_millis(1000)).await;
        }
        Ok(())
    }
    
    async fn stop_all_services(&mut self) -> anyhow::Result<()> {
        // Stop services in reverse order
        for service in self.services.iter_mut().rev() {
            tracing::info!("Stopping service: {}", service.name());
            
            if let Err(e) = service.stop().await {
                tracing::warn!("Error stopping service {}: {}", service.name(), e);
            }
        }
        Ok(())
    }
}

fn hotm_service_main(_arguments: Vec<OsString>) {
    // Initialize async runtime
    let rt = tokio::runtime::Runtime::new().unwrap();
    
    rt.block_on(async {
        // Initialize logging
        tracing_subscriber::fmt()
            .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
            .init();
        
        let mut service_manager = HotMServiceManager::new();
        
        // Add managed services
        service_manager.add_service(PostgreSQLService::new().await.unwrap());
        service_manager.add_service(OllamaService::new().await.unwrap());
        service_manager.add_service(HotMRuntimeService::new().await.unwrap());
        service_manager.add_service(MonitorService::new().await.unwrap());
        
        // Run the service
        if let Err(e) = service_manager.run_service().await {
            tracing::error!("Service manager error: {}", e);
        }
    });
}
```

**Individual Service Implementations:**
```rust
// src/services/postgresql.rs
pub struct PostgreSQLService {
    config: PostgreSQLConfig,
    process: Option<Child>,
    health_client: Option<PostgresClient>,
}

#[async_trait::async_trait]
impl ManagedService for PostgreSQLService {
    fn name(&self) -> &str {
        "hotm-postgres"
    }
    
    async fn start(&mut self) -> anyhow::Result<()> {
        tracing::info!("Starting PostgreSQL service");
        
        // Ensure data directory exists
        self.ensure_data_directory().await?;
        
        // Initialize cluster if needed
        if !self.cluster_exists().await? {
            self.initialize_cluster().await?;
        }
        
        // Start PostgreSQL process
        let mut cmd = Command::new(&self.config.postgres_bin);
        cmd.args([
            "-D", &self.config.data_dir,
            "-p", &self.config.port.to_string(),
            "-c", &format!("log_destination=eventlog"),
        ]);
        
        self.process = Some(cmd.spawn()?);
        
        // Wait for PostgreSQL to be ready
        self.wait_for_ready().await?;
        
        // Install extensions
        self.install_extensions().await?;
        
        tracing::info!("PostgreSQL service started successfully");
        Ok(())
    }
    
    async fn stop(&mut self) -> anyhow::Result<()> {
        if let Some(mut process) = self.process.take() {
            tracing::info!("Stopping PostgreSQL service");
            
            // Graceful shutdown via pg_ctl
            let output = Command::new(&self.config.pg_ctl_bin)
                .args([
                    "stop", 
                    "-D", &self.config.data_dir,
                    "-m", "smart"  // Smart shutdown mode
                ])
                .output()
                .await?;
            
            if output.status.success() {
                tracing::info!("PostgreSQL stopped gracefully");
            } else {
                tracing::warn!("Forceful PostgreSQL shutdown");
                process.kill().await?;
            }
        }
        Ok(())
    }
    
    async fn health_check(&self) -> HealthStatus {
        if let Some(client) = &self.health_client {
            match client.simple_query("SELECT 1").await {
                Ok(_) => HealthStatus::Healthy,
                Err(e) => HealthStatus::Unhealthy(e.to_string()),
            }
        } else {
            HealthStatus::Unknown
        }
    }
    
    async fn get_status(&self) -> ServiceStatus {
        match &self.process {
            Some(process) => {
                match process.try_wait() {
                    Ok(None) => ServiceStatus::Running,
                    Ok(Some(_)) => ServiceStatus::Stopped,
                    Err(_) => ServiceStatus::Error,
                }
            }
            None => ServiceStatus::Stopped,
        }
    }
}
```

#### PowerShell Management Integration

**Service Installation and Management:**
```powershell
# Install-HotMServices.ps1
param(
    [Parameter(Mandatory=$true)]
    [string]$InstallPath,
    
    [Parameter(Mandatory=$true)]
    [string]$DataPath,
    
    [hashtable]$Configuration = @{}
)

function Install-HotMServices {
    param($InstallPath, $DataPath, $Configuration)
    
    Write-Host "Installing HotM Services..." -ForegroundColor Green
    
    try {
        # Create service manager service
        $serviceBinary = Join-Path $InstallPath "bin\hotm-service-manager.exe"
        
        New-Service -Name "HotM-ServiceManager" `
                    -BinaryPathName $serviceBinary `
                    -DisplayName "HotM Service Manager" `
                    -Description "Manages HotM knowledge management services" `
                    -StartupType Automatic `
                    -DependsOn @("RPC", "DCOM", "EventLog")
        
        Write-Host "✓ HotM Service Manager installed" -ForegroundColor Green
        
        # Configure service recovery
        Set-ServiceRecovery -ServiceName "HotM-ServiceManager" `
                           -FirstFailure "Restart" `
                           -SecondFailure "Restart" `
                           -ThirdFailure "RunCommand" `
                           -RestartDelay 5000 `
                           -RecoveryCommand "$InstallPath\bin\hotm-recovery.exe --service=HotM-ServiceManager"
        
        # Set service account and permissions
        Set-ServiceAccount -ServiceName "HotM-ServiceManager" -Account "NT AUTHORITY\LocalService"
        
        # Configure registry settings
        Set-HotMRegistryConfiguration -Configuration $Configuration
        
        # Generate configuration files
        New-HotMConfigurationFiles -InstallPath $InstallPath -DataPath $DataPath
        
        # Set up Windows Firewall rules
        Set-HotMFirewallRules
        
        Write-Host "HotM Services installation completed successfully!" -ForegroundColor Green
        
    } catch {
        Write-Error "Failed to install HotM Services: $_"
        throw
    }
}

function Set-ServiceRecovery {
    param(
        [string]$ServiceName,
        [string]$FirstFailure = "Restart",
        [string]$SecondFailure = "Restart", 
        [string]$ThirdFailure = "None",
        [int]$RestartDelay = 5000,
        [string]$RecoveryCommand = ""
    )
    
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if (-not $service) {
        throw "Service '$ServiceName' not found"
    }
    
    # Use sc.exe for recovery configuration
    $scCommand = "sc.exe failure `"$ServiceName`" reset= 86400 actions= restart/$RestartDelay/restart/$RestartDelay/run/$RestartDelay"
    
    if ($RecoveryCommand) {
        $scCommand += " command= `"$RecoveryCommand`""
    }
    
    Invoke-Expression $scCommand
    
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to configure service recovery for $ServiceName"
    }
}

function Set-HotMRegistryConfiguration {
    param([hashtable]$Configuration)
    
    $registryPath = "HKLM:\SOFTWARE\HotM"
    
    # Create base registry structure
    New-Item -Path $registryPath -Force | Out-Null
    New-Item -Path "$registryPath\Installation" -Force | Out-Null
    New-Item -Path "$registryPath\Services" -Force | Out-Null
    New-Item -Path "$registryPath\Runtime" -Force | Out-Null
    
    # Set default values
    $defaults = @{
        "Installation\Version" = "0.2.0"
        "Installation\InstallPath" = $InstallPath
        "Installation\DataPath" = $DataPath
        "Runtime\Mode" = "server"
        "Runtime\LogLevel" = "info"
        "Services\PostgreSQL\Port" = 54321
        "Services\Ollama\Port" = 11435
        "Services\Runtime\Port" = 53211
    }
    
    foreach ($key in $defaults.Keys) {
        $fullPath = "$registryPath\$key"
        $parentPath = Split-Path $fullPath -Parent
        $valueName = Split-Path $fullPath -Leaf
        
        New-Item -Path $parentPath -Force | Out-Null
        Set-ItemProperty -Path $parentPath -Name $valueName -Value $defaults[$key]
    }
    
    # Override with user configuration
    foreach ($key in $Configuration.Keys) {
        $fullPath = "$registryPath\$key"
        $parentPath = Split-Path $fullPath -Parent  
        $valueName = Split-Path $fullPath -Leaf
        
        New-Item -Path $parentPath -Force | Out-Null
        Set-ItemProperty -Path $parentPath -Name $valueName -Value $Configuration[$key]
    }
}

function Test-HotMServiceHealth {
    param([string]$ServiceName = "HotM-ServiceManager")
    
    $service = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    
    if (-not $service) {
        return @{
            Status = "NotInstalled"
            Health = "Unknown"
            Message = "Service not found"
        }
    }
    
    $health = @{
        Status = $service.Status
        Health = "Unknown"
        Message = ""
    }
    
    if ($service.Status -eq "Running") {
        # Test API endpoint
        try {
            $response = Invoke-RestMethod -Uri "http://localhost:53211/api/v1/health" -TimeoutSec 10
            if ($response.status -eq "healthy") {
                $health.Health = "Healthy"
                $health.Message = "All services operational"
            } else {
                $health.Health = "Degraded"
                $health.Message = "Some services may be unavailable"
            }
        } catch {
            $health.Health = "Unhealthy"
            $health.Message = "API endpoint not responding"
        }
    } else {
        $health.Health = "Unhealthy"
        $health.Message = "Service is not running"
    }
    
    return $health
}

# Export functions
Export-ModuleMember -Function Install-HotMServices, Set-ServiceRecovery, Test-HotMServiceHealth
```

### Management Interface Technology

#### Recommended: Tauri-based Management Console

**Technology Justification:**
- **Native Performance**: Rust backend with web frontend
- **Small Resource Footprint**: ~10MB base size vs ~100MB+ Electron
- **Security**: Process isolation and controlled API surface
- **Maintenance**: Shared codebase with main HotM application
- **Integration**: Direct access to Windows APIs and services

**Management Console Implementation:**
```rust
// src-tauri/src/main.rs
use tauri::{CustomMenuItem, Menu, MenuItem, Submenu, Manager, State};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::sync::RwLock;

#[derive(Debug, Serialize, Deserialize)]
pub struct ServiceStatus {
    name: String,
    display_name: String,
    status: String,
    health: String,
    cpu_usage: f64,
    memory_usage: u64,
    uptime: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemMetrics {
    cpu_percentage: f64,
    memory_used_mb: u64,
    memory_total_mb: u64,
    disk_usage_percentage: f64,
}

pub struct AppState {
    service_manager: Arc<RwLock<ServiceManager>>,
    config_manager: Arc<ConfigurationManager>,
}

#[tauri::command]
async fn get_service_status(state: State<'_, AppState>) -> Result<Vec<ServiceStatus>, String> {
    let manager = state.service_manager.read().await;
    
    let services = manager.get_all_services().await
        .map_err(|e| format!("Failed to get service status: {}", e))?;
    
    Ok(services)
}

#[tauri::command]
async fn start_service(
    service_name: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    let manager = state.service_manager.write().await;
    
    manager.start_service(&service_name).await
        .map_err(|e| format!("Failed to start service {}: {}", service_name, e))
}

#[tauri::command] 
async fn stop_service(
    service_name: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    let manager = state.service_manager.write().await;
    
    manager.stop_service(&service_name).await
        .map_err(|e| format!("Failed to stop service {}: {}", service_name, e))
}

#[tauri::command]
async fn restart_service(
    service_name: String,
    state: State<'_, AppState>
) -> Result<(), String> {
    let manager = state.service_manager.write().await;
    
    manager.restart_service(&service_name).await
        .map_err(|e| format!("Failed to restart service {}: {}", service_name, e))
}

#[tauri::command]
async fn get_system_metrics() -> Result<SystemMetrics, String> {
    let metrics = system_metrics::collect_metrics().await
        .map_err(|e| format!("Failed to collect metrics: {}", e))?;
    
    Ok(metrics)
}

#[tauri::command]
async fn get_service_logs(
    service_name: String,
    lines: Option<usize>
) -> Result<Vec<String>, String> {
    let log_reader = LogReader::new();
    let logs = log_reader.read_service_logs(&service_name, lines.unwrap_or(100))
        .await
        .map_err(|e| format!("Failed to read logs: {}", e))?;
    
    Ok(logs)
}

#[tauri::command]
async fn run_health_checks(
    state: State<'_, AppState>
) -> Result<Vec<HealthCheckResult>, String> {
    let manager = state.service_manager.read().await;
    
    let results = manager.run_all_health_checks().await
        .map_err(|e| format!("Health checks failed: {}", e))?;
    
    Ok(results)
}

fn main() {
    let menu = Menu::new()
        .add_submenu(Submenu::new(
            "Services",
            Menu::new()
                .add_item(CustomMenuItem::new("start_all", "Start All Services"))
                .add_item(CustomMenuItem::new("stop_all", "Stop All Services"))
                .add_separator()
                .add_item(CustomMenuItem::new("health_check", "Run Health Checks"))
        ))
        .add_submenu(Submenu::new(
            "Configuration",
            Menu::new()
                .add_item(CustomMenuItem::new("edit_config", "Edit Configuration"))
                .add_item(CustomMenuItem::new("backup_config", "Backup Configuration"))
                .add_item(CustomMenuItem::new("restore_config", "Restore Configuration"))
        ))
        .add_submenu(Submenu::new(
            "Tools", 
            Menu::new()
                .add_item(CustomMenuItem::new("logs", "View Logs"))
                .add_item(CustomMenuItem::new("metrics", "System Metrics"))
                .add_item(CustomMenuItem::new("diagnostics", "Run Diagnostics"))
        ))
        .add_submenu(Submenu::new(
            "Help",
            Menu::new()
                .add_item(CustomMenuItem::new("documentation", "Documentation"))
                .add_item(CustomMenuItem::new("support", "Support"))
                .add_separator()
                .add_item(CustomMenuItem::new("about", "About"))
        ));
    
    let app_state = AppState {
        service_manager: Arc::new(RwLock::new(ServiceManager::new())),
        config_manager: Arc::new(ConfigurationManager::new().unwrap()),
    };
    
    tauri::Builder::default()
        .manage(app_state)
        .menu(menu)
        .invoke_handler(tauri::generate_handler![
            get_service_status,
            start_service,
            stop_service,
            restart_service,
            get_system_metrics,
            get_service_logs,
            run_health_checks
        ])
        .setup(|app| {
            // Set up real-time event streaming
            let app_handle = app.handle();
            tokio::spawn(async move {
                let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
                loop {
                    interval.tick().await;
                    
                    // Emit service status updates
                    if let Ok(status) = get_current_service_status().await {
                        let _ = app_handle.emit_all("service-status-update", &status);
                    }
                    
                    // Emit system metrics
                    if let Ok(metrics) = get_current_system_metrics().await {
                        let _ = app_handle.emit_all("system-metrics-update", &metrics);
                    }
                }
            });
            
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

### Alternative Implementation Options Analysis

#### Option A: NSSM (Non-Sucking Service Manager)

**Pros:**
- Simple wrapper for existing binaries
- Minimal code changes required
- Robust process monitoring and restart
- Wide Windows compatibility
- Battle-tested in production environments

**Cons:**
- External dependency (requires NSSM installation)
- Limited control over service lifecycle
- No native dependency management
- Less integration with Windows service management

**Use Case:** Quick deployment for legacy applications or when development resources are constrained.

**Implementation Example:**
```powershell
# Install services using NSSM
function Install-WithNSSM {
    param($InstallPath)
    
    # Install PostgreSQL service
    & nssm install hotm-postgres "$InstallPath\postgres\bin\postgres.exe"
    & nssm set hotm-postgres Parameters "-D $env:PROGRAMDATA\HotM\PostgreSQL\data -p 54321"
    & nssm set hotm-postgres DependOnService "RPC DCOM EventLog"
    & nssm set hotm-postgres Start SERVICE_AUTO_START
    
    # Install Ollama service  
    & nssm install hotm-ollama "$InstallPath\ollama\ollama.exe"
    & nssm set hotm-ollama Parameters "serve"
    & nssm set hotm-ollama DependOnService "RPC DCOM EventLog hotm-postgres"
    & nssm set hotm-ollama Start SERVICE_AUTO_START
    
    # Set environment variables
    & nssm set hotm-ollama AppEnvironmentExtra "OLLAMA_HOST=localhost:11435" "OLLAMA_MODELS=$env:PROGRAMDATA\HotM\Ollama\models"
}
```

**Verdict:** Good for rapid prototyping, not recommended for production due to external dependency and limited control.

#### Option B: .NET Windows Service Framework

**Pros:**
- Rich Windows integration APIs
- Comprehensive service management features
- Strong debugging and monitoring tools
- Enterprise-grade reliability patterns
- Extensive documentation and community support

**Cons:**
- .NET runtime dependency (~500MB+ deployment)
- Higher memory footprint (50-100MB baseline)
- Additional complexity for Rust integration
- Licensing considerations for enterprise deployment

**Implementation Example:**
```csharp
// ServiceManager.cs
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

public class HotMServiceManager : BackgroundService
{
    private readonly ILogger<HotMServiceManager> _logger;
    private readonly IServiceProvider _serviceProvider;
    private readonly List<IManagedService> _services;
    
    public HotMServiceManager(
        ILogger<HotMServiceManager> logger,
        IServiceProvider serviceProvider)
    {
        _logger = logger;
        _serviceProvider = serviceProvider;
        _services = new List<IManagedService>();
    }
    
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("HotM Service Manager starting");
        
        // Initialize services
        _services.Add(_serviceProvider.GetRequiredService<PostgreSQLService>());
        _services.Add(_serviceProvider.GetRequiredService<OllamaService>());
        _services.Add(_serviceProvider.GetRequiredService<HotMRuntimeService>());
        
        // Start services in dependency order
        foreach (var service in _services)
        {
            await service.StartAsync(stoppingToken);
            _logger.LogInformation("Started service: {ServiceName}", service.ServiceName);
        }
        
        // Wait for cancellation
        await Task.Delay(Timeout.Infinite, stoppingToken);
        
        // Stop services in reverse order
        foreach (var service in _services.Reverse<IManagedService>())
        {
            await service.StopAsync(CancellationToken.None);
        }
    }
}

public interface IManagedService
{
    string ServiceName { get; }
    Task StartAsync(CancellationToken cancellationToken);
    Task StopAsync(CancellationToken cancellationToken);
    Task<ServiceHealthStatus> GetHealthAsync();
}
```

**Verdict:** Excellent for .NET-based ecosystems, overkill for HotM's requirements given existing Rust infrastructure.

#### Option C: Custom C++ Windows Service

**Pros:**
- Maximum control and performance
- Minimal runtime dependencies
- Direct Windows API integration
- Smallest possible memory footprint

**Cons:**
- Significant development effort required
- Complex error handling and memory management
- Limited cross-platform compatibility
- Higher maintenance burden

**Use Case:** High-performance, resource-constrained environments where every MB matters.

**Verdict:** Not recommended due to development complexity and HotM's existing Rust codebase.

### Deployment Strategy Recommendations

#### MSI Installer Integration

**WiX Toolset Integration:**
```xml
<!-- HotMServiceInstaller.wxs -->
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://schemas.microsoft.com/wix/2006/wi">
  <Product Id="*" 
           Name="HotM Knowledge Management System" 
           Language="1033" 
           Version="0.2.0" 
           Manufacturer="HotM Project"
           UpgradeCode="12345678-1234-1234-1234-123456789012">
    
    <Package InstallerVersion="200" 
             Compressed="yes" 
             InstallScope="perMachine" 
             Description="HotM Windows Services Installer" />
    
    <!-- Service installation -->
    <Directory Id="TARGETDIR" Name="SourceDir">
      <Directory Id="ProgramFilesFolder">
        <Directory Id="INSTALLFOLDER" Name="HotM">
          <Directory Id="BinFolder" Name="bin">
            <Component Id="ServiceManagerComponent" Guid="*">
              <File Id="ServiceManagerExe" 
                    Source="hotm-service-manager.exe" 
                    KeyPath="yes" />
              
              <ServiceInstall Id="HotMServiceManager"
                             Name="HotM-ServiceManager"
                             DisplayName="HotM Service Manager"
                             Description="Manages HotM knowledge management services"
                             Type="ownProcess"
                             Start="auto"
                             Account="NT AUTHORITY\LocalService"
                             ErrorControl="normal"
                             Interactive="no">
                <ServiceDependency Id="RPC" />
                <ServiceDependency Id="DCOM" />
                <ServiceDependency Id="EventLog" />
              </ServiceInstall>
              
              <ServiceControl Id="StartHotMService"
                             Start="install"
                             Stop="both"
                             Remove="uninstall"
                             Name="HotM-ServiceManager"
                             Wait="yes" />
            </Component>
          </Directory>
        </Directory>
      </Directory>
    </Directory>
    
    <!-- Registry configuration -->
    <DirectoryRef Id="TARGETDIR">
      <Component Id="RegistryComponent" Guid="*">
        <RegistryKey Root="HKLM" 
                     Key="SOFTWARE\HotM"
                     Action="createAndRemoveOnUninstall">
          <RegistryValue Name="InstallPath" 
                        Type="string" 
                        Value="[INSTALLFOLDER]" />
          <RegistryValue Name="DataPath" 
                        Type="string" 
                        Value="[CommonAppDataFolder]HotM" />
          <RegistryValue Name="Version" 
                        Type="string" 
                        Value="0.2.0" />
        </RegistryKey>
      </Component>
    </DirectoryRef>
    
    <!-- Custom actions for configuration -->
    <Binary Id="ConfigurationCA" SourceFile="HotM.ConfigurationActions.CA.dll" />
    
    <CustomAction Id="GenerateConfiguration"
                  BinaryKey="ConfigurationCA" 
                  DllEntry="GenerateConfigurationFiles"
                  Execute="deferred"
                  Impersonate="no" />
    
    <CustomAction Id="SetServicePermissions"
                  BinaryKey="ConfigurationCA"
                  DllEntry="SetServicePermissions" 
                  Execute="deferred"
                  Impersonate="no" />
    
    <InstallExecuteSequence>
      <Custom Action="GenerateConfiguration" After="InstallFiles">
        NOT Installed
      </Custom>
      <Custom Action="SetServicePermissions" After="GenerateConfiguration">
        NOT Installed
      </Custom>
    </InstallExecuteSequence>
    
    <Feature Id="ProductFeature" Title="HotM Services" Level="1">
      <ComponentRef Id="ServiceManagerComponent" />
      <ComponentRef Id="RegistryComponent" />
    </Feature>
  </Product>
</Wix>
```

#### Docker-based Development Environment

**Development Container Configuration:**
```dockerfile
# Dockerfile.development
FROM mcr.microsoft.com/windows/servercore:ltsc2022

# Install development dependencies
RUN powershell -Command \
    Set-ExecutionPolicy Bypass -Scope Process -Force; \
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; \
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1')); \
    choco install -y git rust postgresql ollama visualstudio2022-workload-vctools

# Set up development environment
WORKDIR /hotm
COPY . .

# Build services
RUN cargo build --release --bin hotm-service-manager

# Set up development databases and services
RUN powershell -File scripts/setup-dev-environment.ps1

# Expose management ports
EXPOSE 53211 54321 11435

# Start services in development mode
CMD ["powershell", "-File", "scripts/start-dev-services.ps1"]
```

### Testing and Validation Tooling

#### Automated Service Testing Framework

**Integration Test Suite:**
```rust
// tests/service_integration_tests.rs
use std::time::Duration;
use tokio::time::timeout;

#[tokio::test]
async fn test_service_startup_sequence() {
    let test_env = TestEnvironment::new().await;
    
    // Test PostgreSQL startup
    let postgres_result = timeout(
        Duration::from_secs(60),
        test_env.start_postgres()
    ).await;
    
    assert!(postgres_result.is_ok(), "PostgreSQL failed to start within timeout");
    assert!(test_env.postgres_health_check().await.is_ok(), "PostgreSQL health check failed");
    
    // Test Ollama startup
    let ollama_result = timeout(
        Duration::from_secs(120),
        test_env.start_ollama()
    ).await;
    
    assert!(ollama_result.is_ok(), "Ollama failed to start within timeout");
    assert!(test_env.ollama_health_check().await.is_ok(), "Ollama health check failed");
    
    // Test HotM Runtime startup
    let runtime_result = timeout(
        Duration::from_secs(30),
        test_env.start_runtime()
    ).await;
    
    assert!(runtime_result.is_ok(), "Runtime failed to start within timeout");
    assert!(test_env.runtime_health_check().await.is_ok(), "Runtime health check failed");
    
    test_env.cleanup().await;
}

#[tokio::test]
async fn test_service_failure_recovery() {
    let test_env = TestEnvironment::new().await;
    test_env.start_all_services().await;
    
    // Simulate PostgreSQL failure
    test_env.kill_postgres().await;
    
    // Wait for recovery
    tokio::time::sleep(Duration::from_secs(10)).await;
    
    // Verify automatic restart
    assert!(test_env.postgres_health_check().await.is_ok(), "PostgreSQL failed to auto-recover");
    
    test_env.cleanup().await;
}
```

**Performance Benchmarking:**
```rust
// benches/service_performance.rs
use criterion::{criterion_group, criterion_main, Criterion};

fn benchmark_service_startup_time(c: &mut Criterion) {
    c.bench_function("service_startup", |b| {
        b.to_async(tokio::runtime::Runtime::new().unwrap())
            .iter(|| async {
                let test_env = TestEnvironment::new().await;
                let start_time = std::time::Instant::now();
                
                test_env.start_all_services().await;
                
                let startup_duration = start_time.elapsed();
                test_env.cleanup().await;
                
                startup_duration
            });
    });
}

fn benchmark_health_check_latency(c: &mut Criterion) {
    let rt = tokio::runtime::Runtime::new().unwrap();
    let test_env = rt.block_on(TestEnvironment::new());
    rt.block_on(test_env.start_all_services());
    
    c.bench_function("health_check_latency", |b| {
        b.to_async(&rt).iter(|| async {
            test_env.run_all_health_checks().await
        });
    });
}

criterion_group!(benches, benchmark_service_startup_time, benchmark_health_check_latency);
criterion_main!(benches);
```

## Final Technology Stack Summary

**Recommended Implementation Stack:**

1. **Core Services**: Rust with `windows-service` crate
2. **Service Management**: PowerShell modules for installation/configuration
3. **Management UI**: Tauri-based desktop application
4. **Configuration**: Registry + TOML files with hot reloading
5. **Deployment**: MSI installer with WiX toolset
6. **Testing**: Rust integration tests + PowerShell Pester tests
7. **Monitoring**: Windows Event Log + custom metrics collection

**Resource Requirements:**
- **Development Time**: 4-6 weeks for full implementation
- **Runtime Memory**: 50-150MB total service footprint
- **Disk Space**: 200MB installation + data storage
- **Dependencies**: Minimal (Windows 10+ native APIs only)

This technology stack provides enterprise-grade reliability while maintaining simplicity and leveraging HotM's existing Rust expertise.