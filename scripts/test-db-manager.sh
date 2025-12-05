#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# HotM Test Database Manager
# =============================================================================
# Manages test database lifecycle for development, testing, and CI/CD.
# Supports both Docker-based and native PostgreSQL installations.
#
# Usage:
#   ./scripts/test-db-manager.sh <command> [options]
#
# Commands:
#   start     - Start/create test database (uses Docker by default)
#   stop      - Stop test database container
#   reset     - Drop and recreate schema (greenfield rebuild)
#   status    - Show database status and connection info
#   refresh   - Refresh SQLx query cache (.sqlx/)
#   teardown  - Completely remove database and volumes
#
# Options:
#   --native  - Use native PostgreSQL instead of Docker
#   --ci      - CI mode: minimal output, fail fast
#   --port N  - Use port N (default: 5433)
# =============================================================================

# Colors (disabled in CI mode)
setup_colors() {
    if [[ "${CI_MODE:-false}" == "true" || ! -t 1 ]]; then
        RED=''; GREEN=''; YELLOW=''; BLUE=''; NC=''
    else
        RED='\033[0;31m'
        GREEN='\033[0;32m'
        YELLOW='\033[1;33m'
        BLUE='\033[0;34m'
        NC='\033[0m'
    fi
}

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
CONTAINER_NAME="hotm-postgres-test"
DB_USER="${DB_USER:-postgres}"
DB_PASS="${DB_PASS:-postgres}"
DB_NAME="${DB_NAME:-hotm_test}"
DB_PORT="${DB_PORT:-5433}"
USE_NATIVE=false
CI_MODE=false

# Parse arguments
parse_args() {
    COMMAND="${1:-help}"
    shift || true

    while [[ $# -gt 0 ]]; do
        case $1 in
            --native)
                USE_NATIVE=true
                shift
                ;;
            --ci)
                CI_MODE=true
                shift
                ;;
            --port)
                DB_PORT="$2"
                shift 2
                ;;
            *)
                echo "Unknown option: $1"
                exit 1
                ;;
        esac
    done
}

# Logging
log_info() { echo -e "${BLUE}ℹ${NC} $1"; }
log_success() { echo -e "${GREEN}✓${NC} $1"; }
log_warn() { echo -e "${YELLOW}⚠${NC} $1"; }
log_error() { echo -e "${RED}✗${NC} $1"; }

# Get database URL
get_db_url() {
    echo "postgres://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}/${DB_NAME}"
}

get_base_url() {
    echo "postgres://${DB_USER}:${DB_PASS}@localhost:${DB_PORT}"
}

# Check Docker availability
check_docker() {
    if ! command -v docker >/dev/null 2>&1; then
        log_error "Docker is not installed"
        return 1
    fi
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        return 1
    fi
    return 0
}

# Check if container is running
is_container_running() {
    docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"
}

# Check if container exists
container_exists() {
    docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"
}

# Wait for PostgreSQL to be ready
wait_for_postgres() {
    local max_attempts="${1:-30}"
    local attempt=1

    log_info "Waiting for PostgreSQL to be ready..."

    while [[ $attempt -le $max_attempts ]]; do
        if docker exec "${CONTAINER_NAME}" pg_isready -U "${DB_USER}" >/dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            return 0
        fi

        if [[ $attempt -eq $max_attempts ]]; then
            log_error "PostgreSQL failed to start within ${max_attempts} seconds"
            return 1
        fi

        sleep 1
        ((attempt++))
    done
}

# Start database
cmd_start() {
    log_info "Starting HotM test database..."

    if [[ "$USE_NATIVE" == "true" ]]; then
        log_info "Using native PostgreSQL (assuming it's running)"
        # Just verify connection
        if PGPASSWORD="${DB_PASS}" psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -c '\q' 2>/dev/null; then
            log_success "Connected to native PostgreSQL"
        else
            log_error "Cannot connect to native PostgreSQL on port ${DB_PORT}"
            exit 1
        fi
    else
        check_docker || exit 1

        if is_container_running; then
            log_success "Test database container already running"
        elif container_exists; then
            log_info "Starting existing container..."
            docker start "${CONTAINER_NAME}"
            wait_for_postgres
        else
            log_info "Creating new test database container..."
            docker run -d \
                --name "${CONTAINER_NAME}" \
                -e POSTGRES_USER="${DB_USER}" \
                -e POSTGRES_PASSWORD="${DB_PASS}" \
                -e POSTGRES_DB="${DB_NAME}" \
                -p "${DB_PORT}:5432" \
                pgvector/pgvector:pg16 \
                postgres \
                -c shared_preload_libraries='vector' \
                -c max_connections=200 \
                -c shared_buffers=128MB

            wait_for_postgres
        fi
    fi

    # Ensure database exists
    ensure_database

    # Apply schema
    apply_schema

    echo ""
    log_success "Test database ready!"
    echo ""
    echo "Connection URL: $(get_db_url)"
    echo ""
    echo "To use in tests:"
    echo "  export DATABASE_URL=\"$(get_db_url)\""
    echo "  export TEST_DATABASE_URL=\"$(get_base_url)\""
}

