#!/usr/bin/env bash
# HotM Linux prerequisite setup
# Installs and configures PostgreSQL + pgvector, creates the matric database,
# and optionally installs Ollama for local inference.
#
# Usage:
#   ./scripts/setup-linux.sh [--no-ollama] [--db-password PASSWORD]
#
# Tested on: Ubuntu 24.04 / 25.04, Debian 12

set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
DB_USER="matric"
DB_NAME="matric"
DB_PASSWORD="${HOTM_DB_PASSWORD:-matric}"
INSTALL_OLLAMA=true
OLLAMA_EMBED_MODEL="${HOTM_OLLAMA_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_GEN_MODEL="${HOTM_OLLAMA_GEN_MODEL:-qwen3.5:9b}"

# ── Argument parsing ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-ollama)       INSTALL_OLLAMA=false;      shift ;;
    --db-password)     DB_PASSWORD="$2";           shift 2 ;;
    --embed-model)     OLLAMA_EMBED_MODEL="$2";    shift 2 ;;
    --gen-model)       OLLAMA_GEN_MODEL="$2";      shift 2 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

info()  { echo -e "\033[0;32m[hotm]\033[0m $*"; }
warn()  { echo -e "\033[0;33m[hotm]\033[0m $*"; }
error() { echo -e "\033[0;31m[hotm]\033[0m $*" >&2; exit 1; }

require_cmd() { command -v "$1" &>/dev/null || error "Required command not found: $1"; }

# ── System checks ────────────────────────────────────────────────────────────
if [[ "$EUID" -eq 0 ]]; then
  SUDO=""
else
  require_cmd sudo
  SUDO="sudo"
fi

if ! command -v apt-get &>/dev/null; then
  error "This script requires a Debian/Ubuntu system with apt-get."
fi

info "Updating package lists..."
$SUDO apt-get update -qq

# ── PostgreSQL ───────────────────────────────────────────────────────────────
info "Installing PostgreSQL..."
$SUDO apt-get install -y --no-install-recommends postgresql postgresql-contrib

# Detect the installed version and install matching extensions
PG_VER=$(pg_lsclusters --no-header 2>/dev/null | awk 'NR==1{print $1}')
if [ -n "$PG_VER" ]; then
  $SUDO apt-get install -y --no-install-recommends \
    "postgresql-${PG_VER}-pgvector" \
    "postgresql-${PG_VER}-postgis-3" 2>/dev/null \
    && info "pgvector + PostGIS installed for PostgreSQL ${PG_VER}" \
    || warn "Extension packages not found for PostgreSQL ${PG_VER} — some features may be unavailable"
else
  warn "Could not detect PostgreSQL version — skipping extension install"
fi

# Ensure cluster is running
$SUDO systemctl enable --now postgresql

# Create role and database
info "Creating PostgreSQL role '${DB_USER}' and database '${DB_NAME}'..."
$SUDO -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} WITH LOGIN PASSWORD '${DB_PASSWORD}' SUPERUSER;
    RAISE NOTICE 'Role ${DB_USER} created.';
  ELSE
    ALTER ROLE ${DB_USER} WITH PASSWORD '${DB_PASSWORD}';
    RAISE NOTICE 'Role ${DB_USER} already exists — password updated.';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${DB_NAME}')
\gexec
SQL

# Enable required extensions (vector, postgis, pg_trgm)
$SUDO -u postgres psql -d "${DB_NAME}" -v ON_ERROR_STOP=0 <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL
info "PostgreSQL extensions enabled: vector, postgis, pg_trgm"

info "PostgreSQL ready: postgres://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}"

# ── Ollama (optional) ────────────────────────────────────────────────────────
if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
  if command -v ollama &>/dev/null; then
    info "Ollama already installed: $(ollama --version 2>/dev/null || echo 'unknown version')"
  else
    info "Installing Ollama..."
    curl -fsSL https://ollama.com/install.sh | sh
  fi

  # Start Ollama service
  if systemctl is-active --quiet ollama 2>/dev/null; then
    info "Ollama service already running."
  else
    $SUDO systemctl enable --now ollama 2>/dev/null || ollama serve &>/dev/null &
    sleep 2
  fi

  # Pull models
  info "Pulling embedding model: ${OLLAMA_EMBED_MODEL}"
  ollama pull "${OLLAMA_EMBED_MODEL}"

  info "Pulling generation model: ${OLLAMA_GEN_MODEL}"
  info "(This may take several minutes depending on model size and connection speed.)"
  ollama pull "${OLLAMA_GEN_MODEL}"

  info "Ollama ready with models: ${OLLAMA_EMBED_MODEL}, ${OLLAMA_GEN_MODEL}"
else
  warn "Skipping Ollama install (--no-ollama). HotM will start in degraded mode without local inference."
  warn "Configure an external provider in Settings → Admin → Inference after first launch."
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          HotM prerequisites ready (Linux)            ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Database URL:  %-36s║\n" "postgres://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}"
if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
printf "║  Inference:     %-36s║\n" "Ollama (localhost:11434)"
printf "║  Embed model:   %-36s║\n" "${OLLAMA_EMBED_MODEL}"
printf "║  Gen model:     %-36s║\n" "${OLLAMA_GEN_MODEL}"
else
printf "║  Inference:     %-36s║\n" "None (configure post-install)"
fi
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Next step: install HotM from the release page and launch it."
echo "  .deb:      sudo dpkg -i HotM_*.deb"
echo "  AppImage:  chmod +x HotM_*.AppImage && ./HotM_*.AppImage"
echo ""
echo "On first launch HotM will configure itself and connect to Fortemi."
echo "See docs/installation/desktop-linux.md for full instructions."
