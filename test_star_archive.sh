#!/bin/bash

# Test script for star and archive functionality

API_BASE="http://localhost:53211/api/v1"
TEST_NOTE_ID="c4fa9d62-ee86-42fe-85c8-52f2d4301450"

echo "Testing Star and Archive Functionality"
echo "======================================="

# Function to get note status
get_status() {
    curl -s -X GET "$API_BASE/notes/$TEST_NOTE_ID" | jq '.note | {starred, archived}'
}

# Function to update status
update_status() {
    local json="$1"
    curl -s -X PUT "$API_BASE/notes/$TEST_NOTE_ID/status" \
        -H "Content-Type: application/json" \
        -d "$json" | jq -r '.status'
}

echo "1. Initial status:"
get_status

echo -e "\n2. Setting starred=true..."
update_status '{"starred": true}'
get_status

echo -e "\n3. Setting archived=true..."
update_status '{"archived": true}'
get_status

echo -e "\n4. Setting starred=false, archived=false..."
update_status '{"starred": false, "archived": false}'
get_status

echo -e "\n5. Testing both at once - starred=true, archived=true..."
update_status '{"starred": true, "archived": true}'
get_status

echo -e "\n6. Resetting to false..."
update_status '{"starred": false, "archived": false}'
get_status

echo -e "\n✅ All tests completed!"