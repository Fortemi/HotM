# Packaging (Windows 11)

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
