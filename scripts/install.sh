#!/usr/bin/env bash
# HotM one-line installer
#
# Bootstraps a fresh Ubuntu/Debian host:
#   1. Preflights apt, sudo/root, architecture, release assets, and PGDG support
#   2. Adds PostgreSQL Global Development Group (PGDG) apt repo for PG 18
#   3. Downloads + verifies the HotM .deb from github.com/Fortemi/HotM
#   4. apt-installs it (postgres + pgvector + libwebkit pulled via Depends/Recommends)
#   5. The .deb postinst seeds the matric DB
#   6. Optionally resets the matric DB when explicitly requested
#   7. Installs Ollama daemon and pulls default models in the background
#   8. Smoke-tests the sidecar against the local DB and reports status
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash
#
#   # Bring Your Own LLM - skip the bundled Ollama install if you already run
#   # llama.cpp, vLLM, or any OpenAI-compatible endpoint. Fortemi is configurable
#   # for any inference backend; see fortemi/README.md for env vars.
#   curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash -s -- --no-ollama
#
# Other flags:
#   ./scripts/install.sh                           # local checkout
#   ./scripts/install.sh --version v2026.5.14      # pin to specific release
#   ./scripts/install.sh --local-deb path/to.deb   # use a developer-built .deb
#   ./scripts/install.sh --skip-models             # install Ollama, skip model pulls
#   ./scripts/install.sh --reset-db                # reset empty matric DB after install
#   ./scripts/install.sh --reset-db --force        # reset even when note data exists
#   ./scripts/install.sh --skip-smoke-test         # skip sidecar probe
#
# Idempotent by default. Destructive work requires explicit flags.

set -euo pipefail

HOTM_VERSION="${HOTM_VERSION:-latest}"
LOCAL_DEB=""
INSTALL_OLLAMA=true
INSTALL_MODELS=true
RESET_DB=false
RESET_DB_FORCE=false
SKIP_SMOKE_TEST=false
OLLAMA_EMBED_MODEL="${HOTM_OLLAMA_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_GEN_MODEL="${HOTM_OLLAMA_GEN_MODEL:-qwen3.5:9b}"
RELEASE_BASE="${HOTM_RELEASE_BASE:-https://github.com/Fortemi/HotM}"
RELEASE_API="${HOTM_RELEASE_API:-https://api.github.com/repos/Fortemi/HotM}"
PGDG_CODENAME="${HOTM_PGDG_CODENAME:-}"
TMPDIR_HOTM="$(mktemp -d -t hotm-install.XXXXXX)"
trap 'rm -rf "${TMPDIR_HOTM}"' EXIT

while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)         HOTM_VERSION="$2";        shift 2 ;;
    --local-deb)       LOCAL_DEB="$2";           shift 2 ;;
    --no-ollama)       INSTALL_OLLAMA=false;     shift ;;
    --skip-models)     INSTALL_MODELS=false;     shift ;;
    --embed-model)     OLLAMA_EMBED_MODEL="$2";  shift 2 ;;
    --gen-model)       OLLAMA_GEN_MODEL="$2";    shift 2 ;;
    --reset-db)        RESET_DB=true;            shift ;;
    --force)           RESET_DB_FORCE=true;      shift ;;
    --skip-smoke-test) SKIP_SMOKE_TEST=true;     shift ;;
    -h|--help)         sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

info()  { printf '\033[0;32m[hotm]\033[0m %s\n' "$*"; }
warn()  { printf '\033[0;33m[hotm]\033[0m %s\n' "$*"; }
error() { printf '\033[0;31m[hotm]\033[0m %s\n' "$*" >&2; exit 1; }

if [[ "$EUID" -eq 0 ]]; then
  SUDO=""
else
  command -v sudo >/dev/null || error "sudo required (or run as root)"
  SUDO="sudo"
fi

run_as_postgres() {
  if [[ "$EUID" -eq 0 ]]; then
    if command -v runuser >/dev/null 2>&1; then
      runuser -u postgres -- "$@"
    else
      su -s /bin/sh - postgres -c "$(printf '%q ' "$@")"
    fi
  else
    sudo -u postgres "$@"
  fi
}

psql_postgres() {
  run_as_postgres psql "$@"
}

