# Bootstrap HotM on Windows (PowerShell)
# - Installs Rust (rustup), Node.js (winget), and Ollama (optional prompt)
# - Sets up Postgres (DocumentDB assumed external), creates vector extension if possible
# - Builds and runs server and UI in dev mode

param(
  [string]$DatabaseUrl = "postgres://user:pass@localhost:5432/hotm_dev",
  [switch]$InstallOllama
)

Write-Host "== HotM Bootstrap =="

# Install Rust
if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Rust toolchain..."
  Invoke-Expression ((New-Object System.Net.WebClient).DownloadString('https://sh.rustup.rs'))
}

# Install Node
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Node.js via winget..."
  winget install -e --id OpenJS.NodeJS.LTS --silent
}

# Optionally install Ollama
if ($InstallOllama) {
  Write-Host "Installing Ollama..."
  winget install -e --id Ollama.Ollama --silent
}

# Ensure vector extension (requires psql)
if (Get-Command psql -ErrorAction SilentlyContinue) {
  Write-Host "Ensuring 'vector' extension exists..."
  psql $DatabaseUrl -c "CREATE EXTENSION IF NOT EXISTS vector;" | Out-Null
} else {
  Write-Host "psql not found; skipping vector extension creation."
}

# Write .env
"DATABASE_URL=$DatabaseUrl`nOLLAMA_BASE=http://127.0.0.1:11434`nOLLAMA_EMBED_MODEL=nomic-embed-text" | Out-File -Encoding utf8 .env

# Build and run server
Push-Location server
$env:DATABASE_URL = $DatabaseUrl
cargo run
Pop-Location
