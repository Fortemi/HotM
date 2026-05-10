# Quick Start

Get HotM running in under 10 minutes. HotM is a React UI that talks to a Fortemi API. Pick the path that matches your setup.

## Choose your install path

| Path | When to use | Footprint | What gets installed |
|------|-------------|-----------|---------------------|
| **Desktop bundle** | First time trying HotM, no existing LLM setup | ~10 GB | HotM + Fortemi sidecar + Postgres + Ollama + models |
| **Docker UI + external Fortemi** | You already run Fortemi somewhere | ~200 MB | Just the UI container; you provide Fortemi |
| **Bring Your Own LLM** | You already run llama.cpp / vLLM / an OpenAI-compatible endpoint | HotM is agnostic | UI + Fortemi configured to point at your endpoint (skip the bundled Ollama) |

The UI is inference-agnostic — it only needs `VITE_API_BASE_URL` pointing at any Fortemi instance. The inference backend (Ollama, llama.cpp, vLLM, OpenAI-compatible) is configured entirely on the Fortemi side.

> **BYO-LLM users:** the desktop installer installs Ollama by default. Run with `--no-ollama` to skip it. See [Bring Your Own LLM](#bring-your-own-llm) below.

## Desktop Installation

The desktop app bundles the Fortemi API sidecar — no separate server setup required.

### Linux

**One command installs everything** (Postgres 18 via PGDG + pgvector + postgis + Ollama + HotM):

```bash
curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash
```

The bootstrap downloads + checksum-verifies the latest `.deb`, runs `apt install` (which pulls Postgres 18, pgvector, and postgis from PGDG via Depends/Recommends), seeds the `matric` database via the postinst hook, then installs the Ollama daemon and pulls models in the background. Idempotent — re-running is safe.

**Launch:**
```bash
hotm
```

See [desktop-linux.md](installation/desktop-linux.md) for the AppImage path, manual install steps, troubleshooting, and the full list of installer flags.

### macOS

**1. Install prerequisites:**
```bash
curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/setup-macos.sh | bash
```

**2. Install HotM:** Download the latest `HotM_*_aarch64.dmg` from the [releases page](https://github.com/Fortemi/HotM/releases/latest), open it, and drag **HotM** to `/Applications`.

**3. Launch:** Open HotM from Applications. On first launch macOS may show a Gatekeeper warning — right-click and choose **Open**.

See [desktop-macos.md](installation/desktop-macos.md) for full details.

## Docker (Web UI Only)

For server/headless deployments. Requires a separately running Fortemi instance.

```bash
docker run -d \
  --name hotm \
  -e VITE_API_BASE_URL=http://your-fortemi-host:3000 \
  -p 8080:80 \
  ghcr.io/fortemi/hotm-ui:latest
```

Open `http://localhost:8080`. See [docker.md](installation/docker.md) for compose setup.

## Bring Your Own LLM

If you already run llama.cpp, vLLM, or any OpenAI-compatible endpoint, skip the bundled Ollama install — Fortemi is configurable for any inference backend.

**Linux desktop bundle, no Ollama:**

```bash
curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash -s -- --no-ollama
```

This installs HotM + Fortemi + Postgres but skips the Ollama daemon and model pulls. Configure your inference endpoint in Fortemi (env vars or `inference.toml`):

- `MATRIC_INFERENCE_DEFAULT=llamacpp` (or `openai`)
- `LLAMACPP_BASE_URL=http://localhost:8080/v1` (or your endpoint)
- `OPENAI_API_KEY=...` (if using OpenAI or a compatible service)

See the [Fortemi configuration docs](https://git.integrolabs.net/Fortemi/fortemi#configuration) for the full inference backend matrix.

> HotM in Docker doesn't run inference at all — that's all on the Fortemi side. The Docker quickstart above already supports any Fortemi instance via `VITE_API_BASE_URL`.

## Status Indicators

After launch, the sidebar shows the connection state:

| Indicator | Meaning |
|-----------|---------|
| **API Connected** (green) | Fully operational |
| **Degraded** (yellow) | Fortemi reachable, inference unavailable (Ollama not running) |
| **Offline Mode** (red) | Cannot reach Fortemi — check PostgreSQL and sidecar logs |

To recover from Degraded: start Ollama (`ollama serve` or `sudo systemctl start ollama`), then close and reopen HotM.

## Next Steps

- [Operator Guide](operations/operator-guide.md) — configuration, backups, monitoring
- [Agent Guide](operations/agent-guide.md) — MCP server, REST API for automation
- [API Specification](specifications/api-specification.md) — full REST API reference
