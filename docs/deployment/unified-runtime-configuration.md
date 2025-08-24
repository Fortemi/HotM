# Unified Runtime Configuration Guide

## Overview

The HotM unified runtime uses a hierarchical configuration system that supports multiple deployment modes with a single binary. Configuration is resolved through environment variables, command-line arguments, configuration files, and embedded defaults, with each layer overriding the previous.

## Configuration Architecture

### Configuration Resolution Order (Highest to Lowest Priority)

```mermaid
graph TB
    CLI[Command Line Arguments<br/>--mode server --port 8080]
    ENV[Environment Variables<br/>HOTM_MODE=server]
    CONFIG_FILE[Configuration File<br/>hotm.toml]
    USER_CONFIG[User Configuration<br/>~/.hotm/config.toml]
    DEFAULTS[Embedded Defaults<br/>Compiled into Binary]
    
    CLI --> ENV
    ENV --> CONFIG_FILE
    CONFIG_FILE --> USER_CONFIG
    USER_CONFIG --> DEFAULTS
    
    style CLI fill:#f06292
    style ENV fill:#4fc3f7
    style CONFIG_FILE fill:#81c784
    style USER_CONFIG fill:#ffb74d
    style DEFAULTS fill:#ba68c8
```

### Configuration Structure

```rust
// Configuration schema
#[derive(Debug, Deserialize)]
pub struct Configuration {
    pub runtime: RuntimeConfig,
    pub database: DatabaseConfig,
    pub ai: AiConfig,
    pub server: Option<ServerConfig>,
    pub desktop: Option<DesktopConfig>,
    pub security: SecurityConfig,
    pub logging: LoggingConfig,
    pub performance: PerformanceConfig,
}

#[derive(Debug, Deserialize)]
pub enum RuntimeMode {
    Auto,        // Detect best mode automatically
    Desktop,     // Desktop GUI application
    Server,      // HTTP server with web UI
    Hybrid,      // Desktop + Server simultaneously
}
```

## Mode-Specific Configurations

### 1. Desktop Mode Configuration

**Complete Desktop Configuration:**
```toml
# hotm.toml - Desktop Mode Configuration
[runtime]
mode = "desktop"
data_directory = "~/.hotm"
log_level = "info"

[desktop]
show_gui = true
system_tray = true
minimize_to_tray = true
global_hotkey = "Ctrl+Alt+H"
auto_start = true
theme = "auto"  # auto, light, dark, system
startup_mode = "normal"  # normal, minimized, tray
window_size = { width = 1200, height = 800 }
window_position = "center"  # center, remember, custom

[database]
type = "postgresql"
url = "postgresql://hotm:hotm_local@localhost:54321/hotm"  # Embedded PostgreSQL
port = 54321  # Non-standard port to avoid conflicts
embedded = true  # Managed by HotM installer
data_directory = "./data/postgres"
cache_size = "100MB"
auto_backup = true
backup_retention = "30d"
vacuum_on_startup = false
extensions = ["vector", "pg_trgm", "btree_gin"]

[ai]
type = "hybrid"
embedded_models = ["tiny-llm", "sentence-transformers"]
embedded_models_path = "./models"
fallback_url = "http://localhost:11434"
offline_mode = true
timeout = "30s"
max_retries = 3

[security]
encrypt_local_data = true
encryption_method = "windows_dpapi"  # windows_dpapi, keyring, none

[performance]
worker_threads = 2
cache_size = "50MB"
batch_size = 10
max_concurrent_jobs = 5

[features]
web_interface = false
mcp_server = true
api_server = false
debug_mode = false
telemetry = false
cloud_sync = false  # Cross-device sync to cloud

[cloud_sync]
enabled = false
provider = "hotm_cloud"  # hotm_cloud, s3, azure, gcp
endpoint = "https://sync.hotm.app"
auth_method = "api_key"  # api_key, oauth
sync_interval = "15m"
conflict_resolution = "last_write_wins"  # last_write_wins, manual_resolve
selective_sync = true  # Only sync tagged collections
bandwidth_limit = "10MB/hour"  # Prevent overwhelming connection

[services]
# Embedded services managed by HotM installer
postgresql_embedded = true
postgresql_port = 54321
postgresql_data_dir = "./data/postgres"
postgresql_log_file = "./logs/postgres.log"

ollama_embedded = true  # Bundle Ollama with installer
ollama_port = 11435  # Non-standard port to avoid conflicts
ollama_models_dir = "./models"
ollama_log_file = "./logs/ollama.log"

service_management = "windows_service"  # windows_service, systemd, manual

[logging]
level = "info"
file_logging = true
log_file = "./logs/hotm.log"
max_log_size = "10MB"
log_retention = 7
console_logging = true
```

