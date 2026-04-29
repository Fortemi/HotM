# HotM Desktop — macOS Installation

HotM ships as a `.dmg` for macOS (Apple Silicon / aarch64). The bundle contains the HotM UI and the bundled Fortemi API sidecar (`hotm-matric-api`). End-users do **not** need Docker or any backend setup beyond the prereq script below.

## Prerequisites

### Automatic (recommended)

Run the prereq script once. It is idempotent and safe to re-run on upgrade:

```bash
curl -fsSL https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/setup-macos.sh | bash
```

Or with custom options:

```bash
./scripts/setup-macos.sh \
  --db-password "mypassword" \
  --gen-model "llama3.1:8b"
```

The script installs and configures (all idempotent):

- **Homebrew** (probes `/opt/homebrew` and `/usr/local` first; only installs if missing)
- **PostgreSQL 18** via `postgresql@18`, started under `brew services`
- **pgvector** + **PostGIS** via Homebrew
- **`matric` role + `matric` database** with the four extensions HotM needs: `vector`, `postgis`, `pg_trgm`, `unaccent`
- **Ollama** with `nomic-embed-text` (embeddings) and `qwen3.5:9b` (generation/vision) — pass `--no-ollama` to skip
- **Gatekeeper unquarantine** of `/Applications/HotM.app` (`xattr -cr`) — clears the unsigned-bundle warning that would otherwise show on first launch

The script ends with a verification block reporting actual status of each component, and exits non-zero only on hard failures.

### Manual Prerequisites

If you prefer to set up by hand:

**Homebrew** (if not installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

**PostgreSQL 18 + extensions:**
```bash
brew install postgresql@18 pgvector postgis
brew services start postgresql@18
export PATH="$(brew --prefix postgresql@18)/bin:$PATH"

psql postgres <<SQL
CREATE ROLE matric WITH LOGIN PASSWORD 'matric' SUPERUSER;
CREATE DATABASE matric OWNER matric;
SQL

psql -d matric <<SQL
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;
SQL

# Verify password-auth (the path matric-api uses)
PGPASSWORD=matric psql -h localhost -U matric -d matric -c "SELECT 1"
```

**Ollama** (optional):
```bash
brew install ollama
brew services start ollama
ollama pull nomic-embed-text
ollama pull qwen3.5:9b
```

## Installation

1. Download `HotM_<version>_aarch64.dmg` from the [releases page](https://git.integrolabs.net/Fortemi/HotM/releases)
2. Open the DMG and drag **HotM** to `/Applications`
3. **Clear the Gatekeeper quarantine flag** (only needed once, or after each upgrade):
   ```bash
   xattr -cr /Applications/HotM.app
   ```
   The prereq script does this automatically if `/Applications/HotM.app` exists when the script runs. If you installed the DMG after running the script, just re-run the script — it is idempotent.
4. Launch HotM from Launchpad

If you skipped step 3, macOS will show *"HotM cannot be opened because the developer cannot be verified"* on first launch. Either run the `xattr` command above, or right-click the app in Finder and choose **Open** to bypass once.

## First Launch

On first launch HotM:

1. Reads `~/Library/Application Support/com.hotm.app/config.json`
2. Spawns the bundled `hotm-matric-api` sidecar on a free loopback port
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
mkdir -p ~/Library/Logs/HotM
/Applications/HotM.app/Contents/MacOS/hotm 2>&1 | tee ~/Library/Logs/HotM/hotm.log
```

The sidecar binary itself can be invoked directly for one-off MCP work:

```bash
/Applications/HotM.app/Contents/MacOS/hotm-matric-api --mcp
```

## Degraded Mode

Same model as Linux — see [desktop-linux.md#degraded-mode](desktop-linux.md#degraded-mode). HotM still launches without Ollama; you'll see "Ollama unreachable" in the inference status and can switch to a cloud provider in **Admin → Inference**.

To make Ollama start at login:

```bash
brew services start ollama   # one-time enable; starts at login automatically
```

## Updating

Download the new DMG, drag the new `HotM.app` to `/Applications`, replacing the existing one. Configuration and data in `~/Library/Application Support/com.hotm.app/` are preserved.

After replacing the bundle, **re-run** `xattr -cr /Applications/HotM.app` (or the prereq script) — macOS re-applies the quarantine flag every time you replace an unsigned bundle.

## Uninstalling

```bash
rm -rf /Applications/HotM.app
rm -rf ~/Library/Application\ Support/com.hotm.app
rm -rf ~/Library/Logs/HotM
```

PostgreSQL data and Ollama models persist across HotM uninstalls (managed by Homebrew). To remove them:

```bash
brew services stop postgresql@18 ollama
brew uninstall postgresql@18 pgvector postgis ollama
rm -rf "$(brew --prefix)/var/postgresql@18"   # destroys all PG databases on this machine
rm -rf ~/.ollama                                # destroys all Ollama models
```

## Troubleshooting

### "The application is damaged" / Gatekeeper block

```bash
xattr -cr /Applications/HotM.app
```

This re-occurs after every replace of the bundle (e.g., DMG upgrade). Re-run the prereq script — its Gatekeeper step is idempotent.

### PostgreSQL bin not on PATH

The prereq script appends an `export PATH=...` line to `~/.zshrc` or `~/.bash_profile`. If it didn't pick up your shell, add manually:

```bash
echo 'export PATH="$(brew --prefix postgresql@18)/bin:$PATH"' >> ~/.zshrc
```

### hotm-matric-api exits on startup

Tail the live log:

```bash
/Applications/HotM.app/Contents/MacOS/hotm 2>&1 | grep -E 'fortemi|hotm-matric-api'
```

Most common causes:

- **PostgreSQL not running**: `brew services restart postgresql@18`
- **Missing `unaccent` extension** (needed for multilingual FTS): `psql -d matric -c "CREATE EXTENSION IF NOT EXISTS unaccent;"`
- **Wrong PG version installed** (e.g., postgresql@17 from older script): re-run `setup-macos.sh` to install postgresql@18

### Test Connection fails in Admin Panel

If clicking **Admin → Inference → Test Connection** returns "Bad Request" or "Connection Failed" but Ollama is reachable from the terminal, you are likely on a pre-2026.4.1 build. Upgrade to 2026.4.1 or later — earlier desktop builds had a request-body bug that's fixed there.
