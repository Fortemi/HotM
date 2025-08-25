# Windows Service Integration Architecture for HotM

## Executive Summary

This document defines a comprehensive Windows service integration pattern for the HotM installer that handles PostgreSQL, Ollama, and HotM runtime services with proper dependency management, startup sequencing, and user configuration options. The design ensures enterprise-grade reliability while maintaining ease of installation and management.

## Service Architecture Overview

### Service Dependency Hierarchy

```mermaid
graph TB
    subgraph "Windows System Services"
        RPC[RPC Service]
        DCOM[DCOM Service]
        EVENTLOG[EventLog Service]
        NETLOGON[Netlogon Service]
    end
    
    subgraph "HotM Service Stack"
        HOTM_PG[(hotm-postgres)]
        HOTM_OLLAMA[hotm-ollama]
        HOTM_RUNTIME[hotm-runtime]
        HOTM_MONITOR[hotm-monitor]
    end
    
    subgraph "Client Applications"
        DESKTOP[HotM Desktop Client]
        WEB[Web Browser Clients]
        API_CLIENTS[API Clients]
    end
    
    RPC --> HOTM_PG
    DCOM --> HOTM_PG
    EVENTLOG --> HOTM_MONITOR
    NETLOGON --> HOTM_PG
    
    HOTM_PG --> HOTM_OLLAMA
    HOTM_PG --> HOTM_RUNTIME
    HOTM_OLLAMA --> HOTM_RUNTIME
    HOTM_RUNTIME --> HOTM_MONITOR
    
    HOTM_RUNTIME --> DESKTOP
    HOTM_RUNTIME --> WEB
    HOTM_RUNTIME --> API_CLIENTS
    
    style HOTM_PG fill:#4fc3f7
    style HOTM_OLLAMA fill:#81c784
    style HOTM_RUNTIME fill:#ffb74d
    style HOTM_MONITOR fill:#f06292
```

## Service Specifications

### 1. HotM PostgreSQL Service (hotm-postgres)

**Service Configuration:**
- **Service Name**: `hotm-postgres`
- **Display Name**: `HotM PostgreSQL Database Service`
- **Service Account**: `NT AUTHORITY\LocalService`
- **Startup Type**: `Automatic`
- **Port**: 54321 (custom to avoid conflicts)
- **Data Directory**: `%PROGRAMDATA%\HotM\PostgreSQL\data`
- **Log Directory**: `%PROGRAMDATA%\HotM\PostgreSQL\logs`

**Dependencies:**
```ini
[SC CONFIG]
depend= RPC/DCOM/EventLog
```

**Registry Configuration:**
```
HKLM\SYSTEM\CurrentControlSet\Services\hotm-postgres\
├── Type = SERVICE_WIN32_OWN_PROCESS
├── Start = SERVICE_AUTO_START
├── ErrorControl = SERVICE_ERROR_NORMAL
├── ImagePath = "%ProgramFiles%\HotM\postgres\bin\postgres.exe -D %PROGRAMDATA%\HotM\PostgreSQL\data -p 54321"
├── ObjectName = NT AUTHORITY\LocalService
├── DependOnService = RPC,DCOM,EventLog
└── Parameters\
    ├── Port = 54321
    ├── DataDir = %PROGRAMDATA%\HotM\PostgreSQL\data
    ├── ConfigFile = %PROGRAMDATA%\HotM\PostgreSQL\postgresql.conf
    └── Extensions = vector,uuid-ossp,btree_gin
```

**Health Check Endpoint:**
```
http://localhost:54321/health (via pg_isready)
```

### 2. HotM Ollama Service (hotm-ollama)

**Service Configuration:**
- **Service Name**: `hotm-ollama`
- **Display Name**: `HotM AI Model Service`
- **Service Account**: `NT AUTHORITY\LocalService`
- **Startup Type**: `Automatic (Delayed Start)`
- **Port**: 11435 (custom to avoid conflicts)
- **Model Directory**: `%PROGRAMDATA%\HotM\Ollama\models`
- **GPU Support**: Auto-detected (NVIDIA/AMD)

