#!/usr/bin/env bash
set -euo pipefail
API=${API:-http://127.0.0.1:53211/api/v1}

note_id=$(curl -sS -X POST "$API/notes" -H 'Content-Type: application/json' -d '{"content":"Smoke test note","format":"markdown","source":"api"}' | jq -r .noteId)
[ -n "$note_id" ]

curl -sS "$API/notes/$note_id" | jq .note.note.id >/dev/null
curl -sS "$API/search?q=smoke&mode=hybrid" | jq .hits >/dev/null
curl -sS "$API/semantic" -X POST -H 'Content-Type: application/json' -d '{"text":"smoke"}' | jq .similar >/dev/null

echo "OK: note_id=$note_id"
