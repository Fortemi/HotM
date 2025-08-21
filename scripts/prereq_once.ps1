# One-time prerequisites + official Tauri UI scaffold + deps
# Usage (PowerShell as Admin recommended):
#   .\scripts\prereq_once.ps1

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Add-ToPath([string]$dir) {
  if ((Test-Path $dir) -and -not (($env:PATH -split ';') -contains $dir)) {
    $env:PATH = "$dir;$env:PATH"
  }
}

Write-Host '== Installing prerequisites (winget) =='
winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
winget install -e --id Rustlang.Rustup --silent --accept-package-agreements --accept-source-agreements      | Out-Null
winget install -e --id WiXToolset.WiXToolset --silent --accept-package-agreements --accept-source-agreements| Out-Null
winget install -e --id Microsoft.EdgeWebView2Runtime --silent --accept-package-agreements --accept-source-agreements | Out-Null
winget install -e --id Microsoft.VisualStudio.2022.BuildTools --silent --accept-package-agreements --accept-source-agreements | Out-Null

# Update PATH for this shell session
Add-ToPath "$env:ProgramFiles\nodejs"
Add-ToPath "$env:LOCALAPPDATA\Programs\nodejs"
Add-ToPath "$env:APPDATA\npm"
Add-ToPath "$env:USERPROFILE\.cargo\bin"
Add-ToPath "$env:ProgramFiles(x86)\WiX Toolset v3.14\bin"
Add-ToPath "$env:ProgramFiles\WiX Toolset v3.14\bin"

# Scaffold only if missing
if (Test-Path 'ui') {
  Write-Host 'ui/ already exists. Skipping scaffold.'
} else {
  # Official scaffold (React + TS)
  Write-Host '== Scaffolding official Tauri UI (React+TS) into ./ui =='
  if (-not (Get-Command npx -ErrorAction SilentlyContinue)) { throw 'npx not found in PATH (restart shell after Node install)'; }
  npx create-tauri-app@latest ui --template react-ts --yes
}

# Install deps
Push-Location ui
npm install
try { npm i -D @vitejs/plugin-react | Out-Null } catch { }
Pop-Location

Write-Host '== Prereq setup complete. Next run start/build script =='
