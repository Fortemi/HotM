#!/usr/bin/env bash
# Canonical HotM Postgres bootstrap.
#
# Shared by:
#   - .deb postinst (ui/src-tauri/scripts/postinst.sh) — runs as root, peer auth
#   - hotm CLI bootstrap mode (`hotm --bootstrap`) — runs as user, env DATABASE_URL or peer
#   - First-run setup wizard (planned, see issue #222)
#
# Idempotent. Safe to re-run after partial setup or a Postgres major upgrade.
#
# Mode selection:
#   - DATABASE_URL set + accepts CREATEDB/SUPERUSER work → use it directly
#   - Otherwise → fall back to peer auth as the `postgres` shell user
#                 (requires root or sudo to switch user)
#
# Exit codes:
#   0  success (everything seeded, or already present)
#   1  hard failure (no usable connection path, uuidv7 missing, etc.)
#   2  partial — role/db OK but one or more extensions unavailable
#                (semantic search degrades gracefully to FTS-only)

set -e

# ── Logging ────────────────────────────────────────────────────────────────
log() { echo "[hotm-bootstrap] $*"; }
warn() { echo "[hotm-bootstrap] WARN: $*" >&2; }
err()  { echo "[hotm-bootstrap] ERROR: $*" >&2; }

# ── Configuration ──────────────────────────────────────────────────────────
MATRIC_ROLE="${HOTM_MATRIC_ROLE:-matric}"
MATRIC_DB="${HOTM_MATRIC_DB:-matric}"
MATRIC_PASSWORD="${HOTM_MATRIC_PASSWORD:-matric}"
# Extensions the canonical fortemi migration set requires
EXTENSIONS="${HOTM_EXTENSIONS:-vector postgis pg_trgm unaccent}"
# Optional override: caller supplies a connection string with CREATEDB/SUPERUSER
DATABASE_URL="${DATABASE_URL:-}"

# ── Connection strategy ────────────────────────────────────────────────────
# Returns: writes the shell command(s) used for psql invocations to globals
#   PSQL_ADMIN     — runs psql as a superuser to template1/postgres for role+db creation
#   PSQL_MATRIC    — runs psql -d matric as a superuser for extension creation
detect_connection() {
  if [ -n "${DATABASE_URL}" ]; then
    if ! command -v psql >/dev/null 2>&1; then
      err "psql not found; cannot use DATABASE_URL path."
      return 1
    fi
    # User supplied a URL — assume it's already a superuser/CREATEDB connection
    # to the admin db (typically postgres). matric DB connection swaps the db part.
    PSQL_ADMIN=(psql "${DATABASE_URL}")
    # Strip any trailing /dbname and append /matric
    local base_url="${DATABASE_URL%/*}"
    PSQL_MATRIC=(psql "${base_url}/${MATRIC_DB}")
    log "Using DATABASE_URL for bootstrap"
    return 0
  fi

  # Peer auth path: must be root (or able to su to postgres)
  if ! command -v psql >/dev/null 2>&1; then
    err "psql not found and DATABASE_URL not set; cannot bootstrap."
    return 1
  fi

  # Require root for `su - postgres` to work non-interactively
  if [ "$(id -u)" -ne 0 ]; then
    err "Not root and DATABASE_URL not set; cannot switch to postgres user."
    err "Either run as root (sudo) or set DATABASE_URL=postgres://superuser:pw@host/postgres"
    return 1
  fi

  PSQL_ADMIN=(su - postgres -c "psql -v ON_ERROR_STOP=1")
  PSQL_MATRIC=(su - postgres -c "psql -d ${MATRIC_DB} -v ON_ERROR_STOP=0")
  log "Using peer auth as postgres user"
  return 0
}

# Helper: run a heredoc through PSQL_ADMIN regardless of whether it's a su-c
# wrapper or a direct psql call. The su-c form takes its SQL on stdin too, so
# this works uniformly.
psql_admin_sql() {
  "${PSQL_ADMIN[@]}"
}

psql_matric_sql() {
  "${PSQL_MATRIC[@]}"
}

