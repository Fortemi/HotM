#!/usr/bin/env bash
set -euo pipefail

# Start PostgreSQL with pgvector in Docker for development
# No need for manual PostgreSQL installation!

echo "🚀 Starting PostgreSQL with pgvector for HotM development..."

# Check if Docker is installed
if ! command -v docker >/dev/null 2>&1; then
    echo "❌ Docker is not installed. Please install Docker first:"
    echo "   - Windows/Mac: https://www.docker.com/products/docker-desktop"
    echo "   - Linux: https://docs.docker.com/engine/install/"
    exit 1
fi

# Check if Docker daemon is running
if ! docker info >/dev/null 2>&1; then
    echo "❌ Docker daemon is not running. Please start Docker Desktop or the Docker service."
    exit 1
fi

# Configuration - use custom credentials if provided, otherwise defaults
CONTAINER_NAME="hotm-postgres-dev"
DB_USER="${CUSTOM_DB_USER:-hotm}"
DB_PASS="${CUSTOM_DB_PASS:-hotm_dev_pass}"
DB_NAME="${CUSTOM_DB_NAME:-hotm_dev}"
DB_PORT="${CUSTOM_DB_PORT:-${DB_PORT:-5433}}"

# Check if container already exists
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    if docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        echo "✅ PostgreSQL container is already running"
    else
        echo "🔄 Starting existing PostgreSQL container..."
        docker start "${CONTAINER_NAME}"
    fi
else
    echo "📦 Creating new PostgreSQL container with pgvector..."
    docker run -d \
        --name "${CONTAINER_NAME}" \
        -e POSTGRES_USER="${DB_USER}" \
        -e POSTGRES_PASSWORD="${DB_PASS}" \
        -e POSTGRES_DB="${DB_NAME}" \
        -p "${DB_PORT}:5432" \
        -v hotm_postgres_data:/var/lib/postgresql/data \
        pgvector/pgvector:pg16 \
        postgres \
        -c shared_preload_libraries='vector' \
        -c max_connections=200 \
        -c shared_buffers=256MB
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start within 30 seconds"
        exit 1
    fi
    sleep 1
done

# Ensure pgvector extension is created
echo "🔧 Ensuring pgvector extension..."
docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true

# Export connection info
export DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"

echo ""
echo "✅ PostgreSQL is running with pgvector!"
echo "📍 Connection URL: ${DATABASE_URL}"
echo ""
echo "To connect with psql:"
echo "  docker exec -it ${CONTAINER_NAME} psql -U ${DB_USER} -d ${DB_NAME}"
echo ""
echo "To stop the database:"
echo "  docker stop ${CONTAINER_NAME}"
echo ""
echo "To remove the database (WARNING: deletes all data):"
echo "  docker rm -f ${CONTAINER_NAME} && docker volume rm hotm_postgres_data"
echo ""

# Return the connection URL for scripts to use
echo "export DATABASE_URL=\"${DATABASE_URL}\""