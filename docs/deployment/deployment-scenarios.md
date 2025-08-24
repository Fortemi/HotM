# HotM Deployment Scenarios

## Overview

This document details current and planned deployment scenarios for HotM, covering the transition from the current dual-binary architecture to the unified runtime approach. Each scenario is designed for specific use cases, user types, and operational requirements.

## Current Deployment Modes (v0.1.x)

### 1. Desktop Client Mode

**Target Users**: Individual knowledge workers, researchers, writers
**Installation**: MSI package for Windows 11

```mermaid
graph TB
    subgraph "Windows 11 Workstation"
        UI[HotM Desktop App<br/>Tauri + React]
        API[HotM API Server<br/>Port 53211]
        DB[(Local PostgreSQL<br/>+ pgvector)]
        OLLAMA[Ollama Service<br/>Port 11434]
    end
    
    UI -->|HTTP/WS| API
    API --> DB  
    API --> OLLAMA
    
    style UI fill:#e1f5fe
    style API fill:#f3e5f5
    style DB fill:#e8f5e8
    style OLLAMA fill:#fff3e0
```

**Characteristics:**
- **Pros**: Full local control, privacy, offline operation
- **Cons**: Resource intensive, complex setup, limited collaboration
- **Resource Usage**: 2-4GB RAM, 10-50GB storage
- **Network**: Optional (for model downloads)

**Installation Steps:**
1. Run `HotM-Setup-v0.1.0.msi`
2. Installer configures PostgreSQL with pgvector
3. Downloads and configures Ollama with required models
4. Creates desktop shortcuts and system tray integration
5. Configures Windows service for API server

### 2. Centralized Server Mode

**Target Users**: Teams, small organizations, home labs
**Installation**: Docker Compose or manual server setup

```mermaid
graph TB
    subgraph "Server Infrastructure"
        subgraph "Docker Host"
            API[HotM API Server<br/>Container]
            DB[(PostgreSQL<br/>+ pgvector)]
            OLLAMA[Ollama Service<br/>GPU Accelerated]
            NGINX[Nginx Proxy<br/>TLS Termination]
        end
    end
    
    subgraph "Client Workstations"
        CLIENT1[Desktop Client 1]
        CLIENT2[Desktop Client 2]
        WEB[Web Browser]
    end
    
    CLIENT1 -->|HTTPS| NGINX
    CLIENT2 -->|HTTPS| NGINX
    WEB -->|HTTPS| NGINX
    NGINX --> API
    API --> DB
    API --> OLLAMA
    
    style API fill:#f3e5f5
    style DB fill:#e8f5e8
    style OLLAMA fill:#fff3e0
    style NGINX fill:#ffebee
```

**Characteristics:**
- **Pros**: Centralized management, resource sharing, collaboration
- **Cons**: Single point of failure, network dependency, complex security
- **Resource Usage**: 4-16GB RAM, 100GB+ storage, GPU recommended
- **Network**: Always required, HTTPS recommended

**Installation Steps:**
1. Deploy via Docker Compose: `docker-compose up -d`
2. Configure reverse proxy with SSL certificates
3. Set up user authentication and API keys
4. Configure backup and monitoring
5. Install desktop clients with server endpoint

### 3. Local Development Mode

**Target Users**: Developers, contributors, testers
**Installation**: Manual setup with development tools

```mermaid
graph TB
    subgraph "Development Environment"
        IDE[VS Code / IDE]
        UI_DEV[UI Dev Server<br/>Vite + HMR]
        API_DEV[API Dev Server<br/>cargo watch]
        TEST_DB[(Test Database<br/>PostgreSQL)]
        LOCAL_OLLAMA[Local Ollama<br/>Development Models]
    end
    
    IDE --> UI_DEV
    IDE --> API_DEV
    UI_DEV -->|HTTP/WS| API_DEV
    API_DEV --> TEST_DB
    API_DEV --> LOCAL_OLLAMA
    
    style UI_DEV fill:#e3f2fd
    style API_DEV fill:#f1f8e9
    style TEST_DB fill:#fff8e1
    style LOCAL_OLLAMA fill:#fce4ec
```

**Characteristics:**
- **Pros**: Hot reload, debugging tools, test data, isolation
- **Cons**: Manual setup, resource intensive, not production-ready
- **Resource Usage**: 4-8GB RAM, 20GB+ storage
- **Network**: Required for dependencies and models

