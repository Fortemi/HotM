#!/usr/bin/env bash
set -euo pipefail

# One-command bootstrap and run for HotM server (dev)
# Prereqs: postgres client (psql), Rust toolchain, optional Ollama

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

# Check cargo
if ! command -v cargo >/dev/null 2>&1; then
  echo "[ERROR] Rust cargo not found. Install Rust from https://rustup.rs and re-run." >&2
  exit 1
fi

# Check DATABASE_URL
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "[ERROR] Please set DATABASE_URL, e.g.:" >&2
  echo "  export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev" >&2
  exit 1
fi

# Ensure pgvector extension
if ! command -v psql >/dev/null 2>&1; then
  echo "[WARN] psql not found; skipping vector extension check. Ensure 'vector' is installed." >&2
else
  echo "[INFO] Ensuring 'vector' extension exists..."
  psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS vector;" >/dev/null || echo "[WARN] Could not create 'vector' extension; check DB permissions."
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
