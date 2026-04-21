#!/usr/bin/env bash
# HotM macOS prerequisite setup
# Installs and configures PostgreSQL (via Homebrew), creates the matric database,
# and optionally installs Ollama for local inference.
#
# Usage:
#   ./scripts/setup-macos.sh [--no-ollama] [--db-password PASSWORD]
#
# Tested on: macOS 14 Sonoma / 15 Sequoia (Intel + Apple Silicon)

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

# ── Homebrew ────────────────────────────────────────────────────────────────
if ! command -v brew &>/dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Add brew to PATH for Apple Silicon
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
fi

info "Updating Homebrew..."
brew update --quiet

# ── PostgreSQL ───────────────────────────────────────────────────────────────
PG_VERSION="17"
info "Installing PostgreSQL ${PG_VERSION}..."
brew install "postgresql@${PG_VERSION}" pgvector 2>/dev/null || \
  brew install "postgresql@${PG_VERSION}"

PG_BIN="$(brew --prefix postgresql@${PG_VERSION})/bin"
export PATH="${PG_BIN}:${PATH}"

# Start PostgreSQL service
brew services start "postgresql@${PG_VERSION}"
sleep 2

# Create role and database
info "Creating PostgreSQL role '${DB_USER}' and database '${DB_NAME}'..."
psql postgres -v ON_ERROR_STOP=1 <<SQL
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

# Enable pgvector
psql -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || \
  warn "pgvector not available — semantic search will be limited. Install via: brew install pgvector"

info "PostgreSQL ready: postgres://${DB_USER}:${DB_PASSWORD}@localhost/${DB_NAME}"

# ── Ollama (optional) ────────────────────────────────────────────────────────
if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
  if command -v ollama &>/dev/null; then
    info "Ollama already installed."
  else
    info "Installing Ollama via Homebrew..."
    brew install ollama
  fi

  info "Starting Ollama..."
  brew services start ollama 2>/dev/null || ollama serve &>/dev/null &
  sleep 3

  info "Pulling embedding model: ${OLLAMA_EMBED_MODEL}"
  ollama pull "${OLLAMA_EMBED_MODEL}"

  info "Pulling generation model: ${OLLAMA_GEN_MODEL}"
  info "(This may take several minutes.)"
  ollama pull "${OLLAMA_GEN_MODEL}"

  info "Ollama ready."
else
  warn "Skipping Ollama (--no-ollama). HotM will start in degraded mode."
  warn "Configure an external provider in Settings → Admin → Inference after first launch."
fi

# Persist PostgreSQL bin in shell profile
SHELL_PROFILE=""
if [[ -f "${HOME}/.zshrc" ]]; then
  SHELL_PROFILE="${HOME}/.zshrc"
elif [[ -f "${HOME}/.bash_profile" ]]; then
  SHELL_PROFILE="${HOME}/.bash_profile"
fi

if [[ -n "${SHELL_PROFILE}" ]]; then
  PG_PATH_LINE="export PATH=\"${PG_BIN}:\$PATH\""
  if ! grep -qF "${PG_PATH_LINE}" "${SHELL_PROFILE}" 2>/dev/null; then
    echo "${PG_PATH_LINE}" >> "${SHELL_PROFILE}"
    info "Added PostgreSQL to PATH in ${SHELL_PROFILE}"
  fi
fi

# ── Summary ──────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          HotM prerequisites ready (macOS)            ║"
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
echo "Next step: open the HotM DMG from the release page and drag to /Applications."
echo "See docs/installation/desktop-macos.md for full instructions."
