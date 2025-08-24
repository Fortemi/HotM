# Unified Runtime Architecture

## Overview

HotM's unified runtime refactor consolidates the current dual-binary architecture (Tauri frontend + Axum server) into a single Rust binary capable of operating in multiple deployment modes. This design maintains compatibility with existing deployment scenarios while enabling new hybrid configurations and simplified distribution.

## Current vs. Unified Architecture

### Current Architecture (v0.1.x)
```mermaid
graph TB
    subgraph "Current Deployment"
        UI[Tauri Desktop App<br/>React + Rust Backend]
        API[Standalone Axum Server<br/>Port 53211]
        DB[(PostgreSQL<br/>+ pgvector)]
        OLLAMA[Ollama Service<br/>Port 11434]
    end
    
    UI -->|HTTP/WS| API
    API --> DB
    API --> OLLAMA
```

**Limitations:**
- Requires separate binary distribution
- Complex local setup (multiple services)
- Limited offline capability
- Dependency on network layer even for local use

### Unified Architecture (v0.2.0+)
```mermaid
graph TB
    subgraph "Unified Runtime"
        CORE[hotm-core<br/>Shared Business Logic]
        
        subgraph "Interface Adapters"
            GUI[GUI Interface<br/>Tauri/Native]
            HTTP[HTTP Interface<br/>Axum Server]
            CLI[CLI Interface<br/>Clap Commands]
            MCP[MCP Interface<br/>Stdio/HTTP]
        end
        
        subgraph "Service Layer"
            DB_SVC[Database Service]
            AI_SVC[AI Service]
            JOB_SVC[Job Queue Service]
            EVENT_SVC[Event Bus Service]
        end
    end
    
    GUI --> CORE
    HTTP --> CORE
    CLI --> CORE
    MCP --> CORE
    CORE --> DB_SVC
    CORE --> AI_SVC
    CORE --> JOB_SVC
    CORE --> EVENT_SVC
```

**Benefits:**
- Single binary distribution
- Embedded services with optional external connectivity
- Mode-specific optimization
- Simplified deployment and configuration

## Core Architecture Components

### 1. Shared Core (`hotm-core`)

Central business logic library extracted from current server implementation:

```rust
// Core service traits
pub trait DatabaseService: Send + Sync {
    async fn create_note(&self, note: CreateNoteRequest) -> Result<Note>;
    async fn search_notes(&self, query: SearchQuery) -> Result<SearchResults>;
    // ... other database operations
}

pub trait AiService: Send + Sync {
    async fn generate_summary(&self, content: &str) -> Result<String>;
    async fn generate_embeddings(&self, text: &str) -> Result<Vec<f32>>;
    // ... other AI operations
}

pub trait EventBus: Send + Sync {
    async fn emit(&self, event: Event) -> Result<()>;
    async fn subscribe(&self, handler: EventHandler) -> Result<Subscription>;
}

pub trait JobQueue: Send + Sync {
    async fn enqueue(&self, job: Job) -> Result<JobId>;
    async fn process(&self) -> Result<()>;
}
```

### 2. Interface Adapters

Mode-specific interfaces that translate external requests to core operations:

```rust
// Runtime mode configuration
pub enum RuntimeMode {
    Desktop {
        show_gui: bool,
        system_tray: bool,
        global_hotkey: Option<String>,
    },
    Server {
        bind_address: SocketAddr,
        enable_web_ui: bool,
        auth_required: bool,
    },
    Hybrid {
        desktop_config: DesktopConfig,
        server_config: ServerConfig,
    },
    Development {
        hot_reload: bool,
        debug_apis: bool,
        test_mode: bool,
    },
}
```

### 3. Service Implementations

Multiple implementations of core traits for different deployment contexts:

```rust
// Database implementations
pub struct EmbeddedDatabase { /* SQLite + in-memory */ }
pub struct PostgresDatabase { /* External PostgreSQL */ }
pub struct DocumentDatabase { /* Azure Cosmos DB */ }

// Event implementations  
pub struct TauriEventBus { /* Tauri app.emit_all */ }
pub struct WebSocketEventBus { /* WebSocket connections */ }
pub struct LogEventBus { /* File/stdout logging */ }

// AI implementations
pub struct EmbeddedOllama { /* Bundled models */ }
pub struct ExternalOllama { /* Network Ollama service */ }
pub struct CloudAI { /* Azure OpenAI, etc. */ }
```

## Runtime Mode Details

### 1. Desktop Mode

**Purpose**: Replace current Tauri application with enhanced capabilities

```rust
pub struct DesktopRuntime {
    core: Arc<HotmCore>,
    gui: TauriApplication,
    database: EmbeddedDatabase,
    ai_service: EmbeddedOllama,
    event_bus: TauriEventBus,
}
```

