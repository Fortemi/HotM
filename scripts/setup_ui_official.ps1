# Scaffold UI using official create-tauri-app (React + TS), install deps, and merge our UI components
# Usage: .\scripts\setup_ui_official.ps1 [-WithServerBootstrap]
param(
  [switch]$WithServerBootstrap
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
cd $root

function Ensure-NodePath {
  $env:PATH = "$env:ProgramFiles\nodejs;$env:LOCALAPPDATA\Programs\nodejs;$env:APPDATA\npm;" + $env:PATH
}

# 1) Backup existing ui if present
$timestamp = Get-Date -Format 'yyyyMMdd_HHmmss'
if (Test-Path 'ui') {
  $bak = "ui_bak_$timestamp"
  Write-Host "Backing up existing UI to $bak"
  Rename-Item ui $bak
}

# 2) Scaffold official template
Ensure-NodePath
if (-not (Get-Command npx -ErrorAction SilentlyContinue)) {
  throw 'npx not found. Please install Node.js LTS and restart the shell.'
}

Write-Host 'Scaffolding official Tauri React+TS template into ./ui'
npx create-tauri-app@latest ui --template react-ts --yes

# 3) Install deps
Push-Location ui
npm install
# Ensure vite react plugin exists (some templates include it already)
try { npm i -D @vitejs/plugin-react | Out-Null } catch { }
Pop-Location

# 4) Optionally merge custom Tauri bootstrap main.rs
if ($WithServerBootstrap -and (Test-Path 'ui/src-tauri/src/main.rs') -and (Test-Path 'ui_bak/src-tauri/src/main.rs')) {
  Copy-Item 'ui_bak/src-tauri/src/main.rs' 'ui/src-tauri/src/main.rs' -Force
}

# 5) Merge our React components if we had them
if (Test-Path 'ui_bak/src/ui/App.tsx') { Copy-Item 'ui_bak/src/ui/App.tsx' 'ui/src/App.tsx' -Force }
if (Test-Path 'ui_bak/src/ui/Provenance.tsx') { Copy-Item 'ui_bak/src/ui/Provenance.tsx' 'ui/src/Provenance.tsx' -Force }

Write-Host 'Done. You can now build with:'
Write-Host '  cd ui; npm run tauri build'
