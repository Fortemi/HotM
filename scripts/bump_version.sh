#!/bin/bash
# Bash script to bump version across HotM client files

set -e

if [ $# -eq 0 ]; then
    echo "Error: Version number required"
    echo "Usage: $0 <version> (e.g., $0 0.1.3)"
    exit 1
fi

NEW_VERSION=$1

# Validate version format (basic semver check)
if ! [[ $NEW_VERSION =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "Error: Version must be in format x.y.z (e.g., 0.1.3)"
    exit 1
fi

echo -e "\033[36mBumping version to: $NEW_VERSION\033[0m"
echo ""

# Update UI package.json
UI_PACKAGE_JSON="ui/package.json"
if [ -f "$UI_PACKAGE_JSON" ]; then
    echo -e "\033[33mUpdating UI package.json...\033[0m"
    OLD_VERSION=$(jq -r '.version' "$UI_PACKAGE_JSON")
    jq ".version = \"$NEW_VERSION\"" "$UI_PACKAGE_JSON" > "$UI_PACKAGE_JSON.tmp" && mv "$UI_PACKAGE_JSON.tmp" "$UI_PACKAGE_JSON"
    echo -e "  \033[32m$OLD_VERSION → $NEW_VERSION\033[0m"
else
    echo -e "\033[33mWarning: UI package.json not found\033[0m"
fi

# Update Tauri Cargo.toml
TAURI_CARGO="ui/src-tauri/Cargo.toml"
if [ -f "$TAURI_CARGO" ]; then
    echo -e "\033[33mUpdating Tauri Cargo.toml...\033[0m"
    OLD_VERSION=$(grep '^version = ' "$TAURI_CARGO" | head -1 | sed 's/version = "\(.*\)"/\1/')
    sed -i "0,/^version = /s/^version = .*/version = \"$NEW_VERSION\"/" "$TAURI_CARGO"
    if [ ! -z "$OLD_VERSION" ]; then
        echo -e "  \033[32m$OLD_VERSION → $NEW_VERSION\033[0m"
    fi
else
    echo -e "\033[33mWarning: Tauri Cargo.toml not found\033[0m"
fi

# Update Tauri config
TAURI_CONFIG="ui/src-tauri/tauri.conf.json"
if [ -f "$TAURI_CONFIG" ]; then
    echo -e "\033[33mUpdating Tauri config...\033[0m"
    OLD_VERSION=$(jq -r '.version' "$TAURI_CONFIG")
    jq ".version = \"$NEW_VERSION\"" "$TAURI_CONFIG" > "$TAURI_CONFIG.tmp" && mv "$TAURI_CONFIG.tmp" "$TAURI_CONFIG"
    echo -e "  \033[32m$OLD_VERSION → $NEW_VERSION\033[0m"
else
    echo -e "\033[33mWarning: Tauri config not found\033[0m"
fi

echo ""
echo -e "\033[32m✅ Version bump complete!\033[0m"
echo ""
echo -e "\033[33mNext steps:\033[0m"
echo -e "\033[37m1. Review the changes: git diff\033[0m"
echo -e "\033[37m2. Test the build: cd ui && npm run build\033[0m"
echo -e "\033[37m3. Commit the changes: git add . && git commit -m 'bump: version $NEW_VERSION'\033[0m"
echo -e "\033[37m4. Tag the release: git tag v$NEW_VERSION\033[0m"
echo -e "\033[37m5. Push: git push && git push --tags\033[0m"