# Ensure database exists
ensure_database() {
    log_info "Ensuring database '${DB_NAME}' exists..."

    if [[ "$USE_NATIVE" == "true" ]]; then
        PGPASSWORD="${DB_PASS}" createdb -h localhost -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" 2>/dev/null || true
        PGPASSWORD="${DB_PASS}" psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
        PGPASSWORD="${DB_PASS}" psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
    else
        docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -tc \
            "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1 || \
            docker exec "${CONTAINER_NAME}" createdb -U "${DB_USER}" "${DB_NAME}"

        docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || true
        docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";" 2>/dev/null || true
    fi

    log_success "Database ready with pgvector extension"
}

# Apply clean schema
apply_schema() {
    local schema_file="${PROJECT_ROOT}/scripts/schema/clean-schema.sql"

    if [[ ! -f "$schema_file" ]]; then
        log_warn "Clean schema file not found, trying migrations..."
        apply_migrations
        return
    fi

    log_info "Applying clean schema..."

    if [[ "$USE_NATIVE" == "true" ]]; then
        PGPASSWORD="${DB_PASS}" psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
            -f "$schema_file" >/dev/null 2>&1 || {
            log_warn "Schema might already exist, continuing..."
        }
    else
        docker exec -i "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
            < "$schema_file" >/dev/null 2>&1 || {
            log_warn "Schema might already exist, continuing..."
        }
    fi

    log_success "Schema applied"
}

# Apply migrations (fallback)
apply_migrations() {
    log_info "Applying migrations with sqlx..."

    if ! command -v sqlx >/dev/null 2>&1; then
        log_warn "sqlx-cli not installed, skipping migrations"
        return
    fi

    cd "${PROJECT_ROOT}/server"
    DATABASE_URL="$(get_db_url)" sqlx migrate run || {
        log_warn "Migration might have already been applied"
    }

    log_success "Migrations applied"
}

# Stop database
cmd_stop() {
    log_info "Stopping test database..."

    if [[ "$USE_NATIVE" == "true" ]]; then
        log_warn "Cannot stop native PostgreSQL via this script"
        return
    fi

    if is_container_running; then
        docker stop "${CONTAINER_NAME}"
        log_success "Container stopped"
    else
        log_warn "Container not running"
    fi
}

# Reset database (drop and recreate)
cmd_reset() {
    log_info "Resetting test database (greenfield rebuild)..."

    if [[ "$USE_NATIVE" == "true" ]]; then
        PGPASSWORD="${DB_PASS}" dropdb -h localhost -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" --if-exists
        PGPASSWORD="${DB_PASS}" createdb -h localhost -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}"
        PGPASSWORD="${DB_PASS}" psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS vector;"
        PGPASSWORD="${DB_PASS}" psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    else
        if ! is_container_running; then
            log_error "Container not running. Start it first with: $0 start"
            exit 1
        fi

        docker exec "${CONTAINER_NAME}" dropdb -U "${DB_USER}" "${DB_NAME}" --if-exists
        docker exec "${CONTAINER_NAME}" createdb -U "${DB_USER}" "${DB_NAME}"
        docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS vector;"
        docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
            -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
    fi

    apply_schema

    log_success "Database reset complete"
}