**Environment Variable Overrides:**
```bash
# Desktop mode environment variables
export HOTM_MODE=desktop
export HOTM_DATA_DIR=/custom/path
export HOTM_LOG_LEVEL=debug
export HOTM_OFFLINE_MODE=true
export HOTM_ENCRYPT_DATA=true
```

**Command Line Examples:**
```bash
# Basic desktop launch
hotm

# Desktop mode with custom data directory
hotm --mode desktop --data-dir /custom/path

# Desktop mode with debug logging
hotm --mode desktop --log-level debug --console-logging

# Desktop mode without GUI (headless testing)
hotm --mode desktop --no-gui --system-tray
```

### 2. Server Mode Configuration

**Complete Server Configuration:**
```toml
# hotm.toml - Server Mode Configuration
[runtime]
mode = "server"
config_file = "/etc/hotm/server.toml"
pid_file = "/var/run/hotm/hotm.pid"

[server]
bind_address = "0.0.0.0:53211"
enable_tls = true
cert_file = "/etc/hotm/tls/cert.pem"
key_file = "/etc/hotm/tls/key.pem"
cors_origins = ["https://app.example.com", "https://admin.example.com"]
cors_credentials = true
request_timeout = "30s"
max_request_size = "10MB"
compression = true
rate_limiting = true

[server.rate_limiting]
requests_per_minute = 1000
burst_size = 100
whitelist_ips = ["127.0.0.1", "10.0.0.0/8"]

[web_ui]
enabled = true
path = "/ui"
auth_required = true
admin_required = false
custom_css = "/etc/hotm/custom.css"
branding = { name = "Company Knowledge Base", logo = "/assets/logo.png" }

[database]
type = "postgresql" 
# For embedded deployment
url = "postgresql://hotm:${DB_PASSWORD}@localhost:54321/hotm"
# For external PostgreSQL/DocumentDB
# url = "postgres://hotm:${DB_PASSWORD}@postgres:5432/hotm"
embedded = false  # Set to true for single-machine deployments
port = 54321  # Embedded PostgreSQL port
pool_size = 20
max_lifetime = "1h"
connection_timeout = "10s"
idle_timeout = "5m"
ssl_mode = "prefer"  # prefer for local, require for remote
application_name = "hotm-server"
extensions = ["vector", "pg_trgm", "btree_gin"]

[database.migrations]
auto_migrate = true
migration_path = "./migrations"
backup_before_migrate = true

[ai]
type = "ollama"
url = "http://ollama:11434"
generation_model = "gpt-oss:20b"
embedding_model = "nomic-embed-text"
timeout = "60s"
max_retries = 3
parallel_requests = 4
model_validation = true

[ai.fallback]
enabled = true
service = "openai"
api_key = "${OPENAI_API_KEY}"
model = "gpt-3.5-turbo"

[cache]
type = "redis"
url = "redis://redis:6379/0"
password = "${REDIS_PASSWORD}"
pool_size = 10
ttl = "1h"
compression = true

[auth]
type = "jwt"
secret = "${JWT_SECRET}"
algorithm = "HS256"
expires_in = "24h"
refresh_enabled = true
refresh_expires_in = "7d"
admin_users = ["admin@example.com"]

[auth.oauth]
enabled = false
google_client_id = "${GOOGLE_CLIENT_ID}"
github_client_id = "${GITHUB_CLIENT_ID}"

[mcp]
enabled = true
transport = "stdio"
tools = ["all"]
timeout = "30s"
max_concurrent = 10

[backup]
enabled = true
strategy = "incremental"
schedule = "0 2 * * *"  # Daily at 2 AM
retention = "30d"
compression = true
encryption = true
destination = "s3://backup-bucket/hotm/"

[monitoring]
metrics = true
health_checks = true
prometheus_endpoint = "/metrics"
health_endpoint = "/health"
log_requests = true
trace_requests = false

[security]
enforce_https = true
hsts_max_age = "31536000"
content_security_policy = "default-src 'self'"
x_frame_options = "DENY"
api_key_header = "X-API-Key"
admin_api_key = "${ADMIN_API_KEY}"

[performance]
worker_threads = 0  # Use all available cores
cache_size = "200MB"
batch_size = 50
max_concurrent_jobs = 20
job_timeout = "5m"

[logging]
level = "info"
format = "json"
file_logging = true
log_file = "/var/log/hotm/server.log"
max_log_size = "100MB"
log_retention = 30
console_logging = false
audit_logging = true
audit_file = "/var/log/hotm/audit.log"
```