**Dependencies:**
```ini
[SC CONFIG]
depend= RPC/DCOM/EventLog/hotm-postgres
```

**Registry Configuration:**
```
HKLM\SYSTEM\CurrentControlSet\Services\hotm-ollama\
├── Type = SERVICE_WIN32_OWN_PROCESS
├── Start = SERVICE_AUTO_START
├── ErrorControl = SERVICE_ERROR_NORMAL
├── ImagePath = "%ProgramFiles%\HotM\ollama\ollama.exe serve"
├── ObjectName = NT AUTHORITY\LocalService
├── DependOnService = RPC,DCOM,EventLog,hotm-postgres
├── DelayedAutostart = 1
└── Parameters\
    ├── Port = 11435
    ├── ModelDir = %PROGRAMDATA%\HotM\Ollama\models
    ├── GPUEnabled = auto
    ├── DefaultModels = gpt-oss:20b,nomic-embed-text
    └── HealthCheckTimeout = 120000
```

**Environment Variables:**
```ini
OLLAMA_HOST=localhost:11435
OLLAMA_MODELS=%PROGRAMDATA%\HotM\Ollama\models
OLLAMA_GPU_MEMORY_FRACTION=0.8
CUDA_VISIBLE_DEVICES=0
```

**Health Check Endpoint:**
```
http://localhost:11435/api/health
```

### 3. HotM Runtime Service (hotm-runtime)

**Service Configuration:**
- **Service Name**: `hotm-runtime`
- **Display Name**: `HotM Knowledge Management Runtime`
- **Service Account**: `NT AUTHORITY\LocalService`
- **Startup Type**: `Automatic (Delayed Start)`
- **Port**: 53211 (default HotM API port)
- **Mode**: Configurable (Server, Hybrid)

**Dependencies:**
```ini
[SC CONFIG]  
depend= RPC/DCOM/EventLog/hotm-postgres/hotm-ollama
```

**Registry Configuration:**
```
HKLM\SYSTEM\CurrentControlSet\Services\hotm-runtime\
├── Type = SERVICE_WIN32_OWN_PROCESS
├── Start = SERVICE_AUTO_START
├── ErrorControl = SERVICE_ERROR_NORMAL
├── ImagePath = "%ProgramFiles%\HotM\bin\hotm-server.exe --service"
├── ObjectName = NT AUTHORITY\LocalService
├── DependOnService = RPC,DCOM,EventLog,hotm-postgres,hotm-ollama
├── DelayedAutostart = 1
└── Parameters\
    ├── ConfigFile = %PROGRAMDATA%\HotM\config\runtime.toml
    ├── DatabaseURL = postgres://hotm:${DB_PASSWORD}@localhost:54321/hotm
    ├── OllamaURL = http://localhost:11435
    ├── Mode = server
    ├── Port = 53211
    └── LogLevel = info
```

**Health Check Endpoint:**
```
http://localhost:53211/api/v1/health
```

### 4. HotM Monitor Service (hotm-monitor)

**Service Configuration:**
- **Service Name**: `hotm-monitor`
- **Display Name**: `HotM System Monitor`
- **Service Account**: `NT AUTHORITY\LocalService`
- **Startup Type**: `Automatic (Delayed Start)`
- **Purpose**: Health monitoring, automatic recovery, metrics collection

**Dependencies:**
```ini
[SC CONFIG]
depend= EventLog/hotm-runtime
```

**Registry Configuration:**
```
HKLM\SYSTEM\CurrentControlSet\Services\hotm-monitor\
├── Type = SERVICE_WIN32_OWN_PROCESS
├── Start = SERVICE_AUTO_START  
├── ErrorControl = SERVICE_ERROR_NORMAL
├── ImagePath = "%ProgramFiles%\HotM\bin\hotm-monitor.exe"
├── ObjectName = NT AUTHORITY\LocalService
├── DependOnService = EventLog,hotm-runtime
├── DelayedAutostart = 1
└── Parameters\
    ├── MonitorInterval = 30000
    ├── RestartThreshold = 3
    ├── HealthCheckTimeout = 10000
    └── MetricsEnabled = true
```