preflight() {
  info "HotM Linux installer preflight"
  command -v apt-get >/dev/null || error "Only Debian/Ubuntu (apt) is supported by this installer."
  command -v curl >/dev/null || error "curl is required. Install curl and re-run."
  command -v dpkg >/dev/null || error "dpkg is required."

  ARCH="$(dpkg --print-architecture)"
  case "${ARCH}" in
    amd64) ;;
    arm64) warn "arm64 detected - no .deb published for arm64. Use the AppImage manually."; exit 1 ;;
    *) error "Unsupported architecture: ${ARCH}" ;;
  esac

  if [[ "${RESET_DB}" == "true" ]]; then
    warn "--reset-db requested. This can destroy the local matric database."
    if [[ "${RESET_DB_FORCE}" == "true" ]]; then
      warn "--force supplied: reset will proceed even if note data is present."
    fi
  fi
}

add_pgdg_repo() {
  local source_present=false keyring_present=false codename
  grep -rq "apt.postgresql.org" /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null \
    && source_present=true
  [ -f /etc/apt/keyrings/postgresql.gpg ] && keyring_present=true

  if ${source_present} && ${keyring_present}; then
    info "PGDG apt repo already configured."
    return 0
  fi

  codename="${PGDG_CODENAME:-$(lsb_release -cs 2>/dev/null || true)}"
  [[ -n "${codename}" ]] || error "Could not determine distro codename. Set HOTM_PGDG_CODENAME=noble and re-run."

  if ! curl -fsI "https://apt.postgresql.org/pub/repos/apt/dists/${codename}-pgdg/Release" >/dev/null 2>&1; then
    error "PGDG does not publish for codename '${codename}'.
If this is an Ubuntu derivative, set the upstream codename and re-run, for example:
  HOTM_PGDG_CODENAME=noble ./scripts/install.sh"
  fi

  if ${source_present} && ! ${keyring_present}; then
    info "PGDG source list present but keyring missing - reinstalling key only..."
  else
    info "Adding PostgreSQL Global Development Group (PGDG) apt repo for ${codename}-pgdg..."
  fi

  ${SUDO} apt-get install -y -qq ca-certificates gnupg lsb-release >/dev/null 2>&1
  ${SUDO} install -d -m 0755 /etc/apt/keyrings

  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | ${SUDO} gpg --dearmor --yes -o /etc/apt/keyrings/postgresql.gpg \
    || error "Failed to fetch PGDG signing key"
  ${SUDO} chmod 0644 /etc/apt/keyrings/postgresql.gpg

  if ! ${source_present}; then
    echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt ${codename}-pgdg main" \
      | ${SUDO} tee /etc/apt/sources.list.d/pgdg.list >/dev/null
  fi

  info "Refreshing apt index with PGDG..."
  ${SUDO} apt-get update -qq
}

resolve_version() {
  if [[ -n "${LOCAL_DEB}" ]]; then
    [[ -f "${LOCAL_DEB}" ]] || error "Local .deb not found: ${LOCAL_DEB}"
    HOTM_VERSION="local"
    DEB_NAME="$(basename "${LOCAL_DEB}")"
    DEB_PATH="${LOCAL_DEB}"
    SKIP_DPKG=false
    info "Using local .deb: ${LOCAL_DEB}"
    return 0
  fi

  if [[ "${HOTM_VERSION}" == "latest" ]]; then
    info "Resolving latest HotM release..."
    if command -v jq >/dev/null 2>&1; then
      HOTM_VERSION="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
        "${RELEASE_API}/releases?per_page=20" 2>/dev/null \
        | jq -r '[.[] | select(.draft == false and .prerelease == false
                              and (.tag_name | test("^v[0-9]+\\.[0-9]+\\.[0-9]+$")))
                | .tag_name] | first' 2>/dev/null || true)"
    else
      HOTM_VERSION="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
        "${RELEASE_API}/releases?per_page=20" 2>/dev/null \
        | grep -oP '"tag_name":\s*"\Kv[0-9]+\.[0-9]+\.[0-9]+(?=")' | head -1 || true)"
    fi
    [[ -z "${HOTM_VERSION}" || "${HOTM_VERSION}" == "null" ]] \
      && error "Could not resolve latest version. Try --version vX.Y.Z."
  fi
  info "Target version: ${HOTM_VERSION}"

  DEB_NAME="HotM_${HOTM_VERSION#v}_amd64.deb"
  DEB_URL="${RELEASE_BASE}/releases/download/${HOTM_VERSION}/${DEB_NAME}"
  SUMS_URL="${RELEASE_BASE}/releases/download/${HOTM_VERSION}/SHA256SUMS.txt"
  DEB_PATH="${TMPDIR_HOTM}/${DEB_NAME}"
  SUMS_PATH="${TMPDIR_HOTM}/SHA256SUMS.txt"

  INSTALLED_VER="$(dpkg-query -W -f='${Version}' hot-m 2>/dev/null || true)"
  if [[ -n "${INSTALLED_VER}" && "v${INSTALLED_VER}" == "${HOTM_VERSION}" ]]; then
    info "HotM ${HOTM_VERSION} already installed - skipping deb step."
    SKIP_DPKG=true
  else
    SKIP_DPKG=false
  fi
}

