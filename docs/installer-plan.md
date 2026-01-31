# Windows Installer Plan (Tauri MSI)

> **ARCHIVED**: This documentation is for the HotM Desktop Application (v0.1.x) which has been superseded by the React SPA architecture (v0.2.0+).
>
> **Status**: Historical reference only
> **Archived**: 2026-01-31
> **See**: `.aiwg/archive/desktop-era/` for complete desktop documentation
> **Current Architecture**: React SPA consuming matric-memory API (see `.aiwg/architecture/adr/ADR-004-spa-migration.md`)

---

## Goals
- One-click install that ensures prerequisites and starts the background server
- Minimal elevation; rely on Docker for PostgreSQL with pgvector

## Current Implementation

### MSI Installer Features

The installer provides the following options:

1. **HotM Server** (always installed)
   - Rust API server binary (`hotm-server.exe`)
   - Installed as Windows Service on port 53211
   - Registry configuration for database URL

2. **PostgreSQL Setup** (optional, requires Docker)
   - Creates Docker container using `pgvector/pgvector:pg16` image
   - PostgreSQL 16 with pgvector extension pre-built
   - Runs on port 5433 to avoid conflicts with existing PostgreSQL
   - Applies initial schema (`clean-schema.sql`)
   - Creates both `hotm_dev` and `hotm_test` databases

3. **Desktop Client** (optional)
   - Tauri-based desktop application (`hotm-ui.exe`)
   - Global hotkey support (Ctrl+Alt+H)
   - System tray integration

4. **Start with Windows** (optional, requires Desktop Client)
   - Adds startup shortcut to launch minimized to tray

### Prerequisites

- **Docker Desktop** - Required for PostgreSQL setup option
- **Ollama** - Optional, for AI/NLP features (nomic-embed-text, gpt-oss:20b models)

### Why Docker for PostgreSQL?

pgvector does not provide pre-built Windows binaries. The official Docker image `pgvector/pgvector:pg16` includes:
- PostgreSQL 16
- pgvector extension compiled and ready to use
- Proper configuration for vector operations

This approach avoids the complexity of:
- Compiling pgvector from source on Windows
- Managing PostgreSQL installation separately
- Handling Visual Studio build tools requirements

### Files

- `ui/src-tauri/installer/wix/main.wxs` - WiX installer configuration
- `ui/src-tauri/installer/resources/setup-postgres.ps1` - Docker-based PostgreSQL setup
- `ui/src-tauri/installer/resources/clean-schema.sql` - Database schema
- `ui/src-tauri/installer/resources/hotm-server.exe` - Compiled server binary

### Build Process

```bash
# Build the installer
cd ui
npm run tauri build

# Outputs:
# - ui/src-tauri/target/release/bundle/msi/HotM_x.x.x_x64_en-US.msi
# - ui/src-tauri/target/release/bundle/nsis/HotM_x.x.x_x64-setup.exe
```

The `build.rs` script automatically:
1. Builds the server binary from `server/` directory
2. Copies schema file to installer resources
3. Verifies setup script is present

## Development Setup

For development without the installer:

```powershell
# Start PostgreSQL with pgvector via Docker
.\scripts\start-postgres.ps1

# Or use Docker Compose
docker-compose -f docker-compose.dev.yml up -d

# Start the server
cd server
$env:DATABASE_URL = "postgres://hotm:hotm_dev_pass@localhost:5433/hotm_dev"
cargo run

# Start the UI
cd ui
npm run dev
```

## Future Enhancements

- Ollama setup option (download and configure models)
- Health check verification before completing install
- Custom database URL configuration in installer wizard
- Silent install support for enterprise deployment
