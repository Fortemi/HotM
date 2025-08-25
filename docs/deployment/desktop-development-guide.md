# HotM Desktop Mode Development Guide

This guide provides comprehensive instructions for developers working on HotM's desktop deployment mode, particularly for building and testing the Windows MSI installer that will be used for the free local-only user beta release.

## Overview

**Desktop Mode** is HotM's primary end-user deployment mode featuring:
- Single-user personal knowledge management
- Embedded services (PostgreSQL + Ollama) or external connections
- Windows 11 native experience with system tray integration
- Global hotkey support (`Ctrl+Alt+H`)
- Professional MSI installer with service management

## Development Environment Setup

### Prerequisites

**Required Tools:**
- **Windows 11** or **Linux/WSL** (for cross-development)
- **Rust 1.70+** with `cargo`
- **Node.js 18+** with `npm`
- **PostgreSQL 14+** with pgvector extension
- **WiX Toolset** (for MSI building on Windows)

**Development Database:**
```bash
# Linux/WSL setup
export DATABASE_URL=postgres://hotm:hotm_dev@localhost:5432/hotm_dev
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Or use embedded PostgreSQL (recommended for desktop testing)
export DATABASE_URL=postgres://hotm:hotm_local@localhost:54321/hotm
```

### Quick Development Setup

```bash
# Clone unified runtime branch
git clone -b unified-runtime https://github.com/jmagly/hotm.git
cd hotm

# Install dependencies
cargo build --workspace
cd ui && npm install && cd ..

# Run desktop mode for development (uses server mode with desktop config)
export RUST_LOG=hotm_core=info,axum=info
cargo run --bin hotm-unified -- --mode server --config-file configs/desktop-dev.toml

# Access web interface at http://localhost:53211
```

## Testing Desktop Mode

### Full Test Suite

Run the complete validation suite to ensure quality:

```bash
# Run all installer validation tests
python3 tests/installer/validate-data-backup.py
python3 tests/installer/validate-service-lifecycle.py  
python3 tests/installer/validate-installer-implementation.py

# Expected results (as of latest fixes):
# ✅ Backup validation: 5/5 scenarios passing
# ✅ Service lifecycle: 37/40 tests passing (0 critical failures)
# ✅ Installer validation: 11/11 tests passing
```

### Quick Development Testing

For rapid iteration during development:

```bash
# Test desktop functionality without full installer
cargo test --workspace --test desktop_mode_tests

# Test UI integration
cd ui && npm test -- --run && cd ..

# Test database connectivity with embedded config
cargo run --bin hotm-unified -- --mode desktop --test-connection
```

## Building Desktop MSI Installer

### Simple Build (Recommended)

Use the simplified build script for most development:

```powershell
# Build desktop MSI with testing (Windows)
.\scripts\build-desktop-msi.ps1 -RunTests

# Build without tests for faster iteration
.\scripts\build-desktop-msi.ps1 -SkipTests

# Build specific version
.\scripts\build-desktop-msi.ps1 -Version "0.2.1" -Channel "alpha"
```

### Full Production Build

For release-quality builds:

```powershell
# Full production build with all validation
.\scripts\build-installer.ps1 -Version "0.2.0" -Channel "beta" -RunTests

# Skip dependency downloads for faster builds
.\scripts\build-installer.ps1 -SkipDependencies
```

### Build Output

Successful builds create:
```
dist/installer/
├── HotM-Desktop-Setup-v0.2.0-beta.msi    # Main installer
├── HotM-Desktop-Setup-v0.2.0-beta.exe    # Self-extracting installer  
├── checksums.sha256                       # Integrity verification
└── build-report.json                      # Build metadata
```

## Deployment Mode Configuration

Desktop mode uses specific configuration optimized for single-user scenarios:

### configs/desktop.toml
```toml
[deployment]
mode = "desktop"
auto_start = true
system_tray = true
global_hotkey = "Ctrl+Alt+H"

[database]
type = "postgresql"
url = "postgresql://hotm:hotm_local@localhost:54321/hotm"
embedded = true
port = 54321  # Non-standard port to avoid conflicts

[ai]
embedded_ollama = true
ollama_url = "http://localhost:11435"  # Non-standard port
models = ["gpt-oss:20b", "nomic-embed-text"]
auto_download = true

[server]
port = 53211
bind_address = "127.0.0.1"  # Localhost only for security
web_ui_enabled = true

[features]
collaboration = false
remote_sync = false
telemetry = false  # Privacy-first for desktop users
```

## Testing Installation Scenarios

### Manual Installation Testing

Test the installer on clean Windows 11 systems:

