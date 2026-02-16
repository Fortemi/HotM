#!/bin/bash

# Script to test build for UI and Tauri desktop
# Run this before committing to catch build errors

set -e  # Exit on error

echo "=== Testing HotM Build ==="
echo ""

# Test UI TypeScript build
echo "1. Testing UI TypeScript build..."
cd ui
# Generate icons first (will use Node.js version on Linux)
npm run generate-icons
npm run build
echo "✅ UI TypeScript build successful"
echo ""

# Test Tauri build (debug mode for speed)
echo "2. Testing Tauri desktop build..."
cd src-tauri
cargo build
echo "✅ Tauri build successful"
echo ""

echo "=== All builds passed successfully! ==="
