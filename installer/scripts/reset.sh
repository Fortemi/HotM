#!/usr/bin/env bash
set -euo pipefail

# Full reset: stop containers, remove volumes, optionally re-clone

cd "${INSTALL_DIR}" 2>/dev/null || true

echo "=== HotM Full Reset ==="

# Stop and remove Docker resources
if [ -f "${INSTALL_DIR}/docker-compose.prod.yml" ]; then
  echo "Stopping Docker services..."
  docker compose -f "${INSTALL_DIR}/docker-compose.prod.yml" down -v --remove-orphans 2>/dev/null || true
fi

# Remove generated config
echo "Removing generated configuration..."
rm -f "${INSTALL_DIR}/.env"
rm -f "${INSTALL_DIR}/ui/.env.local"

# Remove node_modules
echo "Removing node_modules..."
rm -rf "${INSTALL_DIR}/ui/node_modules"

# Remove build artifacts
echo "Removing build artifacts..."
rm -rf "${INSTALL_DIR}/ui/dist"

echo ""
echo "Reset complete. Re-run the installer to set up again."
