#!/bin/bash
# Quick run script for HotM server

source .env
echo "Starting HotM server..."
echo "Database: ${DATABASE_URL%%@*}@***"
echo "API will be available at: http://127.0.0.1:53211/api/v1"
echo ""
cargo run