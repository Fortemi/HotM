#!/bin/sh
# HotM .deb postinst — runs as root via dpkg after package unpacking.
#
# Responsibilities (idempotent):
#   1. Detect active Postgres cluster version
#   2. Install matching postgresql-NN-pgvector if missing
#   3. Create `matric` role + `matric` database
#   4. Enable extensions: vector, postgis, pg_trgm
#
# Ollama is intentionally NOT installed here — see scripts/install.sh.
# Network access in postinst breaks unattended-upgrades and adds long latency
# (model pulls take 5-20 minutes). Postinst should complete in seconds.
#
# Standard dpkg postinst hooks: configure | abort-upgrade | abort-remove | abort-deconfigure
# We only act on `configure` (fresh install, upgrade, or reconfigure).

set -e

ACTION="$1"

case "${ACTION}" in
  configure) ;;
  abort-upgrade|abort-remove|abort-deconfigure) exit 0 ;;
  *) echo "postinst called with unknown action: ${ACTION}" >&2; exit 1 ;;
esac

# ── Logging ────────────────────────────────────────────────────────────────
log() { echo "[hotm-postinst] $*"; }
warn() { echo "[hotm-postinst] WARN: $*" >&2; }

# ── Postgres readiness ─────────────────────────────────────────────────────
if ! command -v psql >/dev/null 2>&1; then
  warn "psql not found — Postgres dependency apparently missing. Skipping DB setup."
  warn "Run 'sudo /usr/share/hotm/postinst-redo.sh' once Postgres is installed."
  exit 0
fi

# Ensure cluster is running (apt may have left it stopped on fresh install)
if command -v systemctl >/dev/null 2>&1; then
  systemctl is-active --quiet postgresql || systemctl start postgresql || true
  # Wait briefly for cluster to accept connections
  for i in 1 2 3 4 5; do
    su - postgres -c "psql -tAc 'SELECT 1'" >/dev/null 2>&1 && break
    sleep 1
  done
fi

# ── Detect cluster version + install pgvector if missing ───────────────────
PG_VER=""
if command -v pg_lsclusters >/dev/null 2>&1; then
  PG_VER="$(pg_lsclusters --no-header 2>/dev/null | awk 'NR==1{print $1}')"
fi

if [ -n "${PG_VER}" ]; then
  log "Detected Postgres cluster version ${PG_VER}"

  # Recommends: declares pgvector alternatives but apt only picks ONE if any match.
  # If our cluster version isn't covered by Recommends, install the matching one now.
  PGVEC_PKG="postgresql-${PG_VER}-pgvector"
  if ! dpkg -s "${PGVEC_PKG}" >/dev/null 2>&1; then
    log "Installing ${PGVEC_PKG}..."
    apt-get install -y --no-install-recommends "${PGVEC_PKG}" 2>&1 \
      || warn "${PGVEC_PKG} not available — semantic search will fall back to FTS only."
  fi
else
  warn "Could not detect Postgres cluster version. Skipping pgvector install."
fi

# ── Create matric role + database (idempotent) ─────────────────────────────
log "Creating matric role + database..."
su - postgres -c "psql -v ON_ERROR_STOP=1" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'matric') THEN
    CREATE ROLE matric WITH LOGIN PASSWORD 'matric' SUPERUSER;
    RAISE NOTICE 'Created matric role';
  ELSE
    RAISE NOTICE 'matric role exists — leaving password unchanged';
  END IF;
END
$$;

SELECT 'CREATE DATABASE matric OWNER matric'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'matric')\gexec
SQL

# ── Enable extensions (best-effort; missing ones become non-fatal warnings) ─
log "Enabling extensions: vector, postgis, pg_trgm..."
su - postgres -c "psql -d matric -v ON_ERROR_STOP=0" <<'SQL' || true
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL

# Report which extensions are actually enabled
ENABLED="$(su - postgres -c "psql -d matric -tAc \"SELECT string_agg(extname, ', ') FROM pg_extension WHERE extname IN ('vector','postgis','pg_trgm')\"" 2>/dev/null | tr -d ' ')"
log "Extensions enabled: ${ENABLED:-(none)}"

log "Postgres setup complete: postgres://matric:matric@localhost/matric"
log "Note: Ollama must be installed separately. See: scripts/install.sh"

exit 0
