#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: scripts/download-pinned-sidecar.sh <target-triple> <destination-path>

HUX-REQ-010: downloads the pinned Fortemi sidecar asset declared in release/sidecar-provenance.json,
verifies its SHA-256 checksum, marks it executable, and writes a provenance receipt
next to the destination as <destination-path>.provenance.json.
USAGE
}

if [[ $# -ne 2 ]]; then
  usage
  exit 2
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${SIDECAR_PROVENANCE_MANIFEST:-${ROOT_DIR}/release/sidecar-provenance.json}"
TARGET_TRIPLE="$1"
DEST="$2"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "Sidecar provenance manifest not found: ${MANIFEST}" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "node is required to parse ${MANIFEST}" >&2
  exit 1
fi

manifest_value() {
  local expr="$1"
  node -e "
const fs = require('fs');
const manifest = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
const target = process.argv[2];
const asset = manifest.assets && manifest.assets[target];
if (!asset) process.exit(3);
const value = ${expr};
if (value === undefined || value === null || value === '') process.exit(4);
process.stdout.write(String(value));
" "${MANIFEST}" "${TARGET_TRIPLE}"
}

ASSET_NAME="$(manifest_value 'asset.asset_name')"
SHA256_EXPECTED="$(manifest_value 'asset.sha256')"
BASE_URL="$(manifest_value 'manifest.base_url')"
RELEASE_TAG="$(manifest_value 'manifest.release_tag')"
TARGET_COMMITISH="$(manifest_value 'manifest.target_commitish')"
PUBLISHED_AT="$(manifest_value 'manifest.published_at')"
URL="${BASE_URL%/}/${ASSET_NAME}"
SOURCE_FILE="${SIDECAR_SOURCE_FILE:-}"

mkdir -p "$(dirname "${DEST}")"
TMP="${DEST}.tmp"
rm -f "${TMP}"

echo "Staging pinned Fortemi sidecar:"
echo "  target: ${TARGET_TRIPLE}"
echo "  asset:  ${ASSET_NAME}"
echo "  commit: ${TARGET_COMMITISH}"
if [[ -n "${SOURCE_FILE}" ]]; then
  if [[ ! -f "${SOURCE_FILE}" ]]; then
    echo "Pinned sidecar source file not found: ${SOURCE_FILE}" >&2
    exit 1
  fi
  cp "${SOURCE_FILE}" "${TMP}"
  URL="file://${SOURCE_FILE}"
else
  curl -sfL "${URL}" -o "${TMP}"
fi

if command -v sha256sum >/dev/null 2>&1; then
  SHA256_ACTUAL="$(sha256sum "${TMP}" | awk '{print $1}')"
elif command -v shasum >/dev/null 2>&1; then
  SHA256_ACTUAL="$(shasum -a 256 "${TMP}" | awk '{print $1}')"
else
  echo "sha256sum or shasum is required to verify ${ASSET_NAME}" >&2
  rm -f "${TMP}"
  exit 1
fi

if [[ "${SHA256_ACTUAL}" != "${SHA256_EXPECTED}" ]]; then
  echo "Sidecar checksum mismatch for ${ASSET_NAME}" >&2
  echo "  expected: ${SHA256_EXPECTED}" >&2
  echo "  actual:   ${SHA256_ACTUAL}" >&2
  rm -f "${TMP}"
  exit 1
fi

mv "${TMP}" "${DEST}"
chmod +x "${DEST}"

cat > "${DEST}.provenance.json" <<EOF
{
  "source_repository": "Fortemi/fortemi",
  "release_tag": "${RELEASE_TAG}",
  "target_commitish": "${TARGET_COMMITISH}",
  "published_at": "${PUBLISHED_AT}",
  "target_triple": "${TARGET_TRIPLE}",
  "asset_name": "${ASSET_NAME}",
  "download_url": "${URL}",
  "sha256": "${SHA256_ACTUAL}"
}
EOF

echo "Sidecar verified: ${DEST}"
echo "Provenance receipt: ${DEST}.provenance.json"
