#!/bin/bash

echo "Testing HotM AI Pipeline"
echo "========================"

API_BASE="http://localhost:53211/api/v1"

# Check health
echo -e "\n1. Checking server health..."
curl -s "$API_BASE/health" | jq '.'

# Create a test note
echo -e "\n2. Creating test note..."
NOTE_RESPONSE=$(curl -s -X POST "$API_BASE/notes" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "This is a test note for AI enhancement. It contains information about machine learning and artificial intelligence. We want to see if the AI will enhance this with proper markdown formatting and structure."
  }')

NOTE_ID=$(echo $NOTE_RESPONSE | jq -r '.note_id')
echo "Created note with ID: $NOTE_ID"

# Wait for AI processing
echo -e "\n3. Waiting 10 seconds for AI processing..."
sleep 10

# Fetch the note to see if it has a revision
echo -e "\n4. Fetching note with revision..."
NOTE_FULL=$(curl -s "$API_BASE/notes/$NOTE_ID")
echo "Note details:"
echo $NOTE_FULL | jq '.revised'

# Check debug info
echo -e "\n5. Checking debug info..."
curl -s "$API_BASE/debug/revisions" | jq '.'

# Test search
echo -e "\n6. Testing search..."
curl -s "$API_BASE/search?q=machine+learning&mode=hybrid" | jq '.'

echo -e "\nTest complete!"