# Show status
cmd_status() {
    echo "═══════════════════════════════════════════════════════════════"
    echo "  HotM Test Database Status"
    echo "═══════════════════════════════════════════════════════════════"
    echo ""

    if [[ "$USE_NATIVE" == "true" ]]; then
        echo "Mode: Native PostgreSQL"
        if PGPASSWORD="${DB_PASS}" pg_isready -h localhost -p "${DB_PORT}" -U "${DB_USER}" >/dev/null 2>&1; then
            echo -e "Status: ${GREEN}RUNNING${NC}"
        else
            echo -e "Status: ${RED}NOT CONNECTED${NC}"
        fi
    else
        echo "Mode: Docker Container"
        echo "Container: ${CONTAINER_NAME}"

        if is_container_running; then
            echo -e "Status: ${GREEN}RUNNING${NC}"
        elif container_exists; then
            echo -e "Status: ${YELLOW}STOPPED${NC}"
        else
            echo -e "Status: ${RED}NOT CREATED${NC}"
        fi
    fi

    echo ""
    echo "Configuration:"
    echo "  Host:     localhost"
    echo "  Port:     ${DB_PORT}"
    echo "  Database: ${DB_NAME}"
    echo "  User:     ${DB_USER}"
    echo ""
    echo "Connection URLs:"
    echo "  DATABASE_URL:      $(get_db_url)"
    echo "  TEST_DATABASE_URL: $(get_base_url)"
    echo ""

    # Check if we can connect
    if is_container_running || [[ "$USE_NATIVE" == "true" ]]; then
        echo "Tables:"
        if [[ "$USE_NATIVE" == "true" ]]; then
            PGPASSWORD="${DB_PASS}" psql -h localhost -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" \
                -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || \
                echo "  (unable to query)"
        else
            docker exec "${CONTAINER_NAME}" psql -U "${DB_USER}" -d "${DB_NAME}" \
                -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null || \
                echo "  (unable to query)"
        fi
    fi

    echo ""
}

# Refresh SQLx query cache
cmd_refresh() {
    log_info "Refreshing SQLx query cache..."

    # Ensure database is running with schema
    if ! is_container_running && [[ "$USE_NATIVE" != "true" ]]; then
        log_info "Starting database first..."
        cmd_start
    fi

    if ! command -v cargo >/dev/null 2>&1; then
        log_error "cargo not found"
        exit 1
    fi

    cd "${PROJECT_ROOT}/server"

    log_info "Running cargo sqlx prepare..."
    DATABASE_URL="$(get_db_url)" cargo sqlx prepare || {
        log_error "Failed to prepare SQLx queries"
        exit 1
    }

    log_success "SQLx query cache refreshed"
    echo ""
    echo "The .sqlx/ directory has been updated."
    echo "Commit these changes to enable SQLX_OFFLINE=true builds."
}

# Teardown (complete removal)
cmd_teardown() {
    log_warn "This will completely remove the test database and all data!"

    if [[ "$CI_MODE" != "true" ]]; then
        read -p "Are you sure? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Cancelled"
            return
        fi
    fi

    if [[ "$USE_NATIVE" == "true" ]]; then
        PGPASSWORD="${DB_PASS}" dropdb -h localhost -p "${DB_PORT}" -U "${DB_USER}" "${DB_NAME}" --if-exists
        log_success "Database dropped"
    else
        if container_exists; then
            docker rm -f "${CONTAINER_NAME}" 2>/dev/null || true
            log_success "Container removed"
        fi

        # Note: We don't remove the volume here as it might be shared
        log_info "Volume 'hotm_postgres_test_data' preserved (remove manually if needed)"
    fi
}

# Show help
cmd_help() {
    echo "HotM Test Database Manager"
    echo ""
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start     Start/create test database"
    echo "  stop      Stop test database container"
    echo "  reset     Drop and recreate schema (greenfield rebuild)"
    echo "  status    Show database status and connection info"
    echo "  refresh   Refresh SQLx query cache (.sqlx/)"
    echo "  teardown  Completely remove database"
    echo "  help      Show this help message"
    echo ""
    echo "Options:"
    echo "  --native  Use native PostgreSQL instead of Docker"
    echo "  --ci      CI mode: minimal output, fail fast"
    echo "  --port N  Use port N (default: 5433)"
    echo ""
    echo "Environment Variables:"
    echo "  DB_USER   Database user (default: postgres)"
    echo "  DB_PASS   Database password (default: postgres)"
    echo "  DB_NAME   Database name (default: hotm_test)"
    echo "  DB_PORT   Database port (default: 5433)"
    echo ""
    echo "Examples:"
    echo "  $0 start              # Start test database in Docker"
    echo "  $0 reset              # Reset to clean schema"
    echo "  $0 refresh            # Update SQLx query cache"
    echo "  $0 start --native     # Use native PostgreSQL"
    echo "  $0 start --ci         # CI mode for GitHub Actions"
}

# Main
main() {
    parse_args "$@"
    setup_colors

    case "$COMMAND" in
        start)    cmd_start ;;
        stop)     cmd_stop ;;
        reset)    cmd_reset ;;
        status)   cmd_status ;;
        refresh)  cmd_refresh ;;
        teardown) cmd_teardown ;;
        help|--help|-h) cmd_help ;;
        *)
            log_error "Unknown command: $COMMAND"
            cmd_help
            exit 1
            ;;
    esac
}

main "$@"
