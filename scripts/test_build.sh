#!/bin/bash

# Script to test build for both server and UI
# Run this before committing to catch build errors

set -e  # Exit on error

echo "=== Testing HotM Build ==="
echo ""

# Test server build
echo "1. Testing Rust server build..."
cd server
cargo build --release
echo "✅ Server build successful"
echo ""

# Test UI TypeScript build
echo "2. Testing UI TypeScript build..."
cd ../ui
# Generate icons first (will use Node.js version on Linux)
npm run generate-icons
npm run build
echo "✅ UI TypeScript build successful"
echo ""

# Test Tauri build (debug mode for speed)
echo "3. Testing Tauri desktop build..."
cd src-tauri
cargo build
echo "✅ Tauri build successful"
echo ""

echo "=== All builds passed successfully! ==="