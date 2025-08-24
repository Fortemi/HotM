# Migration and Security Guide for Unified Runtime

## Overview

This guide covers the migration strategy from HotM's current dual-binary architecture (v0.1.x) to the unified runtime approach (v0.2.0+), along with comprehensive security considerations for each deployment mode.

## Migration Strategy

### Migration Phases Overview

```mermaid
gantt
    title HotM Unified Runtime Migration Timeline
    dateFormat  YYYY-MM-DD
    section Preparation
    Backup & Assessment    :prep1, 2024-03-01, 7d
    Environment Setup      :prep2, after prep1, 5d
    section Core Migration
    Code Refactoring      :core1, after prep2, 14d
    Service Extraction    :core2, after core1, 10d
    Testing & Validation  :core3, after core2, 7d
    section Deployment
    Staging Deployment    :deploy1, after core3, 5d
    Production Migration  :deploy2, after deploy1, 3d
    Monitoring & Cleanup  :deploy3, after deploy2, 7d
```

### Pre-Migration Assessment

**System Inventory Checklist:**

```bash
#!/bin/bash
# pre-migration-assessment.sh

echo "=== HotM Migration Assessment ==="

# Current installation detection
echo "1. Current Installation:"
if command -v hotm-server &> /dev/null; then
    echo "   ✓ Server binary found: $(which hotm-server)"
    hotm-server --version
else
    echo "   ✗ Server binary not found"
fi

if [ -f "/usr/local/bin/hotm-desktop" ] || [ -f "$HOME/.local/bin/hotm-desktop" ]; then
    echo "   ✓ Desktop binary found"
else
    echo "   ✗ Desktop binary not found"
fi

# Database assessment
echo "2. Database Assessment:"
if pg_isready -h localhost -p 5432 &> /dev/null; then
    echo "   ✓ PostgreSQL accessible"
    psql -h localhost -p 5432 -c "SELECT version();" 2>/dev/null || echo "   ⚠ Database connection issues"
    psql -h localhost -p 5432 -c "SELECT count(*) as note_count FROM notes;" 2>/dev/null || echo "   ⚠ Notes table not accessible"
else
    echo "   ✗ PostgreSQL not accessible"
fi

# AI services assessment
echo "3. AI Services:"
if curl -s http://localhost:11434/api/version &> /dev/null; then
    echo "   ✓ Ollama service accessible"
    curl -s http://localhost:11434/api/tags | jq -r '.models[].name' | head -5
else
    echo "   ✗ Ollama service not accessible"
fi

# Configuration assessment
echo "4. Configuration:"
CONFIG_LOCATIONS=(
    "/etc/hotm/config.toml"
    "$HOME/.hotm/config.toml"
    "./hotm.toml"
)

for config in "${CONFIG_LOCATIONS[@]}"; do
    if [ -f "$config" ]; then
        echo "   ✓ Config found: $config"
    fi
done

# Data assessment
echo "5. Data Storage:"
DATA_LOCATIONS=(
    "$HOME/.hotm"
    "/var/lib/hotm"
    "./data"
)

for data_dir in "${DATA_LOCATIONS[@]}"; do
    if [ -d "$data_dir" ]; then
        echo "   ✓ Data directory: $data_dir ($(du -sh $data_dir | cut -f1))"
    fi
done

echo "=== Assessment Complete ==="
```

### Migration Paths by Current Setup

#### 1. Desktop-Only Installation Migration

**Current State:**
- HotM Desktop App (Tauri)
- Local PostgreSQL
- Local Ollama
- Windows MSI installation

**Migration Steps:**

```mermaid
graph TD
    BACKUP[1. Backup Current Data<br/>Database + Config + Files]
    UNINSTALL[2. Uninstall Current Version<br/>MSI Uninstaller]
    DOWNLOAD[3. Download Unified Runtime<br/>HotM-v0.2.0-Setup.msi]
    INSTALL[4. Install Unified Runtime<br/>Desktop Mode]
    MIGRATE[5. Migrate Data<br/>Import Tool]
    CONFIG[6. Configure Settings<br/>Desktop Mode]
    VERIFY[7. Verify Operation<br/>Test All Features]
    
    BACKUP --> UNINSTALL
    UNINSTALL --> DOWNLOAD
    DOWNLOAD --> INSTALL
    INSTALL --> MIGRATE
    MIGRATE --> CONFIG
    CONFIG --> VERIFY
    
    style BACKUP fill:#f06292
    style MIGRATE fill:#4fc3f7
    style VERIFY fill:#81c784
```

