#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FORTEMI_DIR="${FORTEMI_DIR:-$(cd "${ROOT_DIR}/.." && pwd)/fortemi}"
SIDE_CAR_SRC="${FORTEMI_DIR}/target/release/matric-api"
SIDE_CAR_DST="${ROOT_DIR}/ui/src-tauri/binaries/hotm-matric-api-x86_64-unknown-linux-gnu"

if [[ ! -d "${FORTEMI_DIR}" ]]; then
  echo "Fortemi checkout not found: ${FORTEMI_DIR}" >&2
  echo "Set FORTEMI_DIR=/path/to/fortemi and retry." >&2
  exit 1
fi

echo "Building Fortemi sidecar from ${FORTEMI_DIR}..."
cargo build --manifest-path "${FORTEMI_DIR}/Cargo.toml" --release -p matric-api

mkdir -p "$(dirname "${SIDE_CAR_DST}")"
cp "${SIDE_CAR_SRC}" "${SIDE_CAR_DST}"

echo "Updated HotM sidecar: ${SIDE_CAR_DST}"