**Characteristics:**
- Embedded SQLite database with optional PostgreSQL
- Local Ollama integration or bundled models
- Tauri GUI with system integration
- No network dependencies by default
- MSI installer with service registration

**Configuration:**
```toml
[desktop]
mode = "desktop"
show_gui = true
system_tray = true
global_hotkey = "Ctrl+Alt+H"
auto_start = true

[database]
type = "embedded"
path = "./data/hotm.db"

[ai]
type = "embedded"
models_path = "./models"
fallback_url = "http://localhost:11434"
```

### 2. Server Mode  

**Purpose**: Enhanced standalone server for centralized deployments

```rust
pub struct ServerRuntime {
    core: Arc<HotmCore>,
    http_server: AxumServer,
    web_ui: Option<StaticFiles>,
    database: PostgresDatabase,
    ai_service: ExternalOllama,
    event_bus: WebSocketEventBus,
}
```

**Characteristics:**
- PostgreSQL/DocumentDB backend
- Web-based management interface
- Multi-user authentication
- Docker/systemd service deployment
- API-first architecture

**Configuration:**
```toml
[server]
mode = "server"
bind_address = "0.0.0.0:53211"
enable_web_ui = true
auth_required = true
tls_cert = "./certs/cert.pem"
tls_key = "./certs/key.pem"

[database]
type = "postgresql"
url = "postgres://user:pass@localhost:5432/hotm"

[ai]
type = "ollama"
url = "http://ollama:11434"
```

### 3. Hybrid Mode

**Purpose**: Desktop GUI with simultaneous server capabilities

```rust  
pub struct HybridRuntime {
    core: Arc<HotmCore>,
    gui: TauriApplication,
    http_server: AxumServer,
    database: PostgresDatabase,
    ai_service: ExternalOllama,
    event_bus: MultiEventBus,
}
```

**Characteristics:**
- Desktop application with web access
- Shared database and processing
- Developer and power-user focused
- Network-optional operation
- Remote collaboration support

**Configuration:**
```toml
[hybrid]
mode = "hybrid"

[desktop]
show_gui = true
system_tray = true

[server]
bind_address = "127.0.0.1:53211"
enable_web_ui = true
auth_required = false

[database]
type = "postgresql"
url = "postgres://localhost:5432/hotm"
```

### 4. Development Mode

**Purpose**: Enhanced development experience with debugging tools

```rust
pub struct DevelopmentRuntime {
    core: Arc<HotmCore>,
    gui: Option<TauriApplication>,
    http_server: AxumServer,
    debug_server: DebugServer,
    database: PostgresDatabase,
    ai_service: MockAiService,
    event_bus: LogEventBus,
}
```

**Characteristics:**
- Hot-reload support
- Mock AI services for testing
- Debug APIs and introspection
- Test data generation
- Performance profiling

**Configuration:**
```toml
[development]
mode = "development"
hot_reload = true
debug_apis = true
test_mode = true

[database]
type = "postgresql"
url = "postgres://localhost:5432/hotm_dev"

[ai]
type = "mock"
delay_ms = 100
```

## Component Interaction Patterns

### Event Flow Architecture

```mermaid
sequenceDiagram
    participant UI as User Interface
    participant CORE as HotM Core
    participant DB as Database Service
    participant AI as AI Service
    participant EVENT as Event Bus
    
    UI->>CORE: Create Note Request
    CORE->>DB: Store Original Note
    CORE->>EVENT: Emit NoteCreated
    CORE->>AI: Queue Processing Job
    AI->>AI: Generate Summary/Tags
    AI->>DB: Store Processed Data
    AI->>EVENT: Emit NoteUpdated
    EVENT->>UI: Update Interface
```

### Service Discovery

```rust
pub struct ServiceRegistry {
    database: Arc<dyn DatabaseService>,
    ai: Arc<dyn AiService>, 
    events: Arc<dyn EventBus>,
    jobs: Arc<dyn JobQueue>,
}

impl ServiceRegistry {
    pub fn new(mode: RuntimeMode) -> Self {
        match mode {
            RuntimeMode::Desktop { .. } => Self {
                database: Arc::new(EmbeddedDatabase::new()),
                ai: Arc::new(EmbeddedOllama::new()),
                events: Arc::new(TauriEventBus::new()),
                jobs: Arc::new(LocalJobQueue::new()),
            },
            RuntimeMode::Server { .. } => Self {
                database: Arc::new(PostgresDatabase::new()),
                ai: Arc::new(ExternalOllama::new()),
                events: Arc::new(WebSocketEventBus::new()),
                jobs: Arc::new(DistributedJobQueue::new()),
            },
            // ... other modes
        }
    }
}
```