## Startup Sequencing and Error Handling

### Service Startup Flow

```mermaid
sequenceDiagram
    participant SCM as Service Control Manager
    participant PG as hotm-postgres
    participant OL as hotm-ollama  
    participant RT as hotm-runtime
    participant MON as hotm-monitor
    participant LOG as Event Log
    
    SCM->>PG: Start PostgreSQL Service
    PG->>PG: Initialize database cluster
    PG->>PG: Load pgvector extension
    PG->>SCM: Service started (or timeout)
    
    alt PostgreSQL Success
        SCM->>OL: Start Ollama Service
        OL->>OL: Initialize models directory
        OL->>OL: GPU detection and setup
        OL->>OL: Load default models (async)
        OL->>SCM: Service started (or timeout)
        
        alt Ollama Success
            SCM->>RT: Start HotM Runtime
            RT->>PG: Test database connection
            RT->>OL: Test AI service connection
            RT->>RT: Initialize API server
            RT->>SCM: Service started (or timeout)
            
            alt Runtime Success
                SCM->>MON: Start HotM Monitor
                MON->>RT: Register health monitoring
                MON->>LOG: Begin metric collection
                MON->>SCM: Service started
            else Runtime Failed
                LOG->>LOG: Log runtime startup error
                SCM->>SCM: Execute recovery action
            end
        else Ollama Failed
            LOG->>LOG: Log Ollama startup error
            SCM->>SCM: Skip dependent services
        end
    else PostgreSQL Failed
        LOG->>LOG: Log database startup error
        SCM->>SCM: Skip all dependent services
    end
```

### Error Handling and Recovery

**Service Recovery Actions:**
```ini
[Service Recovery Configuration]
First Failure: Restart Service (Delay: 5000ms)
Second Failure: Restart Service (Delay: 10000ms)  
Third Failure: Run Recovery Program
Reset Counter: After 86400 seconds (24 hours)

Recovery Program: %ProgramFiles%\HotM\bin\hotm-recovery.exe --service=%1
```

**Recovery Strategies by Service:**

**PostgreSQL Recovery:**
1. Check data directory integrity
2. Verify port availability (54321)
3. Repair corrupted indexes
4. Reinitialize cluster if necessary
5. Event Log: Detailed error messages

**Ollama Recovery:**
1. Verify GPU drivers and compatibility  
2. Check model file integrity
3. Attempt model re-download
4. Fall back to CPU-only mode
5. Restart with reduced memory allocation

**HotM Runtime Recovery:**
1. Test all dependency connections
2. Verify configuration file syntax
3. Check port conflicts (53211)
4. Initialize safe mode (read-only)
5. Generate diagnostic report

**Timeout Configuration:**
```toml
[startup_timeouts]
postgres = 60000      # 60 seconds
ollama = 120000       # 120 seconds (model loading)
runtime = 30000       # 30 seconds  
monitor = 10000       # 10 seconds
```

## Configuration Management Strategy

### Registry-Based Configuration

**Base Registry Key:** `HKLM\SOFTWARE\HotM\Configuration`

