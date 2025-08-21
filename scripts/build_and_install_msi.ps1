# Build the HotM MSI (Tauri) and run installer
# Usage:
#   .\scripts\build_and_install_msi.ps1 [-SkipInstall]
#
param(
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ui = Join-Path $root 'ui'

Write-Host '== Building HotM MSI =='

# Ensure prerequisites
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host 'Node.js not found. Installing via winget...'
  winget install -e --id OpenJS.NodeJS.LTS --silent --accept-package-agreements --accept-source-agreements | Out-Null
}
if (-not (Get-Command rustup -ErrorAction SilentlyContinue)) {
  Write-Host 'Rustup not found. Installing via winget...'
  winget install -e --id Rustlang.Rustup --silent --accept-package-agreements --accept-source-agreements | Out-Null
}
if (-not (Get-Command candle.exe -ErrorAction SilentlyContinue)) {
  Write-Host 'WiX Toolset not found. Installing via winget...'
  winget install -e --id WiXToolset.WiXToolset --silent --accept-package-agreements --accept-source-agreements | Out-Null
}
if (-not (Get-Command msedgewebview2.exe -ErrorAction SilentlyContinue)) {
  Write-Host 'Installing Microsoft Edge WebView2 Runtime...'
  winget install -e --id Microsoft.EdgeWebView2Runtime --silent --accept-package-agreements --accept-source-agreements | Out-Null
}

Push-Location $ui
if (-not (Test-Path 'package-lock.json')) { npm install } else { npm ci }
# Build MSI via Tauri
npm run build

# Locate latest MSI
$msiDirRelease = Join-Path $ui 'src-tauri/target/release/bundle/msi'
$msiDirDebug   = Join-Path $ui 'src-tauri/target/debug/bundle/msi'
$msi = $null
if (Test-Path $msiDirRelease) {
  $msi = Get-ChildItem -Path $msiDirRelease -Filter '*.msi' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $msi -and (Test-Path $msiDirDebug)) {
  $msi = Get-ChildItem -Path $msiDirDebug -Filter '*.msi' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
}
if (-not $msi) { throw 'MSI not found under src-tauri/target/*/bundle/msi' }

Write-Host "MSI: $($msi.FullName)"
Pop-Location

if (-not $SkipInstall) {
  Write-Host '== Launching installer (msiexec) =='
  Start-Process msiexec -ArgumentList @('/i', $msi.FullName) -Wait
}
