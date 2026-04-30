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
2. **Verify the download** (recommended — confirms you got the right file from a trusted source):
   ```bash
   cd ~/Downloads
   curl -fL "https://git.integrolabs.net/Fortemi/HotM/releases/download/v2026.4.1/SHA256SUMS-macos.txt" -o SHA256SUMS-macos.txt
   shasum -a 256 -c SHA256SUMS-macos.txt
   # expect: HotM_<version>_aarch64.dmg: OK
   ```
3. Open the DMG (double-click in Finder, or `hdiutil attach HotM_<version>_aarch64.dmg`)
4. Drag **HotM** to your `/Applications` folder
5. Eject the DMG (or `hdiutil detach /Volumes/HotM`)
6. **Approve the bundle for first launch** — see the next section

> **Important — HotM is a self-signed bundle.** We do not pay Apple's $99/year Developer Program for notarization, and HotM is open source. macOS will block the first launch by default and show one of two dialogs:
>
> - *"HotM cannot be opened because the developer cannot be verified"*
> - *"HotM is damaged and can't be opened. You should move it to the Trash."*
>
> Neither is true — the bundle is fine. macOS shows these warnings to **every** non-notarized app, regardless of whether it's safe. The next section walks you through the one-time approval.

## First-launch Gatekeeper approval (one-time, per install)

You only need to do this **once per install** (and again after each upgrade — replacing the bundle re-applies the quarantine flag). Pick whichever path fits your comfort level:

### Path A — System Settings (recommended for most users; macOS 15 Sequoia / 26 Tahoe canonical)

1. Open Launchpad (or Finder → Applications) and **double-click HotM**
2. macOS shows: *"HotM cannot be opened because the developer cannot be verified"* — click **Done** (do not click Move to Trash)
3. Open **System Settings** → **Privacy & Security**
4. Scroll down to the **Security** section. You will see a message like:
   > *"HotM" was blocked from use because it is not from an identified developer.*
5. Click **Open Anyway**
6. Confirm with Touch ID or your password
7. Re-launch HotM from Launchpad — it opens normally

After this one-time approval, HotM launches like any other app for the lifetime of this install.

### Path B — Terminal (one command, fastest)

```bash
xattr -cr /Applications/HotM.app
```

This removes the macOS quarantine attribute that triggers Gatekeeper. After running, HotM launches immediately with no dialogs. Re-run after every DMG upgrade.

### Path C — Re-run the prereq script

If you ran [`setup-macos.sh`](https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/setup-macos.sh) **before** dragging HotM into `/Applications`, it skipped the Gatekeeper step (no app to operate on). After installing the bundle, re-run the script — its Gatekeeper section is idempotent and will clear the quarantine flag for you. This is the same path as Path B but bundled with the rest of the setup verification.

```bash
bash ~/Downloads/setup-macos.sh   # or: curl -fsSL .../setup-macos.sh | bash
```

### Why does macOS do this?

Apple's **Gatekeeper** checks every newly-installed app for a Developer ID signature and a notarization stamp from Apple. HotM is signed, but **not notarized** — notarization requires an active Apple Developer Program membership ($99/year), which we don't currently maintain for the open-source build. The bundle is otherwise legitimate, comes from this repository's CI pipeline, and ships with a published SHA256 you can verify.

This is exactly the same flow you'd hit installing **any** open-source macOS app that isn't Apple-notarized (Homebrew Cask apps, most indie GUI apps, etc.).

## First Launch

After Gatekeeper approval, on first launch HotM:

1. Reads `~/Library/Application Support/com.hotm.app/config.json` (created on first run)
2. Spawns the bundled `hotm-matric-api` sidecar on a free loopback port
3. Runs database migrations automatically against the `matric` database created by the prereq script
4. Opens the Hall of the Mind window
5. Connects to Ollama on `http://127.0.0.1:11434` for inference

You should see **API Connected** (green) in the sidebar within ~10 seconds, and **Ollama** (green) shortly after the inference probe completes. If either is red, see [Troubleshooting](#troubleshooting) below.

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

1. Download the new DMG and verify its SHA256 (same way as the first install)
2. Quit HotM if it's running (`⌘Q` or right-click the dock icon → Quit)
3. Open the new DMG and drag the new `HotM.app` to `/Applications`, **replacing** the existing one
4. **Clear the re-applied Gatekeeper quarantine** — macOS re-applies the quarantine flag every time you replace an unsigned bundle, even on upgrade. Pick one:
   - `xattr -cr /Applications/HotM.app` (one command), **or**
   - re-run [`setup-macos.sh`](https://git.integrolabs.net/Fortemi/HotM/raw/branch/main/scripts/setup-macos.sh) (idempotent), **or**
   - go through System Settings → Privacy & Security again on next launch attempt
5. Re-launch HotM

Configuration and data in `~/Library/Application Support/com.hotm.app/` are preserved across upgrades. The bundled `hotm-matric-api` sidecar version may bump — first launch after upgrade re-runs any new database migrations automatically.

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

### "HotM is damaged and can't be opened" / "developer cannot be verified" / Gatekeeper block

This happens because the bundle is **self-signed but not Apple-notarized** — see [First-launch Gatekeeper approval](#first-launch-gatekeeper-approval-one-time-per-install) above for the full walkthrough. Quickest fix:

```bash
xattr -cr /Applications/HotM.app
```

Then double-click HotM in Launchpad — it opens without dialog. Re-run after every DMG upgrade (the quarantine flag re-applies on each bundle replacement). The prereq script does this automatically when `/Applications/HotM.app` exists at run time.

If `xattr` fails with *"Operation not permitted"*, run with `sudo`:

```bash
sudo xattr -cr /Applications/HotM.app
```

### "Open Anyway" doesn't appear in System Settings → Privacy & Security

It only appears **after** macOS has actively blocked a launch attempt:

1. Try to launch HotM (it'll fail with the "cannot be opened" dialog) — click **Done**
2. **Within ~15 minutes**, open System Settings → Privacy & Security
3. The blocked-app message + **Open Anyway** button should now be there

If the message doesn't appear, the quarantine flag may already be cleared (e.g., the prereq script ran). Just relaunch HotM — it should open normally.

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