```
HKLM\SOFTWARE\HotM\Configuration\
├── Version = "0.2.0"
├── InstallPath = "%ProgramFiles%\HotM"
├── DataPath = "%PROGRAMDATA%\HotM" 
├── LogLevel = "info"
├── Mode = "server"  # server|desktop|hybrid|development
└── Services\
    ├── PostgreSQL\
    │   ├── Enabled = true
    │   ├── Port = 54321
    │   ├── Database = "hotm"
    │   ├── Username = "hotm"
    │   └── MaxConnections = 100
    ├── Ollama\
    │   ├── Enabled = true
    │   ├── Port = 11435
    │   ├── GPUAcceleration = "auto"
    │   ├── ModelCacheSize = "8GB"
    │   └── DefaultModels = "gpt-oss:20b,nomic-embed-text"
    ├── Runtime\
    │   ├── Enabled = true
    │   ├── Port = 53211
    │   ├── WebUI = true
    │   ├── MCPServer = true
    │   └── MaxWorkers = 4
    └── Monitor\
        ├── Enabled = true
        ├── Interval = 30000
        ├── Metrics = true
        └── AutoRestart = true
```

### Configuration File Generation

**Runtime Configuration (`%PROGRAMDATA%\HotM\config\runtime.toml`):**
```toml
[runtime]
mode = "${MODE}"
data_directory = "${DATA_PATH}"
log_level = "${LOG_LEVEL}"

[database]
type = "postgresql"
host = "localhost"
port = ${POSTGRES_PORT}
database = "${DATABASE}"
username = "${DB_USERNAME}"
password = "${DB_PASSWORD}"
ssl_mode = "disable"
pool_size = 20

[ai]
type = "ollama"
url = "http://localhost:${OLLAMA_PORT}"
generation_model = "gpt-oss:20b"
embedding_model = "nomic-embed-text"
timeout = "60s"

[server] 
bind_address = "127.0.0.1:${RUNTIME_PORT}"
enable_tls = false
cors_origins = ["http://localhost:3000"]
max_request_size = "50MB"

[web_ui]
enabled = ${WEB_UI_ENABLED}
path = "/ui"
auth_required = false

[mcp]
enabled = ${MCP_ENABLED}
transport = "stdio"
tools = ["all"]

[logging]
level = "${LOG_LEVEL}"
file = "${DATA_PATH}\\logs\\runtime.log"
format = "json"
rotation = "daily"

[monitoring]
metrics_enabled = true
health_check_interval = 30
performance_tracking = true
```

### Environment Variable Management

**System Environment Variables:**
```cmd
HOTM_INSTALL_PATH=%ProgramFiles%\HotM
HOTM_DATA_PATH=%PROGRAMDATA%\HotM
HOTM_CONFIG_PATH=%PROGRAMDATA%\HotM\config
HOTM_LOG_PATH=%PROGRAMDATA%\HotM\logs

# Database Configuration
DATABASE_URL=postgres://hotm:${DB_PASSWORD}@localhost:54321/hotm
POSTGRES_PORT=54321
POSTGRES_DB=hotm

# AI Configuration  
OLLAMA_HOST=localhost:11435
OLLAMA_MODELS=%PROGRAMDATA%\HotM\Ollama\models

# Runtime Configuration
HOTM_API_PORT=53211
HOTM_MODE=server
RUST_LOG=hotm_server=info,axum=info
```

## Service Monitoring and Management UI

### Management Console Architecture

```mermaid
graph TB
    subgraph "HotM Management Console"
        subgraph "Service Control Panel"
            STATUS[Service Status Dashboard]
            CONTROL[Start/Stop/Restart Controls]
            CONFIG[Configuration Editor]
            LOGS[Log Viewer]
        end
        
        subgraph "System Monitoring"
            HEALTH[Health Checks]
            METRICS[Performance Metrics]
            ALERTS[Alert Management]
            DIAG[Diagnostic Tools]
        end
        
        subgraph "Maintenance Tools"
            BACKUP[Database Backup]
            UPDATE[Update Management]
            CLEANUP[Cleanup Utilities]
            REPAIR[Repair Tools]
        end
    end
    
    STATUS --> CONTROL
    CONTROL --> CONFIG
    CONFIG --> LOGS
    HEALTH --> METRICS
    METRICS --> ALERTS
    ALERTS --> DIAG
    BACKUP --> UPDATE
    UPDATE --> CLEANUP
    CLEANUP --> REPAIR
```

### Service Status Dashboard