**Detailed Migration Commands:**

```powershell
# 1. Backup current installation
$BackupDir = "$env:USERPROFILE\HotM-Backup-$(Get-Date -Format 'yyyy-MM-dd')"
New-Item -Path $BackupDir -ItemType Directory

# Backup database
pg_dump -h localhost -p 5432 -U hotm hotm > "$BackupDir\database-backup.sql"

# Backup configuration and data
Copy-Item -Path "$env:APPDATA\HotM" -Destination "$BackupDir\app-data" -Recurse
Copy-Item -Path "$env:USERPROFILE\.hotm" -Destination "$BackupDir\user-data" -Recurse

# 2. Export current settings
hotm-desktop.exe --export-config "$BackupDir\settings-export.json"

# 3. Uninstall current version
# Use Add/Remove Programs or MSI uninstaller
Start-Process msiexec.exe -ArgumentList "/x {HotM-GUID} /quiet" -Wait

# 4. Install unified runtime
Start-Process "HotM-v0.2.0-Setup.msi" -ArgumentList "/quiet MODE=DESKTOP" -Wait

# 5. Import data using migration tool
hotm.exe migrate --from-v1 --backup-path "$BackupDir" --mode desktop

# 6. Verify installation
hotm.exe --mode desktop --dry-run
```

**Migration Configuration:**
```toml
# migration-config.toml
[migration]
source_version = "0.1.x"
target_version = "0.2.0"
backup_path = "./backup"
preserve_settings = true
validate_data = true

[migration.database]
export_format = "sql"
import_batch_size = 1000
verify_checksums = true

[migration.files]
preserve_structure = true
update_paths = true
remove_duplicates = false
```

#### 2. Server Installation Migration

**Current State:**
- Standalone API server
- PostgreSQL database
- Docker deployment
- Multiple clients

**Migration Steps:**

```bash
#!/bin/bash
# server-migration.sh

set -e

echo "=== HotM Server Migration to Unified Runtime ==="

# 1. Create migration backup
BACKUP_DIR="./hotm-migration-$(date +%Y%m%d)"
mkdir -p $BACKUP_DIR

echo "Creating database backup..."
docker exec hotm-postgres pg_dump -U hotm hotm > $BACKUP_DIR/database.sql

echo "Backing up configuration..."
cp docker-compose.yml $BACKUP_DIR/
cp .env $BACKUP_DIR/
cp -r ./config $BACKUP_DIR/ 2>/dev/null || true

# 2. Export current metrics and state
echo "Exporting current state..."
curl -s http://localhost:53211/api/v1/stats > $BACKUP_DIR/pre-migration-stats.json
curl -s http://localhost:53211/api/v1/health > $BACKUP_DIR/pre-migration-health.json

# 3. Stop current services
echo "Stopping current services..."
docker-compose down

# 4. Update docker-compose for unified runtime
cat > docker-compose.yml << 'EOF'
version: '3.8'
services:
  hotm:
    image: hotm/unified:v0.2.0
    container_name: hotm-unified
    restart: unless-stopped
    ports:
      - "53211:53211"
    environment:
      - HOTM_MODE=server
      - DATABASE_URL=postgres://hotm:${DB_PASSWORD}@postgres:5432/hotm
      - OLLAMA_URL=http://ollama:11434
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - hotm_data:/data
      - ./config:/etc/hotm
    depends_on:
      - postgres
      - ollama
    healthcheck:
      test: ["CMD", "hotm", "health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: pgvector/pgvector:pg14
    container_name: hotm-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: hotm
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: hotm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hotm"]
      interval: 10s
      timeout: 5s
      retries: 5

  ollama:
    image: ollama/ollama:latest
    container_name: hotm-ollama
    restart: unless-stopped
    volumes:
      - ollama_data:/root/.ollama
    ports:
      - "11434:11434"

volumes:
  hotm_data:
  postgres_data:
  ollama_data:
EOF

# 5. Create unified runtime configuration
mkdir -p ./config
cat > ./config/server.toml << 'EOF'
[runtime]
mode = "server"

[server]
bind_address = "0.0.0.0:53211"
enable_tls = false
cors_origins = ["*"]

[database]
type = "postgresql"
url = "postgres://hotm:${DB_PASSWORD}@postgres:5432/hotm"
pool_size = 20

[ai]
type = "ollama"
url = "http://ollama:11434"
generation_model = "gpt-oss:20b"
embedding_model = "nomic-embed-text"

[web_ui]
enabled = true
auth_required = true

[auth]
type = "jwt"
secret = "${JWT_SECRET}"
admin_users = ["admin"]

[logging]
level = "info"
format = "json"
file_logging = true
EOF

# 6. Start unified runtime
echo "Starting unified runtime..."
docker-compose up -d

# 7. Wait for services to be ready
echo "Waiting for services..."
sleep 30

# 8. Restore database if needed
if [ ! -f "./migrated.flag" ]; then
    echo "Restoring database..."
    docker exec -i hotm-postgres psql -U hotm hotm < $BACKUP_DIR/database.sql
    touch ./migrated.flag
fi

# 9. Verify migration
echo "Verifying migration..."
curl -f http://localhost:53211/api/v1/health || {
    echo "Health check failed!"
    exit 1
}

curl -s http://localhost:53211/api/v1/stats > $BACKUP_DIR/post-migration-stats.json

echo "=== Migration Complete ==="
echo "Backup stored in: $BACKUP_DIR"
echo "Unified runtime running on: http://localhost:53211"
```