**Environment Variables for Server:**
```bash
# Critical security variables
export DB_PASSWORD=secure_database_password
export JWT_SECRET=your_jwt_secret_here_32_chars_min
export REDIS_PASSWORD=secure_redis_password
export ADMIN_API_KEY=secure_admin_key_here

# Optional service configuration
export OPENAI_API_KEY=sk-your-openai-key
export GOOGLE_CLIENT_ID=google-oauth-client-id
export GITHUB_CLIENT_ID=github-oauth-client-id

# Deployment-specific overrides
export HOTM_MODE=server
export HOTM_BIND_ADDRESS=0.0.0.0:53211
export HOTM_DATABASE_URL=postgres://user:pass@host:5432/db
export HOTM_OLLAMA_URL=http://ollama-service:11434
export HOTM_LOG_LEVEL=info
export HOTM_ENABLE_TLS=true
```

**Docker Environment File:**
```bash
# .env for docker-compose
DB_PASSWORD=secure_password_123
JWT_SECRET=your_jwt_secret_at_least_32_characters_long
REDIS_PASSWORD=redis_password_123
ADMIN_API_KEY=admin_key_with_sufficient_entropy

# Optional integrations
OPENAI_API_KEY=sk-your-openai-key
BACKUP_S3_BUCKET=s3://your-backup-bucket
```

### 3. Hybrid Mode Configuration

**Hybrid Configuration:**
```toml
# hotm.toml - Hybrid Mode Configuration
[runtime]
mode = "hybrid"
primary_interface = "desktop"  # desktop, server

[desktop]
show_gui = true
system_tray = true
minimize_to_tray = false
global_hotkey = "Ctrl+Alt+H"
theme = "auto"
startup_priority = "high"

[server]
bind_address = "0.0.0.0:53211"
enable_discovery = true
local_network_only = false
auth_required = true
enable_tls = false  # Optional for local networks

[server.discovery]
service_name = "HotM Knowledge Base"
broadcast_interval = "30s"
mdns_enabled = true
upnp_enabled = false

[database]
type = "postgresql"
url = "postgresql://hotm:hotm_local@localhost:54321/hotm"  # Embedded PostgreSQL
embedded = true  # Managed by HotM installer
local_cache = true
cache_size = "200MB"
extensions = ["vector", "pg_trgm", "btree_gin"]

[cloud_sync]
enabled = true  # Enable cross-device sync in hybrid mode
provider = "hotm_cloud"
sync_interval = "10m"  # More frequent sync in hybrid mode
conflict_resolution = "last_write_wins"

[security]
local_auth = false      # No auth for desktop interface
remote_auth = true      # Auth required for remote access
session_sharing = true  # Share sessions between interfaces
api_key_auth = true
admin_mode_local = true # Desktop user has admin rights

[performance]
request_routing = "smart"  # smart, local_first, load_balance
local_cache_priority = true
background_sync = true
offline_queue = true

[sync]
conflict_resolution = "last_write_wins"
backup_on_changes = true
sync_interval = "5m"
max_offline_changes = 1000

[features]
cross_device_clipboard = true
universal_search = true
shared_collections = true
collaborative_editing = false  # Future feature
```

