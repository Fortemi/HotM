#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/ui/test-results/live-asset-ci-receipt"
TAURI_RECEIPT_DIR="${ROOT_DIR}/ui/test-results/live-tauri-full-v1-receipt"
PROVENANCE="${ROOT_DIR}/release/live-asset-receipt-sidecar-provenance.json"
RUN_KEY="${GITHUB_RUN_ID:-local}-$$"
SAFE_RUN_KEY="$(printf '%s' "${RUN_KEY}" | tr -cd '[:alnum:]_-' | cut -c1-36)"
WORK_DIR="$(mktemp -d)"
FORTEMI_DIR="${WORK_DIR}/fortemi"
API_BINARY="${WORK_DIR}/matric-api"
API_LOG="${WORK_DIR}/api.log"
DB_CONTAINER="hotm-live-assets-db-${SAFE_RUN_KEY}"
DB_IMAGE="hotm-live-assets-testdb:${SAFE_RUN_KEY}"
API_PID=""

node_value() {
  node -e "const value=require(process.argv[1]); process.stdout.write(String(${1}));" "${PROVENANCE}"
}

free_port() {
  node -e '
    const server = require("node:net").createServer();
    server.listen(0, "127.0.0.1", () => {
      process.stdout.write(String(server.address().port));
      server.close();
    });
  '
}

cleanup() {
  local status=$?
  trap - EXIT INT TERM
  if [[ -n "${API_PID}" ]]; then
    kill "${API_PID}" >/dev/null 2>&1 || true
    wait "${API_PID}" >/dev/null 2>&1 || true
  fi
  docker rm -f "${DB_CONTAINER}" >/dev/null 2>&1 || true
  docker image rm -f "${DB_IMAGE}" >/dev/null 2>&1 || true
  if [[ "${HOTM_LIVE_PRESERVE_WORK:-0}" != "1" ]]; then
    rm -rf "${WORK_DIR}"
  fi
  exit "${status}"
}
trap cleanup EXIT INT TERM

FORTEMI_COMMIT="$(node_value 'value.target_commitish')"
FORTEMI_RELEASE="$(node_value 'value.release_tag')"
FORTEMI_SHA256="$(node_value 'value.assets["x86_64-unknown-linux-gnu"].sha256')"
DB_PORT="$(free_port)"
API_PORT="$(free_port)"
DB_USER="matric"
DB_NAME="matric_hotm_live"
DB_PASSWORD="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))')"
API_ROOT="http://127.0.0.1:${API_PORT}"
API_URL="${API_ROOT}/api/v1"

rm -rf "${OUTPUT_DIR}" "${TAURI_RECEIPT_DIR}"
mkdir -p "${OUTPUT_DIR}" "${TAURI_RECEIPT_DIR}"

git init -q "${FORTEMI_DIR}"
git -C "${FORTEMI_DIR}" remote add origin https://git.integrolabs.net/Fortemi/fortemi.git
git -C "${FORTEMI_DIR}" fetch -q --depth 1 origin "${FORTEMI_COMMIT}"
git -C "${FORTEMI_DIR}" checkout -q --detach FETCH_HEAD
[[ "$(git -C "${FORTEMI_DIR}" rev-parse HEAD)" == "${FORTEMI_COMMIT}" ]]

docker build -q -f "${FORTEMI_DIR}/build/Dockerfile.testdb" -t "${DB_IMAGE}" "${FORTEMI_DIR}" >/dev/null
docker run -d --name "${DB_CONTAINER}" \
  -p "127.0.0.1:${DB_PORT}:5432" \
  -e POSTGRES_USER="${DB_USER}" \
  -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
  -e POSTGRES_DB="${DB_NAME}" \
  "${DB_IMAGE}" >/dev/null

db_ready=false
for _ in $(seq 1 60); do
  if docker exec "${DB_CONTAINER}" pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
    db_ready=true
    break
  fi
  sleep 1
done
[[ "${db_ready}" == "true" ]]

SIDECAR_PROVENANCE_MANIFEST="${PROVENANCE}" \
  "${ROOT_DIR}/scripts/download-pinned-sidecar.sh" \
  x86_64-unknown-linux-gnu "${API_BINARY}" >/dev/null

