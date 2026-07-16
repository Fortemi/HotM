#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOTM_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FORTEMI_ROOT="$(cd "$HOTM_ROOT/.." && pwd)/fortemi"
ROUTE_VERIFIER="$HOTM_ROOT/.aiwg/testing/scripts/fortemi-route-coverage.py"
ROUTE_JSON="$HOTM_ROOT/.aiwg/api/compatibility/fortemi-v2026-07-route-coverage.json"

if ! command -v python3 >/dev/null 2>&1; then
  echo "error: python3 is required for Fortemi route inventory verification" >&2
  exit 127
fi

if [[ ! -e "$FORTEMI_ROOT/.git" ]]; then
  echo "error: expected Fortemi sibling checkout at $FORTEMI_ROOT" >&2
  echo "clone or mount Fortemi as ../fortemi before running this preflight" >&2
  exit 2
fi

if [[ ! -f "$ROUTE_VERIFIER" ]]; then
  echo "error: route verifier not found at $ROUTE_VERIFIER" >&2
  exit 2
fi

cd "$HOTM_ROOT"
python3 "$ROUTE_VERIFIER" --check

python3 - "$ROUTE_JSON" <<'PY'
import json
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = json.loads(path.read_text())
diagnostics = data.get("verifier_diagnostics", {})
print(
    "verified Fortemi route inventory: "
    f"commit={data.get('fortemi_commit')} "
    f"tag={data.get('fortemi_latest_tag')} "
    f"routes={data.get('route_count')} "
    f"families={len(data.get('family_counts', {}))} "
    f"status_counts={data.get('status_counts')} "
    f"diagnostics={diagnostics}"
)
PY
