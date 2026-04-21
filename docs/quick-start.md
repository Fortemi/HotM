# Quick Start

Get HotM running in under 10 minutes using the desktop app (Linux or macOS).

## Desktop Installation (Recommended)

The desktop app bundles the Fortemi API sidecar — no separate server setup required.

### Linux

**1. Install prerequisites** (PostgreSQL, pgvector, Ollama):
```bash
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/setup-linux.sh | bash
```

**2. Install HotM:**
```bash
# .deb (Ubuntu/Debian)
sudo dpkg -i HotM_2026.2.0_amd64.deb

# AppImage (any distro)
chmod +x HotM_2026.2.0_amd64.AppImage && ./HotM_2026.2.0_amd64.AppImage
```

**3. Launch:**
```bash
hotm
```

See [desktop-linux.md](installation/desktop-linux.md) for full details, troubleshooting, and manual prerequisite setup.

### macOS

**1. Install prerequisites:**
```bash
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/setup-macos.sh | bash
```

**2. Install HotM:** Download `HotM_2026.2.0_aarch64.dmg` from the releases page, open it, and drag **HotM** to `/Applications`.

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
