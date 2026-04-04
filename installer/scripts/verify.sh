#!/usr/bin/env bash
set -euo pipefail

# Verify HotM installation is healthy

cd "${INSTALL_DIR}"

echo "=== HotM Installation Verification ==="
echo ""

# Check Docker services
echo "Docker services:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
echo ""

# Check UI health endpoint
UI_URL="http://localhost:${UI_PORT}"
echo -n "UI health check (${UI_URL}): "
if curl -sf "${UI_URL}/health" >/dev/null 2>&1; then
  echo "PASS"
elif curl -sf "${UI_URL}" >/dev/null 2>&1; then
  echo "PASS (no /health endpoint, but UI responds)"
else
  echo "FAIL - UI not responding"
  exit 1
fi

# Check Fortemi API connectivity
echo -n "Fortemi API (${FORTEMI_API_URL}): "
if curl -sf "${FORTEMI_API_URL}/health" >/dev/null 2>&1; then
  echo "PASS"
else
  echo "WARN - API not reachable (ensure Fortemi is running)"
fi

echo ""
echo "=== Verification Complete ==="
echo ""
echo "HotM is available at: ${PROTOCOL}://${DOMAIN}:${UI_PORT}"
echo ""
echo "Next steps:"
echo "  - Ensure Fortemi API is running at ${FORTEMI_API_URL}"
echo "  - Open ${PROTOCOL}://${DOMAIN}:${UI_PORT} in your browser"
echo "  - View logs: docker compose -f docker-compose.prod.yml logs -f"
