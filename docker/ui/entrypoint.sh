#!/bin/sh
# Inject runtime environment into env-config.js before nginx starts.
# window.__RUNTIME_CONFIG__ is read by ui/src/lib/runtime-config.ts.
# This runs as part of /docker-entrypoint.d/ on nginx:alpine startup.

set -e

ENV_CONFIG="/usr/share/nginx/html/env-config.js"

cat > "$ENV_CONFIG" << EOF
window.__RUNTIME_CONFIG__ = {
  "VITE_API_BASE_URL": "${VITE_API_BASE_URL:-http://localhost:3000}"
};
EOF

echo "env-config.js written (VITE_API_BASE_URL=${VITE_API_BASE_URL:-http://localhost:3000})"
