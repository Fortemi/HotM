#!/usr/bin/env bash
# HotM macOS prerequisite setup
# Installs and configures PostgreSQL 18 + extensions, creates the matric
# database, and optionally installs Ollama for local inference. Also
# clears the Gatekeeper quarantine flag on /Applications/HotM.app so the
# first launch does not trip the unsigned-bundle warning.
#
# Usage:
#   ./scripts/setup-macos.sh [--no-ollama] [--db-password PASSWORD]
#                            [--embed-model MODEL] [--gen-model MODEL]
#
# Tested on: macOS 14 Sonoma / 15 Sequoia (Intel + Apple Silicon)

set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
PG_REQUIRED=18
DB_USER="matric"
DB_NAME="matric"
DB_PASSWORD="${HOTM_DB_PASSWORD:-matric}"
INSTALL_OLLAMA=true
OLLAMA_EMBED_MODEL="${HOTM_OLLAMA_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_GEN_MODEL="${HOTM_OLLAMA_GEN_MODEL:-qwen3.5:9b}"
APP_PATH="/Applications/HotM.app"

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
ok()    { echo -e "\033[0;32m[ ok ]\033[0m $*"; }
warn()  { echo -e "\033[0;33m[warn]\033[0m $*"; }
error() { echo -e "\033[0;31m[err ]\033[0m $*" >&2; exit 1; }

echo ""
echo "═══════════════════════════════════════════"
echo "  HotM — macOS prerequisite setup"
echo "═══════════════════════════════════════════"
echo ""

# ── Homebrew ────────────────────────────────────────────────────────────────
# brew may not be on PATH in non-interactive shells (CI, ssh -t, login
# shells where shell init hasn't sourced brew). Probe canonical locations
# before assuming Homebrew is missing.
if ! command -v brew &>/dev/null; then
  for prefix in /opt/homebrew /usr/local; do
    if [[ -x "$prefix/bin/brew" ]]; then
      eval "$("$prefix/bin/brew" shellenv)"
      break
    fi
  done
fi

if ! command -v brew &>/dev/null; then
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  for prefix in /opt/homebrew /usr/local; do
    if [[ -x "$prefix/bin/brew" ]]; then
      eval "$("$prefix/bin/brew" shellenv)"
      break
    fi
  done
fi
command -v brew &>/dev/null || error "Homebrew install failed — install manually from https://brew.sh"
ok "Homebrew at $(command -v brew)"

info "Updating Homebrew..."
brew update --quiet

# ── PostgreSQL ${PG_REQUIRED} + extensions ─────────────────────────────────
echo ""
echo "── PostgreSQL ${PG_REQUIRED} ──"
if brew list "postgresql@${PG_REQUIRED}" &>/dev/null; then
  ok "postgresql@${PG_REQUIRED} already installed"
else
  info "Installing postgresql@${PG_REQUIRED}..."
  brew install "postgresql@${PG_REQUIRED}"
fi

PG_BIN="$(brew --prefix "postgresql@${PG_REQUIRED}")/bin"
export PATH="${PG_BIN}:${PATH}"

# Start PostgreSQL service
if pg_isready -q 2>/dev/null; then
  ok "PostgreSQL is running"
else
  info "Starting PostgreSQL service..."
  brew services start "postgresql@${PG_REQUIRED}" >/dev/null
  # Wait up to 10s for the daemon to accept connections
  for _ in $(seq 1 20); do
    if pg_isready -q 2>/dev/null; then break; fi
    sleep 0.5
  done
  if pg_isready -q 2>/dev/null; then
    ok "PostgreSQL started"
  else
    error "PostgreSQL did not start within 10s — try: brew services restart postgresql@${PG_REQUIRED}"
  fi
fi

# Extensions (pgvector + postgis, plus the bundled pg_trgm/unaccent)
echo ""
echo "── Extensions ──"
for pkg in pgvector postgis; do
  if brew list "$pkg" &>/dev/null; then
    ok "$pkg already installed"
  else
    info "Installing $pkg..."
    brew install "$pkg"
  fi
done

# ── Role + database ────────────────────────────────────────────────────────
echo ""
echo "── Database setup ──"
info "Creating role '${DB_USER}' and database '${DB_NAME}' (idempotent)..."
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
ok "Role + database ready"

# Enable extensions (vector, postgis, pg_trgm, unaccent)
for ext in vector postgis pg_trgm unaccent; do
  if psql -d "${DB_NAME}" -tAc "CREATE EXTENSION IF NOT EXISTS ${ext};" >/dev/null 2>&1; then
    ok "extension '${ext}' enabled"
  else
    warn "could not create extension '${ext}' — multilingual FTS or graph features may be limited"
  fi
done

# Verify password-auth connection works (the path matric-api uses)
if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c 'SELECT 1' &>/dev/null; then
  ok "password-auth connection verified (postgres://${DB_USER}@localhost/${DB_NAME})"
else
  warn "password-auth connection failed — check pg_hba.conf and Homebrew PG default config"
fi