#### 3. Development Environment Migration

**Migration for Development Teams:**

```bash
#!/bin/bash
# dev-migration.sh

echo "=== Development Environment Migration ==="

# 1. Update repository
git checkout main
git pull origin main

# 2. Backup current development database
pg_dump postgres://dev:dev@localhost:5432/hotm_dev > ./dev-backup.sql

# 3. Install unified runtime dependencies
cargo install --path ./server --bin hotm

# 4. Update development configuration
cat > ./hotm-dev.toml << 'EOF'
[runtime]
mode = "development"
hot_reload = true

[development]
mock_ai = true
auto_test = true
api_docs = true

[database]
type = "postgresql"
url = "postgres://dev:dev@localhost:5432/hotm_dev"

[logging]
level = "trace"
console_logging = true
EOF

# 5. Run development migration
hotm --config ./hotm-dev.toml migrate --from-dev-v1

# 6. Start development server
hotm --config ./hotm-dev.toml --mode development
```

### Data Migration Strategies

#### Database Schema Migration

```sql
-- V2_0_0__unified_runtime_migration.sql

-- Add new columns for unified runtime
ALTER TABLE notes ADD COLUMN IF NOT EXISTS runtime_version VARCHAR(10) DEFAULT '0.2.0';
ALTER TABLE notes ADD COLUMN IF NOT EXISTS migration_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create new configuration table
CREATE TABLE IF NOT EXISTS runtime_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(255) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create migration log table
CREATE TABLE IF NOT EXISTS migration_log (
    id SERIAL PRIMARY KEY,
    migration_version VARCHAR(20) NOT NULL,
    migration_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    error_message TEXT,
    metadata JSONB
);

-- Insert migration record
INSERT INTO migration_log (migration_version, migration_type, status, started_at, metadata)
VALUES ('0.2.0', 'unified_runtime', 'started', CURRENT_TIMESTAMP, '{"source": "0.1.x", "target": "0.2.0"}');

-- Update existing data for compatibility
UPDATE notes SET runtime_version = '0.1.x' WHERE runtime_version IS NULL;

-- Create indexes for new columns
CREATE INDEX IF NOT EXISTS idx_notes_runtime_version ON notes(runtime_version);
CREATE INDEX IF NOT EXISTS idx_runtime_config_key ON runtime_config(config_key);

-- Complete migration
UPDATE migration_log 
SET status = 'completed', completed_at = CURRENT_TIMESTAMP 
WHERE migration_version = '0.2.0' AND status = 'started';
```

#### Configuration Migration