node - "${WORK_DIR}/signing-key.json" "${WORK_DIR}/trusted-keys.json" <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const [privatePath, trustPath] = process.argv.slice(2);
const seed = Buffer.alloc(32, 17);
const prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
const privateKey = crypto.createPrivateKey({
  key: Buffer.concat([prefix, seed]),
  format: 'der',
  type: 'pkcs8',
});
const publicDer = crypto.createPublicKey(privateKey).export({ format: 'der', type: 'spki' });
const publicKey = publicDer.subarray(publicDer.length - 32).toString('base64url');
fs.writeFileSync(privatePath, `${JSON.stringify({
  key_id: 'hotm-live-ci-1',
  private_key: seed.toString('base64url'),
})}\n`, { mode: 0o600 });
fs.writeFileSync(trustPath, `${JSON.stringify([{
  key_id: 'hotm-live-ci-1',
  public_key: publicKey,
  revoked: false,
}])}\n`, { mode: 0o600 });
NODE

env \
  DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}" \
  MATRIC_GIT_SHA="${FORTEMI_COMMIT}" \
  HOST=127.0.0.1 \
  PORT="${API_PORT}" \
  REQUIRE_AUTH=true \
  FORTEMI_ALLOW_LOCAL_ISSUER=true \
  ISSUER_URL="${API_ROOT}" \
  ALLOWED_ORIGINS=http://localhost:1420,http://127.0.0.1:1420 \
  RATE_LIMIT_ENABLED=false \
  REDIS_URL=redis://127.0.0.1:1 \
  MATRIC_ATTACHMENT_SCAN_MODE=disabled \
  DISABLE_SUPPORT_MEMORY=true \
  FILE_STORAGE_PATH="${WORK_DIR}/storage" \
  TUS_STAGING_DIR="${WORK_DIR}/tus" \
  FORTEMI_SHARD_SIGNING_KEY_FILE="${WORK_DIR}/signing-key.json" \
  FORTEMI_SHARD_TRUSTED_KEYS_FILE="${WORK_DIR}/trusted-keys.json" \
  LOG_FORMAT=json \
  RUST_LOG=info \
  "${API_BINARY}" >"${API_LOG}" 2>&1 &
API_PID=$!

api_ready=false
for _ in $(seq 1 120); do
  if curl -fsS "${API_ROOT}/health" >"${WORK_DIR}/health.json" 2>/dev/null; then
    api_ready=true
    break
  fi
  if ! kill -0 "${API_PID}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
[[ "${api_ready}" == "true" ]]
[[ "$(node -e 'process.stdout.write(require(process.argv[1]).git_sha)' "${WORK_DIR}/health.json")" == "${FORTEMI_COMMIT}" ]]

registration="$(
  curl -fsS -X POST "${API_ROOT}/oauth/register" \
    -H 'Content-Type: application/json' \
    -d '{"client_name":"HotM live asset CI","grant_types":["client_credentials"],"scope":"read write"}'
)"
client_id="$(node -e 'const v=JSON.parse(process.argv[1]); process.stdout.write(v.client_id)' "${registration}")"
client_secret="$(node -e 'const v=JSON.parse(process.argv[1]); process.stdout.write(v.client_secret)' "${registration}")"
token_response="$(
  curl -fsS -X POST "${API_ROOT}/oauth/token" \
    -H 'Content-Type: application/x-www-form-urlencoded' \
    --data-urlencode 'grant_type=client_credentials' \
    --data-urlencode "client_id=${client_id}" \
    --data-urlencode "client_secret=${client_secret}" \
    --data-urlencode 'scope=read write'
)"
api_token="$(node -e 'const v=JSON.parse(process.argv[1]); process.stdout.write(v.access_token)' "${token_response}")"