**Hybrid Mode Environment:**
```bash
export HOTM_MODE=hybrid
export HOTM_PRIMARY_INTERFACE=desktop
export HOTM_ENABLE_DISCOVERY=true
export HOTM_LOCAL_AUTH=false
export HOTM_REMOTE_AUTH=true
export HOTM_DATABASE_URL=postgres://localhost:5432/hotm
```

### 4. Development Configuration

**Server Mode is the preferred development mode**, providing enhanced development features through configuration rather than a separate runtime mode.

**Development Configuration (Server Mode):**
```toml
# hotm.toml - Development Configuration (Server Mode)
[runtime]
mode = "server"

[server]
bind_address = "127.0.0.1:53211"
enable_tls = false
cors_origins = ["http://localhost:3000", "http://localhost:8080"]
cors_credentials = true
hot_reload = true
dev_tools = true

[development]
mock_ai = true
auto_test = true
api_docs = true
cors_permissive = true
sql_logging = true
file_watching = true
auto_restart = true

[development.hot_reload]
watch_paths = ["src", "ui/src", "migrations"]
ignore_patterns = ["*.log", "target", "node_modules"]
debounce_ms = 500
rebuild_timeout = "30s"

[testing]
reset_db_on_start = true
load_test_data = true
e2e_headless = false
coverage_reports = true
test_timeout = "30s"
parallel_tests = true

[testing.fixtures]
auto_load = true
fixture_path = "./tests/fixtures"
seed_data = ["users", "notes", "collections"]

[debugging]
performance_profiling = true
memory_tracking = true
request_tracing = true
websocket_debugging = true
sql_query_logging = true
enable_pprof = true
pprof_port = 6060

[mock_ai]
response_delay = "100ms"
failure_rate = 0.1
deterministic_outputs = true
mock_embeddings = true
mock_generation = true

[api_docs]
enabled = true
swagger_ui = true
openapi_spec = "/api/openapi.json"
try_it_out = true
schemas_endpoint = "/api/schemas"

[web_ui]
enabled = true
path = "/ui"
auth_required = false
dev_mode = true
hot_reload = true

[database]
type = "postgresql"
url = "postgresql://hotm:dev_password@localhost:54321/hotm_dev"  # Embedded PostgreSQL
embedded = true  # Use embedded PostgreSQL for development
reset_on_start = false
auto_migrate = true
extensions = ["vector", "pg_trgm", "btree_gin"]

[performance]
worker_threads = 4
cache_size = "100MB"
batch_size = 25
max_concurrent_jobs = 10
enable_metrics = true

[security]
auth_required = false  # Disabled for development
cors_permissive = true

[logging]
level = "trace"
format = "pretty"
console_logging = true
file_logging = true
log_file = "./logs/development.log"
structured_logs = true
request_logging = true
```

**Development Environment Setup:**
```bash
# Development environment variables
export HOTM_MODE=server
export HOTM_DEV_MODE=true
export HOTM_HOT_RELOAD=true
export HOTM_DEBUG_LEVEL=trace
export HOTM_MOCK_AI=true
export HOTM_AUTO_TEST=true
export HOTM_LOG_LEVEL=trace
export DATABASE_URL=postgres://dev:dev@localhost:5432/hotm_dev
export TEST_DATABASE_URL=postgres://test:test@localhost:5432/hotm_test
export RUST_BACKTRACE=full
export RUST_LOG=hotm=trace,tower=debug,axum=debug
```

## Security Configuration

### Authentication and Authorization

```toml
[security.auth]
# Authentication methods (multiple can be enabled)
methods = ["jwt", "api_key", "session"]

# JWT Configuration
[security.auth.jwt]
secret = "${JWT_SECRET}"
algorithm = "HS256"
issuer = "hotm-server"
audience = "hotm-clients"
expires_in = "24h"
refresh_enabled = true
refresh_expires_in = "7d"

# API Key Configuration
[security.auth.api_key]
header_name = "X-API-Key"
query_param = "api_key"  # Optional fallback
admin_key = "${ADMIN_API_KEY}"
user_keys_enabled = true
key_expiration = "90d"

# Session Configuration
[security.auth.session]
cookie_name = "hotm_session"
secure = true
http_only = true
same_site = "strict"
max_age = "24h"

# OAuth Providers
[security.oauth]
enabled = false

[security.oauth.google]
client_id = "${GOOGLE_CLIENT_ID}"
client_secret = "${GOOGLE_CLIENT_SECRET}"
redirect_url = "https://your-domain.com/auth/google/callback"

[security.oauth.github]
client_id = "${GITHUB_CLIENT_ID}"
client_secret = "${GITHUB_CLIENT_SECRET}"
redirect_url = "https://your-domain.com/auth/github/callback"
```

