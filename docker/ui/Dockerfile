# HotM UI — multi-stage Docker image
#
# Build stage:  compiles the React SPA
# Serve stage:  nginx:alpine serves the static dist
#
# Runtime config: set VITE_API_BASE_URL when starting the container.
# The entrypoint rewrites /usr/share/nginx/html/env-config.js so the
# browser picks up the correct API base URL via window.__RUNTIME_CONFIG__.
#
# Example:
#   docker build --build-arg VERSION=2026.2.0 -t hotm-ui .
#   docker run -e VITE_API_BASE_URL=http://fortemi.example.com:3000 -p 8080:80 hotm-ui

# ---------------------------------------------------------------------------
# Stage 1 — build
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS builder

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=dev

WORKDIR /build

# Install deps first (layer cache)
COPY ui/package*.json ./
RUN npm ci

# Copy source and build
COPY ui/ .
RUN npm run build

# ---------------------------------------------------------------------------
# Stage 2 — serve
# ---------------------------------------------------------------------------
FROM nginx:alpine

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=dev

# OCI image labels
LABEL org.opencontainers.image.title="HotM UI" \
      org.opencontainers.image.description="Hall of the Mind — React SPA served via nginx" \
      org.opencontainers.image.source="https://github.com/Fortemi/HotM" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}"

# Static build output
COPY --from=builder /build/dist /usr/share/nginx/html

# SPA routing + gzip config
COPY docker/ui/nginx.conf /etc/nginx/conf.d/default.conf

# Runtime env-config injection (runs before nginx starts)
COPY docker/ui/entrypoint.sh /docker-entrypoint.d/40-env-config.sh
RUN chmod +x /docker-entrypoint.d/40-env-config.sh

EXPOSE 80
