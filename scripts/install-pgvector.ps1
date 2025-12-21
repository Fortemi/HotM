# Install pgvector extension to existing PostgreSQL installation
# This script copies pre-built pgvector files to your PostgreSQL installation
#
# Usage: .\install-pgvector.ps1 [-PgRoot "C:\Program Files\PostgreSQL\17"]
#
# Note: Requires Administrator privileges to copy files to Program Files

param(
    [string]$PgRoot = ""
)

$ErrorActionPreference = "Stop"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "HotM pgvector Extension Installer" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Find PostgreSQL installation if not specified
if (-not $PgRoot) {
    $pgVersions = @("17", "16", "15", "14")
    foreach ($ver in $pgVersions) {
        $testPath = "C:\Program Files\PostgreSQL\$ver"
        if (Test-Path "$testPath\bin\postgres.exe") {
            $PgRoot = $testPath
            Write-Host "Found PostgreSQL $ver at: $PgRoot" -ForegroundColor Green
            break
        }
    }

    if (-not $PgRoot) {
        Write-Host "ERROR: PostgreSQL not found in standard locations." -ForegroundColor Red
        Write-Host "Please specify the PostgreSQL root directory:" -ForegroundColor Yellow
        Write-Host "  .\install-pgvector.ps1 -PgRoot 'C:\path\to\postgresql'" -ForegroundColor Yellow
        exit 1
    }
}

# Verify PostgreSQL installation
if (-not (Test-Path "$PgRoot\bin\postgres.exe")) {
    Write-Host "ERROR: PostgreSQL not found at: $PgRoot" -ForegroundColor Red
    exit 1
}

# Get PostgreSQL version
$pgVersion = & "$PgRoot\bin\postgres.exe" --version 2>&1 | Select-String -Pattern "\d+\.\d+" | ForEach-Object { $_.Matches.Value }
Write-Host "PostgreSQL version: $pgVersion" -ForegroundColor Cyan

# Check if running as administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host ""
    Write-Host "WARNING: Not running as Administrator." -ForegroundColor Yellow
    Write-Host "You may need to run this script as Administrator to install to:" -ForegroundColor Yellow
    Write-Host "  $PgRoot" -ForegroundColor Yellow
    Write-Host ""
}

# Source directory - pgvector files bundled with HotM
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pgvectorSrc = Join-Path $ScriptDir "..\ui\src-tauri\installer\resources\pgvector"

if (-not (Test-Path "$pgvectorSrc\lib\vector.dll")) {
    Write-Host "ERROR: pgvector source files not found at: $pgvectorSrc" -ForegroundColor Red
    Write-Host "Run scripts\build-pgvector.bat first to build pgvector." -ForegroundColor Yellow
    exit 1
}

# Check if pgvector is already installed
if (Test-Path "$PgRoot\lib\vector.dll") {
    Write-Host ""
    Write-Host "pgvector is already installed at: $PgRoot\lib\vector.dll" -ForegroundColor Yellow
    $response = Read-Host "Do you want to reinstall/upgrade? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Installation cancelled." -ForegroundColor Yellow
        exit 0
    }
}

Write-Host ""
Write-Host "Installing pgvector to: $PgRoot" -ForegroundColor Yellow

# Copy files
try {
    # Copy vector.dll
    Write-Host "  Copying vector.dll..." -ForegroundColor Gray
    Copy-Item "$pgvectorSrc\lib\vector.dll" "$PgRoot\lib\" -Force

    # Copy extension files
    Write-Host "  Copying extension files..." -ForegroundColor Gray
    Copy-Item "$pgvectorSrc\share\extension\vector.control" "$PgRoot\share\extension\" -Force
    Copy-Item "$pgvectorSrc\share\extension\vector--*.sql" "$PgRoot\share\extension\" -Force

    Write-Host ""
    Write-Host "pgvector installed successfully!" -ForegroundColor Green
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to copy files: $_" -ForegroundColor Red
    if (-not $isAdmin) {
        Write-Host ""
        Write-Host "Try running this script as Administrator:" -ForegroundColor Yellow
        Write-Host "  Right-click PowerShell > Run as Administrator" -ForegroundColor Yellow
        Write-Host "  Then run: .\scripts\install-pgvector.ps1" -ForegroundColor Yellow
    }
    exit 1
}

# Test the extension
Write-Host ""
Write-Host "To enable pgvector in your database:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Connect to your database:" -ForegroundColor White
Write-Host "     psql -U postgres -d your_database" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Create the extension:" -ForegroundColor White
Write-Host "     CREATE EXTENSION IF NOT EXISTS vector;" -ForegroundColor Gray
Write-Host ""
Write-Host "  3. Verify it's installed:" -ForegroundColor White
Write-Host "     SELECT * FROM pg_extension WHERE extname = 'vector';" -ForegroundColor Gray
Write-Host ""

# If PostgreSQL service is running, we could also test creating extension
$pgService = Get-Service -Name "postgresql*" -ErrorAction SilentlyContinue | Where-Object { $_.Status -eq "Running" }
if ($pgService) {
    Write-Host "PostgreSQL service is running: $($pgService.Name)" -ForegroundColor Green
    Write-Host ""
    Write-Host "For HotM, create the database and extension:" -ForegroundColor Cyan
    Write-Host "  psql -U postgres -c 'CREATE DATABASE hotm_dev;'" -ForegroundColor Gray
    Write-Host "  psql -U postgres -d hotm_dev -c 'CREATE EXTENSION IF NOT EXISTS vector;'" -ForegroundColor Gray
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "pgvector installation complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