### Data Protection

```toml
[security.encryption]
# Data encryption at rest
data_encryption = true
encryption_key = "${DATA_ENCRYPTION_KEY}"
algorithm = "AES-256-GCM"

# Database encryption
database_encryption = true
connection_ssl = true
ssl_cert = "/etc/ssl/certs/pg-client.crt"
ssl_key = "/etc/ssl/private/pg-client.key"
ssl_ca = "/etc/ssl/certs/pg-ca.crt"

# Network encryption
[security.tls]
enabled = true
cert_file = "/etc/hotm/tls/cert.pem"
key_file = "/etc/hotm/tls/key.pem"
ca_file = "/etc/hotm/tls/ca.pem"
protocols = ["TLSv1.2", "TLSv1.3"]
cipher_suites = ["TLS_AES_256_GCM_SHA384", "TLS_CHACHA20_POLY1305_SHA256"]

# Security headers
[security.headers]
hsts_max_age = "31536000"
hsts_include_subdomains = true
content_security_policy = "default-src 'self'; script-src 'self' 'unsafe-inline'"
x_frame_options = "DENY"
x_content_type_options = "nosniff"
x_xss_protection = "1; mode=block"
referrer_policy = "strict-origin-when-cross-origin"
```

### Access Control

```toml
[security.access_control]
# Role-based access control
rbac_enabled = true
default_role = "user"

# IP-based restrictions
ip_whitelist = ["127.0.0.1", "10.0.0.0/8", "192.168.0.0/16"]
ip_blacklist = []
geo_blocking = []  # ["CN", "RU"] - block by country code

# Rate limiting
[security.rate_limiting]
enabled = true
global_limit = "1000/hour"
per_ip_limit = "100/hour"
per_user_limit = "500/hour"
burst_size = 50
sliding_window = true

# Content filtering
[security.content_filtering]
max_file_size = "50MB"
allowed_file_types = ["txt", "md", "pdf", "docx", "html"]
scan_uploads = true
virus_scanning = false  # Requires ClamAV integration
```

## Performance Configuration

### Resource Management

```toml
[performance]
# Thread configuration
worker_threads = 0  # 0 = auto-detect, or specific number
blocking_threads = 50
max_blocking_threads = 500
thread_keep_alive = "10s"

# Memory management
cache_size = "200MB"
max_memory = "2GB"  # Soft limit for monitoring
gc_interval = "5m"  # Periodic cleanup

# Connection pooling
[performance.database]
pool_size = 20
max_lifetime = "1h"
connection_timeout = "10s"
idle_timeout = "5m"
test_on_checkout = true

# HTTP performance
[performance.http]
keep_alive_timeout = "60s"
max_concurrent_connections = 10000
request_timeout = "30s"
response_compression = true
compression_level = 6

# Background job processing
[performance.jobs]
worker_count = 4
queue_size = 1000
batch_size = 50
max_retries = 3
retry_backoff = "exponential"
job_timeout = "5m"
```

### Caching Configuration

```toml
[performance.cache]
# Application cache
enabled = true
type = "memory"  # memory, redis, hybrid
size = "100MB"
ttl = "1h"
cleanup_interval = "10m"

# Redis cache (if type = "redis" or "hybrid")
[performance.cache.redis]
url = "redis://redis:6379/0"
password = "${REDIS_PASSWORD}"
pool_size = 10
connection_timeout = "5s"
key_prefix = "hotm:"
compression = true

# Query result cache
[performance.cache.query]
enabled = true
max_size = "50MB"
ttl = "30m"
cache_selects = true
cache_searches = true
invalidate_on_write = true

# Static file cache
[performance.cache.static]
enabled = true
max_age = "1d"
etag_enabled = true
compression = true
```

## Monitoring and Observability

### Logging Configuration

