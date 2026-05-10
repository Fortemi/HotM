#!/usr/bin/env bash
# HotM one-line installer
#
# Bootstraps a fresh Ubuntu/Debian host:
#   1. Downloads + verifies the latest .deb from github.com/Fortemi/HotM
#   2. apt-installs it (postgres + pgvector + libwebkit pulled via Depends/Recommends)
#   3. .deb postinst seeds the matric DB
#   4. Installs Ollama daemon (curl|sh — official upstream, not an apt package)
#   5. Pulls embedding + generation models in the background
#   6. Verifies and reports
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash
#
#   # Bring Your Own LLM — skip the bundled Ollama install if you already run
#   # llama.cpp, vLLM, or any OpenAI-compatible endpoint. Fortemi is configurable
#   # for any inference backend; see fortemi/README.md for env vars.
#   curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash -s -- --no-ollama
#
# Other flags:
#   ./scripts/install.sh                          # local checkout
#   ./scripts/install.sh --version v2026.5.3      # pin to specific release
#   ./scripts/install.sh --skip-models            # install Ollama, skip model pulls
#
# Idempotent — re-running is safe.

set -euo pipefail

# ── Defaults ────────────────────────────────────────────────────────────────
HOTM_VERSION="${HOTM_VERSION:-latest}"          # `latest` or `v2026.5.1`
LOCAL_DEB=""                                    # path to local .deb (skips download)
INSTALL_OLLAMA=true
INSTALL_MODELS=true
OLLAMA_EMBED_MODEL="${HOTM_OLLAMA_EMBED_MODEL:-nomic-embed-text}"
OLLAMA_GEN_MODEL="${HOTM_OLLAMA_GEN_MODEL:-qwen3.5:9b}"
# Public release host. Internal users can override via HOTM_RELEASE_BASE / HOTM_RELEASE_API.
RELEASE_BASE="${HOTM_RELEASE_BASE:-https://github.com/Fortemi/HotM}"
RELEASE_API="${HOTM_RELEASE_API:-https://api.github.com/repos/Fortemi/HotM}"
TMPDIR_HOTM="$(mktemp -d -t hotm-install.XXXXXX)"
trap 'rm -rf "${TMPDIR_HOTM}"' EXIT

# ── Argument parsing ────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --version)      HOTM_VERSION="$2";        shift 2 ;;
    --local-deb)    LOCAL_DEB="$2";           shift 2 ;;
    --no-ollama)    INSTALL_OLLAMA=false;     shift ;;
    --skip-models)  INSTALL_MODELS=false;     shift ;;
    --embed-model)  OLLAMA_EMBED_MODEL="$2";  shift 2 ;;
    --gen-model)    OLLAMA_GEN_MODEL="$2";    shift 2 ;;
    -h|--help)      sed -n '2,/^$/p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ── Logging helpers ─────────────────────────────────────────────────────────
info()  { printf '\033[0;32m[hotm]\033[0m %s\n' "$*"; }
warn()  { printf '\033[0;33m[hotm]\033[0m %s\n' "$*"; }
error() { printf '\033[0;31m[hotm]\033[0m %s\n' "$*" >&2; exit 1; }

# ── Privilege escalation ────────────────────────────────────────────────────
if [[ "$EUID" -eq 0 ]]; then
  SUDO=""
else
  command -v sudo >/dev/null || error "sudo required (or run as root)"
  SUDO="sudo"
fi

# ── Platform detection ──────────────────────────────────────────────────────
command -v apt-get >/dev/null || error "Only Debian/Ubuntu (apt) is supported by this installer."

ARCH="$(dpkg --print-architecture)"
case "${ARCH}" in
  amd64)  ;;
  arm64)  warn "arm64 detected — no .deb published for arm64. Use the AppImage manually." ; exit 1 ;;
  *)      error "Unsupported architecture: ${ARCH}" ;;
esac

# ── PGDG repo (PostgreSQL 18 not in Ubuntu/Debian default repos) ────────────
# HotM hard-depends on postgresql-18, which only PGDG ships at the moment.
# Idempotent: if the repo is already configured, skip.
add_pgdg_repo() {
  if grep -rq "apt.postgresql.org" /etc/apt/sources.list /etc/apt/sources.list.d/ 2>/dev/null; then
    info "PGDG apt repo already configured."
    return 0
  fi

  info "Adding PostgreSQL Global Development Group (PGDG) apt repo..."
  ${SUDO} apt-get install -y -qq ca-certificates gnupg lsb-release >/dev/null 2>&1
  ${SUDO} install -d -m 0755 /etc/apt/keyrings

  curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    | ${SUDO} gpg --dearmor --yes -o /etc/apt/keyrings/postgresql.gpg \
    || error "Failed to fetch PGDG signing key"
  ${SUDO} chmod 0644 /etc/apt/keyrings/postgresql.gpg

  CODENAME="$(lsb_release -cs)"
  # PGDG publishes per-codename releases; verify before writing the source.
  if ! curl -fsI "https://apt.postgresql.org/pub/repos/apt/dists/${CODENAME}-pgdg/Release" >/dev/null 2>&1; then
    error "PGDG does not publish for codename '${CODENAME}'. See https://apt.postgresql.org/pub/repos/apt/dists/ for supported distros."
  fi
  echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
    | ${SUDO} tee /etc/apt/sources.list.d/pgdg.list >/dev/null

  info "Refreshing apt index with PGDG..."
  ${SUDO} apt-get update -qq
}

