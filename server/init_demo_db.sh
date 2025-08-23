#!/bin/bash

# Initialize demo database with sample content
# This script rebuilds the database and creates demonstration notes

set -e

echo "🔄 Rebuilding database from scratch..."

# Load environment variables
source ../.env

# Use sqlx directly which handles the DATABASE_URL properly
echo "📦 Dropping existing database (if exists)..."
echo "Note: It's OK if the drop fails - it just means the database doesn't exist yet"

# We'll use sqlx database commands which handle the URL parsing correctly
sqlx database drop -y 2>/dev/null || true
echo "📦 Creating fresh database..."
sqlx database create

# The pgvector extension will be created by the migration
echo "🔧 pgvector extension will be installed by migrations..."

# Run migrations
echo "🚀 Running migrations..."
sqlx migrate run

echo "✅ Database initialized successfully!"
echo ""
echo "🎯 Now start the server and run seed_demo_content.sh to populate with demo data"