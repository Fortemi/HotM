#!/bin/bash

# Script to download PlantUML JAR for bundling with the application

PLANTUML_VERSION="1.2025.4"
PLANTUML_URL="https://github.com/plantuml/plantuml/releases/download/v${PLANTUML_VERSION}/plantuml-${PLANTUML_VERSION}.jar"
TARGET_DIR="../src-tauri/resources"
TARGET_FILE="${TARGET_DIR}/plantuml.jar"

echo "Downloading PlantUML v${PLANTUML_VERSION}..."

# Create resources directory if it doesn't exist
mkdir -p "${TARGET_DIR}"

# Download PlantUML JAR
if command -v wget &> /dev/null; then
    wget -O "${TARGET_FILE}" "${PLANTUML_URL}"
elif command -v curl &> /dev/null; then
    curl -L -o "${TARGET_FILE}" "${PLANTUML_URL}"
else
    echo "Error: Neither wget nor curl is available. Please install one of them."
    exit 1
fi

if [ -f "${TARGET_FILE}" ]; then
    echo "PlantUML JAR downloaded successfully to ${TARGET_FILE}"
    echo "Size: $(du -h ${TARGET_FILE} | cut -f1)"
else
    echo "Error: Failed to download PlantUML JAR"
    exit 1
fi