add_pgdg_repo

# ── Local .deb shortcut ─────────────────────────────────────────────────────
# When a local .deb is provided, skip Gitea version resolution and download.
# This is the path used for pre-release validation (developer-built .deb).
if [[ -n "${LOCAL_DEB}" ]]; then
  [[ -f "${LOCAL_DEB}" ]] || error "Local .deb not found: ${LOCAL_DEB}"
  HOTM_VERSION="local"
  DEB_NAME="$(basename "${LOCAL_DEB}")"
  DEB_PATH="${LOCAL_DEB}"
  SKIP_DPKG=false
  info "Using local .deb: ${LOCAL_DEB}"
fi

# ── Resolve target version ──────────────────────────────────────────────────
# Use the GitHub releases API and filter for semver tags (vYYYY.M.PATCH).
# Both the github.com and api.github.com paths support unauthenticated GETs;
# we don't burn rate limit on a single install run.
if [[ -z "${LOCAL_DEB}" && "${HOTM_VERSION}" == "latest" ]]; then
  info "Resolving latest HotM release..."
  if command -v jq >/dev/null 2>&1; then
    HOTM_VERSION="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
      "${RELEASE_API}/releases?per_page=20" 2>/dev/null \
      | jq -r '[.[] | select(.draft == false and .prerelease == false
                            and (.tag_name | test("^v[0-9]+\\.[0-9]+\\.[0-9]+$")))
              | .tag_name] | first' 2>/dev/null || true)"
  else
    # jq fallback: parse JSON with grep — fragile but works without deps
    HOTM_VERSION="$(curl -fsSL -H 'Accept: application/vnd.github+json' \
      "${RELEASE_API}/releases?per_page=20" 2>/dev/null \
      | grep -oP '"tag_name":\s*"\Kv[0-9]+\.[0-9]+\.[0-9]+(?=")' | head -1 || true)"
  fi
  [[ -z "${HOTM_VERSION}" || "${HOTM_VERSION}" == "null" ]] \
    && error "Could not resolve latest version. Try --version vX.Y.Z."
fi
info "Target version: ${HOTM_VERSION}"

if [[ -z "${LOCAL_DEB}" ]]; then
  DEB_NAME="HotM_${HOTM_VERSION#v}_amd64.deb"
  DEB_URL="${RELEASE_BASE}/releases/download/${HOTM_VERSION}/${DEB_NAME}"
  SUMS_URL="${RELEASE_BASE}/releases/download/${HOTM_VERSION}/SHA256SUMS.txt"

  # ── Download .deb + verify checksum ──────────────────────────────────────
  DEB_PATH="${TMPDIR_HOTM}/${DEB_NAME}"
  SUMS_PATH="${TMPDIR_HOTM}/SHA256SUMS.txt"

  # Skip download if already-installed version matches.
  # Package name is `hot-m` (tauri-bundler kebab-cases productName "HotM").
  INSTALLED_VER="$(dpkg-query -W -f='${Version}' hot-m 2>/dev/null || true)"
  if [[ -n "${INSTALLED_VER}" && "v${INSTALLED_VER}" == "${HOTM_VERSION}" ]]; then
    info "HotM ${HOTM_VERSION} already installed — skipping deb step."
    SKIP_DPKG=true
  else
    SKIP_DPKG=false
    info "Downloading ${DEB_NAME}..."
    curl -fL --progress-bar -o "${DEB_PATH}" "${DEB_URL}" \
      || error "Failed to download ${DEB_URL}"

    info "Downloading SHA256SUMS.txt..."
    if curl -fsSL -o "${SUMS_PATH}" "${SUMS_URL}"; then
      info "Verifying checksum..."
      # SHA256SUMS.txt entries may use either bare filename or full build path
      # (e.g. "ui/src-tauri/target/release/bundle/deb/HotM_2026.5.1_amd64.deb").
      # awk against $NF tolerates both formats and is pipefail-safe (grep|awk
      # would abort with set -e if grep finds no match).
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
      warn "SHA256SUMS.txt not available — proceeding without checksum verification."
    fi
  fi
fi

# ── Install via apt (handles dependencies) ──────────────────────────────────
if [[ "${SKIP_DPKG}" != "true" ]]; then
  info "Updating apt index..."
  ${SUDO} apt-get update -qq

  info "Installing HotM .deb (apt resolves Postgres + pgvector + libwebkit)..."
  # apt-get install with local file path resolves Depends + Recommends from the .deb's control file
  ${SUDO} apt-get install -y "${DEB_PATH}" \
    || error "apt install failed. Run 'sudo apt-get install -f' to repair."
fi

# ── Verify Postgres + matric DB ─────────────────────────────────────────────
info "Verifying Postgres setup (postinst should have created matric DB)..."
${SUDO} systemctl is-active --quiet postgresql || ${SUDO} systemctl start postgresql
if ${SUDO} -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='matric'" | grep -q 1; then
  info "matric database present"
else
  warn "matric database missing — postinst may have failed. Check 'sudo dpkg-reconfigure hot-m'."
fi

# ── Ollama (optional) ───────────────────────────────────────────────────────
if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
  if command -v ollama >/dev/null 2>&1; then
    info "Ollama already installed: $(ollama --version 2>/dev/null | head -1)"
  else
    info "Installing Ollama (curl-piping the official upstream installer)..."
    info "  This downloads from https://ollama.com/install.sh — review at that URL."
    curl -fsSL https://ollama.com/install.sh | sh
  fi

  # Ollama's upstream installer skips data-dir creation when the `ollama`
  # system user already exists from a prior install. If we re-install onto a
  # box where /usr/share/ollama was wiped manually, the service then fails to
  # start with "could not create directory mkdir /usr/share/ollama: permission
  # denied". Idempotent fix: ensure the dir exists with ollama:ollama
  # ownership before enabling the service.
  if id ollama >/dev/null 2>&1; then
    ${SUDO} install -d -m 0755 -o ollama -g ollama /usr/share/ollama 2>/dev/null || true
  fi

  if ! systemctl is-active --quiet ollama 2>/dev/null; then
    info "Enabling and starting Ollama service..."
    ${SUDO} systemctl enable --now ollama 2>/dev/null \
      || warn "Could not enable ollama via systemd — try 'ollama serve' manually."
    sleep 2
  fi

  if [[ "${INSTALL_MODELS}" == "true" ]]; then
    # Pull models in background — they're large (5-20 GB) and we don't want to block.
    LOG_DIR="${HOME}/.local/share/com.hotm.app"
    mkdir -p "${LOG_DIR}"
    PULL_LOG="${LOG_DIR}/ollama-pull.log"

    info "Starting model pulls in background (log: ${PULL_LOG})"
    info "  Embedding: ${OLLAMA_EMBED_MODEL}"
    info "  Generation: ${OLLAMA_GEN_MODEL} (~5 GB, may take 5-15 minutes)"
    (
      echo "=== Pull started $(date -Is) ==="
      ollama pull "${OLLAMA_EMBED_MODEL}" 2>&1
      ollama pull "${OLLAMA_GEN_MODEL}"   2>&1
      echo "=== Pull complete $(date -Is) ==="
    ) >"${PULL_LOG}" 2>&1 &
    info "Background pull PID: $!  (track with: tail -f ${PULL_LOG})"
  fi
else
  info "Skipping Ollama (--no-ollama). Configure Fortemi to use your existing inference backend:"
  info "  MATRIC_INFERENCE_DEFAULT=llamacpp   (or openai, vllm, etc.)"
  info "  LLAMACPP_BASE_URL=http://localhost:8080/v1"
  info "  See https://git.integrolabs.net/Fortemi/fortemi#configuration for the full matrix."
fi

# ── Final verification ──────────────────────────────────────────────────────
# Resolve status values BEFORE printf — nested quote escaping inside $()
# inside "..." word-splits SQL on whitespace and produces fake "missing" reports.
HOTM_STATUS="$(dpkg-query -W -f='${Version}' hot-m 2>/dev/null || echo 'NOT INSTALLED')"
PG_STATUS="$(systemctl is-active postgresql 2>/dev/null || echo 'inactive')"
PGVEC_STATUS="$(${SUDO} -u postgres psql -d matric -tAc "SELECT extname FROM pg_extension WHERE extname='vector'" 2>/dev/null | grep -q vector && echo 'enabled' || echo 'missing')"
OLLAMA_STATUS="$(systemctl is-active ollama 2>/dev/null || echo 'inactive')"

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                    HotM Installation Status                      ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
printf "║  HotM:        %-50s║\n" "${HOTM_STATUS}"
printf "║  Postgres:    %-50s║\n" "${PG_STATUS}"
printf "║  pgvector:    %-50s║\n" "${PGVEC_STATUS}"
if [[ "${INSTALL_OLLAMA}" == "true" ]]; then
printf "║  Ollama:      %-50s║\n" "${OLLAMA_STATUS}"
printf "║  Models:      %-50s║\n" "pulling in background — see ollama-pull.log"
else
printf "║  Ollama:      %-50s║\n" "skipped"
fi
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "Launch HotM:  hotm"
echo "Logs:         hotm 2>&1 | tee ~/.local/share/com.hotm.app/hotm.log"
echo "Docs:         ${RELEASE_BASE}/blob/main/docs/installation/desktop-linux.md"
echo ""
