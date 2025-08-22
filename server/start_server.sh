#!/bin/bash

# HotM Server Start Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════╗"
echo "║      Hall of the Mind Server         ║"
echo "║         Starting Up...                ║"
echo "╚═══════════════════════════════════════╝"
echo -e "${NC}"

# Check if .env file exists, if not run setup
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠ No .env file found. Running database setup...${NC}"
    ./setup_db.sh
    echo ""
fi

# Load environment variables from .env
if [ -f .env ]; then
    export $(cat .env | xargs)
    echo -e "${GREEN}✓ Loaded environment from .env${NC}"
fi

# Verify DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}❌ DATABASE_URL is not set${NC}"
    echo "Please run ./setup_db.sh first or set DATABASE_URL manually"
    exit 1
fi

echo "Database URL: ${DATABASE_URL%%@*}@***"
echo ""

# Check if PostgreSQL is accessible
if ! pg_isready -h localhost > /dev/null 2>&1; then
    echo -e "${RED}❌ PostgreSQL is not running${NC}"
    echo "Please start PostgreSQL first:"
    echo "  sudo service postgresql start"
    exit 1
fi

echo -e "${GREEN}✓ PostgreSQL is running${NC}"

# Check if Ollama is running (optional)
if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Ollama is running${NC}"
    
    # Check for required models
    if curl -s http://localhost:11434/api/tags | grep -q "gpt-oss:20b"; then
        echo -e "${GREEN}  ✓ gpt-oss:20b model found${NC}"
    else
        echo -e "${YELLOW}  ⚠ gpt-oss:20b model not found${NC}"
        echo "    To enable AI features, run: ollama pull gpt-oss:20b"
    fi
    
    if curl -s http://localhost:11434/api/tags | grep -q "nomic-embed-text"; then
        echo -e "${GREEN}  ✓ nomic-embed-text model found${NC}"
    else
        echo -e "${YELLOW}  ⚠ nomic-embed-text model not found${NC}"
        echo "    To enable embeddings, run: ollama pull nomic-embed-text"
    fi
else
    echo -e "${YELLOW}⚠ Ollama is not running (AI features will be disabled)${NC}"
    echo "  To enable AI features: ollama serve"
fi

# Check for PlantUML server (optional)
echo ""
if command -v java &> /dev/null; then
    # Check if PlantUML server is already running
    if curl -s http://localhost:8080 > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PlantUML server is already running${NC}"
    else
        # Try to start PlantUML server
        if [ -f plantuml.jar ]; then
            echo -e "${YELLOW}Starting PlantUML server on port 8080...${NC}"
            java -jar plantuml.jar -picoweb:8080 > /dev/null 2>&1 &
            PLANTUML_PID=$!
            sleep 2
            if curl -s http://localhost:8080 > /dev/null 2>&1; then
                echo -e "${GREEN}✓ PlantUML server started (PID: $PLANTUML_PID)${NC}"
            else
                echo -e "${YELLOW}⚠ PlantUML server failed to start${NC}"
            fi
        else
            echo -e "${YELLOW}⚠ PlantUML JAR not found (diagram rendering disabled)${NC}"
            echo "  To enable: wget https://github.com/plantuml/plantuml/releases/download/v1.2025.4/plantuml-1.2025.4.jar -O plantuml.jar"
        fi
    fi
else
    echo -e "${YELLOW}⚠ Java not installed (PlantUML diagrams will not work)${NC}"
fi

echo ""

# Run migrations
echo "Running database migrations..."
if command -v sqlx &> /dev/null; then
    sqlx migrate run || {
        echo -e "${YELLOW}⚠ Migrations failed or already applied${NC}"
    }
else
    echo -e "${YELLOW}⚠ sqlx-cli not installed, skipping migrations${NC}"
    echo "  Install with: cargo install sqlx-cli"
fi

echo ""
echo -e "${BLUE}Starting HotM Server...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Set logging level
export RUST_LOG="${RUST_LOG:-hotm_server=info,axum=info}"

# Run the server
cargo run --release

# Note: --release flag builds optimized version
# Remove --release for faster compilation during development