```toml
[logging]
level = "info"  # trace, debug, info, warn, error
format = "json"  # json, pretty, compact

# File logging
file_logging = true
log_file = "/var/log/hotm/hotm.log"
max_log_size = "100MB"
log_retention = 30
log_compression = true

# Console logging
console_logging = false
console_format = "pretty"

# Structured logging fields
[logging.fields]
timestamp = true
level = true
target = true
thread_id = false
request_id = true
user_id = true
ip_address = false

# Log filtering
[logging.filters]
# Reduce noise from specific modules
"hyper" = "warn"
"tokio" = "info"
"sqlx" = "warn"

# Audit logging
[logging.audit]
enabled = true
audit_file = "/var/log/hotm/audit.log"
log_auth_events = true
log_data_changes = true
log_admin_actions = true
```

### Metrics and Health Checks

```toml
[monitoring]
# Health checks
health_checks = true
health_endpoint = "/health"
ready_endpoint = "/ready"
live_endpoint = "/live"

# Prometheus metrics
metrics = true
metrics_endpoint = "/metrics"
custom_metrics = true

# Distributed tracing
tracing = false
tracing_endpoint = "http://jaeger:14268/api/traces"
sample_rate = 0.1

# Performance monitoring
[monitoring.performance]
request_metrics = true
database_metrics = true
cache_metrics = true
job_queue_metrics = true
system_metrics = true

# Alerting
[monitoring.alerts]
enabled = false
webhook_url = "https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
error_threshold = 10  # errors per minute
latency_threshold = "1s"
disk_usage_threshold = 90  # percentage
memory_usage_threshold = 85  # percentage
```

## Configuration Validation and Testing

### Configuration Validation

```rust
// Configuration validation example
impl Configuration {
    pub fn validate(&self) -> Result<(), ConfigError> {
        // Validate mode-specific requirements
        match self.runtime.mode {
            RuntimeMode::Server => {
                if self.server.is_none() {
                    return Err(ConfigError::MissingServerConfig);
                }
                if self.database.type_name() != "postgresql" {
                    return Err(ConfigError::InvalidDatabaseForServer);
                }
            },
            RuntimeMode::Desktop => {
                if self.desktop.is_none() {
                    return Err(ConfigError::MissingDesktopConfig);
                }
            },
            RuntimeMode::Hybrid => {
                if self.desktop.is_none() || self.server.is_none() {
                    return Err(ConfigError::MissingHybridConfigs);
                }
            },
            RuntimeMode::Auto => {
                // Auto mode will be detected at runtime
            }
        }
        
        // Validate security requirements
        if self.runtime.mode == RuntimeMode::Server && !self.security.auth.enabled() {
            return Err(ConfigError::AuthRequiredForServer);
        }
        
        // Validate resource limits
        if self.performance.cache_size.as_bytes() > self.performance.max_memory.as_bytes() {
            return Err(ConfigError::CacheSizeExceedsMemoryLimit);
        }
        
        Ok(())
    }
}
```

### Configuration Testing

```toml
# test-config.toml - Configuration for testing
[runtime]
mode = "server"
test_mode = true

[database]
type = "postgresql"
url = "postgres://test:test@localhost:5432/hotm_test"
reset_on_start = true

[ai]
type = "mock"
deterministic = true
response_delay = "1ms"

[logging]
level = "debug"
console_logging = true
file_logging = false

[security]
auth_disabled = true  # Only for testing
cors_permissive = true
```

## Installer Service Management

### Embedded Services Architecture

The HotM installer bundles and manages essential services to provide a complete local-first experience:

**Bundled Services:**
- **PostgreSQL with pgvector** - Local DocumentDB with vector search capabilities
- **Ollama** - Local AI inference engine with bundled models
- **HotM Runtime** - Unified application runtime

**Service Management Features:**
```toml
[installer.services]
# Windows Service Integration
windows_service_install = true
service_name = "HotM Knowledge Base"
service_display_name = "HotM Knowledge Management System"
service_description = "Local-first knowledge management with AI capabilities"
start_type = "automatic"  # automatic, manual, disabled

# Service Dependencies
postgresql_startup_timeout = "30s"
ollama_startup_timeout = "60s"  # Model loading takes time
service_startup_order = ["postgresql", "ollama", "hotm"]

# Port Management
auto_port_detection = true
port_conflict_resolution = "increment"  # increment, fail, prompt
reserved_port_range = "54320-54330"

# Service Health Monitoring
health_check_interval = "30s"
auto_restart_failed_services = true
max_restart_attempts = 3
restart_backoff = "exponential"
```