```powershell
# Test silent installation
msiexec /i HotM-Desktop-Setup-v0.2.0-beta.msi /quiet DEPLOYMENT_MODE=desktop

# Test interactive installation
.\HotM-Desktop-Setup-v0.2.0-beta.exe

# Test upgrade scenario
msiexec /i HotM-Desktop-Setup-v0.2.1-beta.msi /quiet REINSTALLMODE=vomus REINSTALL=ALL
```

### Automated Installation Testing

Use the provided test framework:

```powershell
# Run installer tests (Windows)
.\tests\installer\Run-InstallerTests.ps1 -Mode Desktop

# Test specific scenarios
.\tests\installer\Run-InstallerTests.ps1 -Scenarios @("FreshInstall", "Upgrade", "Uninstall")
```

## Common Development Workflows

### 1. Feature Development & Testing

```bash
# Make changes to hotm-core or hotm-desktop
# Test locally first
cargo run --bin hotm-unified -- --mode desktop --config-file configs/desktop-dev.toml

# Run unit tests
cargo test --package hotm-core
cargo test --package hotm-desktop

# Build and test installer
.\scripts\build-desktop-msi.ps1 -RunTests
```

### 2. Database Schema Changes

```bash
# Create new migration
cd hotm-core && sqlx migrate add your_migration_name

# Test migration with embedded database
export DATABASE_URL=postgres://hotm:hotm_local@localhost:54321/hotm
sqlx migrate run

# Rebuild and test
cargo build --workspace
.\scripts\build-desktop-msi.ps1 -RunTests
```

### 3. UI Changes

```bash
# Frontend development
cd ui && npm run dev  # Hot reload development

# Build production UI
cd ui && npm run build

# Test in desktop context
cargo run --bin hotm-unified -- --mode desktop
```

### 4. Installer Customization

```xml
<!-- Modify installer/hotm-installer.wxs -->
<!-- Add custom properties, features, or conditions -->

<!-- Test changes -->
```powershell
.\scripts\build-desktop-msi.ps1 -RunTests
```

## Troubleshooting

### Common Issues

**Build Failures:**
```bash
# Clean build state
cargo clean
cd ui && npm run clean && cd ..

# Rebuild dependencies
cargo build --workspace
cd ui && npm install && cd ..
```

**Database Connection Issues:**
```bash
# Check PostgreSQL service
sudo service postgresql status

# Verify pgvector extension
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector';"

# Reset development database
dropdb hotm_dev && createdb hotm_dev
psql hotm_dev -c "CREATE EXTENSION vector;"
sqlx migrate run
```

**Installer Testing Issues:**
```powershell
# Clean installer cache
Remove-Item -Recurse -Force dist\installer\*

# Check WiX installation
candle.exe -help
light.exe -help

# Verify Windows SDK
where cl.exe
```

### Logging and Diagnostics

**Enable Debug Logging:**
```bash
export RUST_LOG=hotm_core=debug,hotm_desktop=debug,sqlx=info
cargo run --bin hotm-unified -- --mode desktop
```

**Installer Logging:**
```powershell
# Enable MSI logging
msiexec /i HotM-Setup.msi /l*v install.log

# Review installation logs
Get-Content install.log | Select-String -Pattern "error|warn"
```

## Release Preparation

### Pre-Release Checklist

- [ ] All tests passing (backup, service lifecycle, installer validation)
- [ ] Version numbers updated across all files
- [ ] Build succeeds on clean Windows 11 system
- [ ] MSI installs and uninstalls cleanly
- [ ] Desktop application launches and functions correctly
- [ ] Database initialization and migration works
- [ ] Global hotkey and system tray integration functional

### Release Build

```powershell
# Final production build
.\scripts\build-installer.ps1 -Version "0.2.0" -Channel "stable" -RunTests -Force

# Verify checksums
certutil -hashfile dist\installer\HotM-Desktop-Setup-v0.2.0-stable.msi SHA256
```

## Next Steps

After successful desktop mode development and testing:

1. **Beta Release**: Deploy to limited user group via MSI distribution
2. **Windows Store**: Package for Microsoft Store distribution
3. **Telemetry Integration**: Add optional usage analytics (with user consent)
4. **Auto-Update**: Implement in-app update mechanism
5. **Multi-Language**: Prepare installer for internationalization

## Resources

- [Unified Runtime Architecture](./unified-runtime-architecture.md)
- [Deployment Scenarios](./deployment-scenarios.md)
- [Windows Installer Validation Results](../test-results/final-validation/)
- [WiX Toolset Documentation](https://wixtoolset.org/documentation/)
- [Tauri Desktop Development](https://tauri.app/v1/guides/)

---

*This guide is maintained as part of the HotM unified runtime documentation. Last updated: 2025-08-24*