# HotM Desktop — Linux Installation

HotM ships as a Tauri desktop application for Linux. The `.deb` and `.AppImage` bundles include the HotM UI and the Fortemi API sidecar. Postgres + pgvector + Ollama are runtime prerequisites and are handled by the bootstrap installer below.

## Quick install (recommended)

One command bootstraps everything on a fresh Ubuntu 24.04+ host:

```bash
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/install.sh | bash
```

The installer is idempotent — re-running is safe and skips anything already in place.

### What `install.sh` does

| Step | Action |
|------|--------|
| 1 | Resolves the latest HotM release on git.integrolabs.net |
| 2 | Downloads `HotM_<version>_amd64.deb` and `SHA256SUMS.txt`, verifies the checksum |
| 3 | Runs `apt-get install ./HotM_*.deb` — apt resolves and installs `postgresql`, `postgresql-contrib`, `libwebkit2gtk-4.1-0`, and the matching `postgresql-NN-pgvector` |
| 4 | The `.deb` postinst creates the `matric` role, the `matric` database, and enables `vector`, `postgis`, `pg_trgm` extensions |
| 5 | Runs the official Ollama installer (`curl https://ollama.com/install.sh \| sh`) and enables the `ollama` systemd service |
| 6 | Pulls `nomic-embed-text` (embeddings) and `qwen3.5:9b` (generation) **in the background** — model pulls take 5-15 minutes and don't block the installer |
| 7 | Reports installed status and next steps |

Audit the script before piping by reading it directly:
```bash
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/install.sh | less
```

### Installer flags

```bash
./scripts/install.sh \
  --version v2026.5.1     # pin to a specific release (default: latest)
  --no-ollama             # skip Ollama install (HotM starts in degraded mode)
  --skip-models           # install Ollama but don't auto-pull models
  --embed-model nomic-embed-text
  --gen-model qwen3.5:9b
```

## Manual install (advanced)

If you prefer to do it yourself or need to integrate with existing infrastructure:

### 1. Install Postgres + pgvector via apt

```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
PG_VER=$(pg_lsclusters --no-header | awk 'NR==1{print $1}')
sudo apt-get install postgresql-${PG_VER}-pgvector postgresql-${PG_VER}-postgis-3
```

### 2. Install the HotM `.deb`

```bash
wget https://git.integrolabs.net/Fortemi/HotM/releases/download/v2026.5.1/HotM_2026.5.1_amd64.deb
sudo apt-get install ./HotM_2026.5.1_amd64.deb
# postinst seeds the matric role + database + extensions automatically
```

The `.deb` declares Postgres as `Depends:` and pgvector as `Recommends:`, so step 1 is technically redundant if you go straight to step 2. Step 1 is shown for clarity about what's being pulled in.

### 3. Install Ollama (optional, for AI features)

```bash
curl -fsSL https://ollama.com/install.sh | sh
sudo systemctl enable --now ollama
ollama pull nomic-embed-text
ollama pull qwen3.5:9b
```

Skip this step if you plan to use a remote inference provider — configure it in **Settings → Admin → Inference** after first launch.

## Files installed

| Path | Purpose |
|------|---------|
| `/usr/bin/hotm` | HotM UI (Tauri WebView) |
| `/usr/bin/hotm-matric-api` | Bundled Fortemi API sidecar |
| `/usr/share/applications/HotM.desktop` | Desktop launcher |
| `/usr/share/icons/hicolor/*/apps/hotm.png` | Application icons |
| `~/.config/com.hotm.app/config.json` | Per-user runtime config (created on first launch) |

## First launch

```bash
hotm
```

On first launch HotM:

1. Reads `~/.config/com.hotm.app/config.json` (creates defaults if absent)
2. Spawns `hotm-matric-api` bound to `127.0.0.1:<free-port>`
3. Writes the resolved API URL back to `config.json`
4. Runs database migrations against the `matric` database
5. Connects to Ollama on `localhost:11434`
6. Opens the Hall of the Mind window

The sidebar status indicator:

| Color | Meaning |
|-------|---------|
| Green — **API Connected** | Postgres + Ollama both reachable, all features available |
| Yellow — **Degraded** | Postgres OK, Ollama unavailable; notes/search work, AI enhancement disabled |
| Red — **Offline** | Postgres unreachable; check `systemctl status postgresql` |

## Configuration

Configuration lives at `~/.config/com.hotm.app/config.json`:

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
sudo -u postgres psql -c "ALTER ROLE matric WITH PASSWORD 'newpassword'"
# Then update database_url in config.json
```

## Updating

```bash
# Re-run the installer — it detects the installed version and skips if already current
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/install.sh | bash
```

Or pin to a specific version:

```bash
./scripts/install.sh --version v2026.6.0
```

Configuration and data are preserved across updates.

## Uninstalling

```bash
sudo apt-get remove hot-m
```

> The dpkg package name is `hot-m` — Tauri's bundler kebab-cases the
> `productName` ("HotM") when generating the deb. The user-facing app and
> its binaries are still named `hotm` / `hotm-matric-api`.

Remove user data and config (not done by `apt remove`):

```bash
rm -rf ~/.config/com.hotm.app ~/.local/share/com.hotm.app
```

To also drop the `matric` database:

```bash
sudo -u postgres psql -c "DROP DATABASE matric; DROP ROLE matric;"
```

## Degraded mode recovery

If HotM shows yellow **Degraded** in the sidebar:

```bash
# Check Ollama
systemctl status ollama
sudo systemctl start ollama

# Check models are present
ollama list
# Should show nomic-embed-text and qwen3.5:9b

# In HotM: click the retry button in the sidebar
```

If models are still pulling (background after install), check progress:

```bash
tail -f ~/.local/share/com.hotm.app/ollama-pull.log
```

## Troubleshooting

### "Offline Mode" on launch (red sidebar)

Postgres isn't running or `database_url` in config.json is wrong.

```bash
sudo systemctl status postgresql
sudo systemctl start postgresql
psql "$(jq -r .database_url ~/.config/com.hotm.app/config.json)"
```

### postinst failed during install

Re-run the postinst:

```bash
sudo dpkg-reconfigure hot-m
```

If that fails, check that Postgres is reachable:

```bash
sudo -u postgres psql -c '\l'
```

### `hotm-matric-api` crashes on launch

Run HotM from a terminal to see sidecar output:

```bash
hotm 2>&1
```

Common causes:
- `database_url` credentials wrong
- Postgres not running
- Stale sidecar process: `pkill -f hotm-matric-api`

### WebView fails to start

```bash
sudo apt-get install libwebkit2gtk-4.1-0
```

### pgvector extension missing

The `Recommends:` line covers Postgres 15-17. Other versions need manual install:

```bash
PG_VER=$(pg_lsclusters --no-header | awk 'NR==1{print $1}')
sudo apt-get install postgresql-${PG_VER}-pgvector
sudo -u postgres psql -d matric -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Without pgvector, semantic search falls back to full-text only.

## See also

- [docker.md](./docker.md) — Docker Compose deployment (for headless / server use)
- [desktop-macos.md](./desktop-macos.md) — macOS install via `.dmg`
