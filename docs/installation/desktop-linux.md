# HotM Desktop — Linux Installation

HotM ships as a Tauri desktop application for Linux. The `.deb` and `.AppImage` bundles include the HotM UI and the Fortemi API sidecar. Postgres 18 + pgvector, Ollama, and Speaches/Whisper are runtime prerequisites and are handled by the bootstrap installer below.

> **Postgres 18 required.** Fortemi migrations rely on `uuidv7()` (a Postgres 18 built-in). Older clusters (PG 13–17) will fail at first launch with `function uuidv7() does not exist`. Install.sh adds the [PGDG apt repo](https://wiki.postgresql.org/wiki/Apt) for you so PG 18 is available on Ubuntu 24.04 LTS, 25.10 (questing), and Debian 12+.

## Quick install (recommended)

One command bootstraps everything on a fresh Ubuntu 24.04+ host:

```bash
curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash
```

The installer is idempotent — re-running is safe and skips anything already in place.

### What `install.sh` does

| Step | Action |
|------|--------|
| 1 | Resolves the latest HotM release via the GitHub releases API |
| 2 | Downloads `HotM_<version>_amd64.deb` and `SHA256SUMS.txt`, verifies the checksum |
| 3 | Adds the PGDG apt repo (PostgreSQL official) if not already configured |
| 4 | Runs `apt-get install ./HotM_*.deb` — apt resolves and installs `postgresql-18`, `postgresql-contrib-18`, `postgresql-18-pgvector`, `postgresql-18-postgis-3`, and `libwebkit2gtk-4.1-0` |
| 5 | The `.deb` postinst creates the `matric` role, the `matric` database, and enables `vector`, `postgis`, `pg_trgm`, `unaccent` extensions |
| 6 | Runs the official Ollama installer (`curl https://ollama.com/install.sh \| sh`) and enables the `ollama` systemd service |
| 7 | Pulls `nomic-embed-text` (embeddings) and `qwen3.5:9b` (generation) **in the background** — model pulls take 5-15 minutes and don't block the installer |
| 8 | Installs Docker if needed and starts Speaches/Whisper on `127.0.0.1:8000` for audio/video transcription |
| 9 | Runs a short sidecar smoke probe unless `--skip-smoke-test` is set |
| 10 | Reports installed status and next steps |

Audit the script before piping by reading it directly:
```bash
curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | less
```

### Installer flags

```bash
./scripts/install.sh \
  --version v2026.5.14    # pin to a specific release (default: latest)
  --local-deb ./HotM_2026.5.14_amd64.deb
  --no-ollama             # skip Ollama install (HotM starts in degraded mode)
  --skip-models           # install Ollama but don't auto-pull models
  --no-whisper            # skip local Speaches/Whisper and disable transcription jobs
  --embed-model nomic-embed-text
  --gen-model qwen3.5:9b
  --whisper-model Systran/faster-distil-whisper-large-v3
  --whisper-image ghcr.io/speaches-ai/speaches:latest-cpu
  --reset-db              # reset an empty/drifted matric DB after install
  --reset-db --force      # destructive: reset even when note rows exist
  --skip-smoke-test       # skip the sidecar startup probe
```

## Manual install (advanced)

If you prefer to do it yourself or need to integrate with existing infrastructure:

### 1. Add the PGDG apt repo and install Postgres 18

```bash
sudo install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  | sudo gpg --dearmor -o /etc/apt/keyrings/postgresql.gpg
CODENAME=$(lsb_release -cs)
# Ubuntu 25.10 (questing) and similar post-LTS releases: substitute "noble".
echo "deb [signed-by=/etc/apt/keyrings/postgresql.gpg] https://apt.postgresql.org/pub/repos/apt ${CODENAME}-pgdg main" \
  | sudo tee /etc/apt/sources.list.d/pgdg.list

sudo apt-get update
sudo apt-get install postgresql-18 postgresql-contrib-18 \
  postgresql-18-pgvector postgresql-18-postgis-3
```

### 2. Install the HotM `.deb`

```bash
wget https://github.com/Fortemi/HotM/releases/download/v2026.5.3/HotM_2026.5.3_amd64.deb
sudo apt-get install ./HotM_2026.5.3_amd64.deb
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

### 4. Install Speaches/Whisper (optional, for audio/video transcription)

The installer starts the CPU image by default:

```bash
sudo apt-get install docker.io
sudo systemctl enable --now docker
sudo docker run -d \
  --name hotm-speaches \
  --restart unless-stopped \
  -p 127.0.0.1:8000:8000 \
  -v hotm-speaches-models:/home/ubuntu/.cache/huggingface/hub \
  -e WHISPER__MODEL=Systran/faster-distil-whisper-large-v3 \
  ghcr.io/speaches-ai/speaches:latest-cpu
```

Use `--no-whisper` when this host should not run local transcription. That writes `components.whisper=false` so the bundled sidecar disables transcription jobs instead of queuing work that cannot run.

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
  "file_storage_path": "",
  "components": {
    "ollama": true,
    "whisper": true
  },
  "ollama_base_url": "http://127.0.0.1:11434",
  "whisper_base_url": "http://127.0.0.1:8000"
}
```

| Field | Description |
|-------|-------------|
| `api_base_url` | Updated automatically at startup — do not edit manually |
| `database_url` | PostgreSQL connection string for the Fortemi sidecar |
| `file_storage_path` | Where attachments are stored. Empty → `~/.local/share/com.hotm.app/fortemi-files` |
| `components.ollama` | Whether this desktop profile expects the local Ollama service |
| `components.whisper` | Whether this desktop profile enables local audio/video transcription |
| `ollama_base_url` | Ollama endpoint passed to the bundled Fortemi sidecar |
| `whisper_base_url` | Whisper-compatible endpoint passed to the bundled Fortemi sidecar |

To change the database password:

```bash
sudo -u postgres psql -c "ALTER ROLE matric WITH PASSWORD 'newpassword'"
# Then update database_url in config.json
```

## Updating

```bash
# Re-run the installer — it detects the installed version and skips if already current
curl -fsSL https://raw.githubusercontent.com/Fortemi/HotM/main/scripts/install.sh | bash
```

Or pin to a specific version:

```bash
./scripts/install.sh --version v2026.6.0
```

Configuration and data are preserved across updates. If a reinstall hits Fortemi migration-checksum drift on a disposable host, rerun with `--reset-db`; the installer refuses to reset a database with note rows unless `--force` is also supplied.

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

The `Recommends:` pulls `postgresql-18-pgvector` from PGDG. If it's missing, the PGDG repo wasn't added — see manual install step 1 above. To install retroactively:

```bash
sudo apt-get install postgresql-18-pgvector
sudo -u postgres psql -d matric -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

Without pgvector, semantic search falls back to full-text only.

### `function uuidv7() does not exist`

Matric-api migrations require `uuidv7()` — a Postgres 18 built-in. If you see this error, the cluster is running Postgres 13–17. Upgrade to Postgres 18 (PGDG):

```bash
sudo systemctl stop postgresql
sudo apt-get install postgresql-18
# pg_upgradecluster from old version → 18, or accept data loss and re-run install
```

The install.sh bootstrap handles this automatically on fresh installs.

## See also

- [docker.md](./docker.md) — Docker Compose deployment (for headless / server use)
- [desktop-macos.md](./desktop-macos.md) — macOS install via `.dmg`
