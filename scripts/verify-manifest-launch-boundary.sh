#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
manifest="${ROOT_DIR}/.aiwg/architecture/manifest-schema-v1.md"
issue_draft="${ROOT_DIR}/.aiwg/issues/checkpoint-issue-drafts-2026-07.md"
proof_plan="${ROOT_DIR}/.aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md"
fixture="${ROOT_DIR}/.aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs"
failures=0

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  failures=$((failures + 1))
}

require_file() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    fail "missing file: ${file}"
  fi
}

require_text() {
  local file="$1"
  local text="$2"
  if ! grep -Fq "$text" "$file"; then
    fail "missing '${text}' in ${file}"
  fi
}

require_file "$manifest"
require_file "$issue_draft"
require_file "$proof_plan"
require_file "$fixture"

if [[ "$failures" -ne 0 ]]; then
  exit 1
fi

# HUX-REQ-013: hosted/mobile manifest discovery remains a production-claim
# no-go until the unauthenticated endpoint has launch-rate proof.
# Proof-plan artifact: HotM/.aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md
require_text "$manifest" "GET /v1/manifest"
require_text "$manifest" "unauthenticated"
require_text "$manifest" "60 requests/minute"
require_text "$manifest" "Provisional checkpoint planning value"
require_text "$manifest" "must replace or justify the launch value before public/hosted/mobile production claims"
require_text "$manifest" "Launch-boundary update, 2026-07"
require_text "$manifest" "Fortemi/HotM#251"
require_text "$manifest" ".aiwg/testing/manifest-launch-rate-limit-proof-plan-2026-07.md"
require_text "$manifest" "must replace or justify the launch baseline"
require_text "$manifest" "This does not block the current fixture-backed HotM enterprise preview"
require_text "$manifest" "429 Too Many Requests"
require_text "$manifest" "Retry-After"
require_text "$manifest" "ETag"
require_text "$manifest" "Cache-Control"
require_text "$issue_draft" "Fortemi/HotM#251"
require_text "$issue_draft" "Replace or justify the provisional 60 requests/minute launch value"
require_text "$issue_draft" "Define the enforcement layer"
require_text "$issue_draft" "HTTP \`429 Too Many Requests\`, \`Retry-After\`, cache/ETag behavior under rate limiting, and non-bypass by cache headers"
require_text "$issue_draft" "not a blocker for the current fixture-backed enterprise demo"
require_text "$proof_plan" "Fortemi/HotM#251"
require_text "$proof_plan" "launch baseline"
require_text "$proof_plan" "Enforcement layer"
require_text "$proof_plan" "Cache headers do not bypass"
require_text "$proof_plan" "Do not close \`Fortemi/HotM#251\` with documentation only."
require_text "$proof_plan" "node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs"
require_text "$proof_plan" "local fixture proof does not close \`Fortemi/HotM#251\`"
require_text "$fixture" "statuses: [200, 304, 405, 429]"
require_text "$fixture" "cache_header_non_bypass: true"

fixture_output="$(mktemp "${TMPDIR:-/tmp}/hotm-manifest-launch-rate-fixture.XXXXXX.json")"
(cd "$ROOT_DIR" && node .aiwg/testing/scripts/validate-manifest-launch-rate-limit-fixture.mjs >"$fixture_output")
require_text "$fixture_output" '"ok": true'
require_text "$fixture_output" '"route": "/v1/manifest"'
require_text "$fixture_output" '"cache_header_non_bypass": true'
rm -f "$fixture_output"

if [[ "$failures" -ne 0 ]]; then
  printf 'manifest launch boundary check failed with %d issue(s)\n' "$failures" >&2
  exit 1
fi

echo "manifest launch boundary check passed"