browser_status=0
(
  cd "${ROOT_DIR}/ui"
  HOTM_LIVE_ASSET_E2E=1 \
  HOTM_LIVE_REQUIRE_AUTH=1 \
  HOTM_LIVE_MEMORY="hotm_live_browser_${SAFE_RUN_KEY}" \
  HOTM_API_URL="${API_URL}" \
  HOTM_API_TOKEN="${api_token}" \
  VITE_API_BEARER_TOKEN="${api_token}" \
  npm run test:e2e:live-assets
) || browser_status=$?

browser_metrics="$(
  find "${ROOT_DIR}/ui/test-results" -type f \
    -name hotm-live-asset-browser-metrics.json -print -quit
)"
if [[ "${browser_status}" -eq 0 && -n "${browser_metrics}" ]]; then
  (
    cd "${ROOT_DIR}/ui"
    npm run verify:live-asset-metrics
  ) || browser_status=$?
  mkdir -p "${OUTPUT_DIR}"
  cp "${browser_metrics}" "${OUTPUT_DIR}/browser-metrics.json"
fi

tauri_status=0
mkdir -p "${TAURI_RECEIPT_DIR}"
(
  cd "${ROOT_DIR}/ui/src-tauri"
  HOTM_LIVE_TAURI_API_URL="${API_URL}" \
  HOTM_LIVE_TAURI_SOURCE_MEMORY="hotm_live_tauri_source_${SAFE_RUN_KEY}" \
  HOTM_LIVE_TAURI_RECOVERY_MEMORY="hotm_live_tauri_recovery_${SAFE_RUN_KEY}" \
  HOTM_LIVE_TAURI_API_TOKEN="${api_token}" \
  HOTM_LIVE_TAURI_RECEIPT_PATH="../test-results/live-tauri-full-v1-receipt/receipt.json" \
  TAURI_CONFIG='{"bundle":{"externalBin":[]}}' \
  cargo test tests::live_fortemi_tauri_local_file_full_v1_recovery_receipt \
    -- --ignored --exact --nocapture
) || tauri_status=$?

if [[ "${tauri_status}" -eq 0 ]]; then
  mkdir -p "${OUTPUT_DIR}"
  (
    cd "${ROOT_DIR}/ui"
    npm run verify:live-tauri-full-v1-receipt -- \
      test-results/live-tauri-full-v1-receipt/receipt.json
  ) >"${OUTPUT_DIR}/tauri-validation.json" || tauri_status=$?
  cp "${TAURI_RECEIPT_DIR}/receipt.json" "${OUTPUT_DIR}/tauri-receipt.json"
fi

redaction_status=0
for secret in "${api_token}" "${client_secret}" "${DB_PASSWORD}" "${WORK_DIR}"; do
  if grep -Fq "${secret}" "${API_LOG}"; then
    redaction_status=1
  fi
done

HOTM_COMMIT="$(git -C "${ROOT_DIR}" rev-parse HEAD)"
HOTM_DIRTY=false
if [[ -n "$(git -C "${ROOT_DIR}" status --porcelain)" ]]; then
  HOTM_DIRTY=true
fi
FORTEMI_HEALTH_COMMIT="$(node -e 'process.stdout.write(require(process.argv[1]).git_sha)' "${WORK_DIR}/health.json")"

HOTM_COMMIT="${HOTM_COMMIT}" \
HOTM_DIRTY="${HOTM_DIRTY}" \
FORTEMI_COMMIT="${FORTEMI_COMMIT}" \
FORTEMI_HEALTH_COMMIT="${FORTEMI_HEALTH_COMMIT}" \
FORTEMI_RELEASE="${FORTEMI_RELEASE}" \
FORTEMI_SHA256="${FORTEMI_SHA256}" \
BROWSER_STATUS="${browser_status}" \
TAURI_STATUS="${tauri_status}" \
REDACTION_STATUS="${redaction_status}" \
OUTPUT_DIR="${OUTPUT_DIR}" \
node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const outputDir = process.env.OUTPUT_DIR;
const sha256File = (name) => {
  const file = path.join(outputDir, name);
  return fs.existsSync(file)
    ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    : null;
};
const passed = Number(process.env.BROWSER_STATUS) === 0
  && Number(process.env.TAURI_STATUS) === 0
  && Number(process.env.REDACTION_STATUS) === 0;
