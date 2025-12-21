# HotM PostgreSQL Setup Script (Installer Version)
# Sets up PostgreSQL with pgvector using Docker
# This script is run during MSI installation when "Setup Database" is checked

param(
    [string]$SchemaFile = "$PSScriptRoot\clean-schema.sql"
)

$ErrorActionPreference = "Stop"

# Configuration
$ContainerName = "hotm-postgres"
$DbUser = "hotm"
$DbPass = "hotm_dev_pass"
$DbName = "hotm_dev"
$DbPort = "5433"

function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    # Also log to file for installer debugging
    Add-Content -Path "$PSScriptRoot\setup-log.txt" -Value $logMessage -ErrorAction SilentlyContinue
}

Write-Log "Starting HotM PostgreSQL setup..."

# Check if Docker is available
try {
    $null = docker --version
    Write-Log "Docker found."
} catch {
    Write-Log "ERROR: Docker is not installed or not in PATH."
    Write-Log "Please install Docker Desktop from https://www.docker.com/products/docker-desktop"
    exit 1
}

# Check if Docker daemon is running
try {
    $null = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon not running"
    }
    Write-Log "Docker daemon is running."
} catch {
    Write-Log "ERROR: Docker daemon is not running. Please start Docker Desktop."
    exit 1
}

# Check if container already exists
$existingContainer = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }
$runningContainer = docker ps --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }

if ($existingContainer) {
    if ($runningContainer) {
        Write-Log "PostgreSQL container '$ContainerName' is already running."
    } else {
        Write-Log "Starting existing PostgreSQL container..."
        docker start $ContainerName | Out-Null
    }
} else {
    Write-Log "Creating new PostgreSQL container with pgvector..."
    docker run -d `
        --name $ContainerName `
        -e POSTGRES_USER=$DbUser `
        -e POSTGRES_PASSWORD=$DbPass `
        -e POSTGRES_DB=$DbName `
        -p "${DbPort}:5432" `
        -v hotm_postgres_data:/var/lib/postgresql/data `
        --restart unless-stopped `
        pgvector/pgvector:pg16 `
        postgres `
        -c shared_preload_libraries='vector' `
        -c max_connections=200 `
        -c shared_buffers=256MB | Out-Null

    if ($LASTEXITCODE -ne 0) {
        Write-Log "ERROR: Failed to create Docker container."
        exit 1
    }
    Write-Log "Container created successfully."
}

# Wait for PostgreSQL to be ready
Write-Log "Waiting for PostgreSQL to be ready..."
$maxAttempts = 30
for ($i = 1; $i -le $maxAttempts; $i++) {
    $ready = docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "PostgreSQL is ready!"
        break
    }
    if ($i -eq $maxAttempts) {
        Write-Log "ERROR: PostgreSQL failed to start within 30 seconds."
        exit 1
    }
    Start-Sleep -Seconds 1
}

# Ensure pgvector extension is created
Write-Log "Ensuring pgvector extension..."
docker exec $ContainerName psql -U $DbUser -d $DbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>$null | Out-Null

# Apply schema if file exists
if (Test-Path $SchemaFile) {
    Write-Log "Applying database schema from $SchemaFile..."
    Get-Content $SchemaFile | docker exec -i $ContainerName psql -U $DbUser -d $DbName 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Log "Schema applied successfully."
    } else {
        Write-Log "WARNING: Schema application may have had issues. Check database manually."
    }
} else {
    Write-Log "Schema file not found at $SchemaFile - skipping schema setup."
}

# Create test database if needed
Write-Log "Ensuring test database exists..."
docker exec $ContainerName psql -U $DbUser -d postgres -c "CREATE DATABASE hotm_test WITH OWNER $DbUser;" 2>$null | Out-Null
docker exec $ContainerName psql -U $DbUser -d hotm_test -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>$null | Out-Null

$DatabaseUrl = "postgres://${DbUser}:${DbPass}@localhost:${DbPort}/${DbName}"

Write-Log ""
Write-Log "PostgreSQL setup complete!"
Write-Log "Connection URL: $DatabaseUrl"
Write-Log ""
Write-Log "Container: $ContainerName"
Write-Log "Port: $DbPort"
Write-Log "User: $DbUser"
Write-Log "Database: $DbName"

# Set system environment variable for HotM Server service
try {
    [Environment]::SetEnvironmentVariable("HOTM_DATABASE_URL", $DatabaseUrl, "Machine")
    Write-Log "Set HOTM_DATABASE_URL system environment variable."
} catch {
    Write-Log "WARNING: Could not set system environment variable (requires admin)."
}

Write-Log "Setup completed successfully."
exit 0
