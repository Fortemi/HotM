#!/bin/bash
# ============================================================================
# HotM Database Schema Rebuild Script (Linux/WSL)
# ============================================================================
# Drops all tables and recreates from clean-schema.sql
# WARNING: This is DESTRUCTIVE and will delete ALL data
# Use only for development/testing!
# ============================================================================

set -e  # Exit on error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE="$SCRIPT_DIR/clean-schema.sql"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if DATABASE_URL is set
if [[ -z "${DATABASE_URL:-}" ]]; then
  echo -e "${RED}ERROR: DATABASE_URL environment variable is not set${NC}"
  echo "Example: export DATABASE_URL=postgres://user:pass@localhost:5432/hotm_dev"
  exit 1
fi

echo -e "${YELLOW}================================================${NC}"
echo -e "${YELLOW}HotM Database Schema Rebuild${NC}"
echo -e "${YELLOW}================================================${NC}"
echo ""
echo -e "${RED}WARNING: This will DELETE ALL DATA in the database!${NC}"
echo "Database: $DATABASE_URL"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
  echo "Rebuild cancelled."
  exit 0
fi

# Test connection
echo -e "${GREEN}[1/4] Testing database connection...${NC}"
if ! psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Cannot connect to database${NC}"
  echo "Please check your DATABASE_URL and ensure PostgreSQL is running."
  exit 1
fi

# Drop all tables (CASCADE to handle dependencies)
echo -e "${GREEN}[2/4] Dropping all tables and schemas...${NC}"
psql "$DATABASE_URL" <<EOF
-- Drop all tables, types, and functions
DROP SCHEMA IF EXISTS public CASCADE;
CREATE SCHEMA public;

-- Restore default permissions
GRANT ALL ON SCHEMA public TO PUBLIC;
GRANT ALL ON SCHEMA public TO postgres;
EOF

# Recreate extensions (must be done before schema)
echo -e "${GREEN}[3/4] Recreating extensions...${NC}"
psql "$DATABASE_URL" <<EOF
-- Recreate pgvector extension (CRITICAL: Must exist before vector columns)
CREATE EXTENSION IF NOT EXISTS vector;

-- Recreate UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF

# Execute clean-schema.sql
echo -e "${GREEN}[4/4] Executing clean schema...${NC}"
if [[ ! -f "$SCHEMA_FILE" ]]; then
  echo -e "${RED}ERROR: Schema file not found: $SCHEMA_FILE${NC}"
  exit 1
fi

psql "$DATABASE_URL" -f "$SCHEMA_FILE"

# Verify schema creation
echo ""
echo -e "${GREEN}Schema rebuild complete!${NC}"
echo ""
echo "Verifying tables created:"
psql "$DATABASE_URL" -c "\dt" | head -20

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}Database successfully reset to clean state${NC}"
echo -e "${GREEN}================================================${NC}"
