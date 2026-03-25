#!/bin/sh
# Generate runtime config from environment variables.
# This runs at container startup so the SPA can read config
# without a rebuild.

CONFIG_FILE="/usr/share/nginx/html/env-config.js"
API_PROXY_CONF="/etc/nginx/includes/api-proxy.conf"

# --- Runtime JS config for the SPA ---
cat > "$CONFIG_FILE" <<EOF
window.__RUNTIME_CONFIG__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_APP_TITLE: "${VITE_APP_TITLE:-}"
};
EOF

# --- Inject Fortemi API reverse proxy into nginx when FORTEMI_API_URL is set ---
if [ -n "$FORTEMI_API_URL" ]; then
  # Strip trailing slash and /api/v1 suffix to get the server root
  # e.g. "http://host:3000/api/v1" -> "http://host:3000"
  #      "http://host:3000"        -> "http://host:3000"
  FORTEMI_ROOT=$(echo "$FORTEMI_API_URL" | sed 's|/api/v[0-9]*/*$||' | sed 's|/*$||')

  cat > "$API_PROXY_CONF" <<PROXYEOF
# Fortemi API reverse proxy (REST + SSE + WebSocket)
# Auto-generated at container startup from FORTEMI_API_URL=$FORTEMI_API_URL

location /api/v1/ {
    proxy_pass ${FORTEMI_ROOT}/api/v1/;
    proxy_http_version 1.1;
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    # WebSocket upgrade support (/api/v1/ws)
    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;

    # SSE/streaming support (/api/v1/events)
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding on;

    # Long-lived connections for SSE (default 60s is too short)
    proxy_read_timeout 3600s;
    proxy_send_timeout 600s;
}
PROXYEOF

  echo "Fortemi API proxy: /api/v1/ -> ${FORTEMI_ROOT}/api/v1/"
else
  # Empty file — nginx include is valid with an empty file
  : > "$API_PROXY_CONF"
  echo "No FORTEMI_API_URL set — Fortemi API proxy not configured"
fi

exec nginx -g 'daemon off;'
