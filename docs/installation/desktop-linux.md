# HotM Desktop — Linux Installation

HotM ships as a self-contained desktop application for Linux. The `.deb` and `.AppImage` bundles include both the HotM UI and the Fortemi API sidecar — no separate server installation required.

## Prerequisites

### Automatic (recommended)

Run the prerequisite script from the repo root (or download it separately):

```bash
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/setup-linux.sh | bash
```

Or with custom options:

```bash
./scripts/setup-linux.sh \
  --db-password "mypassword" \
  --gen-model "llama3.1:8b"
```

The script installs and configures:
- **PostgreSQL** with the `matric` role and `matric` database
- **pgvector** extension for semantic search
- **Ollama** with `nomic-embed-text` (embeddings) and `qwen3.5:9b` (generation/vision)

Pass `--no-ollama` to skip Ollama — HotM will start in [Degraded mode](#degraded-mode) and you can configure a cloud provider later.

### Manual Prerequisites

If you prefer to set up manually:

**PostgreSQL:**
```bash
sudo apt-get install postgresql postgresql-contrib
# Install extensions matching the active cluster version (e.g. 18)
PG_VER=$(pg_lsclusters --no-header | awk 'NR==1{print $1}')
sudo apt-get install postgresql-${PG_VER}-pgvector postgresql-${PG_VER}-postgis-3
sudo -u postgres psql <<SQL
CREATE ROLE matric WITH LOGIN PASSWORD 'matric' SUPERUSER;
CREATE DATABASE matric OWNER matric;
SQL
sudo -u postgres psql -d matric <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL
```

**Ollama** (optional):
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull nomic-embed-text
ollama pull qwen3.5:9b
```

## Installation

### Option A — .deb Package (recommended for Ubuntu/Debian)

```bash
# Download from the releases page
wget https://git.integrolabs.net/Fortemi/HotM/releases/download/latest/HotM_2026.2.0_amd64.deb

# Install
sudo dpkg -i HotM_2026.2.0_amd64.deb
sudo apt-get install -f    # resolve any missing deps

# Launch
hotm
```

Files installed:
- `/usr/bin/hotm` — HotM UI (Tauri WebView)
- `/usr/bin/hotm-matric-api` — bundled Fortemi API sidecar (HotM-namespaced filename to avoid collision with sibling Tauri apps that bundle their own matric-api)
- `/usr/share/applications/HotM.desktop` — desktop launcher
- `/usr/share/icons/hicolor/*/apps/hotm.png` — application icons

### Option B — AppImage (portable, any distro)

```bash
chmod +x HotM_2026.2.0_amd64.AppImage
./HotM_2026.2.0_amd64.AppImage
```

The AppImage bundles all libraries and runs on any x86-64 Linux distribution without installation.

## First Launch

On first launch HotM:

1. Reads `~/.config/com.hotm.app/config.json` (creates defaults if absent)
2. Spawns `matric-api` bound to `127.0.0.1:<free-port>`
3. Writes the resolved API URL back to `config.json`
4. Runs database migrations automatically
5. Opens the Hall of the Mind window

If everything is configured correctly the sidebar shows **API Connected** (green).

If Ollama is available HotM shows **API Connected**. If Ollama is not running at startup, HotM shows **Degraded** (yellow) — notes and search work, AI enhancement does not. See [Degraded mode](#degraded-mode).

## Configuration

HotM's configuration lives at:

```
~/.config/com.hotm.app/config.json
```

Default contents:

```json
{
  "api_base_url": "http://127.0.0.1:PORT",
  "database_url": "postgres://matric:matric@localhost/matric",
  "file_storage_path": ""
}
```

| Field | Description |
|-------|-------------|
| `api_base_url` | Updated automatically at startup — do not edit manually |
| `database_url` | PostgreSQL connection string for the Fortemi sidecar |
| `file_storage_path` | Where attachments are stored. Empty → `~/.local/share/com.hotm.app/fortemi-files` |

To change the database password:

```bash
# Update Postgres
sudo -u postgres psql -c "ALTER ROLE matric WITH PASSWORD 'newpassword'"

# Update config
nano ~/.config/com.hotm.app/config.json
# set "database_url": "postgres://matric:newpassword@localhost/matric"
```

## Viewing Sidecar Logs

Fortemi sidecar output is piped to the host terminal when HotM is launched from a terminal:

```bash
hotm 2>&1 | grep -E "\[fortemi\]|\[fortemi:err\]"
```

For persistent log capture:

```bash
hotm 2>&1 | tee ~/.local/share/com.hotm.app/hotm.log
```

## Degraded Mode

HotM shows **Degraded** (yellow) in the sidebar when Fortemi is reachable but inference is unavailable — typically because Ollama was not running when the Fortemi sidecar started.

In degraded mode:
- ✅ Note creation, editing, search, collections, tags — all work
- ❌ AI enhancement (NLP revision, summarization, auto-tagging) — disabled

**To recover without restarting:**

1. Start Ollama: `ollama serve` or `sudo systemctl start ollama`
2. In HotM: click the retry button in the sidebar, or close and reopen HotM

**To avoid degraded mode:** ensure Ollama is running before launching HotM, or configure it as a persistent service:

```bash
sudo systemctl enable --now ollama
```

## Updating

```bash
# Download new .deb and reinstall — dpkg handles the upgrade
sudo dpkg -i HotM_NEW_VERSION_amd64.deb
```

Configuration and data are preserved across updates.

## Uninstalling

```bash
sudo dpkg -r hotm
```

Data and configuration in `~/.config/com.hotm.app/` and `~/.local/share/com.hotm.app/` are not removed. Delete them manually if desired:

```bash
rm -rf ~/.config/com.hotm.app ~/.local/share/com.hotm.app
```

## Troubleshooting

### "Offline Mode" on launch

**Cause:** PostgreSQL is not running, or the `database_url` in config.json is wrong.

**Fix:**
```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
```

Check the connection string:
```bash
psql "$(jq -r .database_url ~/.config/com.hotm.app/config.json)"
```

### matric-api crashes immediately

Run HotM from a terminal to see sidecar logs:
```bash
hotm 2>&1
```

Common causes:
- `database_url` credentials are wrong
- PostgreSQL is not running
- Port conflict (another `matric-api` process already running)

Kill stale sidecar processes:
```bash
pkill -f hotm-matric-api
```

### WebView fails to start

HotM requires `libwebkit2gtk-4.1`. Install it:
```bash
sudo apt-get install libwebkit2gtk-4.1-0
```

### pgvector not available

Semantic search falls back to full-text only. To add pgvector:
```bash
# Ubuntu 24.04+
sudo apt-get install postgresql-$(pg_lsclusters --no-header | awk 'NR==1{print $1}')-pgvector
sudo -u postgres psql -d matric -c "CREATE EXTENSION IF NOT EXISTS vector;"
```
