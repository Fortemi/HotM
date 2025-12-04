# Start PostgreSQL with pgvector in Docker for development (Windows PowerShell)
# No need for manual PostgreSQL installation!

Write-Host "🚀 Starting PostgreSQL with pgvector for HotM development..." -ForegroundColor Green

# Check if Docker is installed
try {
    $null = docker --version
} catch {
    Write-Host "❌ Docker is not installed. Please install Docker Desktop:" -ForegroundColor Red
    Write-Host "   https://www.docker.com/products/docker-desktop" -ForegroundColor Yellow
    exit 1
}

# Check if Docker daemon is running
try {
    $null = docker info 2>$null
    if ($LASTEXITCODE -ne 0) {
        throw "Docker daemon not running"
    }
} catch {
    Write-Host "❌ Docker daemon is not running. Please start Docker Desktop." -ForegroundColor Red
    exit 1
}

# Configuration
$ContainerName = "hotm-postgres-dev"
$DbUser = "hotm"
$DbPass = "hotm_dev_pass"
$DbName = "hotm_dev"
$DbPort = if ($env:DB_PORT) { $env:DB_PORT } else { "5433" }

# Check if container already exists
$existingContainer = docker ps -a --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }
$runningContainer = docker ps --format "{{.Names}}" | Where-Object { $_ -eq $ContainerName }

if ($existingContainer) {
    if ($runningContainer) {
        Write-Host "✅ PostgreSQL container is already running" -ForegroundColor Green
    } else {
        Write-Host "🔄 Starting existing PostgreSQL container..." -ForegroundColor Yellow
        docker start $ContainerName | Out-Null
    }
} else {
    Write-Host "📦 Creating new PostgreSQL container with pgvector..." -ForegroundColor Yellow
    docker run -d `
        --name $ContainerName `
        -e POSTGRES_USER=$DbUser `
        -e POSTGRES_PASSWORD=$DbPass `
        -e POSTGRES_DB=$DbName `
        -p "${DbPort}:5432" `
        -v hotm_postgres_data:/var/lib/postgresql/data `
        pgvector/pgvector:pg16 `
        postgres `
        -c shared_preload_libraries='vector' `
        -c max_connections=200 `
        -c shared_buffers=256MB | Out-Null
}

# Wait for PostgreSQL to be ready
Write-Host "⏳ Waiting for PostgreSQL to be ready..." -ForegroundColor Yellow
$maxAttempts = 30
for ($i = 1; $i -le $maxAttempts; $i++) {
    $ready = docker exec $ContainerName pg_isready -U $DbUser -d $DbName 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PostgreSQL is ready!" -ForegroundColor Green
        break
    }
    if ($i -eq $maxAttempts) {
        Write-Host "❌ PostgreSQL failed to start within 30 seconds" -ForegroundColor Red
        exit 1
    }
    Start-Sleep -Seconds 1
}

# Ensure pgvector extension is created
Write-Host "🔧 Ensuring pgvector extension..." -ForegroundColor Yellow
docker exec $ContainerName psql -U $DbUser -d $DbName -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>$null | Out-Null

# Set connection info
$DatabaseUrl = "postgres://${DbUser}:${DbPass}@localhost:${DbPort}/${DbName}"
$env:DATABASE_URL = $DatabaseUrl

Write-Host ""
Write-Host "✅ PostgreSQL is running with pgvector!" -ForegroundColor Green
Write-Host "📍 Connection URL: $DatabaseUrl" -ForegroundColor Cyan
Write-Host ""
Write-Host "To connect with psql:" -ForegroundColor Yellow
Write-Host "  docker exec -it $ContainerName psql -U $DbUser -d $DbName"
Write-Host ""
Write-Host "To stop the database:" -ForegroundColor Yellow
Write-Host "  docker stop $ContainerName"
Write-Host ""
Write-Host "To remove the database (WARNING: deletes all data):" -ForegroundColor Yellow
Write-Host "  docker rm -f $ContainerName; docker volume rm hotm_postgres_data"
Write-Host ""
Write-Host "Set environment variable for this session:" -ForegroundColor Green
Write-Host "  `$env:DATABASE_URL = `"$DatabaseUrl`""