#!/bin/sh
# Generate runtime config from environment variables.
# This runs at container startup so the SPA can read config
# without a rebuild.

CONFIG_FILE="/usr/share/nginx/html/env-config.js"

cat > "$CONFIG_FILE" <<EOF
window.__RUNTIME_CONFIG__ = {
  VITE_API_BASE_URL: "${VITE_API_BASE_URL:-}",
  VITE_APP_TITLE: "${VITE_APP_TITLE:-}"
};
EOF

exec nginx -g 'daemon off;'
