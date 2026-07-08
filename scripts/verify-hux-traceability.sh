#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCAN_PATHS=(
  "${ROOT_DIR}/ui/src"
  "${ROOT_DIR}/ui/e2e"
  "${ROOT_DIR}/scripts"
)

missing=0

for n in $(seq 1 14); do
  req="$(printf 'HUX-REQ-%03d' "${n}")"
  if ! grep -Rqs -- "${req}" "${SCAN_PATHS[@]}"; then
    echo "missing ${req} in HotM test/script traceability anchors" >&2
    missing=1
  fi
done

if [[ "${missing}" -ne 0 ]]; then
  exit 1
fi

echo "HUX traceability anchors present for HUX-REQ-001 through HUX-REQ-014"
