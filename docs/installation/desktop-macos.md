# HotM Desktop — macOS Installation

HotM ships as a `.dmg` for macOS (Apple Silicon / aarch64). The bundle includes both the HotM UI and the Fortemi API sidecar.

## Prerequisites

### Automatic (recommended)

```bash
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/setup-macos.sh | bash
```

Or with custom options:

```bash
./scripts/setup-macos.sh \
  --db-password "mypassword" \
  --gen-model "llama3.1:8b"
```

The script installs via Homebrew: PostgreSQL 17, pgvector, and Ollama.

Pass `--no-ollama` to skip Ollama — HotM will start in [Degraded mode](#degraded-mode).

### Manual Prerequisites

**Homebrew** (if not installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**PostgreSQL:**
```bash
brew install postgresql@17 pgvector
brew services start postgresql@17
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"

psql postgres <<SQL
CREATE ROLE matric WITH LOGIN PASSWORD 'matric' SUPERUSER;
CREATE DATABASE matric OWNER matric;
SQL
psql -d matric -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

**Ollama** (optional):
```bash
brew install ollama
brew services start ollama
ollama pull nomic-embed-text
ollama pull qwen3.5:9b
```

## Installation

1. Download `HotM_2026.2.0_aarch64.dmg` from the [releases page](https://git.integrolabs.net/Fortemi/HotM/releases)
2. Open the DMG and drag **HotM** to `/Applications`
3. On first launch, macOS may show a Gatekeeper warning — right-click the app and choose **Open**

## First Launch

On first launch HotM:

1. Reads `~/Library/Application Support/com.hotm.app/config.json`
2. Spawns the bundled `matric-api` sidecar on a free loopback port
3. Runs database migrations automatically
4. Opens the Hall of the Mind window

## Configuration

Configuration file:

```
~/Library/Application Support/com.hotm.app/config.json
```

```json
{
  "api_base_url": "http://127.0.0.1:PORT",
  "database_url": "postgres://matric:matric@localhost/matric",
  "file_storage_path": ""
}
```

File storage defaults to `~/Library/Application Support/com.hotm.app/fortemi-files`.

## Viewing Sidecar Logs

Launch from Terminal to see output:

```bash
/Applications/HotM.app/Contents/MacOS/hotm 2>&1
```

Or redirect to a log file:

```bash
/Applications/HotM.app/Contents/MacOS/hotm 2>&1 | tee ~/Library/Logs/HotM/hotm.log
```

## Degraded Mode

Same as Linux — see [desktop-linux.md#degraded-mode](desktop-linux.md#degraded-mode).

Ensure Ollama starts before HotM:

```bash
brew services start ollama   # start at login
```

## Updating

Download the new DMG, drag the new `HotM.app` to `/Applications`, replacing the existing one. Configuration and data are preserved.

## Uninstalling

```bash
rm -rf /Applications/HotM.app
rm -rf ~/Library/Application\ Support/com.hotm.app
rm -rf ~/Library/Logs/HotM
```

## Troubleshooting

### "The application is damaged" / Gatekeeper block

```bash
xattr -cr /Applications/HotM.app
```

### PostgreSQL path not found

Add to `~/.zshrc`:

```bash
export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"
```

### matric-api exits on startup

Check logs:
```bash
/Applications/HotM.app/Contents/MacOS/hotm 2>&1 | grep fortemi
```

Most common cause: PostgreSQL not running.
```bash
brew services start postgresql@17
```