**Setup Steps:**
1. Clone repository and install dependencies
2. Set up PostgreSQL with test database
3. Configure Ollama with development models
4. Run `npm run dev` and `cargo run` in separate terminals
5. Configure IDE with debugging and testing tools

### 4. Hybrid Mode (Limited)

**Target Users**: Power users needing both local and remote access
**Installation**: Desktop client + server configuration

**Current Limitations:**
- Requires manual configuration of both modes
- No shared state between desktop and server interfaces
- Complex networking setup for remote access
- Potential data synchronization issues

## Unified Runtime Deployment Scenarios (v0.2.0+)

### 1. Enhanced Desktop Mode

**Single Binary Deployment with Embedded Services**

```mermaid
graph TB
    subgraph "HotM Unified Runtime"
        subgraph "Core Services"
            CORE[HotM Core Engine]
            DB_SVC[Database Service]
            AI_SVC[AI Service] 
            JOB_SVC[Job Queue]
            EVENT_SVC[Event Bus]
        end
        
        subgraph "Interface Layer"
            GUI[Desktop GUI<br/>Tauri Interface]
            TRAY[System Tray<br/>Quick Actions]
        end
        
        subgraph "Storage Layer"
            SQLITE[(Embedded SQLite<br/>+ Vector Extension)]
            FILES[Local File Storage<br/>Attachments/Cache]
        end
        
        subgraph "AI Layer"
            EMBEDDED_AI[Embedded Models<br/>Small Inference]
            OLLAMA_CLIENT[Ollama Client<br/>Fallback to External]
        end
    end
    
    GUI --> CORE
    TRAY --> CORE
    CORE --> DB_SVC
    CORE --> AI_SVC
    CORE --> JOB_SVC
    CORE --> EVENT_SVC
    DB_SVC --> SQLITE
    DB_SVC --> FILES
    AI_SVC --> EMBEDDED_AI
    AI_SVC --> OLLAMA_CLIENT
    
    style CORE fill:#4fc3f7
    style GUI fill:#81c784  
    style SQLITE fill:#ffb74d
    style EMBEDDED_AI fill:#f06292
```

**Configuration Example:**
```toml
# hotm.toml
[runtime]
mode = "desktop"
data_directory = "~/.hotm"

[desktop]
show_gui = true
system_tray = true
global_hotkey = "Ctrl+Alt+H"
auto_start = true
theme = "auto"  # auto, light, dark

[database]
type = "embedded"
path = "./data/hotm.db"
cache_size = "100MB"
auto_backup = true

[ai]
type = "hybrid"
embedded_models = ["tiny-llm", "sentence-transformers"]
fallback_url = "http://localhost:11434"
offline_mode = true

[features]
web_interface = false
mcp_server = true
api_server = false
```

**Deployment Characteristics:**
- **Installation**: Single MSI/EXE installer (~500MB including models)
- **Dependencies**: None (fully embedded)
- **Resource Usage**: 150-400MB RAM, 2-10GB storage
- **Network**: Optional (for model updates, sync)
- **Startup Time**: <3 seconds
- **Offline Capable**: Fully functional without network

**Use Cases:**
- Personal knowledge management
- Research and writing
- Offline-first workflows
- Privacy-sensitive environments
- Travel/mobile usage

### 2. Server Mode with Web Interface

**Centralized Deployment with Built-in Management UI**

```mermaid
graph TB
    subgraph "HotM Server Runtime"
        subgraph "Core Services"
            CORE[HotM Core Engine]
            HTTP[HTTP Server<br/>Axum Framework]
            WEB_UI[Web Management UI<br/>Static Files]
            MCP[MCP Server<br/>AI Integration]
        end
        
        subgraph "External Services"
            DB[(PostgreSQL<br/>+ pgvector)]
            OLLAMA[Ollama Service<br/>GPU Accelerated]
            REDIS[(Redis Cache<br/>Optional)]
        end
        
        subgraph "Client Connections"
            DESKTOP[Desktop Clients]
            WEB_BROWSER[Web Browsers]
            API_CLIENT[API Clients]
            AI_ASSISTANT[AI Assistants<br/>via MCP]
        end
    end
    
    DESKTOP -->|HTTPS/WSS| HTTP
    WEB_BROWSER -->|HTTPS| HTTP
    API_CLIENT -->|REST API| HTTP
    AI_ASSISTANT -->|MCP| MCP
    
    HTTP --> CORE
    WEB_UI --> HTTP
    MCP --> CORE
    CORE --> DB
    CORE --> OLLAMA
    CORE --> REDIS
    
    style CORE fill:#4fc3f7
    style HTTP fill:#81c784
    style WEB_UI fill:#ffb74d
    style DB fill:#f06292
```

