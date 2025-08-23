#!/bin/bash
# CI Database setup script for HotM server
set -e

echo "🔧 HotM CI Database Setup"
echo "========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# CI specific values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-hotm_test}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

echo "Creating test database: $DB_NAME"

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER; then
        echo -e "${GREEN}✓ PostgreSQL is ready${NC}"
        break
    fi
    echo "Attempt $i/30 - waiting for PostgreSQL..."
    sleep 2
done

# Create the test database
echo "Creating database $DB_NAME..."
export PGPASSWORD=$DB_PASSWORD
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME || {
    echo -e "${YELLOW}⚠ Database might already exist, continuing...${NC}"
}

# Create pgvector extension
echo "Setting up pgvector extension..."
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
    echo -e "${RED}❌ Failed to create pgvector extension${NC}"
    exit 1
}

echo -e "${GREEN}✓ pgvector extension ready${NC}"

# Export the DATABASE_URL for tests
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

echo ""
echo -e "${GREEN}✅ CI Database setup complete!${NC}"
echo "Test Database URL: $DATABASE_URL"
echo ""