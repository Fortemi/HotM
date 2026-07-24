# HotM + Fortemi all-in-one image.
#
# The Fortemi base is an immutable multi-architecture index produced from
# runtime commit c93742d7c75b481621b821f4584304289eb364d5.
FROM node:22-bookworm-slim@sha256:6c74791e557ce11fc957704f6d4fe134a7bc8d6f5ca4403205b2966bd488f6b3 AS ui-builder

WORKDIR /build
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

FROM ghcr.io/fortemi/fortemi:bundle-main@sha256:7d014c5580e62526069a0fc0d7ad994ed70fa73a8810d2b07476b1dfe5a99ae4

ARG GIT_SHA=unknown
ARG BUILD_DATE=unknown
ARG VERSION=dev

LABEL org.opencontainers.image.title="HotM Bundle" \
      org.opencontainers.image.description="HotM web UI with the pinned Fortemi PostgreSQL/API/MCP runtime" \
      org.opencontainers.image.source="https://git.integrolabs.net/Fortemi/HotM" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${GIT_SHA}" \
      org.opencontainers.image.created="${BUILD_DATE}" \
      com.hotm.fortemi.image="ghcr.io/fortemi/fortemi@sha256:7d014c5580e62526069a0fc0d7ad994ed70fa73a8810d2b07476b1dfe5a99ae4" \
      com.hotm.fortemi.revision="c93742d7c75b481621b821f4584304289eb364d5"

COPY --from=ui-builder /build/dist /app/hotm-ui
COPY docker/bundle/server.mjs /app/hotm-server.mjs
RUN cp /app/entrypoint.sh /app/fortemi-entrypoint.sh
COPY docker/bundle/entrypoint.sh /app/entrypoint.sh
RUN chmod 0755 /app/entrypoint.sh /app/fortemi-entrypoint.sh

ENV HOTM_PORT=4180
ENV VITE_API_BASE_URL=http://localhost:3000/api/v1

EXPOSE 4180 3000 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD curl -fsS http://127.0.0.1:4180/healthz >/dev/null \
      && curl -fsS http://127.0.0.1:3000/livez >/dev/null \
      || exit 1

ENTRYPOINT ["/app/entrypoint.sh"]
