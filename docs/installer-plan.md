# Windows Installer Plan (Tauri MSI)

Goals
- One-click install that ensures prerequisites and starts the background server
- Minimal elevation; rely on existing Postgres/DocumentDB or instruct the user

Approach
- Bundle Tauri desktop UI (MSI) and keep server as a separate Rust binary started by UI on first run
- Use PowerShell bootstrap (`scripts/bootstrap_windows.ps1`) to check/install prereqs and start server
- Future: ship a Windows Service for the server and register it during MSI install

Prereqs (user consent)
- Rust (for dev) not needed in runtime build; server will be compiled and shipped in releases
- Node/WebView2 are needed during dev; runtime uses WebView2 which MSI will install if missing
- Postgres: recommend managed (DocumentDB). If local, point to a pgvector-enabled instance
- Ollama: optional; prompt to install or proceed degraded

MSI wiring
- Tauri MSI installs the UI
- On first UI launch, it runs the bootstrap script to start the server (reads `.env` or prompts)
- Health endpoint is checked and errors surfaced in a simple dialog

Future enhancements
- Package the server as a Windows Service (sc.exe create) and auto-start it on login
- Include a small wizard in the UI for DB URL and Ollama model pulls
- Add WiX CustomActions to install VC++ deps and WebView2 silently
