#!/bin/bash
# Local test database setup script for HotM server
# Creates a test database on port 5433 to avoid conflicts with dev database

set -e

# Configuration
TEST_DB_PORT=${TEST_DB_PORT:-5433}
TEST_DB_NAME=${TEST_DB_NAME:-hotm_test_local}
TEST_DB_USER=${TEST_DB_USER:-hotm_test}
TEST_DB_PASS=${TEST_DB_PASS:-hotm_test_pass}

echo "Setting up local test database on port $TEST_DB_PORT..."

# Check if PostgreSQL is running on test port
if ! pg_isready -h localhost -p $TEST_DB_PORT -U postgres > /dev/null 2>&1; then
    echo "PostgreSQL is not running on port $TEST_DB_PORT"
    echo "Please start a PostgreSQL instance on port $TEST_DB_PORT or set TEST_DB_PORT to an available port"
    echo "Example: sudo -u postgres pg_ctl -D /var/lib/postgresql/test -o \"-p $TEST_DB_PORT\" -l /var/log/postgresql/test.log start"
    exit 1
fi

# Create test user
echo "Creating test user '$TEST_DB_USER'..."
psql -h localhost -p $TEST_DB_PORT -U postgres -c "CREATE USER $TEST_DB_USER WITH PASSWORD '$TEST_DB_PASS';" 2>/dev/null || echo "User already exists"

# Create test database
echo "Creating test database '$TEST_DB_NAME'..."
createdb -h localhost -p $TEST_DB_PORT -U postgres -O $TEST_DB_USER $TEST_DB_NAME 2>/dev/null || echo "Database already exists"

# Install pgvector extension
echo "Installing pgvector extension..."
psql -h localhost -p $TEST_DB_PORT -U postgres -d $TEST_DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;"

# Grant permissions
psql -h localhost -p $TEST_DB_PORT -U postgres -d $TEST_DB_NAME -c "GRANT ALL PRIVILEGES ON DATABASE $TEST_DB_NAME TO $TEST_DB_USER;"
psql -h localhost -p $TEST_DB_PORT -U postgres -d $TEST_DB_NAME -c "GRANT ALL ON SCHEMA public TO $TEST_DB_USER;"

echo "Test database setup complete!"
echo "Test database URL: postgresql://$TEST_DB_USER:$TEST_DB_PASS@localhost:$TEST_DB_PORT/$TEST_DB_NAME"
echo ""
echo "To run tests locally, use:"
echo "export TEST_DATABASE_URL=postgresql://$TEST_DB_USER:$TEST_DB_PASS@localhost:$TEST_DB_PORT/$TEST_DB_NAME"
echo "cd server && cargo test"