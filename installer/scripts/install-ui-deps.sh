#!/usr/bin/env bash
set -euo pipefail

# Install UI npm dependencies

cd "${INSTALL_DIR}/ui"

echo "Installing npm dependencies..."
npm ci --prefer-offline 2>/dev/null || npm install

echo "Building UI for production..."
npm run build

echo "UI dependencies installed and built."
