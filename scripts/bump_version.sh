#!/bin/bash
# HotM Version Bumping Script
# Usage: ./scripts/bump_version.sh <new_version>
# Example: ./scripts/bump_version.sh 0.2.0

set -e

NEW_VERSION="$1"

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <new_version>"
    echo "Example: $0 0.2.0"
    exit 1
fi

# Validate version format (semantic versioning)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$ ]]; then
    echo "Error: Version must follow semantic versioning (e.g., 1.0.0, 1.0.0-alpha, 1.0.0+build)"
    exit 1
fi

echo "Bumping HotM version to $NEW_VERSION"
echo "====================================="

# Update Cargo.toml files
echo "1. Updating Rust packages..."
sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" server/Cargo.toml
sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" ui/src-tauri/Cargo.toml

# Update package.json
echo "2. Updating Node.js package..."
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" ui/package.json

# Update Tauri config
echo "3. Updating Tauri configuration..."
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" ui/src-tauri/tauri.conf.json

# Update README badge
echo "4. Updating README badge..."
sed -i "s/version-.*-blue/version-$NEW_VERSION-blue/" README.md

# Update API documentation
echo "5. Updating API documentation..."
sed -i "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" docs/02-specifications/api-specification.md

echo ""
echo "✅ Version bumped to $NEW_VERSION in all files"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Commit changes: git add -A && git commit -m 'chore: bump version to $NEW_VERSION'"
echo "3. Create tag: git tag v$NEW_VERSION"
echo "4. Push tag: git push origin v$NEW_VERSION"
echo "5. GitHub Actions will automatically build and release"