**Real-time Service Monitoring:**
```typescript
interface ServiceStatus {
  name: string;
  displayName: string;
  status: 'running' | 'stopped' | 'starting' | 'stopping' | 'error';
  health: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  uptime: number;
  lastRestart: Date;
  cpu: number;
  memory: number;
  connections?: number;
  errors: number;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceStatus[];
  dependencies: DependencyStatus[];
  alerts: Alert[];
  metrics: SystemMetrics;
}
```

**Dashboard Features:**
- **Real-time Status**: Live updates every 5 seconds
- **Service Cards**: Visual status indicators with key metrics
- **Dependency Graph**: Interactive view of service relationships
- **Quick Actions**: Start/stop/restart buttons with confirmation
- **Alert Notifications**: Pop-up alerts for critical issues
- **Performance Graphs**: CPU, memory, and connection metrics

### Configuration Management Interface

**Hierarchical Configuration Editor:**
```typescript
interface ConfigNode {
  key: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'select';
  description: string;
  validation?: string;
  requires_restart?: boolean;
  children?: ConfigNode[];
}

interface ConfigurationManager {
  getConfiguration(): Promise<ConfigNode[]>;
  updateConfiguration(path: string, value: any): Promise<void>;
  validateConfiguration(): Promise<ValidationResult>;
  applyConfiguration(): Promise<void>;
  resetToDefaults(): Promise<void>;
}
```

**Configuration Features:**
- **Live Validation**: Real-time syntax and value checking
- **Change Preview**: Show effects before applying
- **Rollback Support**: Automatic backup and restore
- **Restart Notifications**: Warn when changes require service restart
- **Export/Import**: Configuration backup and sharing

### Log Viewer and Analysis

**Structured Log Viewer:**
```typescript
interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  service: string;
  message: string;
  fields: Record<string, any>;
  correlation_id?: string;
}

interface LogViewer {
  tail(service: string, lines: number): AsyncIterator<LogEntry>;
  search(query: LogQuery): Promise<LogEntry[]>;
  export(service: string, timeRange: TimeRange): Promise<Blob>;
  analyze(service: string, timeRange: TimeRange): Promise<LogAnalysis>;
}
```

**Log Viewer Features:**
- **Multi-service Tabs**: Switch between service logs
- **Live Streaming**: Real-time log updates
- **Filtering**: By level, service, time range, keywords
- **Search**: Full-text search with regex support
- **Export**: Download logs in various formats (JSON, CSV, TXT)
- **Analysis**: Error patterns, performance trends

### Health Check and Diagnostics

**Comprehensive Health Monitoring:**
```typescript
interface HealthCheck {
  name: string;
  category: 'connectivity' | 'performance' | 'resources' | 'data';
  status: 'pass' | 'warn' | 'fail';
  message: string;
  value?: number;
  threshold?: number;
  duration: number;
}

interface DiagnosticSuite {
  runHealthChecks(): Promise<HealthCheck[]>;
  testConnectivity(): Promise<ConnectivityReport>;
  analyzePerformance(): Promise<PerformanceReport>;
  checkDiskSpace(): Promise<ResourceReport>;
  validateData(): Promise<DataIntegrityReport>;
}
```

**Health Check Categories:**

**Database Connectivity:**
- PostgreSQL connection pool status
- Query response times
- Connection count vs limits
- Index health and usage
- Lock contention analysis

**AI Service Health:**
- Ollama service availability
- Model loading status
- GPU utilization (if available)
- Inference latency
- Memory usage patterns

**System Resources:**
- CPU utilization trends
- Memory usage and leaks
- Disk space availability
- Network connectivity
- Port availability

**Data Integrity:**
- Database consistency checks
- Index rebuilding status
- Backup validation
- Configuration file syntax

### Performance Metrics Dashboard

**Key Performance Indicators:**
```typescript
interface Metrics {
  requests_per_second: number;
  average_response_time: number;
  error_rate: number;
  active_connections: number;
  queue_depth: number;
  cache_hit_ratio: number;
  ai_processing_time: number;
  search_performance: number;
}
```

