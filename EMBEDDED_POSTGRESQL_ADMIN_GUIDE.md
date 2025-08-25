# Embedded PostgreSQL Administration Guide for HotM

## Overview

Hall of the Mind includes a complete embedded PostgreSQL database with pgvector extension, providing enterprise-grade data persistence and vector search capabilities without requiring external database management. This guide covers installation, configuration, maintenance, and troubleshooting for administrators.

## Table of Contents

1. [Installation Options](#installation-options)
2. [Service Management](#service-management)
3. [Configuration Management](#configuration-management)
4. [Backup and Restore](#backup-and-restore)
5. [Performance Tuning](#performance-tuning)
6. [Troubleshooting](#troubleshooting)
7. [Security Considerations](#security-considerations)
8. [Upgrade Procedures](#upgrade-procedures)
9. [Monitoring and Maintenance](#monitoring-and-maintenance)
10. [Command Reference](#command-reference)

## Installation Options

### Embedded PostgreSQL (Recommended)

The HotM installer provides a fully automated PostgreSQL deployment:

**Features:**
- PostgreSQL 15.8 with pgvector 0.7.4
- Automatic service installation and configuration
- System-optimized performance settings
- Automated backup scheduling
- Zero-configuration setup for most users

**System Requirements:**
- Windows 10/11 (64-bit)
- 4GB RAM minimum, 8GB recommended
- 2GB free disk space for database
- Available network port (default: 54321)

**Installation Process:**

1. **Run HotM Installer**: Double-click the MSI package
2. **Choose Components**: Select "API Server" to include embedded database
3. **Database Configuration**: Choose "Embedded PostgreSQL (Recommended)"
4. **Port Configuration**: Default port 54321 (automatically adjusted if conflicts detected)
5. **Installation**: Installer will:
   - Extract PostgreSQL binaries
   - Initialize database cluster
   - Deploy HotM schema
   - Install Windows service
   - Configure automatic startup

**Post-Installation Verification:**

```powershell
# Verify service status
Get-Service "HotM-PostgreSQL" | Format-Table Name, Status, StartType

# Test database connectivity
& "C:\Program Files\HotM\bin\hotm-db-manager.exe" test-connection

# Check service logs
Get-EventLog -LogName Application -Source "HotM-PostgreSQL" -Newest 10
```

### External PostgreSQL Connection

For organizations with existing PostgreSQL infrastructure:

**Requirements:**
- PostgreSQL 13+ with pgvector extension installed
- Network connectivity to PostgreSQL server
- Database and user account with appropriate permissions

**Configuration:**

1. **Create Database and User:**
```sql
-- Run on existing PostgreSQL server
CREATE USER hotm WITH PASSWORD 'secure_password';
CREATE DATABASE hotm OWNER hotm;
GRANT ALL PRIVILEGES ON DATABASE hotm TO hotm;

-- Connect to hotm database
\c hotm

-- Install required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO hotm;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO hotm;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO hotm;
```

2. **Configure HotM Connection:**
```toml
# Edit: %PROGRAMDATA%\HotM\config\database.toml
[database]
type = "postgresql"
host = "your-postgres-server.com"
port = 5432
database = "hotm"
username = "hotm"
password = "secure_password"
ssl_mode = "require"
pool_size = 20
embedded = false
```

## Service Management

### Windows Service: HotM-PostgreSQL

**Service Properties:**
- **Name:** HotM-PostgreSQL
- **Display Name:** HotM PostgreSQL Database Service
- **Service Account:** NT AUTHORITY\LocalService
- **Startup Type:** Automatic
- **Dependencies:** RPC, DCOM, EventLog

**Management Commands:**

```powershell
# Service status and control
Get-Service "HotM-PostgreSQL"
Start-Service "HotM-PostgreSQL"
Stop-Service "HotM-PostgreSQL"
Restart-Service "HotM-PostgreSQL"

# Service configuration
sc.exe config "HotM-PostgreSQL" start= auto
sc.exe config "HotM-PostgreSQL" start= disabled

# Service recovery actions
sc.exe failure "HotM-PostgreSQL" reset= 86400 actions= restart/5000/restart/10000/run/30000
```

**Service Recovery:**

The service is configured with automatic recovery actions:
1. **First Failure:** Restart service after 5 seconds
2. **Second Failure:** Restart service after 10 seconds  
3. **Third Failure:** Run recovery program
4. **Reset Counter:** After 24 hours

**Manual Recovery:**

```powershell
# Run recovery utility
& "C:\Program Files\HotM\bin\hotm-recovery.exe" --service postgresql

# Force service restart
Stop-Service "HotM-PostgreSQL" -Force
Start-Service "HotM-PostgreSQL"

# Check service dependencies
sc.exe enumdepend "HotM-PostgreSQL"
```

### Database Manager Tool

The `hotm-db-manager.exe` utility provides comprehensive database management:

```powershell
# Service operations
hotm-db-manager.exe start
hotm-db-manager.exe stop  
hotm-db-manager.exe restart
hotm-db-manager.exe status

# Configuration management
hotm-db-manager.exe configure --optimize-system
hotm-db-manager.exe configure --port 54321
hotm-db-manager.exe test-connection

# Backup operations
hotm-db-manager.exe backup --type manual
hotm-db-manager.exe backup --type pre-upgrade --description "Before v0.3.0"
hotm-db-manager.exe restore --backup-id "12345678"
hotm-db-manager.exe list-backups

# Migration and maintenance
hotm-db-manager.exe migrate --to-version "0.3.0"
hotm-db-manager.exe vacuum --analyze
hotm-db-manager.exe reindex
```

## Configuration Management

### Database Configuration

**Primary Configuration File:** `%PROGRAMDATA%\HotM\config\database.toml`

```toml
[database]
type = "postgresql"
host = "localhost"
port = 54321
database = "hotm"
username = "hotm"
# Password stored in secure registry location
ssl_mode = "disable"  # Internal connection only
pool_size = 20
embedded = true

[cluster]
data_directory = "C:\\ProgramData\\HotM\\database\\cluster"
backup_directory = "C:\\ProgramData\\HotM\\database\\backups"
log_directory = "C:\\ProgramData\\HotM\\logs\\postgresql"

[performance]
# System-optimized values (auto-generated)
shared_buffers = "256MB"
work_mem = "8MB"
effective_cache_size = "1GB"
max_connections = 50

[backup]
retention_days = 30
daily_backup_time = "02:00"
compression_enabled = true
verify_backups = true
```

### PostgreSQL Configuration

**Main Configuration:** `%PROGRAMDATA%\HotM\database\cluster\postgresql.conf`

Key embedded-optimized settings:

```ini
# Connection Configuration
listen_addresses = 'localhost'
port = 54321
max_connections = 50

# Memory Configuration (System-optimized)
shared_buffers = 256MB
work_mem = 8MB
maintenance_work_mem = 64MB
effective_cache_size = 1GB

# Security Configuration
ssl = off                              # Internal only
password_encryption = scram-sha-256
log_statement = 'none'                 # No SQL logging for security

# Performance Configuration
random_page_cost = 1.1                 # SSD optimized
effective_io_concurrency = 100
checkpoint_timeout = 5min
checkpoint_completion_target = 0.9

# Extensions
shared_preload_libraries = 'vector,pg_stat_statements'

# Logging (Minimal for embedded use)
log_min_messages = warning
log_min_error_statement = error
log_destination = 'stderr,csvlog'
logging_collector = on
```

**Host-Based Authentication:** `%PROGRAMDATA%\HotM\database\cluster\pg_hba.conf`

```
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     scram-sha-256
host    all             all             127.0.0.1/32            scram-sha-256
host    all             all             ::1/128                 scram-sha-256
```

### Registry Configuration

**Database Registry:** `HKLM\SOFTWARE\HotM\Database`

```
Type          REG_SZ      embedded
Port          REG_DWORD   54321
ClusterPath   REG_SZ      C:\ProgramData\HotM\database\cluster
BackupPath    REG_SZ      C:\ProgramData\HotM\database\backups
Version       REG_SZ      15.8
PgVectorVersion REG_SZ    0.7.4
```

## Backup and Restore

### Automated Backup System

**Backup Types:**
- **Scheduled:** Daily automated backups (default 2:00 AM)
- **Pre-upgrade:** Automatic backup before HotM updates
- **Manual:** Administrator-initiated backups
- **Emergency:** Backups created during error recovery

**Backup Locations:**
```
%PROGRAMDATA%\HotM\database\backups\
├── daily\              # Scheduled daily backups
├── weekly\             # Weekly consolidated backups  
├── pre-upgrade\        # Pre-upgrade safety backups
├── manual\             # Administrator-created backups
└── emergency\          # Emergency recovery backups
```

**Backup Management:**

```powershell
# Create manual backup
hotm-db-manager.exe backup --type manual --description "Before configuration change"

# List all available backups
hotm-db-manager.exe list-backups

# Restore from specific backup
hotm-db-manager.exe restore --backup-id "a1b2c3d4" --target-db "hotm_restored"

# Verify backup integrity
hotm-db-manager.exe verify-backup --backup-id "a1b2c3d4"

# Cleanup old backups
hotm-db-manager.exe cleanup-backups --older-than 30
```

**Backup Configuration:**

```toml
# %PROGRAMDATA%\HotM\config\backup.toml
[backup]
retention_days = 30
daily_backup_time = "02:00"
max_backup_size_gb = 5.0
compression_enabled = true
verify_backups = true

[cleanup]
auto_cleanup = true
keep_pre_upgrade = true
min_free_space_gb = 2.0
```

### Disaster Recovery

**Complete System Recovery:**

1. **Stop HotM Services:**
```powershell
Stop-Service "HotM-PostgreSQL"
Stop-Service "HotM-Runtime"  
```

2. **Backup Current State:**
```powershell
# Backup current cluster (if accessible)
robocopy "%PROGRAMDATA%\HotM\database\cluster" "%TEMP%\hotm-recovery-backup" /E

# Export configuration
reg export "HKLM\SOFTWARE\HotM" "%TEMP%\hotm-config-backup.reg"
```

3. **Restore from Backup:**
```powershell
# Method 1: Using backup manager
hotm-db-manager.exe restore --backup-id "latest" --target-db "hotm"

# Method 2: Manual cluster restore
Remove-Item "%PROGRAMDATA%\HotM\database\cluster" -Recurse -Force
hotm-db-manager.exe initialize-cluster
hotm-db-manager.exe restore-cluster --backup-path "path\to\backup.sql"
```

4. **Verify and Restart:**
```powershell
# Test database integrity
hotm-db-manager.exe test-connection
hotm-db-manager.exe verify-schema

# Start services
Start-Service "HotM-PostgreSQL"
Start-Service "HotM-Runtime"
```

## Performance Tuning

### System Analysis and Optimization

The embedded PostgreSQL automatically optimizes configuration based on system resources:

**Memory-Based Optimization:**
```
System RAM     shared_buffers    work_mem    max_connections
4-8 GB         128MB            4MB         25
8-16 GB        256MB            8MB         50  
16+ GB         512MB            16MB        100
```

**Storage-Based Optimization:**
```
Storage Type   random_page_cost   effective_io_concurrency
HDD           4.0                2
SSD           1.1                100
NVMe          1.0                200
```

**Manual Performance Tuning:**

```powershell
# System analysis and recommendations
hotm-db-manager.exe analyze-system
hotm-db-manager.exe recommend-config

# Apply optimizations
hotm-db-manager.exe configure --optimize-system
hotm-db-manager.exe configure --memory-profile high
hotm-db-manager.exe configure --workload-profile read-heavy

# Performance monitoring
hotm-db-manager.exe monitor --duration 300  # 5 minutes
hotm-db-manager.exe stats --connections
hotm-db-manager.exe stats --queries
```

### Query Performance Optimization

**Index Maintenance:**
```powershell
# Rebuild indexes
hotm-db-manager.exe reindex --analyze

# Vacuum and analyze
hotm-db-manager.exe vacuum --full --analyze

# Update statistics
hotm-db-manager.exe analyze-stats
```

**Vector Search Optimization:**
```sql
-- Optimize vector index parameters
ALTER INDEX embedding_vector_idx SET (lists = 1000);

-- Update vector statistics
ANALYZE embedding;

-- Monitor vector query performance
SELECT * FROM pg_stat_user_indexes WHERE relname = 'embedding';
```

## Troubleshooting

### Common Issues and Solutions

**1. Service Won't Start**

*Symptoms:* HotM-PostgreSQL service fails to start

*Diagnosis:*
```powershell
# Check service status
Get-Service "HotM-PostgreSQL" | Format-List *

# Check Windows Event Log
Get-EventLog -LogName Application -Source "HotM-PostgreSQL" -Newest 10

# Check PostgreSQL logs
Get-Content "%PROGRAMDATA%\HotM\logs\postgresql\postgresql.log" -Tail 50
```

*Solutions:*
```powershell
# Port conflict resolution
hotm-db-manager.exe configure --find-available-port

# Cluster repair
hotm-db-manager.exe repair-cluster

# Service reinstallation
hotm-db-manager.exe reinstall-service
```

**2. Database Connection Failures**

*Symptoms:* HotM applications cannot connect to database

*Diagnosis:*
```powershell
# Test connection
hotm-db-manager.exe test-connection

# Check network connectivity
Test-NetConnection localhost -Port 54321

# Verify service status
pg_isready -h localhost -p 54321
```

*Solutions:*
```powershell
# Reset connection configuration
hotm-db-manager.exe configure --reset-connections

# Restart services
Restart-Service "HotM-PostgreSQL"

# Check firewall rules
Get-NetFirewallRule -DisplayName "*HotM*"
```

**3. Performance Issues**

*Symptoms:* Slow query performance, high resource usage

*Diagnosis:*
```powershell
# Performance analysis
hotm-db-manager.exe analyze-performance

# Resource monitoring
hotm-db-manager.exe monitor --duration 60

# Query statistics
hotm-db-manager.exe stats --slow-queries
```

*Solutions:*
```powershell
# Re-optimize configuration
hotm-db-manager.exe configure --optimize-system

# Maintenance operations
hotm-db-manager.exe vacuum --analyze
hotm-db-manager.exe reindex

# Memory tuning
hotm-db-manager.exe configure --memory-profile auto
```

**4. Backup/Restore Failures**

*Symptoms:* Backup creation fails or restore operations error

*Diagnosis:*
```powershell
# Check backup status
hotm-db-manager.exe list-backups --verify

# Test backup integrity
hotm-db-manager.exe verify-backup --backup-id "latest"

# Check disk space
Get-PSDrive C | Format-Table Name,Used,Free
```

*Solutions:*
```powershell
# Free up space
hotm-db-manager.exe cleanup-backups --older-than 14

# Repair backup metadata
hotm-db-manager.exe repair-backup-registry

# Manual backup creation
hotm-db-manager.exe backup --type emergency
```

### Advanced Troubleshooting

**Database Corruption Recovery:**

```powershell
# Check database integrity
hotm-db-manager.exe check-integrity

# Repair minor corruption
hotm-db-manager.exe repair --mode conservative

# Full cluster rebuild (last resort)
hotm-db-manager.exe rebuild-cluster --from-backup "latest"
```

**Service Recovery:**

```powershell
# Complete service reset
Stop-Service "HotM-PostgreSQL" -Force
hotm-db-manager.exe uninstall-service
hotm-db-manager.exe install-service
Start-Service "HotM-PostgreSQL"
```

## Security Considerations

### Default Security Posture

**Network Security:**
- PostgreSQL listens only on localhost (127.0.0.1)
- Default port 54321 (non-standard to avoid conflicts)
- No external network access by default
- Windows Firewall rules restrict access

**Authentication:**
- SCRAM-SHA-256 password encryption
- No trust authentication methods
- Service runs as LocalService account
- Secure password generation and storage

**Data Security:**
- Database files protected by NTFS permissions
- Backup files encrypted at rest
- No SQL statement logging (prevents data leakage)
- Audit trail for administrative operations

### Security Hardening

**Additional Hardening Steps:**

```powershell
# Disable unnecessary extensions
hotm-db-manager.exe configure --disable-extension "adminpack"

# Enable connection logging (if needed)
hotm-db-manager.exe configure --set "log_connections=on"

# Configure backup encryption
hotm-db-manager.exe configure --encrypt-backups

# Set up audit logging
hotm-db-manager.exe configure --enable-audit
```

**Permission Review:**

```powershell
# Review data directory permissions
icacls "%PROGRAMDATA%\HotM\database\cluster"

# Review service permissions
sc.exe sdshow "HotM-PostgreSQL"

# Review registry permissions
reg query "HKLM\SOFTWARE\HotM\Database" /s
```

## Upgrade Procedures

### HotM Version Upgrades

**Pre-Upgrade Checklist:**

1. **Create Pre-Upgrade Backup:**
```powershell
hotm-db-manager.exe backup --type pre-upgrade --description "Before v0.3.0 upgrade"
```

2. **Verify Current State:**
```powershell
hotm-db-manager.exe status --full
hotm-db-manager.exe test-connection
hotm-db-manager.exe check-integrity
```

3. **Document Configuration:**
```powershell
# Export configuration
hotm-db-manager.exe export-config --file "config-backup.json"

# Export registry settings
reg export "HKLM\SOFTWARE\HotM" "hotm-registry-backup.reg"
```

**Upgrade Process:**

The HotM installer automatically handles database schema migrations:

1. **Automatic Schema Detection:** Installer detects current schema version
2. **Migration Planning:** Generates migration plan and validates compatibility
3. **Pre-Migration Backup:** Creates automatic backup before changes
4. **Schema Migration:** Applies incremental schema updates
5. **Verification:** Tests database integrity after migration
6. **Service Restart:** Restarts services with new configuration

**Post-Upgrade Verification:**

```powershell
# Verify upgrade completion
hotm-db-manager.exe status --migration-history

# Test functionality  
hotm-db-manager.exe test-connection
hotm-db-manager.exe verify-schema

# Performance check
hotm-db-manager.exe stats --performance
```

**Rollback Procedures:**

If upgrade fails or issues are discovered:

```powershell
# Automatic rollback (if available)
hotm-db-manager.exe rollback --to-backup "pre-upgrade-latest"

# Manual rollback
Stop-Service "HotM-PostgreSQL"
hotm-db-manager.exe restore --backup-id "pre-upgrade-backup-id"
Start-Service "HotM-PostgreSQL"

# Verify rollback
hotm-db-manager.exe status --version
```

### PostgreSQL Version Updates

**Minor Version Updates (15.8 → 15.9):**

```powershell
# Stop services
Stop-Service "HotM-PostgreSQL"

# Create backup
hotm-db-manager.exe backup --type pre-upgrade

# Update binaries (done by HotM installer)
# Start services
Start-Service "HotM-PostgreSQL"

# Verify upgrade
hotm-db-manager.exe status --postgres-version
```

**Major Version Updates (15.x → 16.x):**

Major PostgreSQL upgrades require cluster migration:

```powershell
# Create full backup
hotm-db-manager.exe backup --type pre-upgrade --full

# Export data
pg_dumpall -h localhost -p 54321 -U postgres > full-backup.sql

# Stop services
Stop-Service "HotM-PostgreSQL"

# Initialize new cluster (done by installer)
# Restore data
psql -h localhost -p 54321 -U postgres < full-backup.sql

# Verify migration
hotm-db-manager.exe verify-schema
```

## Monitoring and Maintenance

### Health Monitoring

**Automated Health Checks:**

The HotM system continuously monitors database health:

- **Connection Status:** Every 30 seconds
- **Query Performance:** Every 5 minutes
- **Disk Usage:** Every 10 minutes
- **Backup Status:** Daily
- **Service Status:** Continuous

**Manual Health Checks:**

```powershell
# Complete health assessment
hotm-db-manager.exe health-check --comprehensive

# Connection testing
hotm-db-manager.exe test-connection --verbose

# Performance baseline
hotm-db-manager.exe baseline --create "monthly-$(Get-Date -Format 'yyyy-MM')"
```

### Maintenance Tasks

**Daily Maintenance:**

Automated tasks performed daily:

- Backup creation and verification
- Log rotation and cleanup
- Basic performance statistics collection
- Connection pool optimization

**Weekly Maintenance:**

```powershell
# Manual weekly tasks
hotm-db-manager.exe vacuum --analyze
hotm-db-manager.exe update-statistics
hotm-db-manager.exe check-indexes
hotm-db-manager.exe cleanup-logs --older-than 7
```

**Monthly Maintenance:**

```powershell
# Monthly comprehensive maintenance
hotm-db-manager.exe maintenance --comprehensive
hotm-db-manager.exe analyze-performance --report monthly
hotm-db-manager.exe optimize-storage
hotm-db-manager.exe update-configuration --optimize
```

### Performance Monitoring

**Key Performance Indicators:**

```powershell
# Database performance metrics
hotm-db-manager.exe stats --kpi

# Connection statistics
hotm-db-manager.exe stats --connections

# Query performance
hotm-db-manager.exe stats --queries --slow-threshold 1000

# Resource utilization
hotm-db-manager.exe stats --resources
```

**Performance Trending:**

```powershell
# Create performance report
hotm-db-manager.exe report --performance --period "last-month"

# Export metrics
hotm-db-manager.exe export-metrics --format csv --file "performance-$(Get-Date -Format 'yyyy-MM').csv"
```

## Command Reference

### hotm-db-manager.exe Commands

**Service Management:**
```powershell
hotm-db-manager.exe start                    # Start PostgreSQL service
hotm-db-manager.exe stop                     # Stop PostgreSQL service
hotm-db-manager.exe restart                  # Restart PostgreSQL service
hotm-db-manager.exe status                   # Show service status
hotm-db-manager.exe install-service          # Install Windows service
hotm-db-manager.exe uninstall-service        # Remove Windows service
```

**Configuration:**
```powershell
hotm-db-manager.exe configure --optimize-system             # Auto-optimize for system
hotm-db-manager.exe configure --port 54321                  # Set PostgreSQL port
hotm-db-manager.exe configure --memory-profile high         # Set memory profile
hotm-db-manager.exe configure --reset                       # Reset to defaults
hotm-db-manager.exe export-config --file config.json        # Export configuration
hotm-db-manager.exe import-config --file config.json        # Import configuration
```

**Backup/Restore:**
```powershell
hotm-db-manager.exe backup --type manual                           # Create manual backup
hotm-db-manager.exe backup --type pre-upgrade --description "..."   # Pre-upgrade backup
hotm-db-manager.exe list-backups                                   # List all backups
hotm-db-manager.exe restore --backup-id "12345"                    # Restore from backup
hotm-db-manager.exe verify-backup --backup-id "12345"              # Verify backup integrity
hotm-db-manager.exe cleanup-backups --older-than 30                # Cleanup old backups
```

**Maintenance:**
```powershell
hotm-db-manager.exe vacuum --analyze                # Vacuum and analyze
hotm-db-manager.exe reindex                         # Rebuild all indexes
hotm-db-manager.exe update-statistics              # Update query statistics  
hotm-db-manager.exe check-integrity                # Check database integrity
hotm-db-manager.exe repair --mode conservative     # Repair minor issues
hotm-db-manager.exe maintenance --comprehensive    # Full maintenance cycle
```

**Monitoring:**
```powershell
hotm-db-manager.exe health-check                   # Basic health check
hotm-db-manager.exe health-check --comprehensive   # Complete health assessment
hotm-db-manager.exe monitor --duration 300         # Monitor for 5 minutes
hotm-db-manager.exe stats --performance            # Performance statistics
hotm-db-manager.exe stats --connections            # Connection statistics
hotm-db-manager.exe report --period "last-week"    # Generate report
```

**Testing:**
```powershell
hotm-db-manager.exe test-connection                # Test database connection
hotm-db-manager.exe verify-schema                  # Verify schema integrity
hotm-db-manager.exe benchmark --duration 60        # Run performance benchmark
```

### PowerShell Management Scripts

**Service Status Check:**
```powershell
# Check all HotM services
Get-Service "HotM-*" | Format-Table Name, Status, StartType -AutoSize
```

**Database Connection Test:**
```powershell
# Test PostgreSQL connectivity
$env:PGPASSWORD = "password"  # Set if needed
& "C:\Program Files\HotM\database\postgresql\bin\pg_isready.exe" -h localhost -p 54321 -U hotm
```

**Backup Space Monitoring:**
```powershell
# Check backup directory disk usage
$backupPath = "$env:PROGRAMDATA\HotM\database\backups"
Get-ChildItem $backupPath -Recurse | Measure-Object -Property Length -Sum | 
    Select-Object @{Name="TotalSizeGB"; Expression={[math]::Round($_.Sum/1GB, 2)}}
```

This comprehensive administration guide provides the necessary information for IT administrators to successfully deploy, configure, and maintain HotM's embedded PostgreSQL database in enterprise environments while ensuring optimal performance, security, and reliability.