# ── Ollama (optional) ────────────────────────────────────────────────────────
echo ""
echo "── Ollama (local inference) ──"
if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
  if command -v ollama &>/dev/null; then
    ok "Ollama installed: $(ollama --version 2>/dev/null | head -1)"
  else
    info "Installing Ollama via Homebrew..."
    brew install ollama
  fi

  # Start service
  if curl -sf http://localhost:11434/api/tags --max-time 2 &>/dev/null; then
    ok "Ollama is running"
  else
    info "Starting Ollama..."
    brew services start ollama 2>/dev/null || (nohup ollama serve >/dev/null 2>&1 &)
    for _ in $(seq 1 10); do
      if curl -sf http://localhost:11434/api/tags --max-time 2 &>/dev/null; then break; fi
      sleep 0.5
    done
    curl -sf http://localhost:11434/api/tags --max-time 2 &>/dev/null && ok "Ollama started" \
      || warn "Ollama did not respond within 5s — try: brew services restart ollama"
  fi

  # Pull required models (idempotent — Ollama skips if already present)
  info "Pulling embedding model: ${OLLAMA_EMBED_MODEL}"
  ollama pull "${OLLAMA_EMBED_MODEL}"
  info "Pulling generation model: ${OLLAMA_GEN_MODEL}"
  info "(This may take several minutes depending on model size and connection speed.)"
  ollama pull "${OLLAMA_GEN_MODEL}"

  # Show what's actually loaded
  if curl -sf http://localhost:11434/api/tags --max-time 2 2>/dev/null \
      | python3 -c "import sys,json; m=json.load(sys.stdin).get('models',[]); print('\n'.join(f'  - {x[\"name\"]}' for x in m))" \
      2>/dev/null > /tmp/.hotm-ollama-models; then
    ok "Ollama models available:"
    cat /tmp/.hotm-ollama-models
    rm -f /tmp/.hotm-ollama-models
  fi
else
  warn "Skipping Ollama (--no-ollama). HotM will start without local inference."
  warn "Configure an external provider in Admin → Inference after first launch."
fi

# ── Persist PostgreSQL bin in shell profile ────────────────────────────────
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
    info "Added PostgreSQL bin to PATH in ${SHELL_PROFILE}"
  fi
fi

# ── Gatekeeper unquarantine ────────────────────────────────────────────────
echo ""
echo "── Gatekeeper ──"
if [[ -d "${APP_PATH}" ]]; then
  if xattr -cr "${APP_PATH}" 2>/dev/null; then
    ok "cleared quarantine flag on ${APP_PATH}"
  else
    warn "could not clear quarantine — run manually: sudo xattr -cr \"${APP_PATH}\""
  fi
else
  info "${APP_PATH} not yet present — skip Gatekeeper step"
  info "After installing from the DMG, run: xattr -cr \"${APP_PATH}\""
fi

# ── Verification summary ───────────────────────────────────────────────────
echo ""
PG_STATE="not running"
if pg_isready -q 2>/dev/null; then PG_STATE="running"; fi

DB_STATE="not connected"
if PGPASSWORD="${DB_PASSWORD}" psql -h localhost -U "${DB_USER}" -d "${DB_NAME}" -c 'SELECT 1' &>/dev/null; then
  DB_STATE="${DB_NAME} (auth ok)"
fi

EXT_STATE=$(psql -d "${DB_NAME}" -tAc "SELECT string_agg(extname, ',' ORDER BY extname) FROM pg_extension WHERE extname IN ('vector','postgis','pg_trgm','unaccent');" 2>/dev/null | tr -d ' ' || echo "(unknown)")

OLLAMA_STATE="not running"
OLLAMA_MODELS=""
if curl -sf http://localhost:11434/api/tags --max-time 2 &>/dev/null; then
  OLLAMA_STATE="running"
  OLLAMA_MODELS=$(curl -sf http://localhost:11434/api/tags --max-time 2 \
    | python3 -c "import sys,json; m=json.load(sys.stdin).get('models',[]); print(', '.join(x['name'] for x in m))" 2>/dev/null || echo "")
fi

GK_STATE="(app not installed yet)"
if [[ -d "${APP_PATH}" ]]; then
  GK_STATE="quarantine cleared"
fi

echo "╔══════════════════════════════════════════════════════════╗"
echo "║          HotM prerequisites ready (macOS)                ║"
echo "╠══════════════════════════════════════════════════════════╣"
printf "║  PostgreSQL:    %-40s║\n" "${PG_STATE} (v${PG_REQUIRED})"
printf "║  Database:      %-40s║\n" "${DB_STATE}"
printf "║  Extensions:    %-40s║\n" "${EXT_STATE:-(none enabled)}"
if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
printf "║  Ollama:        %-40s║\n" "${OLLAMA_STATE}"
printf "║  Models:        %-40s║\n" "${OLLAMA_MODELS:-(none yet)}"
else
printf "║  Inference:     %-40s║\n" "deferred (configure post-install)"
fi
printf "║  Gatekeeper:    %-40s║\n" "${GK_STATE}"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Next step:"
echo "  1. Open the HotM DMG from the release page"
echo "  2. Drag HotM.app to /Applications"
echo "  3. If prompted by Gatekeeper, re-run this script (or:"
echo "       xattr -cr \"${APP_PATH}\" )"
echo "  4. Launch HotM from Launchpad — it will configure itself on first run"
echo ""
echo "See docs/installation/desktop-macos.md for full details."
