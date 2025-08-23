#!/bin/bash

# Run HotM Tests
# This script runs all tests (frontend + backend) locally

set -e

echo "🧪 Running HotM Test Suite"
echo "=========================="

# Check if we're in the right directory
if [ ! -f "CLAUDE.md" ]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Frontend tests
echo "📱 Running Frontend Tests..."
echo "------------------------------"
cd ui
npm run test -- --run --reporter=verbose
echo "✅ Frontend tests completed"

echo ""
echo "🔧 Type checking..."
npm run typecheck
echo "✅ Type check completed"

echo ""
echo "📦 Building frontend..."
npm run build
echo "✅ Frontend build completed"

cd ..

# Backend tests  
echo ""
echo "🦀 Running Backend Tests..."
echo "----------------------------"

# Check for required environment variables
if [ -z "$DATABASE_URL" ] && [ -z "$TEST_DATABASE_URL" ]; then
    echo "⚠️  Neither DATABASE_URL nor TEST_DATABASE_URL is set"
    echo "   Setting up default test database URL..."
    export TEST_DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hotm_test"
    export DATABASE_URL="$TEST_DATABASE_URL"
fi

# Check if database is accessible
if ! pg_isready -h localhost -p 5432 -U postgres >/dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on localhost:5432"
    echo "   Please start PostgreSQL with pgvector extension"
    echo "   Or run: docker run --name postgres-test -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d pgvector/pgvector:pg16"
    exit 1
fi

echo "🔧 Checking code formatting..."
cd server
cargo fmt -- --check
echo "✅ Code formatting check completed"

echo ""
echo "🔍 Running clippy..."
cargo clippy -- -D warnings
echo "✅ Clippy check completed"

echo ""
echo "🧪 Running backend tests..."
RUST_LOG=off cargo test -- --nocapture
echo "✅ Backend tests completed"

cd ..

echo ""
echo "🎉 All tests passed successfully!"
echo "================================="