**Visualization Components:**
- **Time Series Graphs**: Request volume, latency, errors
- **Gauge Charts**: Current utilization levels
- **Heat Maps**: Error distribution and patterns
- **Comparison Charts**: Performance over time
- **Resource Utilization**: CPU, memory, disk, network

## Implementation Technology Recommendations

### Primary Implementation Stack

**Service Wrapper Technology:**
```rust
// Rust-based Windows Service
use windows_service::{
    service::{ServiceControl, ServiceControlAccept, ServiceExitCode, ServiceState, ServiceStatus, ServiceType},
    service_dispatcher, Result,
    service_control_handler::{self, ServiceControlHandlerResult},
};

pub struct HotMService {
    name: String,
    component: Box<dyn ServiceComponent>,
}

impl HotMService {
    pub fn new(name: &str, component: Box<dyn ServiceComponent>) -> Self {
        Self {
            name: name.to_string(),
            component,
        }
    }
    
    pub fn run(&self) -> Result<()> {
        service_dispatcher::start(self.name.clone(), self.service_main)?;
        Ok(())
    }
}
```

**Alternative Implementation Options:**

**Option 1: NSSM (Non-Sucking Service Manager)**
- **Pros**: Simple wrapper for existing binaries, robust monitoring
- **Cons**: External dependency, less control over service lifecycle
- **Use Case**: Quick deployment, legacy application wrapping

**Option 2: .NET Service Framework**
- **Pros**: Rich Windows integration, familiar to Windows developers
- **Cons**: .NET runtime dependency, larger memory footprint
- **Use Case**: Complex service orchestration, GUI service management

**Option 3: Custom Rust Service Implementation**
- **Pros**: Full control, minimal dependencies, high performance
- **Cons**: More development effort, Windows-specific code
- **Use Case**: Production deployments, performance-critical applications

### Recommended Implementation Approach

**Hybrid Rust + PowerShell Solution:**
```rust
// Core service implementation in Rust
pub struct ServiceManager {
    postgres: PostgreSQLService,
    ollama: OllamaService,
    runtime: HotMRuntimeService,
    monitor: MonitorService,
}

impl ServiceManager {
    pub async fn start_all(&mut self) -> Result<()> {
        self.postgres.start().await?;
        self.postgres.wait_ready(Duration::from_secs(60)).await?;
        
        self.ollama.start().await?;
        self.ollama.wait_ready(Duration::from_secs(120)).await?;
        
        self.runtime.start().await?;
        self.runtime.wait_ready(Duration::from_secs(30)).await?;
        
        self.monitor.start().await?;
        Ok(())
    }
}
```

```powershell
# PowerShell service management utilities
function Install-HotMServices {
    param(
        [string]$InstallPath,
        [string]$DataPath,
        [hashtable]$Configuration
    )
    
    # Install PostgreSQL service
    New-Service -Name "hotm-postgres" `
                -BinaryPathName "$InstallPath\postgres\bin\postgres.exe -D $DataPath\PostgreSQL\data -p 54321" `
                -StartupType Automatic `
                -DependsOn @("RPC", "DCOM", "EventLog")
    
    # Install Ollama service  
    New-Service -Name "hotm-ollama" `
                -BinaryPathName "$InstallPath\ollama\ollama.exe serve" `
                -StartupType Automatic `
                -DependsOn @("RPC", "DCOM", "EventLog", "hotm-postgres")
    
    # Install HotM Runtime service
    New-Service -Name "hotm-runtime" `
                -BinaryPathName "$InstallPath\bin\hotm-server.exe --service" `
                -StartupType Automatic `
                -DependsOn @("RPC", "DCOM", "EventLog", "hotm-postgres", "hotm-ollama")
    
    # Install Monitor service
    New-Service -Name "hotm-monitor" `
                -BinaryPathName "$InstallPath\bin\hotm-monitor.exe" `
                -StartupType Automatic `
                -DependsOn @("EventLog", "hotm-runtime")
}
```

