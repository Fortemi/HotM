#!/bin/bash

# Script to download PlantUML JAR for bundling with the application

PLANTUML_VERSION="1.2025.4"
PLANTUML_URL="https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml-${PLANTUML_VERSION}.jar"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TARGET_DIR="${SCRIPT_DIR}/../src-tauri/resources"
TARGET_FILE="${TARGET_DIR}/plantuml.jar"

echo -e "\033[36mDownloading PlantUML v${PLANTUML_VERSION}...\033[0m"

# Create resources directory if it doesn't exist
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "\033[33mCreating resources directory...\033[0m"
    mkdir -p "$TARGET_DIR"
fi

# Check if JAR already exists
if [ -f "$TARGET_FILE" ]; then
    echo -e "\033[33mPlantUML JAR already exists at ${TARGET_FILE}\033[0m"
    echo -e "\033[90mSize: $(du -h ${TARGET_FILE} | cut -f1)\033[0m"
    read -p "Do you want to re-download it? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "\033[32m✓ Using existing PlantUML JAR\033[0m"
        exit 0
    fi
fi

# Download PlantUML JAR
echo -e "\033[90mDownloading from: ${PLANTUML_URL}\033[0m"
if command -v wget &> /dev/null; then
    wget -q --show-progress -O "${TARGET_FILE}" "${PLANTUML_URL}"
elif command -v curl &> /dev/null; then
    curl -L --progress-bar -o "${TARGET_FILE}" "${PLANTUML_URL}"
else
    echo -e "\033[31m❌ Error: Neither wget nor curl is available. Please install one of them.\033[0m"
    exit 1
fi

if [ -f "${TARGET_FILE}" ]; then
    FILE_SIZE=$(du -h "${TARGET_FILE}" | cut -f1)
    echo -e "\033[32m✅ PlantUML JAR downloaded successfully!\033[0m"
    echo -e "\033[36mLocation: ${TARGET_FILE}\033[0m"
    echo -e "\033[36mSize: ${FILE_SIZE}\033[0m"
else
    echo -e "\033[31m❌ Error: Failed to download PlantUML JAR\033[0m"
    exit 1
fi

echo ""
echo -e "\033[33mNote: PlantUML requires Java to be installed on the system.\033[0m"
echo -e "\033[90mYou can check Java installation with: java -version\033[0m"