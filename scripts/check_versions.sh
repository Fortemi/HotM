#!/bin/bash
# Script to check current version across all project files

echo -e "\033[36m🔍 Current Version Status\033[0m"
echo "=========================="

# Check UI package.json
if [ -f "ui/package.json" ]; then
    UI_VERSION=$(jq -r '.version' "ui/package.json")
    echo -e "UI package.json:       \033[32m$UI_VERSION\033[0m"
else
    echo -e "UI package.json:       \033[31mNOT FOUND\033[0m"
fi

# Check Tauri Cargo.toml
if [ -f "ui/src-tauri/Cargo.toml" ]; then
    TAURI_VERSION=$(grep '^version = ' "ui/src-tauri/Cargo.toml" | head -1 | sed 's/version = "\(.*\)"/\1/')
    echo -e "Tauri Cargo.toml:      \033[32m$TAURI_VERSION\033[0m"
else
    echo -e "Tauri Cargo.toml:      \033[31mNOT FOUND\033[0m"
fi

# Check Tauri config
if [ -f "ui/src-tauri/tauri.conf.json" ]; then
    TAURI_CONFIG_VERSION=$(jq -r '.version' "ui/src-tauri/tauri.conf.json")
    echo -e "Tauri config:          \033[32m$TAURI_CONFIG_VERSION\033[0m"
else
    echo -e "Tauri config:          \033[31mNOT FOUND\033[0m"
fi

echo ""

# Check for consistency
VERSIONS=()
[ ! -z "$UI_VERSION" ] && VERSIONS+=("$UI_VERSION")
[ ! -z "$TAURI_VERSION" ] && VERSIONS+=("$TAURI_VERSION")
[ ! -z "$TAURI_CONFIG_VERSION" ] && VERSIONS+=("$TAURI_CONFIG_VERSION")
UNIQUE_VERSIONS=($(printf "%s\n" "${VERSIONS[@]}" | sort -u))

if [ ${#UNIQUE_VERSIONS[@]} -eq 1 ]; then
    echo -e "\033[32m✅ All versions are consistent: ${UNIQUE_VERSIONS[0]}\033[0m"
elif [ ${#UNIQUE_VERSIONS[@]} -gt 1 ]; then
    echo -e "\033[31m❌ Version mismatch detected!\033[0m"
    echo -e "\033[33mFound versions: ${UNIQUE_VERSIONS[*]}\033[0m"
    echo -e "\033[33mRun: ./scripts/bump_version.sh <desired_version>\033[0m"
else
    echo -e "\033[33m⚠️  No version files found\033[0m"
fi