### Management Interface Technology

**Tauri-based Management Console:**
```typescript
// React-based management UI
import { invoke } from '@tauri-apps/api/tauri';

interface ServiceControlAPI {
  getServiceStatus(): Promise<ServiceStatus[]>;
  startService(name: string): Promise<void>;
  stopService(name: string): Promise<void>;
  restartService(name: string): Promise<void>;
  getConfiguration(): Promise<Configuration>;
  updateConfiguration(config: Configuration): Promise<void>;
  getLogs(service: string, lines: number): Promise<LogEntry[]>;
  runHealthChecks(): Promise<HealthCheck[]>;
}
```

## Security and Permissions Model

### Service Account Strategy

**Principle of Least Privilege:**
- **PostgreSQL**: `NT AUTHORITY\LocalService` with data directory access
- **Ollama**: `NT AUTHORITY\LocalService` with model directory access
- **Runtime**: `NT AUTHORITY\LocalService` with config file access
- **Monitor**: `NT AUTHORITY\LocalService` with event log write access

**Directory Permissions:**
```
%PROGRAMDATA%\HotM\
├── PostgreSQL\
│   └── data\ (Full Control: LocalService, Administrators)
├── Ollama\
│   └── models\ (Full Control: LocalService, Administrators)
├── config\ (Read/Write: LocalService, Administrators; Read: Users)
└── logs\ (Write: LocalService, Administrators; Read: Administrators)
```

### Registry Security

**Service Configuration Protection:**
```
HKLM\SYSTEM\CurrentControlSet\Services\hotm-*
├── Permissions: Full Control (SYSTEM, Administrators)
├── Read Access: Authenticated Users
└── Write Access: Administrators only
```

### Network Security

**Port Access Control:**
- **54321 (PostgreSQL)**: Local connections only
- **11435 (Ollama)**: Local connections only  
- **53211 (HotM API)**: Configurable (local/network)

**Firewall Rules:**
```powershell
# Inbound rules for HotM services
New-NetFirewallRule -DisplayName "HotM API" -Direction Inbound -Port 53211 -Protocol TCP
New-NetFirewallRule -DisplayName "HotM PostgreSQL" -Direction Inbound -Port 54321 -Protocol TCP -LocalAddress 127.0.0.1
New-NetFirewallRule -DisplayName "HotM Ollama" -Direction Inbound -Port 11435 -Protocol TCP -LocalAddress 127.0.0.1
```

### Authentication and Authorization

**Service-to-Service Authentication:**
```toml
[authentication]
postgres_user = "hotm"
postgres_password = "${DB_PASSWORD}"
api_key = "${GENERATED_API_KEY}"
jwt_secret = "${JWT_SECRET}"

[authorization]
admin_users = ["administrator"]
readonly_users = []
api_access = "local"  # local|network|public
```

## Testing Strategy for Service Integration

### Test Categories