fetch_deb() {
  if [[ "${SKIP_DPKG}" == "true" || -n "${LOCAL_DEB}" ]]; then
    return 0
  fi

  info "Downloading ${DEB_NAME}..."
  curl -fL --progress-bar -o "${DEB_PATH}" "${DEB_URL}" \
    || error "Failed to download ${DEB_URL}"

  info "Downloading SHA256SUMS.txt..."
  if curl -fsSL -o "${SUMS_PATH}" "${SUMS_URL}"; then
    info "Verifying checksum..."
    EXPECTED="$(awk -v target="${DEB_NAME}" '
      {
        n = split($NF, parts, "/");
        if (parts[n] == target) { print $1; exit }
      }
    ' "${SUMS_PATH}")"
    [[ -z "${EXPECTED}" ]] && error "Checksum for ${DEB_NAME} not found in SHA256SUMS.txt"
    ACTUAL="$(sha256sum "${DEB_PATH}" | awk '{print $1}')"
    [[ "${EXPECTED}" != "${ACTUAL}" ]] && error "Checksum mismatch! Expected ${EXPECTED}, got ${ACTUAL}"
    info "Checksum OK"
  else
    warn "SHA256SUMS.txt not available - proceeding without checksum verification."
  fi
}

install_deb() {
  if [[ "${SKIP_DPKG}" == "true" ]]; then
    return 0
  fi
  info "Updating apt index..."
  ${SUDO} apt-get update -qq

  info "Installing HotM .deb (apt resolves Postgres + pgvector + libwebkit)..."
  ${SUDO} apt-get install -y "${DEB_PATH}" \
    || error "apt install failed. Run 'sudo apt-get install -f' to repair."
}

verify_postgres() {
  info "Verifying Postgres setup (postinst should have created matric DB)..."
  ${SUDO} systemctl is-active --quiet postgresql || ${SUDO} systemctl start postgresql
  if psql_postgres -tAc "SELECT 1 FROM pg_database WHERE datname='matric'" | grep -q 1; then
    info "matric database present"
  else
    warn "matric database missing - postinst may have failed. Check 'sudo dpkg-reconfigure hot-m'."
  fi
}

reset_matric_db() {
  [[ "${RESET_DB}" == "true" ]] || return 0
  info "Resetting matric database (--reset-db)..."

  local note_count
  note_count="$(psql_postgres -d matric -tAc 'SELECT count(*) FROM note' 2>/dev/null | tr -d ' ' || echo 0)"
  note_count="${note_count:-0}"
  if [[ "${note_count}" =~ ^[0-9]+$ && "${note_count}" -gt 0 && "${RESET_DB_FORCE}" != "true" ]]; then
    error "Refusing --reset-db: matric.note has ${note_count} rows.
This is destructive. Re-run with --reset-db --force to confirm data loss,
or back up your matric DB first:
  sudo -u postgres pg_dump matric > matric-backup-$(date +%Y%m%d).sql"
  fi

  psql_postgres -d postgres -c 'DROP DATABASE IF EXISTS matric' >/dev/null
  psql_postgres -d postgres -c 'DROP ROLE IF EXISTS matric' >/dev/null
  psql_postgres -d postgres -c "CREATE ROLE matric LOGIN PASSWORD 'matric' CREATEDB" >/dev/null
  psql_postgres -d postgres -c 'CREATE DATABASE matric OWNER matric' >/dev/null
  psql_postgres -d matric <<'SQL' >/dev/null
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
SQL
  info "matric database reset: empty + vector/postgis/pg_trgm/unaccent extensions present"
}

