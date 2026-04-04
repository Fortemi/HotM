#!/usr/bin/env bash
set -euo pipefail

# Build and start HotM via Docker Compose

cd "${INSTALL_DIR}"

echo "Pulling/building Docker images..."
docker compose -f docker-compose.prod.yml build

echo "Starting services..."
docker compose -f docker-compose.prod.yml up -d

echo "Waiting for services to become healthy..."
TIMEOUT=120
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
  if docker compose -f docker-compose.prod.yml ps --status running | grep -q hotm-ui; then
    echo "HotM UI is running."
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  echo "  waiting... (${ELAPSED}s)"
done

if [ $ELAPSED -ge $TIMEOUT ]; then
  echo "WARNING: Services did not become healthy within ${TIMEOUT}s"
  echo "Check logs with: docker compose -f docker-compose.prod.yml logs"
  exit 1
fi

echo "Deployment complete."