```rust
// Configuration migration tool
pub struct ConfigMigration {
    source_version: Version,
    target_version: Version,
    backup_path: PathBuf,
}

impl ConfigMigration {
    pub async fn migrate_v1_to_v2(&self) -> Result<()> {
        // 1. Load v0.1.x configuration
        let v1_config = self.load_v1_config().await?;
        
        // 2. Transform to v0.2.0 format
        let v2_config = self.transform_config(v1_config).await?;
        
        // 3. Validate new configuration
        v2_config.validate()?;
        
        // 4. Backup old configuration
        self.backup_old_config().await?;
        
        // 5. Write new configuration
        self.write_v2_config(v2_config).await?;
        
        Ok(())
    }
    
    fn transform_config(&self, v1: V1Config) -> V2Config {
        V2Config {
            runtime: RuntimeConfig {
                mode: match v1.deployment_type {
                    V1DeploymentType::Desktop => RuntimeMode::Desktop,
                    V1DeploymentType::Server => RuntimeMode::Server,
                },
            },
            database: DatabaseConfig {
                type_: match v1.database.provider {
                    V1DatabaseProvider::PostgreSQL => DatabaseType::PostgreSQL,
                    V1DatabaseProvider::SQLite => DatabaseType::Embedded,
                },
                url: v1.database.connection_string,
                pool_size: v1.database.max_connections.unwrap_or(20),
            },
            ai: AiConfig {
                type_: AiServiceType::Ollama,
                url: v1.ollama.endpoint,
                generation_model: v1.ollama.generation_model,
                embedding_model: v1.ollama.embedding_model,
            },
            // ... other transformations
        }
    }
}
```

## Security Considerations

### Security Architecture by Deployment Mode

#### Desktop Mode Security

```mermaid
graph TB
    subgraph "Desktop Security Boundary"
        subgraph "User Space"
            GUI[Desktop Application<br/>User Context]
            TRAY[System Tray<br/>Background Service]
        end
        
        subgraph "Data Protection"
            ENC_DB[Encrypted Database<br/>Windows DPAPI]
            ENC_FILES[Encrypted Files<br/>BitLocker Integration]
            KEY_STORE[Key Storage<br/>Windows Credential Manager]
        end
        
        subgraph "Process Isolation"
            MAIN_PROC[Main Process<br/>Least Privilege]
            BG_WORKERS[Background Workers<br/>Sandboxed]
        end
    end
    
    subgraph "External Threats"
        MALWARE[Malware<br/>Process Injection]
        PHISHING[Phishing<br/>Credential Theft]
        PHYSICAL[Physical Access<br/>Data Extraction]
    end
    
    GUI --> ENC_DB
    TRAY --> KEY_STORE
    ENC_DB --> ENC_FILES
    MAIN_PROC --> BG_WORKERS
    
    %% Threat mitigation
    MALWARE -.->|Blocked by| MAIN_PROC
    PHISHING -.->|Protected by| KEY_STORE
    PHYSICAL -.->|Protected by| ENC_FILES
    
    style ENC_DB fill:#4fc3f7
    style KEY_STORE fill:#81c784
    style MALWARE fill:#f06292
```

**Desktop Security Configuration:**

```toml
[security]
# Local data protection
encrypt_local_data = true
encryption_method = "windows_dpapi"  # Platform-specific
key_derivation = "pbkdf2"
key_iterations = 100000

# Process security
run_as_service = false
sandbox_workers = true
memory_protection = true
dep_enabled = true  # Data Execution Prevention
aslr_enabled = true  # Address Space Layout Randomization

# File system security
secure_delete = true
temp_file_cleanup = true
log_encryption = true

# Network security (when applicable)
disable_network_by_default = true
require_explicit_network_consent = true
certificate_pinning = true

[security.audit]
log_file_access = true
log_data_changes = true
log_security_events = true
audit_log_encryption = true
```

#### Server Mode Security