**Configuration Example:**
```toml
# hotm.toml
[runtime]
mode = "server"
config_file = "/etc/hotm/server.toml"

[server]
bind_address = "0.0.0.0:53211"
enable_tls = true
cert_file = "/etc/hotm/tls/cert.pem"
key_file = "/etc/hotm/tls/key.pem"
cors_origins = ["https://app.example.com"]

[web_ui]
enabled = true
path = "/ui"
auth_required = true

[database]
type = "postgresql"
url = "postgres://hotm:${DB_PASSWORD}@postgres:5432/hotm"
pool_size = 20
ssl_mode = "require"

[ai]
type = "ollama"
url = "http://ollama:11434"
generation_model = "gpt-oss:20b"
embedding_model = "nomic-embed-text"
timeout = "60s"

[cache]
type = "redis"
url = "redis://redis:6379"
ttl = "1h"

[auth]
type = "jwt"
secret = "${JWT_SECRET}"
admin_users = ["admin@example.com"]

[mcp]
enabled = true
transport = "stdio"
tools = ["all"]
```

**Deployment Options:**

**Docker Compose:**
```yaml
version: '3.8'
services:
  hotm:
    image: hotm/server:v0.2.0
    ports:
      - "53211:53211"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - hotm_data:/data
      - ./config:/etc/hotm
    depends_on:
      - postgres
      - ollama
```

**Systemd Service:**
```ini
[Unit]
Description=HotM Knowledge Management Server
After=network.target postgresql.service

[Service]
Type=simple
User=hotm
ExecStart=/usr/local/bin/hotm --config /etc/hotm/server.toml
Restart=always
RestartSec=5

[Install]  
WantedBy=multi-user.target
```

**Use Cases:**
- Team collaboration
- Organizational knowledge bases
- API-driven integrations
- Multi-user environments
- Cloud deployments

### 3. Hybrid Mode (Enhanced)

**Desktop Application with Simultaneous Server Capabilities**

```mermaid
graph TB
    subgraph "HotM Hybrid Runtime"
        subgraph "Unified Core"
            CORE[HotM Core Engine]
            ROUTER[Request Router<br/>Local vs Remote]
        end
        
        subgraph "Local Interfaces"
            GUI[Desktop GUI<br/>Primary Interface]
            TRAY[System Tray<br/>Quick Access]
        end
        
        subgraph "Server Interfaces"  
            HTTP[HTTP Server<br/>Remote Access]
            WEB[Web Interface<br/>Browser Access]
            MCP[MCP Server<br/>AI Integration]
        end
        
        subgraph "Data Layer"
            DB[(Shared Database<br/>PostgreSQL)]
            CACHE[Local Cache<br/>Performance]
        end
    end
    
    subgraph "Remote Clients"
        MOBILE[Mobile Browser]
        REMOTE_PC[Remote Desktop]
        AI_TOOLS[AI Tools<br/>MCP Clients]
    end
    
    GUI --> ROUTER
    TRAY --> ROUTER
    HTTP --> ROUTER
    WEB --> ROUTER
    MCP --> ROUTER
    ROUTER --> CORE
    CORE --> DB
    CORE --> CACHE
    
    MOBILE -->|HTTPS| HTTP
    REMOTE_PC -->|HTTPS| HTTP
    AI_TOOLS -->|MCP| MCP
    
    style CORE fill:#4fc3f7
    style ROUTER fill:#81c784
    style GUI fill:#ffb74d
    style HTTP fill:#f06292
```

