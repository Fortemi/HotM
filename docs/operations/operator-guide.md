# HotM Operator Guide

This guide covers day-to-day operation of HotM for desktop deployments — configuration, monitoring, updates, backup, and troubleshooting.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│  HotM Desktop (Tauri)                       │
│                                             │
│  ┌────────────────────────────────────┐     │
│  │  WebView (React SPA)               │     │
│  │  connects to http://127.0.0.1:PORT │     │
│  └──────────────┬─────────────────────┘     │
│                 │ HTTP                       │
│  ┌──────────────▼─────────────────────┐     │
│  │  matric-api sidecar                │     │
│  │  spawned by Tauri on a free port   │     │
│  │  killed when HotM quits            │     │
│  └──────────────┬─────────────────────┘     │
└─────────────────┼───────────────────────────┘
                  │
     ┌────────────┼─────────────┐
     ▼            ▼             ▼
PostgreSQL     Ollama      File storage
(localhost)  (optional)   (~/.local/share/...)
```

## Configuration File

**Linux:** `~/.config/com.hotm.app/config.json`
**macOS:** `~/Library/Application Support/com.hotm.app/config.json`

```json
{
  "api_base_url": "http://127.0.0.1:PORT",
  "database_url": "postgres://matric:matric@localhost/matric",
  "file_storage_path": ""
}
```

| Field | Description |
|-------|-------------|
| `api_base_url` | Rewritten at each launch. Do not edit manually. |
| `database_url` | Postgres DSN. Change this to point at a remote Postgres instance. |
| `file_storage_path` | Attachment file storage. Empty → platform default data dir. |

Changes to `database_url` or `file_storage_path` take effect at next launch.

## Sidecar Lifecycle

The Fortemi sidecar (`matric-api`) is:
- **Spawned** when HotM opens, on a randomly selected free loopback port
- **Killed** when the user selects Quit from the tray menu
- **Not killed** when the window is closed (close-to-tray behaviour)

Only one sidecar runs per HotM instance. If you launch multiple HotM windows they share the same sidecar process (Tauri prevents multiple app instances by default).

To check if the sidecar is running:
```bash
pgrep -a matric-api
```

To kill a stale sidecar manually:
```bash
pkill -f matric-api
```

## Keyboard Shortcuts

HotM registers one global OS-level shortcut that works even when the application window is hidden:

| Shortcut | Platform | Action |
|----------|----------|--------|
| `Ctrl+Alt+H` | Linux / Windows | Toggle window visibility (show or hide) |
| `Cmd+Alt+H` | macOS | Toggle window visibility (show or hide) |

The shortcut is registered at startup. If another application has already claimed the same combination, HotM logs a warning (`HotM: Failed to register global shortcut`) and the shortcut is unavailable for that session.

## Logs

Run HotM from a terminal to capture all output:

**Linux:**
```bash
hotm 2>&1 | tee ~/.local/share/com.hotm.app/hotm.log
```

**macOS:**
```bash
/Applications/HotM.app/Contents/MacOS/hotm 2>&1 | tee ~/Library/Logs/HotM/hotm.log
```

Sidecar log lines are prefixed `[fortemi]` or `[fortemi:err]`.

Useful filters:
```bash
# Database and migration events
hotm 2>&1 | grep -E "migration|database|Database"

# Inference/Ollama events
hotm 2>&1 | grep -E "inference|Ollama|ollama|capabilities"

# Errors only
hotm 2>&1 | grep -iE "error|panic|failed"
```

## Inference Configuration

Inference is configured through the Admin Panel (**Admin → Inference** tab in HotM) or by environment variable.

| Env Var | Default | Description |
|---------|---------|-------------|
| `MATRIC_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama base URL |
| `MATRIC_OLLAMA_GENERATION_MODEL` | `qwen3.5:9b` | Generation/vision model |
| `MATRIC_OLLAMA_EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model |
| `WHISPER_BASE_URL` | `http://127.0.0.1:8000` | Whisper-compatible transcription URL; set empty to disable |
| `WHISPER_MODEL` | `Systran/faster-distil-whisper-large-v3` | Audio/video transcription model |

To use a cloud provider (OpenAI, OpenRouter) instead of Ollama, set these through the Admin Panel. Configuration is persisted in the Fortemi database.

## Database Maintenance

### Check database size

```bash
psql "$(jq -r .database_url ~/.config/com.hotm.app/config.json)" \
  -c "SELECT pg_size_pretty(pg_database_size('matric'));"
```

### Vacuum and analyse

```bash
psql "postgres://matric:matric@localhost/matric" -c "VACUUM ANALYZE;"
```

### Reindex vector index (after large imports)

