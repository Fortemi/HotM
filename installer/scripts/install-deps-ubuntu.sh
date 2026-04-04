#!/usr/bin/env bash
set -euo pipefail

# Install system dependencies on Ubuntu/Debian

echo "Updating package lists..."
sudo apt-get update -qq

echo "Installing build essentials..."
sudo apt-get install -y -qq \
  build-essential \
  curl \
  wget \
  ca-certificates

echo "Ubuntu/Debian dependencies installed."
