#!/usr/bin/env bash
set -euo pipefail

# Simple dev server script
if [ ! -d ".venv" ]; then
  python -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt

export HOTM_DATA_DIR="${HOTM_DATA_DIR:-$(pwd)/data}"
mkdir -p "$HOTM_DATA_DIR/notes"

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
