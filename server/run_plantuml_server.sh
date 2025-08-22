#!/bin/bash

# Script to run PlantUML server alongside the API server
# PlantUML server will run on port 8080

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLANTUML_DIR="${SCRIPT_DIR}/plantuml-server"
PLANTUML_WAR="${PLANTUML_DIR}/plantuml.war"
JETTY_RUNNER="${PLANTUML_DIR}/jetty-runner.jar"
PORT=8080

echo -e "\033[36m===================================\033[0m"
echo -e "\033[36m   PlantUML Server Launcher\033[0m"
echo -e "\033[36m===================================\033[0m"
echo ""

# Check if Java is installed
if ! command -v java &> /dev/null; then
    echo -e "\033[31m❌ Error: Java is not installed\033[0m"
    echo "Please install Java 8 or higher"
    exit 1
fi

# Check if WAR file exists
if [ ! -f "$PLANTUML_WAR" ]; then
    echo -e "\033[31m❌ Error: PlantUML WAR not found at $PLANTUML_WAR\033[0m"
    echo "Please download it first"
    exit 1
fi

# Check if Jetty runner exists
if [ ! -f "$JETTY_RUNNER" ]; then
    echo -e "\033[31m❌ Error: Jetty runner not found at $JETTY_RUNNER\033[0m"
    echo "Please download it first"
    exit 1
fi

# Check if port is already in use
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo -e "\033[33m⚠️  Port $PORT is already in use\033[0m"
    echo "PlantUML server might already be running"
    read -p "Kill existing process and restart? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Killing existing process..."
        lsof -ti:$PORT | xargs kill -9 2>/dev/null
        sleep 1
    else
        exit 0
    fi
fi

echo -e "\033[32m✓ Java is installed\033[0m"
java -version 2>&1 | head -1

echo -e "\033[32m✓ PlantUML WAR found\033[0m"
echo -e "\033[32m✓ Jetty runner found\033[0m"
echo ""

echo -e "\033[36mStarting PlantUML server on port $PORT...\033[0m"
echo -e "\033[90mServer will be available at: http://localhost:$PORT/plantuml\033[0m"
echo ""

# Run the server
java -jar "$JETTY_RUNNER" --port $PORT "$PLANTUML_WAR"