install_ollama() {
  if [[ "${INSTALL_OLLAMA}" != "true" ]]; then
    info "Skipping Ollama (--no-ollama). Configure Fortemi to use your existing inference backend:"
    info "  MATRIC_INFERENCE_DEFAULT=llamacpp   (or openai, vllm, etc.)"
    info "  LLAMACPP_BASE_URL=http://localhost:8080/v1"
    info "  See https://git.integrolabs.net/Fortemi/fortemi#configuration for the full matrix."
    return 0
  fi

  if command -v ollama >/dev/null 2>&1; then
    info "Ollama already installed: $(ollama --version 2>/dev/null | head -1)"
  else
    if getent group ollama >/dev/null 2>&1 && ! id ollama >/dev/null 2>&1; then
      info "Cleaning orphan ollama group from prior install..."
      group_members="$(getent group ollama | cut -d: -f4 | tr ',' ' ')"
      for u in ${group_members}; do
        ${SUDO} gpasswd -d "$u" ollama >/dev/null 2>&1 || true
      done
      ${SUDO} groupdel ollama 2>&1 | grep -vE "primary group|does not exist" || true
    fi

    info "Installing Ollama (curl-piping the official upstream installer)..."
    info "  This downloads from https://ollama.com/install.sh - review at that URL."
    if ! curl -fsSL https://ollama.com/install.sh | sh; then
      warn "Upstream Ollama installer reported a non-zero exit. Verifying state below..."
    fi
  fi

  if id ollama >/dev/null 2>&1; then
    ${SUDO} install -d -m 0755 -o ollama -g ollama /usr/share/ollama 2>/dev/null || true
  fi

  if [ ! -f /etc/systemd/system/ollama.service ]; then
    warn "Ollama upstream installer did not create /etc/systemd/system/ollama.service."
    warn "  This usually means a leftover ollama user or group from a prior install."
    warn "  Try: sudo userdel ollama; sudo groupdel ollama; then re-run this script."
  fi

  if ! systemctl is-active --quiet ollama 2>/dev/null; then
    info "Enabling and starting Ollama service..."
    ${SUDO} systemctl enable --now ollama 2>/dev/null \
      || warn "Could not enable ollama via systemd - try 'ollama serve' manually."
    sleep 2
  fi
}

pull_models() {
  if [[ "${INSTALL_OLLAMA}" != "true" || "${INSTALL_MODELS}" != "true" ]]; then
    info "Skipping model pulls."
    return 0
  fi
  if ! command -v ollama >/dev/null 2>&1; then
    warn "ollama command not found - skipping model pulls."
    return 0
  fi

  LOG_DIR="${HOME}/.local/share/com.hotm.app"
  mkdir -p "${LOG_DIR}"
  PULL_LOG="${LOG_DIR}/ollama-pull.log"

  info "Starting model pulls in background (log: ${PULL_LOG})"
  info "  Embedding: ${OLLAMA_EMBED_MODEL}"
  info "  Generation: ${OLLAMA_GEN_MODEL} (~5 GB, may take 5-15 minutes)"
  (
    echo "=== Pull started $(date -Is) ==="
    ollama pull "${OLLAMA_EMBED_MODEL}" 2>&1
    ollama pull "${OLLAMA_GEN_MODEL}" 2>&1
    echo "=== Pull complete $(date -Is) ==="
  ) >"${PULL_LOG}" 2>&1 &
  info "Background pull PID: $!  (track with: tail -f ${PULL_LOG})"
}