## Data Storage Strategy

### Mode-Specific Storage

| Mode | Primary Storage | Backup/Sync | Use Case |
|------|----------------|-------------|----------|
| Desktop | SQLite + Files | Optional Cloud | Personal use |
| Server | PostgreSQL | Replicas | Team/Organization |
| Hybrid | PostgreSQL | Local Cache | Power Users |
| Development | PostgreSQL | None | Testing |

### Database Abstraction

```rust
pub enum DatabaseConfig {
    Embedded { 
        path: PathBuf,
        cache_size: usize,
    },
    PostgreSQL {
        url: String,
        pool_size: u32,
        ssl_mode: SslMode,
    },
    DocumentDB {
        connection_string: String,
        database_name: String,
    },
}

pub async fn create_database_service(config: DatabaseConfig) -> Result<Arc<dyn DatabaseService>> {
    match config {
        DatabaseConfig::Embedded { path, cache_size } => {
            Ok(Arc::new(EmbeddedDatabase::new(path, cache_size).await?))
        },
        DatabaseConfig::PostgreSQL { url, pool_size, ssl_mode } => {
            Ok(Arc::new(PostgresDatabase::connect(url, pool_size, ssl_mode).await?))
        },
        DatabaseConfig::DocumentDB { connection_string, database_name } => {
            Ok(Arc::new(DocumentDatabase::connect(connection_string, database_name).await?))
        },
    }
}
```

## Process Architecture

### Single Process Model

```rust
#[tokio::main]
async fn main() -> Result<()> {
    let config = load_configuration().await?;
    let runtime_mode = determine_runtime_mode(&config).await?;
    
    let services = ServiceRegistry::new(runtime_mode.clone()).await?;
    let core = HotmCore::new(services).await?;
    
    match runtime_mode {
        RuntimeMode::Desktop { .. } => {
            let desktop = DesktopRuntime::new(core).await?;
            desktop.run().await
        },
        RuntimeMode::Server { .. } => {
            let server = ServerRuntime::new(core).await?;
            server.run().await
        },
        RuntimeMode::Hybrid { .. } => {
            let hybrid = HybridRuntime::new(core).await?;
            hybrid.run().await
        },
        RuntimeMode::Development { .. } => {
            let dev = DevelopmentRuntime::new(core).await?;
            dev.run().await
        },
    }
}
```

### Resource Management

```rust
pub struct RuntimeResources {
    database_pool: DatabasePool,
    ai_client: AiClient,
    job_workers: WorkerPool,
    event_subscribers: EventSubscriberPool,
}

impl RuntimeResources {
    pub async fn shutdown_gracefully(&self) -> Result<()> {
        // Graceful shutdown sequence
        self.job_workers.stop_accepting_jobs().await?;
        self.job_workers.wait_for_completion(Duration::from_secs(30)).await?;
        self.event_subscribers.close_all().await?;
        self.database_pool.close().await?;
        Ok(())
    }
}
```

## Migration Strategy

### Phase 1: Core Extraction (v0.1.1)
- Extract business logic into `hotm-core` crate
- Implement service traits
- Add EventBus abstraction
- Maintain existing binary structure

### Phase 2: Interface Abstraction (v0.1.2)
- Create interface adapter layer
- Implement Tauri command handlers
- Add configuration management
- Test dual-interface operation

### Phase 3: Unified Binary (v0.2.0)
- Merge binaries with runtime mode selection
- Implement embedded database option
- Add web UI for server mode
- Create installation packages

### Phase 4: Enhancement (v0.2.1+)
- Add cloud integrations
- Implement distributed features
- Enhance development tooling
- Performance optimizations

## Configuration Management

### Hierarchical Configuration

```toml
# Default embedded in binary
[defaults]
log_level = "info"
cache_size = "100MB"

# User configuration file
[user]
data_directory = "~/.hotm"
backup_enabled = true

# Environment overrides
[env]
DATABASE_URL = "${DATABASE_URL}"
AI_SERVICE_URL = "${AI_SERVICE_URL}"

# Runtime mode selection
[runtime]
mode = "auto"  # auto, desktop, server, hybrid, development
prefer_embedded = true
```

### Configuration Resolution