```mermaid
graph TB
    subgraph "Server Security Layers"
        subgraph "Network Layer"
            FW[Firewall<br/>iptables/Windows Firewall]
            TLS[TLS Termination<br/>Modern Ciphers Only]
            RATE[Rate Limiting<br/>DDoS Protection]
        end
        
        subgraph "Application Layer"
            AUTH[Authentication<br/>JWT + MFA]
            AUTHZ[Authorization<br/>RBAC]
            INPUT_VAL[Input Validation<br/>Sanitization]
        end
        
        subgraph "Data Layer"
            DB_ENC[Database Encryption<br/>AES-256]
            BACKUP_ENC[Backup Encryption<br/>GPG]
            LOG_ENC[Log Encryption<br/>Structured Logging]
        end
        
        subgraph "Infrastructure Layer"
            CONTAINER[Container Security<br/>Non-root User]
            SECRETS[Secret Management<br/>HashiCorp Vault]
            MONITORING[Security Monitoring<br/>SIEM Integration]
        end
    end
    
    subgraph "Threat Vectors"
        DDOS[DDoS Attacks]
        INJECTION[SQL/NoSQL Injection]
        XSS[XSS/CSRF Attacks]
        PRIVESC[Privilege Escalation]
        DATA_BREACH[Data Exfiltration]
    end
    
    %% Security controls
    DDOS -.->|Mitigated by| RATE
    INJECTION -.->|Prevented by| INPUT_VAL
    XSS -.->|Blocked by| INPUT_VAL
    PRIVESC -.->|Limited by| AUTHZ
    DATA_BREACH -.->|Protected by| DB_ENC
    
    style AUTH fill:#4fc3f7
    style DB_ENC fill:#81c784
    style DDOS fill:#f06292
```

**Server Security Configuration:**

```toml
[security]
# Network security
enforce_https = true
hsts_max_age = "31536000"
hsts_include_subdomains = true
tls_min_version = "1.2"
cipher_suites = [
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256",
    "ECDHE-RSA-AES256-GCM-SHA384"
]

# Authentication and authorization
[security.auth]
require_mfa = true
password_policy = "strong"  # Strong password requirements
session_timeout = "30m"
max_login_attempts = 5
lockout_duration = "15m"
jwt_rotation_interval = "24h"

# Input validation and sanitization
[security.input]
max_request_size = "10MB"
sanitize_html = true
validate_json_schema = true
sql_injection_protection = true
xss_protection = true
csrf_protection = true

# Data protection
[security.data]
database_encryption = true
backup_encryption = true
log_encryption = true
pii_detection = true
data_retention_policy = "2y"
secure_deletion = true

# Infrastructure security
[security.infrastructure]
container_readonly_filesystem = true
drop_capabilities = ["ALL"]
add_capabilities = ["NET_BIND_SERVICE"]
run_as_non_root = true
security_opt = ["no-new-privileges:true"]

# Monitoring and alerting
[security.monitoring]
failed_login_alerts = true
suspicious_activity_detection = true
file_integrity_monitoring = true
log_tampering_detection = true
```

### Threat Model and Mitigation Strategies

#### Common Threats Across All Modes

```mermaid
graph TD
    subgraph "Data Threats"
        DATA_LOSS[Data Loss<br/>Hardware Failure]
        DATA_CORRUPTION[Data Corruption<br/>Software Bugs]
        DATA_THEFT[Data Theft<br/>Unauthorized Access]
    end
    
    subgraph "Access Threats"
        UNAUTH_ACCESS[Unauthorized Access<br/>Weak Authentication]
        PRIVESC[Privilege Escalation<br/>Permission Bypass]
        SESSION_HIJACK[Session Hijacking<br/>Token Theft]
    end
    
    subgraph "Network Threats"
        MITM[Man-in-the-Middle<br/>Interception]
        DDOS[Denial of Service<br/>Resource Exhaustion]
        DNS_POISON[DNS Poisoning<br/>Redirect Attacks]
    end
    
    subgraph "Application Threats"
        CODE_INJECTION[Code Injection<br/>SQL/Script Injection]
        XSS[Cross-Site Scripting<br/>Client-Side Attacks]
        CSRF[Cross-Site Request Forgery<br/>Action Hijacking]
    end
    
    subgraph "Mitigation Controls"
        BACKUP[Automated Backups<br/>Multiple Locations]
        ENCRYPTION[End-to-End Encryption<br/>Strong Algorithms]
        AUTH[Multi-Factor Auth<br/>Strong Passwords]
        MONITORING[Security Monitoring<br/>Anomaly Detection]
        UPDATES[Regular Updates<br/>Security Patches]
    end
    
    %% Threat to mitigation mapping
    DATA_LOSS --> BACKUP
    DATA_CORRUPTION --> BACKUP
    DATA_THEFT --> ENCRYPTION
    UNAUTH_ACCESS --> AUTH
    PRIVESC --> AUTH
    SESSION_HIJACK --> AUTH
    MITM --> ENCRYPTION
    DDOS --> MONITORING
    DNS_POISON --> MONITORING
    CODE_INJECTION --> UPDATES
    XSS --> UPDATES
    CSRF --> UPDATES
    
    style DATA_THEFT fill:#f06292
    style UNAUTH_ACCESS fill:#f06292
    style MITM fill:#f06292
    style CODE_INJECTION fill:#f06292
    style ENCRYPTION fill:#4fc3f7
    style AUTH fill:#81c784
    style MONITORING fill:#ffb74d
```