smoke_test_sidecar() {
  if [[ "${SKIP_SMOKE_TEST}" == "true" ]]; then
    return 0
  fi
  local bin="/usr/bin/hotm-matric-api"
  if [[ ! -x "${bin}" ]]; then
    return 0
  fi

  info "Probing hotm-matric-api against existing matric DB (10s smoke test)..."
  local probe_port=33501 probe_log pid
  probe_log="$(mktemp -t hotm-sidecar-smoke.XXXXXX)"

  DATABASE_URL="postgres://matric:matric@localhost:5432/matric" \
  HOST=127.0.0.1 PORT="${probe_port}" RUST_LOG=info \
    "${bin}" >/dev/null 2>"${probe_log}" &
  pid=$!

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    if ! kill -0 "${pid}" 2>/dev/null; then
      break
    fi
    sleep 1
  done
  kill "${pid}" 2>/dev/null || true
  wait "${pid}" 2>/dev/null || true

  if grep -q "was previously applied but has been modified" "${probe_log}"; then
    echo
    warn "Fortemi migration drift detected."
    echo "  The matric database has migrations applied at an older checksum than"
    echo "  the bundled hotm-matric-api expects. HotM will refuse to start until"
    echo "  the database is reset or repaired."
    echo
    echo "  Recovery options:"
    echo "    1. Reset the matric database when safe:"
    echo "         sudo $0 --reset-db"
    echo "       Add --force only after backing up or accepting data loss."
    echo
    echo "    2. Manual backup first:"
    echo "         sudo -u postgres pg_dump matric > matric-backup-$(date +%Y%m%d).sql"
    echo
  elif grep -qiE "error|failed|panic" "${probe_log}"; then
    warn "Sidecar probe reported startup diagnostics. Re-run with: hotm 2>&1"
    tail -40 "${probe_log}" >&2 || true
  else
    info "Sidecar smoke probe completed."
  fi
  rm -f "${probe_log}"
}

report_status() {
  local hotm_status pg_status pg_ver vector_status postgis_status trgm_status unaccent_status ollama_status model_count
  hotm_status="$(dpkg-query -W -f='${Version}' hot-m 2>/dev/null || echo 'NOT INSTALLED')"
  pg_status="$(systemctl is-active postgresql 2>/dev/null || echo 'inactive')"
  pg_ver="$(psql_postgres -tAc 'SHOW server_version' 2>/dev/null | head -1 || true)"
  vector_status="$(psql_postgres -d matric -tAc "SELECT extversion FROM pg_extension WHERE extname='vector'" 2>/dev/null | tr -d ' ' || true)"
  postgis_status="$(psql_postgres -d matric -tAc "SELECT extversion FROM pg_extension WHERE extname='postgis'" 2>/dev/null | tr -d ' ' || true)"
  trgm_status="$(psql_postgres -d matric -tAc "SELECT extversion FROM pg_extension WHERE extname='pg_trgm'" 2>/dev/null | tr -d ' ' || true)"
  unaccent_status="$(psql_postgres -d matric -tAc "SELECT extversion FROM pg_extension WHERE extname='unaccent'" 2>/dev/null | tr -d ' ' || true)"

  if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
    if command -v ollama >/dev/null 2>&1; then
      if curl -sf http://localhost:11434/api/tags --max-time 2 >/dev/null 2>&1; then
        model_count="$(curl -sf http://localhost:11434/api/tags 2>/dev/null | grep -oE '"name":"[^"]+"' | wc -l | tr -d ' ' || true)"
        ollama_status="running, ${model_count:-0} model(s) visible"
      else
        ollama_status="installed, service not responding"
      fi
    else
      ollama_status="not installed"
    fi
  else
    ollama_status="skipped"
  fi

  echo ""
  echo "=================================================================="
  echo "  HotM Installation Status"
  echo "=================================================================="
  printf "  %-12s %s\n" "HotM:" "${hotm_status}"
  printf "  %-12s %s%s\n" "Postgres:" "${pg_status}" "${pg_ver:+ (${pg_ver})}"
  printf "  %-12s vector=%s postgis=%s pg_trgm=%s unaccent=%s\n" "Extensions:" \
    "${vector_status:-MISSING}" "${postgis_status:-MISSING}" "${trgm_status:-MISSING}" "${unaccent_status:-MISSING}"
  printf "  %-12s %s\n" "Ollama:" "${ollama_status}"
  if [[ "${INSTALL_OLLAMA}" == "true" && "${INSTALL_MODELS}" == "true" ]]; then
    printf "  %-12s %s\n" "Models:" "pulling in background - see ~/.local/share/com.hotm.app/ollama-pull.log"
  fi
  echo ""
  echo "Launch HotM:  hotm"
  echo "Logs:         hotm 2>&1 | tee ~/.local/share/com.hotm.app/hotm.log"
  echo "Docs:         ${RELEASE_BASE}/blob/main/docs/installation/desktop-linux.md"
  echo ""
}

main() {
  preflight
  resolve_version
  fetch_deb
  add_pgdg_repo
  install_deb
  verify_postgres
  reset_matric_db
  install_ollama
  pull_models
  smoke_test_sidecar
  report_status
}

main "$@"