```rust
pub struct Configuration {
    runtime: RuntimeConfig,
    database: DatabaseConfig,
    ai: AiConfig,
    logging: LoggingConfig,
    security: SecurityConfig,
}

impl Configuration {
    pub async fn load() -> Result<Self> {
        let mut config = Self::default();
        
        // Load from embedded defaults
        config.merge_from_embedded()?;
        
        // Load from config file
        if let Ok(file_config) = Self::load_from_file().await {
            config.merge(file_config)?;
        }
        
        // Override with environment variables
        config.merge_from_env()?;
        
        // Override with CLI arguments
        config.merge_from_args()?;
        
        config.validate()?;
        Ok(config)
    }
}
```

## Error Handling and Resilience

### Service Degradation

```rust
pub struct ServiceHealth {
    database: HealthStatus,
    ai_service: HealthStatus,
    event_bus: HealthStatus,
}

pub enum HealthStatus {
    Healthy,
    Degraded { reason: String },
    Unhealthy { error: String },
}

impl HotmCore {
    pub async fn handle_service_degradation(&self, service: ServiceType, health: HealthStatus) {
        match (service, health) {
            (ServiceType::AI, HealthStatus::Unhealthy { .. }) => {
                // Disable AI features, continue with basic functionality
                self.disable_ai_features().await;
            },
            (ServiceType::Database, HealthStatus::Degraded { .. }) => {
                // Switch to read-only mode
                self.enable_readonly_mode().await;
            },
            _ => {}
        }
    }
}
```

### Recovery Strategies

```rust
pub struct RecoveryManager {
    retry_policies: HashMap<ServiceType, RetryPolicy>,
    circuit_breakers: HashMap<ServiceType, CircuitBreaker>,
}

impl RecoveryManager {
    pub async fn attempt_recovery(&self, service: ServiceType) -> Result<()> {
        let policy = self.retry_policies.get(&service).unwrap();
        let breaker = self.circuit_breakers.get(&service).unwrap();
        
        if breaker.is_open() {
            return Err(anyhow!("Circuit breaker is open for {:?}", service));
        }
        
        policy.execute(|| async {
            match service {
                ServiceType::Database => self.reconnect_database().await,
                ServiceType::AI => self.reconnect_ai_service().await,
                ServiceType::EventBus => self.restart_event_bus().await,
            }
        }).await
    }
}
```

## Performance Considerations

### Resource Allocation by Mode

| Mode | Memory Usage | CPU Usage | Storage | Network |
|------|-------------|-----------|---------|---------|
| Desktop | 100-200MB | Low | Local SQLite | Minimal |
| Server | 200-500MB | Medium | PostgreSQL | High |
| Hybrid | 300-600MB | Medium-High | PostgreSQL | Medium |
| Development | 400-800MB | High | PostgreSQL | High |

### Optimization Strategies

```rust
pub struct PerformanceConfig {
    mode: RuntimeMode,
    worker_threads: usize,
    cache_size: ByteSize,
    batch_size: usize,
    connection_pool_size: u32,
}

impl PerformanceConfig {
    pub fn for_mode(mode: RuntimeMode, system_resources: SystemResources) -> Self {
        match mode {
            RuntimeMode::Desktop { .. } => Self {
                mode,
                worker_threads: 2,
                cache_size: ByteSize::mb(50),
                batch_size: 10,
                connection_pool_size: 5,
            },
            RuntimeMode::Server { .. } => Self {
                mode,
                worker_threads: system_resources.cpu_cores,
                cache_size: ByteSize::mb(200),
                batch_size: 50,
                connection_pool_size: 20,
            },
            // ... other modes
        }
    }
}
```

## Security Model

### Mode-Specific Security

```rust
pub struct SecurityConfig {
    authentication: AuthConfig,
    encryption: EncryptionConfig,
    network: NetworkSecurityConfig,
}

pub enum AuthConfig {
    None,                          // Desktop mode
    Simple { admin_key: String },  // Development mode
    JWT { secret: String },        // Server mode
    OAuth { providers: Vec<OAuthProvider> }, // Enterprise mode
}
```

### Data Protection

```rust
pub trait DataProtection: Send + Sync {
    async fn encrypt(&self, data: &[u8]) -> Result<Vec<u8>>;
    async fn decrypt(&self, data: &[u8]) -> Result<Vec<u8>>;
}

pub struct WindowsDPAPI;
pub struct AESEncryption { key: [u8; 32] }
pub struct NoEncryption;

impl HotmCore {
    pub fn create_data_protection(mode: RuntimeMode) -> Arc<dyn DataProtection> {
        match mode {
            RuntimeMode::Desktop { .. } => Arc::new(WindowsDPAPI::new()),
            RuntimeMode::Server { .. } => Arc::new(AESEncryption::from_env()),
            _ => Arc::new(NoEncryption),
        }
    }
}
```

This unified runtime architecture provides a solid foundation for the refactor while maintaining backward compatibility and enabling new deployment scenarios.