# ── Wait for cluster to accept connections ─────────────────────────────────
wait_for_cluster() {
  if command -v systemctl >/dev/null 2>&1 && [ "$(id -u)" -eq 0 ]; then
    systemctl is-active --quiet postgresql || systemctl start postgresql || true
  fi
  for _ in 1 2 3 4 5; do
    if psql_admin_sql <<<"SELECT 1" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  warn "Postgres did not respond within 5s; continuing — admin SQL may fail."
}

# ── Cluster version + matching pgvector package (postinst path only) ───────
maybe_install_pgvector_pkg() {
  # Only attempt when running as root via apt — sidecar/CLI paths skip this
  [ "$(id -u)" -eq 0 ] || return 0
  command -v apt-get >/dev/null 2>&1 || return 0
  command -v pg_lsclusters >/dev/null 2>&1 || return 0

  local pg_ver
  pg_ver="$(pg_lsclusters --no-header 2>/dev/null | awk 'NR==1{print $1}')"
  [ -n "${pg_ver}" ] || { warn "No Postgres cluster detected; skipping pgvector pkg install."; return 0; }

  log "Detected Postgres cluster version ${pg_ver}"
  local pkg="postgresql-${pg_ver}-pgvector"
  if ! dpkg -s "${pkg}" >/dev/null 2>&1; then
    log "Installing ${pkg}..."
    apt-get install -y --no-install-recommends "${pkg}" 2>&1 \
      || warn "${pkg} not available — semantic search will fall back to FTS only."
  fi
}

# ── Role + database (idempotent) ───────────────────────────────────────────
create_role_and_db() {
  log "Ensuring ${MATRIC_ROLE} role and ${MATRIC_DB} database..."
  psql_admin_sql <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${MATRIC_ROLE}') THEN
    CREATE ROLE ${MATRIC_ROLE} WITH LOGIN PASSWORD '${MATRIC_PASSWORD}' SUPERUSER;
    RAISE NOTICE 'Created ${MATRIC_ROLE} role';
  ELSE
    RAISE NOTICE '${MATRIC_ROLE} role exists — leaving password unchanged';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${MATRIC_DB} OWNER ${MATRIC_ROLE}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${MATRIC_DB}')\gexec
SQL
}

# ── Extensions (best-effort) ───────────────────────────────────────────────
# Returns 0 on full success, 2 if any extension failed.
enable_extensions() {
  log "Enabling extensions: ${EXTENSIONS}..."
  local sql=""
  for ext in ${EXTENSIONS}; do
    sql+="CREATE EXTENSION IF NOT EXISTS ${ext};"$'\n'
  done

  # ON_ERROR_STOP=0 so a missing extension doesn't abort the whole transaction
  echo "${sql}" | psql_matric_sql || true

  # Report which extensions are actually enabled
  local enabled
  enabled="$(echo "SELECT string_agg(extname, ', ') FROM pg_extension WHERE extname IN ('vector','postgis','pg_trgm','unaccent')" \
    | psql_matric_sql -tA 2>/dev/null | tr -d ' ' || true)"
  log "Extensions enabled: ${enabled:-(none)}"

  # Did we get them all?
  local missing=0
  for ext in ${EXTENSIONS}; do
    case ",${enabled}," in
      *",${ext},"*) ;;
      *) missing=1 ;;
    esac
  done
  return $(( missing == 0 ? 0 : 2 ))
}

# ── uuidv7() availability check (PG18+ built-in) ───────────────────────────
check_uuidv7() {
  if echo "SELECT uuidv7()" | psql_matric_sql -tA >/dev/null 2>&1; then
    log "uuidv7() built-in available"
    return 0
  fi
  err "uuidv7() not available — Postgres 18 is required."
  err "matric-api migrations will fail. Install postgresql-18 from PGDG."
  return 1
}

# ── Main ────────────────────────────────────────────────────────────────────
main() {
  detect_connection || return 1
  maybe_install_pgvector_pkg
  wait_for_cluster
  create_role_and_db
  local ext_rc=0
  enable_extensions || ext_rc=$?
  check_uuidv7 || return 1
  log "Bootstrap complete: postgres://${MATRIC_ROLE}:${MATRIC_PASSWORD}@localhost/${MATRIC_DB}"
  return ${ext_rc}
}

# When sourced (e.g. by postinst), only define functions and return.
# When executed directly (CLI / wizard), run main.
if [ "${BASH_SOURCE[0]:-$0}" = "${0}" ]; then
  main "$@"
fi
