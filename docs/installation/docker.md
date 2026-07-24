# HotM — Docker Installation

The supported Docker image is `hotm-bundle`: one container containing the HotM
web UI and the digest-pinned Fortemi PostgreSQL/API/MCP runtime. The older
`hotm-ui` image remains available for operators who intentionally manage
Fortemi separately.

## Quick Start

Create `.env`:

```dotenv
POSTGRES_PASSWORD=replace-with-a-long-random-local-password
```

Then start the bundle:

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Open `http://localhost:4180`. The compose file publishes the UI, API, and MCP
ports on loopback only:

| Surface | Default |
| --- | --- |
| HotM UI | `http://127.0.0.1:4180` |
| Fortemi API | `http://127.0.0.1:3000` |
| Fortemi MCP | `http://127.0.0.1:3001` |

Persisted database, attachment, and backup data use the `hotm-postgres`,
`hotm-files`, and `hotm-backups` named volumes.

## Images and Tags

| Shape | GHCR | Gitea registry |
| --- | --- | --- |
| Supported bundle | `ghcr.io/fortemi/hotm-bundle` | `git.integrolabs.net/fortemi/hotm-bundle` |
| Legacy UI only | `ghcr.io/fortemi/hotm-ui` | `git.integrolabs.net/fortemi/hotm-ui` |

Main publishes `:latest` and `:sha-<7char>`. Numbered release tags publish
`:latest` and `:<version>`. CI also emits a publication receipt containing both
image digests and the immutable Fortemi base identity.

The current bundle pins Fortemi image
`ghcr.io/fortemi/fortemi@sha256:7d014c5580e62526069a0fc0d7ad994ed70fa73a8810d2b07476b1dfe5a99ae4`
at runtime commit `c93742d7c75b481621b821f4584304289eb364d5`.

## Runtime Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `POSTGRES_PASSWORD` | none; required | Password for the embedded PostgreSQL role. |
| `VITE_API_BASE_URL` | `http://localhost:3000/api/v1` | Browser-visible Fortemi API URL. |
| `REQUIRE_AUTH` | `false` | Enable Fortemi OAuth enforcement when set to `true`. |
| `I_UNDERSTAND_NO_AUTH` | `true` | Required Fortemi acknowledgement for local anonymous mode. |
| `MATRIC_ATTACHMENT_SCAN_MODE` | `disabled` | Set to `required` with a configured scanner for managed deployments. |
| `OLLAMA_BASE`, `OLLAMA_HOST` | host port `11434` | Fortemi inference endpoint. |
| `WHISPER_BASE_URL` | host port `8000/v1` | Optional transcription endpoint. |

The defaults are for a single-user local deployment. Do not publish the ports
on a non-loopback interface with anonymous auth or disabled malware scanning.
For hosted access, enable Fortemi auth, require attachment scanning, use TLS
termination, and follow the Fortemi operator guidance.

## Direct `docker run`

```bash
docker run -d \
  --name hotm \
  --env-file .env \
  -e REQUIRE_AUTH=false \
  -e I_UNDERSTAND_NO_AUTH=true \
  -e MATRIC_ATTACHMENT_SCAN_MODE=disabled \
  -p 127.0.0.1:4180:4180 \
  -p 127.0.0.1:3000:3000 \
  -p 127.0.0.1:3001:3001 \
  -v hotm-postgres:/var/lib/postgresql/data \
  -v hotm-files:/var/lib/matric/files \
  -v hotm-backups:/var/backups/matric-memory \
  ghcr.io/fortemi/hotm-bundle:latest
```

The wrapper acknowledges Fortemi's no-backup migration flag only when
`PGDATA/PG_VERSION` does not yet exist. Existing volumes retain Fortemi's
verified pre-migration backup gate.

## Legacy UI-only Deployment

Operators with an external Fortemi server can continue to run:

```bash
docker run -d \
  --name hotm-ui \
  -e VITE_API_BASE_URL=https://fortemi.example/api/v1 \
  -p 127.0.0.1:4180:80 \
  ghcr.io/fortemi/hotm-ui:latest
```

This image contains no database or backend and is not the self-contained
product shape.

## Build and Verify Locally

```bash
docker build \
  --file docker/bundle/Dockerfile \
  --build-arg VERSION=local \
  --build-arg GIT_SHA=local \
  --build-arg BUILD_DATE="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --tag hotm-bundle:local \
  .

docker image inspect hotm-bundle:local \
  --format '{{ index .Config.Labels "com.hotm.fortemi.revision" }}'
```

The expected pinned Fortemi revision is
`c93742d7c75b481621b821f4584304289eb364d5`.

## Release Backfill Policy

`publish-hotm-ui-image.yml` now uses `push.tags: [v*]`, which is supported by
the same Gitea event used by the desktop release. A current main build restores
`:latest`; the next numbered tag establishes the first supported
`hotm-bundle:<version>` release. Historical versions before the bundle contract
are not relabeled as bundled images. Missing legacy `hotm-ui` tags may be
rebuilt only from their matching immutable Git tags, then verified by digest
before publication.
