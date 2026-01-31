# Packaging (Windows 11)

> **ARCHIVED**: This documentation is for the HotM Desktop Application (v0.1.x) which has been superseded by the React SPA architecture (v0.2.0+).
>
> **Status**: Historical reference only
> **Archived**: 2026-01-31
> **See**: `.aiwg/archive/desktop-era/` for complete desktop documentation
> **Current Architecture**: React SPA consuming matric-memory API (see `.aiwg/architecture/adr/ADR-004-spa-migration.md`)

---

MSI build
- Prereqs: Rust (stable), Node.js LTS, Visual Studio C++ Build Tools, Wix Toolset (handled by Tauri)
- From `ui/`:

```powershell
npm install
npm run build
```

Tray & Global Hotkey
- The app registers a tray icon and Ctrl+Alt+H global shortcut to toggle the main window.

First-run
- On first start, verify:
  - `DATABASE_URL` is configured for the server
  - Postgres `vector` extension exists
  - Ollama service is running and models (`gpt-oss:20b`, `nomic-embed-text`) are present

Troubleshooting
- Check `http://127.0.0.1:53211/api/v1/health` for `db`, `vector`, and `ollama` flags
- Run `scripts/e2e_api_smoke.sh` in WSL to validate API
