#!/usr/bin/env bash
set -euo pipefail

# Install system dependencies on Fedora

echo "Installing build essentials..."
sudo dnf install -y \
  gcc \
  gcc-c++ \
  make \
  curl \
  wget \
  ca-certificates

echo "Fedora dependencies installed."