```bash
psql "postgres://matric:matric@localhost/matric" \
  -c "REINDEX INDEX CONCURRENTLY note_embeddings_embedding_idx;"
```

## Backup and Restore

### Export via HotM UI

HotM supports archive export from **Admin → Backup**. This produces a `.hotm-archive` file containing all notes, tags, attachments, and metadata.

### Database backup (operator-level)

```bash
pg_dump postgres://matric:matric@localhost/matric \
  -Fc -f ~/hotm-backup-$(date +%Y%m%d).dump
```

Restore:
```bash
pg_restore -d postgres://matric:matric@localhost/matric \
  ~/hotm-backup-20260421.dump
```

### File storage backup

```bash
# Linux
tar -czf ~/hotm-files-$(date +%Y%m%d).tar.gz \
  ~/.local/share/com.hotm.app/fortemi-files

# macOS
tar -czf ~/hotm-files-$(date +%Y%m%d).tar.gz \
  ~/Library/Application\ Support/com.hotm.app/fortemi-files
```

## Updating HotM

### Desktop (.deb)

```bash
sudo dpkg -i HotM_NEW_VERSION_amd64.deb
```

### Desktop (AppImage)

Replace the AppImage file. Configuration and database are unaffected.

### Updating the bundled Fortemi sidecar

The sidecar (`matric-api`) is bundled in the HotM package. It updates when HotM updates. To run a different Fortemi version, replace `/usr/bin/matric-api` (Linux) or the binary inside the `.app` bundle (macOS) with the desired build.

## Multi-Archive Setup

HotM supports multiple named archives (knowledge bases) within a single Fortemi instance. Manage archives through **Admin → Archives** in the UI.

Each archive has isolated notes, tags, and search indexes. The "Default" archive is created automatically on first launch.

## Remote Fortemi

To point HotM at a remote or separately managed Fortemi instance instead of the bundled sidecar:

1. Set `database_url` to an empty string in `config.json` — this disables sidecar launch
2. Set `api_base_url` to your remote Fortemi URL (e.g. `http://192.168.1.100:3000`)

```json
{
  "api_base_url": "http://192.168.1.100:3000",
  "database_url": "",
  "file_storage_path": "",
  "components": {
    "ollama": false,
    "whisper": false
  }
}
```

HotM will connect directly to the remote instance and skip sidecar spawning.

## Launch Flags

HotM accepts the following command-line flags at startup:

| Flag | Description |
|------|-------------|
| `--minimized` (Linux/macOS) | Start with the window hidden in the system tray |
| `/minimized` (Windows) | Same as `--minimized` |

The `--minimized` flag is useful for autostart-on-login scenarios where you want HotM running in the background without interrupting the desktop session.

```bash
# Linux: start HotM minimized (e.g. in .profile or a systemd user unit)
hotm --minimized
```

Example systemd user unit (`~/.config/systemd/user/hotm.service`):
```ini
[Unit]
Description=HotM - Hall of the Mind
After=graphical-session.target

[Service]
ExecStart=/usr/bin/hotm --minimized
Restart=on-failure

[Install]
WantedBy=graphical-session.target
```

## PlantUML Diagrams

The desktop app can render PlantUML diagrams embedded in notes. When a note contains a PlantUML code block, HotM sends the diagram source to a local PlantUML server and displays the rendered image inline.

**Requirements:** A PlantUML server must be running on `localhost:8080`. The easiest way to run one is via Docker:

```bash
docker run -d -p 8080:8080 plantuml/plantuml-server:jetty
```

The container starts immediately and survives reboots if you add `--restart unless-stopped`.

**Graceful degradation:** If no PlantUML server is reachable, HotM displays the raw diagram source as a fenced code block rather than an image. No error is shown to the user. To confirm the server is up:

```bash
curl -s http://localhost:8080/png/SyfFKj2rKt3CoKnELR1Io4ZDoSa70000 -o /dev/null -w "%{http_code}"
# Expect: 200
```

## Security Notes

- The sidecar binds to `127.0.0.1` only — it is not reachable from the network
- The `database_url` is stored in plaintext in `config.json` — ensure appropriate file permissions
- Attachment files are stored unencrypted in the file storage directory
- For multi-user systems, each user should have their own HotM installation and Postgres database

## Health Checks

Check the Fortemi API health directly:

```bash
# Get the active port from config
PORT=$(jq -r .api_base_url ~/.config/com.hotm.app/config.json | grep -oP ':\K[0-9]+')
curl -s "http://127.0.0.1:${PORT}/health" | jq .
```

Expected healthy response:
```json
{
  "status": "healthy",
  "version": "2026.x.x",
  "capabilities": {
    "chat": { "available": true },
    "inference": { "configured": true }
  }
}
```
