#!/usr/bin/env bash
set -euo pipefail

# One-command bootstrap and run for HotM server (dev)
# Automatically starts PostgreSQL in Docker if needed
# Prereqs: Docker (for auto-PostgreSQL), Rust toolchain, optional Ollama

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Check cargo
if ! command -v cargo >/dev/null 2>&1; then
  echo "[ERROR] Rust cargo not found. Install Rust from https://rustup.rs and re-run." >&2
  exit 1
fi

# Function to parse DATABASE_URL
parse_database_url() {
  local url="$1"
  # Remove postgres:// or postgresql:// prefix
  url="${url#postgres://}"
  url="${url#postgresql://}"
  
  # Extract user:pass@host:port/dbname
  if [[ "$url" =~ ^([^:]+):([^@]+)@([^:/]+):?([0-9]+)?/(.+)$ ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_PASS="${BASH_REMATCH[2]}"
    DB_HOST="${BASH_REMATCH[3]}"
    DB_PORT="${BASH_REMATCH[4]:-5432}"
    DB_NAME="${BASH_REMATCH[5]}"
    return 0
  else
    return 1
  fi
}

# Function to test PostgreSQL connection
test_postgres_connection() {
  if command -v psql >/dev/null 2>&1; then
    psql "$1" -c "SELECT 1;" >/dev/null 2>&1
  else
    # Try with Docker if psql not available
    if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "hotm-postgres-dev"; then
      local parsed_ok=false
      if parse_database_url "$1"; then
        docker exec hotm-postgres-dev psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1
      else
        return 1
      fi
    else
      return 1
    fi
  fi
}

# Check DATABASE_URL and test connection
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[INFO] DATABASE_URL not set. Setting up PostgreSQL with default credentials..."
  DATABASE_NEEDS_SETUP=true
  USE_DEFAULT_CREDS=true
else
  echo "[INFO] Testing PostgreSQL connection..."
  if ! test_postgres_connection "$DATABASE_URL"; then
    echo "[WARN] Cannot connect to PostgreSQL at $DATABASE_URL"
    
    # Parse the DATABASE_URL to get credentials
    if parse_database_url "$DATABASE_URL"; then
      echo "[INFO] Will create PostgreSQL container with credentials from DATABASE_URL"
      DATABASE_NEEDS_SETUP=true
      USE_DEFAULT_CREDS=false
    else
      echo "[ERROR] Could not parse DATABASE_URL format" >&2
      DATABASE_NEEDS_SETUP=true
      USE_DEFAULT_CREDS=true
    fi
  else
    echo "[INFO] PostgreSQL connection successful!"
    DATABASE_NEEDS_SETUP=false
  fi
fi

# Start PostgreSQL if needed
if [[ "$DATABASE_NEEDS_SETUP" == "true" ]]; then
  # Try to auto-start PostgreSQL with Docker
  if command -v docker >/dev/null 2>&1; then
    if [[ "$USE_DEFAULT_CREDS" == "true" ]]; then
      echo "[INFO] Starting PostgreSQL with Docker (default credentials)..."
      # Source the start-postgres script with defaults
      source "${ROOT_DIR}/scripts/start-postgres.sh"
      export DATABASE_URL="postgres://hotm:hotm_dev_pass@localhost:5433/hotm_dev"
    else
      echo "[INFO] Starting PostgreSQL with Docker (using DATABASE_URL credentials)..."
      
      # Export parsed credentials for start-postgres script
      export CUSTOM_DB_USER="$DB_USER"
      export CUSTOM_DB_PASS="$DB_PASS"
      export CUSTOM_DB_NAME="$DB_NAME"
      export CUSTOM_DB_PORT="${DB_PORT}"
      
      # If original DATABASE_URL was on standard port (5432), use our dev port (5433)
      if [[ "$DB_PORT" == "5432" ]]; then
        export CUSTOM_DB_PORT="5433"
        echo "[INFO] Switching from port 5432 to 5433 to avoid conflicts"
      fi
      
      # Source the start-postgres script with custom credentials
      source "${ROOT_DIR}/scripts/start-postgres.sh"
      
      # Update DATABASE_URL with potentially new port
      export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${CUSTOM_DB_PORT}/${DB_NAME}"
      echo "[INFO] Using DATABASE_URL: $DATABASE_URL"
    fi
    
    # Wait a moment and test connection
    sleep 2
    if ! test_postgres_connection "$DATABASE_URL"; then
      echo "[ERROR] Failed to connect to PostgreSQL after starting container" >&2
      exit 1
    fi
  else
    echo "[ERROR] PostgreSQL not accessible and Docker not available." >&2
    echo "  Option 1: Install Docker to auto-start PostgreSQL" >&2
    echo "  Option 2: Start PostgreSQL manually and set DATABASE_URL" >&2
    echo "    export DATABASE_URL=postgres://user:pass@localhost:5433/hotm_dev" >&2
    exit 1
  fi
fi

# Run migrations if needed
echo "[INFO] Running database migrations..."
cd "$ROOT_DIR/server"
if command -v sqlx >/dev/null 2>&1; then
  sqlx migrate run || echo "[WARN] Failed to run migrations with sqlx CLI"
else
  echo "[INFO] sqlx CLI not found, migrations will run on server startup"
fi
cd "$ROOT_DIR"

# Ensure pgvector extension
if ! command -v psql >/dev/null 2>&1; then
  # Try with Docker
  if command -v docker >/dev/null 2>&1 && docker ps --format '{{.Names}}' | grep -q "hotm-postgres-dev"; then
    echo "[INFO] Ensuring 'vector' extension via Docker..."
    docker exec hotm-postgres-dev psql -U hotm -d hotm_dev -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null 2>&1 || true
  else
    echo "[WARN] psql not found; skipping vector extension check. Ensure 'vector' is installed." >&2
  fi
else
  echo "[INFO] Ensuring 'vector' extension exists..."
  psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null 2>&1 || echo "[WARN] Could not create 'vector' extension; check DB permissions."
fi

# Ollama models (optional)
if command -v ollama >/dev/null 2>&1; then
  echo "[INFO] Checking Ollama models..."
  if ! ollama list | grep -q "gpt-oss:20b"; then
    echo "[INFO] Pulling gpt-oss:20b..."; ollama pull gpt-oss:20b || true
  fi
  if ! ollama list | grep -q "nomic-embed-text"; then
    echo "[INFO] Pulling nomic-embed-text..."; ollama pull nomic-embed-text || true
  fi
else
  echo "[WARN] Ollama not found; semantic features will be degraded. See https://ollama.com" >&2
fi

# Run the server
cd "$ROOT_DIR/server"
RUST_LOG=hotm_server=info,axum=info cargo run