**1. Unit Tests - Service Components**
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[tokio::test]
    async fn test_postgres_service_startup() {
        let service = PostgreSQLService::new(test_config());
        assert!(service.start().await.is_ok());
        assert!(service.is_ready().await);
        service.stop().await.unwrap();
    }
    
    #[tokio::test] 
    async fn test_service_dependency_order() {
        let manager = ServiceManager::new();
        let result = manager.start_all().await;
        assert!(result.is_ok());
        
        // Verify startup order
        assert!(manager.postgres.started_at < manager.ollama.started_at);
        assert!(manager.ollama.started_at < manager.runtime.started_at);
    }
}
```

**2. Integration Tests - Service Communication**
```rust
#[tokio::test]
async fn test_full_service_stack() {
    let test_env = TestEnvironment::setup().await;
    
    // Start all services
    test_env.start_postgres().await?;
    test_env.start_ollama().await?;
    test_env.start_runtime().await?;
    
    // Test end-to-end functionality
    let client = test_env.api_client();
    let note = client.create_note("Test note").await?;
    assert!(note.id.is_some());
    
    // Test AI processing
    tokio::time::sleep(Duration::from_secs(5)).await;
    let processed_note = client.get_note(note.id.unwrap()).await?;
    assert!(processed_note.revised_content.is_some());
    
    test_env.cleanup().await;
}
```

**3. End-to-End Tests - Windows Service Integration**
```powershell
# PowerShell-based E2E tests
Describe "HotM Service Installation" {
    It "Should install all services successfully" {
        Install-HotMServices -InstallPath "C:\Test\HotM" -DataPath "C:\Test\Data"
        
        Get-Service "hotm-postgres" | Should -Not -BeNullOrEmpty
        Get-Service "hotm-ollama" | Should -Not -BeNullOrEmpty  
        Get-Service "hotm-runtime" | Should -Not -BeNullOrEmpty
        Get-Service "hotm-monitor" | Should -Not -BeNullOrEmpty
    }
    
    It "Should start services in correct order" {
        Start-Service "hotm-postgres"
        Start-Service "hotm-ollama"
        Start-Service "hotm-runtime"
        
        (Get-Service "hotm-postgres").Status | Should -Be "Running"
        (Get-Service "hotm-ollama").Status | Should -Be "Running"
        (Get-Service "hotm-runtime").Status | Should -Be "Running"
    }
}
```

**4. Performance Tests - Service Resource Usage**
```rust
#[tokio::test]
async fn test_service_resource_limits() {
    let monitor = ResourceMonitor::new();
    let services = start_all_services().await;
    
    // Monitor for 5 minutes
    let duration = Duration::from_secs(300);
    let stats = monitor.collect_stats(duration).await;
    
    // Assert resource limits
    assert!(stats.postgres_memory_mb < 512);
    assert!(stats.ollama_memory_mb < 4096);
    assert!(stats.runtime_memory_mb < 256);
    
    // Assert performance benchmarks
    assert!(stats.api_response_time_ms < 100);
    assert!(stats.database_query_time_ms < 50);
}
```

**5. Failure Recovery Tests**
```rust
#[tokio::test]
async fn test_service_failure_recovery() {
    let manager = ServiceManager::new();
    manager.start_all().await.unwrap();
    
    // Simulate PostgreSQL failure
    manager.postgres.kill().await;
    
    // Wait for recovery
    tokio::time::sleep(Duration::from_secs(10)).await;
    
    // Verify recovery
    assert!(manager.postgres.is_running().await);
    assert!(manager.runtime.is_running().await);
    
    // Test functionality after recovery
    let client = TestApiClient::new();
    let response = client.health_check().await.unwrap();
    assert_eq!(response.status, "healthy");
}
```

### Continuous Integration Pipeline

**GitHub Actions Workflow:**
```yaml
name: Windows Service Integration Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  windows-service-tests:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Test Environment
      run: |
        # Install PostgreSQL portable
        choco install postgresql --version 14.8 --params '/NoPath'
        
        # Install Ollama
        Invoke-WebRequest -Uri "https://ollama.ai/install.ps1" -OutFile "install.ps1"
        .\install.ps1
    
    - name: Build Services
      run: |
        cargo build --release --bin hotm-server
        cargo build --release --bin hotm-monitor
    
    - name: Run Service Integration Tests
      run: |
        cargo test --test service_integration -- --nocapture
        
    - name: Run PowerShell Service Tests  
      run: |
        Invoke-Pester -Path .\tests\windows\services.tests.ps1
    
    - name: Collect Test Artifacts
      uses: actions/upload-artifact@v3
      with:
        name: service-logs
        path: |
          logs/**/*
          test-results/**/*
```

This comprehensive Windows service integration architecture provides enterprise-grade reliability, maintainability, and user experience while handling the complexity of multi-service coordination in the Windows environment.