const receipt = {
  schemaVersion: 'hotm.live-asset-ci-receipt.v1',
  issue: 'Fortemi/HotM#283',
  status: passed ? 'passed' : 'failed',
  profile: '2.0.0/full-v1',
  identity: {
    hotmCommit: process.env.HOTM_COMMIT,
    hotmWorktreeDirty: process.env.HOTM_DIRTY === 'true',
    fortemiCommit: process.env.FORTEMI_COMMIT,
    fortemiHealthCommit: process.env.FORTEMI_HEALTH_COMMIT,
    fortemiCommitAuthority: 'immutable-sidecar-release-provenance-and-configured-health',
    sidecarRelease: process.env.FORTEMI_RELEASE,
    sidecarSha256: process.env.FORTEMI_SHA256,
  },
  execution: {
    headless: true,
    authenticationRequired: true,
    storageBackend: 'filesystem',
    browserTarget: 'playwright-chromium',
    desktopTarget: 'tauri-command-core-linux-x86_64',
    gitRepository: process.env.GITHUB_REPOSITORY || null,
    gitRunId: process.env.GITHUB_RUN_ID || null,
  },
  children: {
    browser: {
      status: Number(process.env.BROWSER_STATUS) === 0 ? 'passed' : 'failed',
      sha256: sha256File('browser-metrics.json'),
    },
    tauri: {
      status: Number(process.env.TAURI_STATUS) === 0 ? 'passed' : 'failed',
      sha256: sha256File('tauri-receipt.json'),
    },
  },
  claims: {
    browserSetInputFilesAgainstLiveFortemiPassed: Number(process.env.BROWSER_STATUS) === 0,
    browserTusMultiOffsetResumePassed: Number(process.env.BROWSER_STATUS) === 0,
    browserTusExactlyOneAttachmentPassed: Number(process.env.BROWSER_STATUS) === 0,
    reuploadAndShardMetadataRelationshipsPassed: Number(process.env.BROWSER_STATUS) === 0,
    browserSavedDownloadPassed: Number(process.env.BROWSER_STATUS) === 0,
    tauriLocalFileCoreAgainstLiveFortemiPassed: Number(process.env.TAURI_STATUS) === 0,
    sourceRetiredBeforeCleanRecoveryPassed: Number(process.env.TAURI_STATUS) === 0,
    browserAndDesktopNormalizedContractPassed: passed,
    signedFullV1CleanRecoveryPassed: passed,
    exactBytesDigestAndLengthPassed: passed,
    authenticatedBoundaryPassed: passed,
    redactionScanPassed: Number(process.env.REDACTION_STATUS) === 0,
    launchedDesktopGui: false,
    interactiveNativeDialogs: false,
    suiteWidePortability: false,
  },
  publication: {
    artifact: 'hotm-live-asset-ci-receipt',
    uploadPending: true,
  },
  notClaimed: [
    'launched Tauri GUI or interactive native dialogs',
    'non-Linux desktop targets',
    'suite-wide portability or complete backup',
  ],
};
fs.writeFileSync(path.join(outputDir, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`);
NODE

validation_status=0
HOTM_LIVE_EXPECT_CLEAN="${HOTM_LIVE_EXPECT_CLEAN:-1}" \
  node "${ROOT_DIR}/ui/scripts/verify-live-asset-ci-receipt.cjs" \
    "${OUTPUT_DIR}/receipt.json" >"${OUTPUT_DIR}/validation.json" || validation_status=$?

(
  cd "${ROOT_DIR}"
  node ui/scripts/write-receipt-artifact-manifest.cjs \
    ui/test-results/live-asset-ci-receipt/artifact-manifest.json \
    hotm-live-asset-ci-receipt \
    ui/test-results/live-asset-ci-receipt
  node ui/scripts/write-receipt-artifact-manifest.cjs --verify \
    ui/test-results/live-asset-ci-receipt/artifact-manifest.json
)

if [[ "${browser_status}" -ne 0 || "${tauri_status}" -ne 0 \
  || "${redaction_status}" -ne 0 || "${validation_status}" -ne 0 ]]; then
  exit 1
fi