**Installation Directory Structure:**
```
C:\Program Files\HotM\
├── bin/
│   ├── hotm.exe                 # Main runtime
│   ├── pg_ctl.exe              # PostgreSQL control
│   └── ollama.exe              # AI inference engine
├── data/
│   ├── postgres/               # PostgreSQL data directory
│   ├── models/                 # AI models (3-5GB)
│   └── user/                   # User data and notes
├── logs/
│   ├── hotm.log
│   ├── postgres.log
│   └── ollama.log
├── config/
│   ├── hotm.toml              # Main configuration
│   ├── postgresql.conf         # PostgreSQL settings
│   └── models.json            # AI model inventory
└── uninstall/
    └── cleanup.exe            # Complete removal tool
```

**Service Configuration Templates:**

**PostgreSQL Configuration (postgresql.conf):**
```ini
# Optimized for local desktop use
port = 54321
max_connections = 100
shared_buffers = 128MB
effective_cache_size = 512MB
work_mem = 4MB
maintenance_work_mem = 64MB

# Logging optimized for desktop use
log_destination = 'stderr'
logging_collector = on
log_directory = '../logs'
log_filename = 'postgres.log'
log_rotation_age = 1d
log_rotation_size = 10MB

# Enable required extensions
shared_preload_libraries = 'vector'
```

**Ollama Service Configuration:**
```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 11435,
    "models_path": "./models",
    "concurrent_requests": 2,
    "memory_limit": "4GB"
  },
  "bundled_models": [
    {
      "name": "gpt-oss:20b",
      "size": "1.2GB",
      "purpose": "text_generation",
      "auto_load": true
    },
    {
      "name": "nomic-embed-text",
      "size": "274MB", 
      "purpose": "embeddings",
      "auto_load": true
    }
  ],
  "startup": {
    "preload_models": true,
    "warmup_requests": false,
    "health_check_endpoint": "/api/health"
  }
}
```

### User Service Management Interface

**Desktop UI Service Panel:**
```toml
[ui.services]
show_service_status = true
allow_service_control = true  # Start/stop/restart services
show_resource_usage = true   # CPU, memory, disk usage
log_viewer = true           # Built-in log viewer
port_configuration = true   # Change ports if conflicts occur

[ui.services.status_indicators]
# System tray indicators
postgresql_status = "green"  # green, yellow, red
ollama_status = "green"
cloud_sync_status = "blue"  # blue when syncing, green when idle
```

**Command Line Service Management:**
```bash
# Service control commands
hotm service status           # Show all service status
hotm service start postgres   # Start specific service
hotm service stop ollama      # Stop specific service  
hotm service restart all      # Restart all services
hotm service logs postgres    # View service logs

# Configuration management
hotm config validate         # Validate configuration
hotm config test-connection  # Test database connection
hotm config reset            # Reset to defaults
hotm config export           # Export current config
```

### Installation and Upgrade Handling

**Initial Installation Process:**
1. **Pre-installation Checks**
   - Port availability scanning
   - Disk space verification (minimum 8GB)
   - Windows version compatibility
   - Existing service conflict detection

2. **Service Installation**
   - PostgreSQL service registration
   - Database initialization with extensions
   - Ollama service setup and model download
   - HotM service registration and configuration

3. **Post-installation Verification**
   - Service startup validation  
   - Database connectivity test
   - AI model loading verification
   - User account setup

**Upgrade Process:**
```toml
[installer.upgrade]
backup_user_data = true
backup_database = true  
preserve_configuration = true
service_migration = "seamless"  # seamless, restart, manual

# Data migration between versions
migration_scripts = ["v0.1_to_v0.2.sql"]
rollback_support = true
rollback_timeout = "5m"
```

This comprehensive configuration guide ensures that HotM can be properly configured for any deployment scenario while maintaining security, performance, and operational best practices with full service management capabilities.