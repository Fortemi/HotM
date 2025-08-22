#!/bin/bash

echo "Setting up Ollama models for HotM"
echo "=================================="

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "Error: Ollama is not running. Please start Ollama first."
    exit 1
fi

echo "Ollama is running. Checking models..."

# Check for generation model
if curl -s http://localhost:11434/api/tags | jq -e '.models[] | select(.name == "gpt-oss:20b")' > /dev/null 2>&1; then
    echo "✓ Generation model (gpt-oss:20b) is already installed"
else
    echo "Pulling generation model (gpt-oss:20b)..."
    ollama pull gpt-oss:20b
fi

# Check for embedding model
if curl -s http://localhost:11434/api/tags | jq -e '.models[] | select(.name == "nomic-embed-text")' > /dev/null 2>&1; then
    echo "✓ Embedding model (nomic-embed-text) is already installed"
else
    echo "Pulling embedding model (nomic-embed-text)..."
    ollama pull nomic-embed-text
fi

echo ""
echo "Available models:"
curl -s http://localhost:11434/api/tags | jq '.models[].name'

echo ""
echo "Setup complete! You can now run the HotM server."