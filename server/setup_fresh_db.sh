#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Setting up fresh HotM database${NC}"

# Load environment variables
if [ -f "../.env" ]; then
    source ../.env
    echo -e "${GREEN}✅ Loaded environment from ../.env${NC}"
elif [ -f ".env" ]; then
    source .env
    echo -e "${GREEN}✅ Loaded environment from .env${NC}"
else
    echo -e "${RED}❌ No .env file found! Please create one with DATABASE_URL${NC}"
    exit 1
fi

# Parse DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL not set in environment${NC}"
    exit 1
fi

# Extract components from DATABASE_URL
# Format: postgres://username:password@host:port/database
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

echo -e "${YELLOW}Database Configuration:${NC}"
echo "  Host: $DB_HOST:$DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if PostgreSQL is running
echo -e "${YELLOW}Checking PostgreSQL connection...${NC}"
export PGPASSWORD=$DB_PASS
if psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c '\q' 2>/dev/null; then
    echo -e "${GREEN}✅ PostgreSQL is accessible${NC}"
else
    echo -e "${RED}❌ Cannot connect to PostgreSQL. Please ensure:${NC}"
    echo "  1. PostgreSQL is running"
    echo "  2. User '$DB_USER' exists with password"
    echo "  3. Host '$DB_HOST:$DB_PORT' is accessible"
    exit 1
fi

# Drop and recreate database
echo -e "${YELLOW}Recreating database '$DB_NAME'...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres <<EOF
DROP DATABASE IF EXISTS $DB_NAME;
CREATE DATABASE $DB_NAME;
EOF
echo -e "${GREEN}✅ Database recreated${NC}"

# Create pgvector extension
echo -e "${YELLOW}Installing pgvector extension...${NC}"
psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME <<EOF
CREATE EXTENSION IF NOT EXISTS vector;
EOF
echo -e "${GREEN}✅ pgvector extension installed${NC}"

# Run migrations
echo -e "${YELLOW}Running migrations...${NC}"
export DATABASE_URL  # Make sure it's exported for sqlx
if command -v sqlx &> /dev/null; then
    sqlx migrate run
    echo -e "${GREEN}✅ Migrations completed${NC}"
else
    echo -e "${YELLOW}⚠️  sqlx-cli not found, running SQL directly...${NC}"
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < migrations/0001_complete_mvp_schema.sql
    psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < migrations/0002_add_progress_message.sql 2>/dev/null || true
    echo -e "${GREEN}✅ SQL migrations completed${NC}"
fi

echo ""
echo -e "${GREEN}🎉 Database setup complete!${NC}"
echo -e "${YELLOW}You can now start the server with:${NC}"
echo "  cd server && cargo run"
echo ""
echo -e "${YELLOW}Or use the development script:${NC}"
echo "  ./scripts/dev_server.sh"