**Configuration Example:**
```toml
# hotm.toml
[runtime]
mode = "hybrid"
primary_interface = "desktop"

[desktop]
show_gui = true
system_tray = true
minimize_to_tray = true
startup_mode = "tray"

[server]
bind_address = "0.0.0.0:53211"
enable_discovery = true
auth_required = true
local_network_only = false

[database]
type = "postgresql" 
url = "postgres://localhost:5432/hotm"
local_cache = true
cache_size = "200MB"

[security]
local_auth = false
remote_auth = true
api_key_auth = true
session_timeout = "24h"

[sync]
conflict_resolution = "last_write_wins"
backup_on_changes = true
```

**Features:**
- **Seamless Interface Switching**: Same data accessible via desktop GUI or web browser
- **Smart Routing**: Local requests bypass HTTP stack, remote requests use full auth
- **Automatic Discovery**: LAN devices can discover and connect to hybrid instances
- **Conflict Resolution**: Built-in handling for simultaneous local/remote edits
- **Performance Optimization**: Local requests get priority and caching

**Use Cases:**
- Power users wanting desktop + mobile access
- Home office with family sharing
- Remote work scenarios
- Developer productivity setups
- Small team collaboration

### 4. Development Mode (Enhanced)

**Comprehensive Development Environment**

```mermaid
graph TB
    subgraph "HotM Development Runtime"
        subgraph "Core Runtime"
            CORE[HotM Core Engine]
            HOT_RELOAD[Hot Reload System]
            DEBUG[Debug Services]
        end
        
        subgraph "Development Interfaces"
            GUI[Desktop GUI<br/>with DevTools]
            WEB[Development Web UI]
            DEBUG_UI[Debug Dashboard]
            API_DOCS[OpenAPI Docs]
        end
        
        subgraph "Development Services"
            MOCK_AI[Mock AI Service<br/>Deterministic]
            TEST_DB[(Test Database<br/>Auto-reset)]
            PROFILER[Performance Profiler]
            LOG_VIEWER[Structured Logs]
        end
        
        subgraph "Testing Tools"
            E2E[E2E Test Runner]
            API_TESTS[API Test Suite]
            LOAD_TEST[Load Testing]
        end
    end
    
    GUI --> CORE
    WEB --> CORE  
    DEBUG_UI --> DEBUG
    CORE --> HOT_RELOAD
    CORE --> MOCK_AI
    CORE --> TEST_DB
    DEBUG --> PROFILER
    DEBUG --> LOG_VIEWER
    
    style CORE fill:#4fc3f7
    style HOT_RELOAD fill:#81c784
    style DEBUG fill:#ffb74d
    style MOCK_AI fill:#f06292
```

**Configuration Example:**
```toml
# hotm.toml
[runtime]
mode = "development"
hot_reload = true
debug_level = "trace"

[development]
mock_ai = true
auto_test = true
api_docs = true
cors_permissive = true
sql_logging = true

[testing]
reset_db_on_start = true
load_test_data = true
e2e_headless = false
coverage_reports = true

[debugging]
performance_profiling = true
memory_tracking = true
request_tracing = true
websocket_debugging = true

[mock_ai]
response_delay = "100ms"
failure_rate = 0.1
deterministic_outputs = true
```

**Enhanced Features:**
- **Live Code Updates**: Changes to backend code trigger automatic rebuilds
- **Test Data Management**: Automatic generation and seeding of realistic test data
- **Performance Monitoring**: Built-in profiling and performance metrics
- **API Documentation**: Auto-generated OpenAPI docs with live testing
- **Debug Dashboards**: Visual interfaces for logs, metrics, and system state

**Use Cases:**
- Core development work
- Feature prototyping
- Performance optimization
- Integration testing
- Documentation generation

### 5. Cloud-Native Mode (Future)

**Kubernetes-Ready Deployment**

