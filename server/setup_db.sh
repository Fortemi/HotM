#!/bin/bash

# Database setup script for HotM server
set -e

echo "🔧 HotM Database Setup"
echo "======================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-hotm_dev}"
DB_USER="${DB_USER:-hotm}"
DB_PASSWORD="${DB_PASSWORD:-hotm_dev_pass}"

echo "Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running on $DB_HOST:$DB_PORT${NC}"
    echo "Please start PostgreSQL first."
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Create the database and user
echo ""
echo "Setting up database and user..."
echo "You may be prompted for the postgres user password."
echo ""

# Create user and database SQL script
cat > /tmp/setup_hotm.sql << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
        CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

# Execute the setup
psql -U postgres -h $DB_HOST -p $DB_PORT -f /tmp/setup_hotm.sql 2>/dev/null || {
    echo -e "${YELLOW}⚠ Could not connect as postgres user.${NC}"
    echo "Trying with sudo..."
    sudo -u postgres psql -f /tmp/setup_hotm.sql || {
        echo -e "${RED}❌ Failed to create database/user${NC}"
        echo "You may need to manually create the database and user."
        echo ""
        echo "Manual steps:"
        echo "1. Connect to PostgreSQL: sudo -u postgres psql"
        echo "2. Run these commands:"
        echo "   CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';"
        echo "   CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        echo "   GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
        exit 1
    }
}

# Clean up
rm -f /tmp/setup_hotm.sql

echo -e "${GREEN}✓ Database and user created/verified${NC}"

# Create pgvector extension
echo ""
echo "Setting up pgvector extension..."

export PGPASSWORD=$DB_PASSWORD
psql -U $DB_USER -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || {
    echo -e "${YELLOW}⚠ Could not create pgvector extension as $DB_USER${NC}"
    echo "Trying with postgres user..."
    psql -U postgres -h $DB_HOST -p $DB_PORT -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || {
        sudo -u postgres psql -d $DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
            echo -e "${RED}❌ Failed to create pgvector extension${NC}"
            echo "Please install postgresql-pgvector package if not already installed:"
            echo "  sudo apt-get install postgresql-15-pgvector"
            exit 1
        }
    }
}

echo -e "${GREEN}✓ pgvector extension ready${NC}"

# Export the DATABASE_URL
export DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"

echo ""
echo -e "${GREEN}✅ Database setup complete!${NC}"
echo ""
echo "Database URL:"
echo "  $DATABASE_URL"
echo ""
echo "To use this database URL in your session:"
echo "  export DATABASE_URL=\"$DATABASE_URL\""
echo ""
echo "To make it permanent, add it to your ~/.bashrc or ~/.zshrc"

# Save the DATABASE_URL to a .env file for convenience
echo "DATABASE_URL=$DATABASE_URL" > .env
echo ""
echo "DATABASE_URL saved to .env file"