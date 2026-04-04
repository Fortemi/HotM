#!/usr/bin/env bash
set -euo pipefail

# Install system dependencies on macOS

if ! command -v brew &>/dev/null; then
  echo "Homebrew not found. Install from https://brew.sh"
  exit 1
fi

echo "macOS: ensuring Xcode CLI tools..."
xcode-select --install 2>/dev/null || true

echo "macOS dependencies ready."