```mermaid
graph TB
    subgraph "Kubernetes Cluster"
        subgraph "HotM Services"
            API_PODS[HotM API Pods<br/>Replicas: 3]
            WEB_PODS[Web UI Pods<br/>Static Content]
            MCP_PODS[MCP Server Pods<br/>AI Integration]
        end
        
        subgraph "Data Services"
            PG_CLUSTER[(PostgreSQL Cluster<br/>Primary + Replicas)]
            REDIS_CLUSTER[(Redis Cluster<br/>Caching + Sessions)]
        end
        
        subgraph "AI Services"
            OLLAMA_DEPLOY[Ollama Deployment<br/>GPU Nodes]
            MODEL_PVC[Model Storage<br/>Persistent Volumes]
        end
        
        subgraph "Infrastructure"
            INGRESS[Ingress Controller<br/>TLS + Load Balancing]
            MONITORING[Prometheus + Grafana<br/>Observability]
        end
    end
    
    INGRESS --> API_PODS
    INGRESS --> WEB_PODS
    API_PODS --> PG_CLUSTER
    API_PODS --> REDIS_CLUSTER
    API_PODS --> OLLAMA_DEPLOY
    MCP_PODS --> API_PODS
    OLLAMA_DEPLOY --> MODEL_PVC
    
    style API_PODS fill:#4fc3f7
    style PG_CLUSTER fill:#81c784
    style OLLAMA_DEPLOY fill:#ffb74d
    style INGRESS fill:#f06292
```

**Features:**
- **Horizontal Scaling**: Auto-scaling based on load
- **High Availability**: Multi-zone deployment with failover
- **Resource Management**: CPU/memory limits and requests
- **Service Mesh**: Advanced networking and security
- **GitOps Deployment**: Automated deployment from git commits

## Migration Paths

### From Current v0.1.x to Unified v0.2.0

**Desktop Users:**
1. **Backup**: Export existing notes and configurations
2. **Uninstall**: Remove current desktop application and services
3. **Install**: Deploy new unified binary with desktop mode
4. **Import**: Restore notes and settings
5. **Configure**: Adjust preferences for new features

**Server Users:**
1. **Database Backup**: Full PostgreSQL dump
2. **Configuration Export**: Save current server settings
3. **Rolling Update**: Deploy new server containers
4. **Database Migration**: Run schema updates
5. **Client Updates**: Update desktop clients to unified version

**Development Teams:**
1. **Repository Updates**: Update build scripts and CI/CD
2. **Environment Refresh**: Set up new development mode
3. **Testing**: Validate all existing functionality
4. **Documentation**: Update deployment and development docs

### Backward Compatibility

**API Compatibility:**
- All v1 API endpoints remain functional
- WebSocket events maintain same format
- MCP tools preserve existing interface

**Data Compatibility:**
- Database schema migrations handle existing data
- Configuration files auto-migrate to new format
- Note content and metadata preserved

**Client Compatibility:**
- Existing desktop clients work with new server
- Gradual migration support for mixed environments
- Legacy API support for 6 months post-release

## Comparison Matrix

| Scenario | Setup Complexity | Resource Usage | Collaboration | Offline Support | Maintenance |
|----------|------------------|----------------|---------------|-----------------|-------------|
| **Current Desktop** | High | High | None | Full | High |
| **Current Server** | Very High | High | Good | None | Very High |
| **Enhanced Desktop** | Low | Medium | Limited | Full | Low |
| **Server + Web UI** | Medium | Medium-High | Excellent | None | Medium |
| **Hybrid Mode** | Medium | Medium-High | Good | Partial | Medium |
| **Development** | High | High | None | Partial | Low |
| **Cloud-Native** | Very High | Variable | Excellent | None | Automated |

## Recommendations by Use Case

### Individual Users
- **Recommended**: Enhanced Desktop Mode
- **Alternative**: Hybrid Mode (if remote access needed)
- **Benefits**: Simple setup, full privacy, offline capability

### Small Teams (2-10 people)
- **Recommended**: Server Mode with Web UI
- **Alternative**: Hybrid Mode for lead user + desktop clients
- **Benefits**: Centralized collaboration, shared knowledge base

### Organizations (10+ people)
- **Recommended**: Server Mode with dedicated infrastructure
- **Alternative**: Cloud-Native deployment
- **Benefits**: Scalability, enterprise features, IT management

### Developers
- **Recommended**: Development Mode for coding, Desktop Mode for daily use
- **Alternative**: Hybrid Mode with development features
- **Benefits**: Debugging tools, test automation, hot reload

### Enterprise/Cloud
- **Recommended**: Cloud-Native Kubernetes deployment
- **Alternative**: Server Mode with enterprise features
- **Benefits**: High availability, auto-scaling, enterprise security

This comprehensive deployment strategy ensures HotM can serve users across the full spectrum from individual knowledge workers to large organizations, while maintaining simplicity where possible and providing power where needed.