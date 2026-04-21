# HotM — Docker Installation

The HotM Docker image serves the React SPA via nginx. It does **not** include the Fortemi sidecar — for Docker deployments you run Fortemi separately and point HotM at it via `VITE_API_BASE_URL`.

## Quick Start

```bash
docker run -d \
  --name hotm \
  -e VITE_API_BASE_URL=http://your-fortemi-host:3000 \
  -p 8080:80 \
  ghcr.io/fortemi/hotm-ui:latest
```

Open `http://localhost:8080`.

## Images

| Registry | Image |
|----------|-------|
| GitHub Container Registry | `ghcr.io/fortemi/hotm-ui:latest` |
| Gitea | `git.integrolabs.net/fortemi/hotm-ui:latest` |

Tags: `:latest`, `:sha-<7char>` (rolling), `:<version>` (releases, e.g. `:2026.2.0`).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_BASE_URL` | `http://localhost:3000` | Fortemi API base URL |

The entrypoint script (`/docker-entrypoint.d/40-env-config.sh`) writes `VITE_API_BASE_URL` into `/usr/share/nginx/html/env-config.js` at container startup. This is read by the UI as `window.__RUNTIME_CONFIG__`.

## Docker Compose with Fortemi

```yaml
services:
  fortemi:
    image: ghcr.io/fortemi/hotm-agent-proxy:latest   # or matric-api if using direct image
    environment:
      DATABASE_URL: postgres://matric:matric@postgres/matric
    depends_on:
      - postgres

  hotm:
    image: ghcr.io/fortemi/hotm-ui:latest
    ports:
      - "8080:80"
    environment:
      VITE_API_BASE_URL: http://fortemi:3000
    depends_on:
      - fortemi

  postgres:
    image: pgvector/pgvector:pg17
    environment:
      POSTGRES_USER: matric
      POSTGRES_PASSWORD: matric
      POSTGRES_DB: matric
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

## nginx Configuration

The bundled nginx config handles:

- SPA routing (`try_files $uri $uri/ /index.html`)
- Gzip compression for JS/CSS/fonts/SVG
- Aggressive caching for hashed assets (1 year, immutable)
- No-cache for `index.html` and `env-config.js`

To override, bind-mount a custom `nginx.conf`:
```bash
docker run -v ./my-nginx.conf:/etc/nginx/conf.d/default.conf:ro \
  -e VITE_API_BASE_URL=http://fortemi:3000 \
  -p 8080:80 \
  ghcr.io/fortemi/hotm-ui:latest
```

## Building Locally

```bash
docker build \
  --build-arg VERSION=dev \
  -f docker/ui/Dockerfile \
  -t hotm-ui:local \
  .

docker run -e VITE_API_BASE_URL=http://localhost:3000 -p 8080:80 hotm-ui:local
```