#### Mode-Specific Security Controls

| Threat Category | Desktop Mode | Server Mode | Hybrid Mode | Mitigation Priority |
|----------------|--------------|-------------|-------------|-------------------|
| **Data at Rest** | Windows DPAPI, BitLocker | Database encryption, File encryption | Both approaches | High |
| **Data in Transit** | Optional TLS for external | Mandatory TLS/HTTPS | Both required | High |
| **Authentication** | Local user auth | JWT + MFA | Combined | High |
| **Authorization** | Single user | RBAC | Context-aware | Medium |
| **Network Security** | Firewall optional | Firewall required | Selective | High |
| **Monitoring** | Local logs | SIEM integration | Hybrid monitoring | Medium |
| **Backup** | Local + cloud | Automated enterprise | Both strategies | High |

### Security Implementation Guidelines

#### 1. Secure Development Lifecycle

```rust
// Security validation example
pub struct SecurityValidator {
    policies: Vec<SecurityPolicy>,
    threat_model: ThreatModel,
}

impl SecurityValidator {
    pub async fn validate_deployment(&self, config: &Configuration) -> SecurityResult {
        let mut issues = Vec::new();
        
        // Validate encryption requirements
        if config.runtime.mode.requires_network() && !config.security.enforce_https {
            issues.push(SecurityIssue::new(
                SecuritySeverity::High,
                "HTTPS required for network deployments",
                "Set security.enforce_https = true"
            ));
        }
        
        // Validate authentication strength
        if config.runtime.mode == RuntimeMode::Server {
            if !config.security.auth.require_mfa {
                issues.push(SecurityIssue::new(
                    SecuritySeverity::Medium,
                    "Multi-factor authentication recommended for server mode",
                    "Set security.auth.require_mfa = true"
                ));
            }
        }
        
        // Validate data protection
        if config.runtime.mode == RuntimeMode::Desktop && !config.security.encrypt_local_data {
            issues.push(SecurityIssue::new(
                SecuritySeverity::Medium,
                "Local data encryption recommended",
                "Set security.encrypt_local_data = true"
            ));
        }
        
        SecurityResult::new(issues)
    }
}
```

#### 2. Security Monitoring and Incident Response

```toml
[security.incident_response]
# Automated response to security events
auto_lock_on_breach = true
max_failed_auth_attempts = 5
breach_notification_email = "security@company.com"
incident_log_retention = "1y"

# Threat detection
[security.threat_detection]
brute_force_detection = true
anomaly_detection = true
geo_location_tracking = true
suspicious_activity_threshold = 10

# Response procedures
[security.response]
isolate_on_compromise = true
backup_on_incident = true
forensic_logging = true
external_security_contact = "incident-response@company.com"
```

#### 3. Compliance and Audit Requirements

```toml
[security.compliance]
# Regulatory compliance
gdpr_compliance = true
hipaa_compliance = false
sox_compliance = false

# Audit logging
[security.audit]
log_all_access = true
log_data_changes = true
log_admin_actions = true
log_security_events = true
audit_log_integrity = true
audit_log_retention = "7y"

# Data governance
[security.data_governance]
data_classification = true
data_retention_policy = "automatic"
data_anonymization = true
right_to_deletion = true  # GDPR Article 17
data_portability = true   # GDPR Article 20
```

This comprehensive migration and security guide ensures a smooth transition to the unified runtime while maintaining the highest security standards across all deployment modes.