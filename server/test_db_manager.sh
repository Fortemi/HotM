#!/bin/bash
# Test Database Manager for HotM server
# Handles setup, cleanup, and lifecycle management of test database

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test database configuration
TEST_CONTAINER_NAME="hotm_test_postgres"
TEST_PORT=5433
TEST_DB_NAME="hotm_test"
TEST_USER="postgres"
TEST_PASSWORD="postgres"
POSTGRES_IMAGE="pgvector/pgvector:pg16"

# Function to print colored output
print_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }

# Function to cleanup existing test containers
cleanup_test_db() {
    print_info "Cleaning up existing test database containers..."
    
    # Stop and remove any containers using the test port or name
    local containers=$(docker ps -aq --filter "name=$TEST_CONTAINER_NAME" 2>/dev/null || true)
    if [ ! -z "$containers" ]; then
        print_info "Stopping and removing existing test container..."
        docker stop $containers 2>/dev/null || true
        docker rm $containers 2>/dev/null || true
    fi
    
    # Also check for any containers using port 5433
    local port_containers=$(docker ps --filter "publish=$TEST_PORT" -q 2>/dev/null || true)
    if [ ! -z "$port_containers" ]; then
        print_info "Stopping containers using test port $TEST_PORT..."
        docker stop $port_containers 2>/dev/null || true
        docker rm $port_containers 2>/dev/null || true
    fi
    
    # Check for act containers that might be lingering
    local act_containers=$(docker ps -aq --filter "name=act-*postgres*" 2>/dev/null || true)
    if [ ! -z "$act_containers" ]; then
        print_info "Cleaning up act test containers..."
        docker stop $act_containers 2>/dev/null || true
        docker rm $act_containers 2>/dev/null || true
    fi
    
    print_success "Cleanup complete"
}

# Function to setup fresh test database
setup_test_db() {
    print_info "Setting up fresh test database..."
    
    # Start PostgreSQL container
    docker run -d \
        --name $TEST_CONTAINER_NAME \
        -e POSTGRES_USER=$TEST_USER \
        -e POSTGRES_PASSWORD=$TEST_PASSWORD \
        -e POSTGRES_DB=postgres \
        -p $TEST_PORT:5432 \
        --health-cmd="pg_isready -U $TEST_USER" \
        --health-interval=10s \
        --health-timeout=5s \
        --health-retries=5 \
        $POSTGRES_IMAGE
    
    print_info "Waiting for PostgreSQL to be ready..."
    
    # Wait for container to be healthy
    for i in {1..30}; do
        if docker ps --filter "name=$TEST_CONTAINER_NAME" --filter "health=healthy" | grep -q $TEST_CONTAINER_NAME; then
            print_success "PostgreSQL container is healthy"
            break
        fi
        echo "Attempt $i/30 - waiting for container to be healthy..."
        sleep 2
    done
    
    # Verify connection
    if ! pg_isready -h localhost -p $TEST_PORT -U $TEST_USER; then
        print_error "Failed to connect to test database"
        exit 1
    fi
    
    # Create test database
    export PGPASSWORD=$TEST_PASSWORD
    print_info "Creating test database: $TEST_DB_NAME"
    createdb -h localhost -p $TEST_PORT -U $TEST_USER $TEST_DB_NAME || {
        print_warning "Database might already exist, continuing..."
    }
    
    # Create pgvector extension
    print_info "Setting up pgvector extension..."
    psql -h localhost -p $TEST_PORT -U $TEST_USER -d $TEST_DB_NAME -c "CREATE EXTENSION IF NOT EXISTS vector;" || {
        print_error "Failed to create pgvector extension"
        exit 1
    }
    
    # Run migrations
    print_info "Running database migrations..."
    cd /home/manitcor/dev/hotm/server
    export DATABASE_URL="postgres://$TEST_USER:$TEST_PASSWORD@localhost:$TEST_PORT/$TEST_DB_NAME"
    sqlx migrate run --database-url="$DATABASE_URL" || {
        print_error "Failed to run migrations"
        exit 1
    }
    
    print_success "Test database setup complete!"
    print_info "Database URL: postgres://$TEST_USER:$TEST_PASSWORD@localhost:$TEST_PORT/$TEST_DB_NAME"
}

# Function to run tests with proper environment
run_tests() {
    print_info "Running tests with clean database..."
    
    cd /home/manitcor/dev/hotm/server
    
    export DATABASE_URL="postgres://$TEST_USER:$TEST_PASSWORD@localhost:$TEST_PORT/$TEST_DB_NAME"
    export TEST_DATABASE_URL="postgres://$TEST_USER:$TEST_PASSWORD@localhost:$TEST_PORT"
    export USE_MOCK_AI=true
    export RUST_LOG=debug
    export RUST_BACKTRACE=1
    
    print_info "Environment variables set:"
    echo "  DATABASE_URL=$DATABASE_URL"
    echo "  TEST_DATABASE_URL=$TEST_DATABASE_URL"
    echo "  USE_MOCK_AI=$USE_MOCK_AI"
    echo ""
    
    cargo test --all-features "$@"
}

# Function to show status
show_status() {
    print_info "Test database status:"
    
    if docker ps --filter "name=$TEST_CONTAINER_NAME" | grep -q $TEST_CONTAINER_NAME; then
        print_success "Test container is running"
        docker ps --filter "name=$TEST_CONTAINER_NAME" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
        
        if pg_isready -h localhost -p $TEST_PORT -U $TEST_USER 2>/dev/null; then
            print_success "Database is accepting connections"
        else
            print_warning "Database is not ready"
        fi
    else
        print_warning "No test container found"
    fi
    
    # Show any other containers using our port
    local port_containers=$(docker ps --filter "publish=$TEST_PORT" -q 2>/dev/null || true)
    if [ ! -z "$port_containers" ] && ! docker ps --filter "name=$TEST_CONTAINER_NAME" -q | grep -q "$port_containers"; then
        print_warning "Other containers found using port $TEST_PORT:"
        docker ps --filter "publish=$TEST_PORT" --format "table {{.Names}}\t{{.Image}}\t{{.Ports}}"
    fi
}

# Main command handling
case "$1" in
    "cleanup")
        cleanup_test_db
        ;;
    "setup")
        cleanup_test_db
        setup_test_db
        ;;
    "test")
        shift
        run_tests "$@"
        ;;
    "full")
        shift
        cleanup_test_db
        setup_test_db
        run_tests "$@"
        ;;
    "status")
        show_status
        ;;
    *)
        echo "Usage: $0 {cleanup|setup|test|full|status}"
        echo ""
        echo "Commands:"
        echo "  cleanup  - Stop and remove existing test database containers"
        echo "  setup    - Create fresh test database (includes cleanup)"
        echo "  test     - Run tests with existing database"
        echo "  full     - Cleanup, setup fresh database, and run tests"
        echo "  status   - Show current test database status"
        echo ""
        echo "Examples:"
        echo "  $0 full                    # Complete fresh test run"
        echo "  $0 test                    # Run tests with existing DB"
        echo "  $0 test integration        # Run specific test file"
        echo "  $0 cleanup                 # Clean up containers"
        exit 1
        ;;
esac