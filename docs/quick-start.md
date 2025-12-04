# Quick Start Guide

This guide gets you running HotM in under 2 minutes with automatic PostgreSQL setup.

## Prerequisites

- **Docker** (for automatic PostgreSQL with pgvector)
- **Rust** 1.70+ (install from [rustup.rs](https://rustup.rs))
- **Node.js** 18+ (for UI development)
- **Ollama** (optional, for AI features - [ollama.com](https://ollama.com))

## One-Command Start

### Linux/macOS/WSL
```bash
# Clone and start everything
git clone https://github.com/yourusername/hotm.git
cd hotm
./scripts/dev_server.sh
```

### Windows PowerShell
```powershell
# Clone and start everything
git clone https://github.com/yourusername/hotm.git
cd hotm
.\scripts\dev-server.ps1
```

This automatically:
✅ Starts PostgreSQL with pgvector in Docker (if not running)
✅ Creates database and extensions
✅ Pulls Ollama models (if Ollama installed)
✅ Runs migrations
✅ Starts the API server on port 53211

## Start the UI (separate terminal)

```bash
cd ui
npm install
npm run dev
```

The Tauri desktop app will open automatically.

## What Gets Set Up?

### PostgreSQL in Docker
- Container: `hotm-postgres-dev`
- Database: `hotm_dev`
- User: `hotm` / Password: `hotm_dev_pass`
- Port: 5433 (avoids conflicts with local PostgreSQL)
- Extensions: pgvector (for embeddings)
- Persistent volume: `hotm_postgres_data`

### Connection URL
```
postgres://hotm:hotm_dev_pass@localhost:5433/hotm_dev
```

## Manual Database Management

### Start PostgreSQL Only
```bash
# Linux/macOS/WSL
./scripts/start-postgres.sh

# Windows PowerShell
.\scripts\start-postgres.ps1
```

### Stop PostgreSQL
```bash
docker stop hotm-postgres-dev
```

### Remove PostgreSQL (WARNING: Deletes all data!)
```bash
docker rm -f hotm-postgres-dev
docker volume rm hotm_postgres_data
```

### Connect with psql
```bash
docker exec -it hotm-postgres-dev psql -U hotm -d hotm_dev
```

## Docker Compose Alternative

For more control, use Docker Compose:

```bash
# Start PostgreSQL and optionally Ollama
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

## Troubleshooting

### Port Conflicts?
By default, we use port 5433 to avoid conflicts with local PostgreSQL installations.

To use a different port:
```bash
# Set custom port
export DB_PORT=5434
./scripts/start-postgres.sh

# Update DATABASE_URL accordingly
export DATABASE_URL="postgres://hotm:hotm_dev_pass@localhost:5434/hotm_dev"
```

### Docker Not Running?
- **Windows/Mac**: Start Docker Desktop
- **Linux**: `sudo systemctl start docker`

### Ollama Models Not Downloading?
```bash
# Manually pull models
ollama pull gpt-oss:20b
ollama pull nomic-embed-text
```

## Next Steps

- API Documentation: http://localhost:53211/api/docs
- Full Development Guide: [docs/implementation/development-guide.md](implementation/development-guide.md)
- Testing: Run `gh act -j backend-tests` for full test suite