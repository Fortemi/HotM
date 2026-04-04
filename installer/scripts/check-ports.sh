#!/usr/bin/env bash
set -euo pipefail

# Verify required ports are available before deployment

PORTS=("${UI_PORT}" "3001")
LABELS=("HotM UI" "Agent Proxy")
FAILED=0

for i in "${!PORTS[@]}"; do
  PORT="${PORTS[$i]}"
  LABEL="${LABELS[$i]}"

  if ss -tlnp 2>/dev/null | grep -q ":${PORT} " || \
     lsof -i ":${PORT}" -sTCP:LISTEN &>/dev/null; then
    echo "ERROR: Port ${PORT} (${LABEL}) is already in use"
    FAILED=1
  else
    echo "OK: Port ${PORT} (${LABEL}) is available"
  fi
done

if [ "${FAILED}" -eq 1 ]; then
  echo ""
  echo "Free the occupied ports or change UI_PORT in your configuration."
  exit 1
fi

echo "All ports available."
