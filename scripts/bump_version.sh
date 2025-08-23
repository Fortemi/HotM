#!/bin/bash
# HotM Version Bumping Script
# Usage: ./scripts/bump_version.sh <new_version> [channel]
# Examples: 
#   ./scripts/bump_version.sh 0.2.0           # Uses current channel from release.json
#   ./scripts/bump_version.sh 0.2.0 alpha     # Sets channel to alpha
#   ./scripts/bump_version.sh 0.2.0 stable    # Sets channel to stable

set -e

NEW_VERSION="$1"
NEW_CHANNEL="$2"

if [ -z "$NEW_VERSION" ]; then
    echo "Usage: $0 <new_version> [channel]"
    echo "Examples:"
    echo "  $0 0.2.0           # Uses current channel from release.json"
    echo "  $0 0.2.0 alpha     # Sets channel to alpha"
    echo "  $0 0.2.0 stable    # Sets channel to stable"
    echo ""
    echo "Available channels: alpha, beta, rc, stable"
    exit 1
fi

# Validate version format (clean semantic versioning for package managers)
if ! [[ "$NEW_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be clean semantic versioning (e.g., 1.0.0)"
    echo "Release channel suffixes are handled separately in the tag"
    exit 1
fi

# Get current channel or use provided channel
if [ -n "$NEW_CHANNEL" ]; then
    # Validate channel
    case "$NEW_CHANNEL" in
        alpha|beta|rc|stable)
            CHANNEL="$NEW_CHANNEL"
            ;;
        *)
            echo "Error: Invalid channel '$NEW_CHANNEL'. Must be: alpha, beta, rc, stable"
            exit 1
            ;;
    esac
    
    # Update release.json with new channel
    echo "Updating release channel to: $CHANNEL"
    sed -i "s/\"channel\": \".*\"/\"channel\": \"$CHANNEL\"/" release.json
else
    # Read current channel from release.json
    CHANNEL=$(grep '"channel"' release.json | sed 's/.*"channel": "\([^"]*\)".*/\1/')
    if [ -z "$CHANNEL" ]; then
        CHANNEL="beta"  # Default fallback
    fi
fi

# Determine tag suffix
if [ "$CHANNEL" = "stable" ]; then
    TAG_VERSION="v$NEW_VERSION"
    DISPLAY_VERSION="$NEW_VERSION"
else
    TAG_VERSION="v$NEW_VERSION-$CHANNEL"
    DISPLAY_VERSION="$NEW_VERSION-$CHANNEL"
fi

echo "Bumping HotM to version $NEW_VERSION (channel: $CHANNEL)"
echo "Git tag will be: $TAG_VERSION"
echo "=================================================="

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
echo "✅ Version bumped to $DISPLAY_VERSION"
echo "   - Package versions: $NEW_VERSION (clean for package managers)"
echo "   - Release channel: $CHANNEL"
echo ""
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Commit changes: git add -A && git commit -m 'chore: bump version to $DISPLAY_VERSION'"
echo "3. Create tag: git tag $TAG_VERSION"
echo "4. Push tag: git push origin $TAG_VERSION"
echo "5. GitHub Actions will automatically build and release as '$DISPLAY_VERSION'"