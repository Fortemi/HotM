# One-command bootstrap and run for HotM server (Windows PowerShell)
# Automatically starts PostgreSQL in Docker if needed
# Prereqs: Docker (for auto-PostgreSQL), Rust toolchain, optional Ollama

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting HotM Development Server..." -ForegroundColor Green

# Get root directory
$RootDir = Split-Path -Parent $PSScriptRoot
Push-Location $RootDir

try {
    # Check cargo
    try {
        $null = cargo --version
    } catch {
        Write-Host "[ERROR] Rust cargo not found. Install Rust from https://rustup.rs and re-run." -ForegroundColor Red
        exit 1
    }

    # Function to test PostgreSQL connection
    function Test-PostgresConnection {
        param([string]$ConnectionString)
        
        try {
            # Try with psql if available
            $null = psql --version 2>$null
            $output = psql $ConnectionString -c "SELECT 1;" 2>&1
            return $LASTEXITCODE -eq 0
        } catch {
            # Try with Docker if container is running
            $containerRunning = docker ps --format "{{.Names}}" 2>$null | Where-Object { $_ -eq "hotm-postgres-dev" }
            if ($containerRunning) {
                $output = docker exec hotm-postgres-dev psql -U hotm -d hotm_dev -c "SELECT 1;" 2>&1
                return $LASTEXITCODE -eq 0
            }
            return $false
        }
    }

    # Check DATABASE_URL and test connection
    $DatabaseNeedsSetup = $false
    if (-not $env:DATABASE_URL) {
        Write-Host "[INFO] DATABASE_URL not set. Setting up PostgreSQL..." -ForegroundColor Yellow
        $DatabaseNeedsSetup = $true
    } else {
        Write-Host "[INFO] Testing PostgreSQL connection..." -ForegroundColor Yellow
        if (-not (Test-PostgresConnection $env:DATABASE_URL)) {
            Write-Host "[WARN] Cannot connect to PostgreSQL at $env:DATABASE_URL" -ForegroundColor Yellow
            $DatabaseNeedsSetup = $true
        } else {
            Write-Host "[INFO] PostgreSQL connection successful!" -ForegroundColor Green
        }
    }

    # Start PostgreSQL if needed
    if ($DatabaseNeedsSetup) {
        # Try to auto-start PostgreSQL with Docker
        try {
            $null = docker --version
            Write-Host "[INFO] Starting PostgreSQL with Docker..." -ForegroundColor Yellow
            
            # Run the start-postgres script
            & "$RootDir\scripts\start-postgres.ps1"
            
            # Set the DATABASE_URL for this session
            $env:DATABASE_URL = "postgres://hotm:hotm_dev_pass@localhost:5433/hotm_dev"
            
            # Wait and test connection
            Start-Sleep -Seconds 2
            if (-not (Test-PostgresConnection $env:DATABASE_URL)) {
                Write-Host "[ERROR] Failed to connect to PostgreSQL after starting container" -ForegroundColor Red
                exit 1
            }
        } catch {
            Write-Host "[ERROR] PostgreSQL not accessible and Docker not available." -ForegroundColor Red
            Write-Host "  Option 1: Install Docker Desktop to auto-start PostgreSQL" -ForegroundColor Yellow
            Write-Host "  Option 2: Start PostgreSQL manually and set DATABASE_URL" -ForegroundColor Yellow
            Write-Host '    $env:DATABASE_URL = "postgres://user:pass@localhost:5433/hotm_dev"' -ForegroundColor Cyan
            exit 1
        }
    }

    # Ensure pgvector extension
    Write-Host "[INFO] Ensuring 'vector' extension exists..." -ForegroundColor Yellow
    try {
        # Try with psql if available
        $null = psql --version 2>$null
        psql $env:DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>$null | Out-Null
    } catch {
        # Try with Docker
        $containerRunning = docker ps --format "{{.Names}}" | Where-Object { $_ -eq "hotm-postgres-dev" }
        if ($containerRunning) {
            Write-Host "[INFO] Ensuring 'vector' extension via Docker..." -ForegroundColor Yellow
            docker exec hotm-postgres-dev psql -U hotm -d hotm_dev -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>$null | Out-Null
        } else {
            Write-Host "[WARN] psql not found; skipping vector extension check. Ensure 'vector' is installed." -ForegroundColor Yellow
        }
    }

    # Ollama models (optional)
    try {
        $null = ollama --version 2>$null
        Write-Host "[INFO] Checking Ollama models..." -ForegroundColor Yellow
        
        $models = ollama list 2>$null
        if ($models -notmatch "gpt-oss:20b") {
            Write-Host "[INFO] Pulling gpt-oss:20b..." -ForegroundColor Yellow
            ollama pull gpt-oss:20b
        }
        if ($models -notmatch "nomic-embed-text") {
            Write-Host "[INFO] Pulling nomic-embed-text..." -ForegroundColor Yellow
            ollama pull nomic-embed-text
        }
    } catch {
        Write-Host "[WARN] Ollama not found; semantic features will be degraded. See https://ollama.com" -ForegroundColor Yellow
    }

    # Run the server
    Write-Host "[INFO] Starting HotM server on port 53211..." -ForegroundColor Green
    Set-Location "$RootDir\server"
    $env:RUST_LOG = "hotm_server=info,axum=info"
    cargo run

} finally {
    Pop-Location
}