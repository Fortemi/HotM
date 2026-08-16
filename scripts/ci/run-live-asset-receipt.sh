#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="${ROOT_DIR}/ui/test-results/live-asset-ci-receipt"
TAURI_RECEIPT_DIR="${ROOT_DIR}/ui/test-results/live-tauri-full-v1-receipt"
PROVENANCE="${ROOT_DIR}/release/live-asset-receipt-sidecar-provenance.json"
RAW_OS="$(uname -s)"
RAW_ARCH="$(uname -m)"

case "${RAW_OS}" in
  Linux | linux) NORMALIZED_OS="linux" ;;
  Darwin | darwin) NORMALIZED_OS="darwin" ;;
  *)
    echo "Unsupported live asset receipt OS: ${RAW_OS}" >&2
    exit 2
    ;;
esac

case "${RAW_ARCH}" in
  x86_64 | amd64) NORMALIZED_ARCH="x86_64" ;;
  arm64 | aarch64) NORMALIZED_ARCH="arm64" ;;
  *)
    echo "Unsupported live asset receipt architecture: ${RAW_ARCH}" >&2
    exit 2
    ;;
esac

case "${NORMALIZED_OS}/${NORMALIZED_ARCH}" in
  linux/x86_64)
    SIDECAR_TARGET="x86_64-unknown-linux-gnu"
    DESKTOP_TARGET="tauri-command-core-linux-x86_64"
    ;;
  linux/arm64)
    SIDECAR_TARGET="aarch64-unknown-linux-gnu"
    DESKTOP_TARGET="tauri-command-core-linux-arm64"
    ;;
  darwin/arm64)
    SIDECAR_TARGET="aarch64-apple-darwin"
    DESKTOP_TARGET="tauri-command-core-darwin-arm64"
    ;;
  *)
    echo "Unsupported live asset receipt platform: ${NORMALIZED_OS}/${NORMALIZED_ARCH}" >&2
    exit 2
    ;;
esac

RUN_KEY="${GITHUB_RUN_ID:-local}-$$"
SAFE_RUN_KEY="$(printf '%s' "${RUN_KEY}" | tr -cd '[:alnum:]_-' | cut -c1-36)"
WORK_DIR="$(mktemp -d)"
EVIDENCE_DIR="${WORK_DIR}/evidence"
FORTEMI_DIR="${WORK_DIR}/fortemi"
CONTRACT_FORTEMI_DIR="${WORK_DIR}/fortemi-contracts"
API_BINARY="${WORK_DIR}/matric-api"
API_LOG="${WORK_DIR}/api.log"
DB_CONTAINER="hotm-live-assets-db-${SAFE_RUN_KEY}"
DB_IMAGE="hotm-live-assets-testdb:${SAFE_RUN_KEY}"
API_PID=""
DB_CONTAINER_RUNNING=false
DB_IMAGE_BUILT=false

node_value() {
  node -e "const value=require(process.argv[1]); process.stdout.write(String(${1}));" \
    "${PROVENANCE}" "${SIDECAR_TARGET}"
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
  if [[ "${DB_CONTAINER_RUNNING}" == "true" ]]; then
    docker rm -f "${DB_CONTAINER}" >/dev/null 2>&1 || true
  fi
  if [[ "${DB_IMAGE_BUILT}" == "true" ]]; then
    docker image rm -f "${DB_IMAGE}" >/dev/null 2>&1 || true
  fi
  if [[ "${HOTM_LIVE_PRESERVE_WORK:-0}" != "1" ]]; then
    rm -rf "${WORK_DIR}"
  fi
  exit "${status}"
}
trap cleanup EXIT INT TERM

FORTEMI_COMMIT="$(node_value 'value.target_commitish')"
FORTEMI_RELEASE="$(node_value 'value.release_tag')"
FORTEMI_SHA256="$(node_value 'value.assets[process.argv[2]].sha256')"
API_PORT="$(free_port)"
UI_PORT="$(free_port)"
while [[ "${UI_PORT}" == "${API_PORT}" ]]; do
  UI_PORT="$(free_port)"
done
API_ROOT="http://127.0.0.1:${API_PORT}"
API_URL="${API_ROOT}/api/v1"
UI_ROOT="http://127.0.0.1:${UI_PORT}"
DATABASE_PROVISIONING="external"
DATABASE_URL="${HOTM_LIVE_DATABASE_URL:-}"
DB_PASSWORD=""
EXTERNAL_DB_PASSWORD=""

rm -rf "${OUTPUT_DIR}" "${TAURI_RECEIPT_DIR}"
mkdir -p "${OUTPUT_DIR}" "${TAURI_RECEIPT_DIR}" "${EVIDENCE_DIR}"

git init -q "${FORTEMI_DIR}"
git -C "${FORTEMI_DIR}" remote add origin https://git.integrolabs.net/Fortemi/fortemi.git
git -C "${FORTEMI_DIR}" fetch -q --depth 1 origin "${FORTEMI_COMMIT}"
git -C "${FORTEMI_DIR}" checkout -q --detach FETCH_HEAD
[[ "$(git -C "${FORTEMI_DIR}" rev-parse HEAD)" == "${FORTEMI_COMMIT}" ]]

if [[ -z "${DATABASE_URL}" ]]; then
  DATABASE_PROVISIONING="managed-docker"
  DB_PORT="$(free_port)"
  DB_USER="matric"
  DB_NAME="matric_hotm_live"
  DB_PASSWORD="$(
    node -e 'process.stdout.write(require("node:crypto").randomBytes(24).toString("base64url"))'
  )"
  DATABASE_URL="postgres://${DB_USER}:${DB_PASSWORD}@127.0.0.1:${DB_PORT}/${DB_NAME}"

  docker build -q -f "${FORTEMI_DIR}/build/Dockerfile.testdb" \
    -t "${DB_IMAGE}" "${FORTEMI_DIR}" >/dev/null
  DB_IMAGE_BUILT=true
  docker run -d --name "${DB_CONTAINER}" \
    -p "127.0.0.1:${DB_PORT}:5432" \
    -e POSTGRES_USER="${DB_USER}" \
    -e POSTGRES_PASSWORD="${DB_PASSWORD}" \
    -e POSTGRES_DB="${DB_NAME}" \
    "${DB_IMAGE}" >/dev/null
  DB_CONTAINER_RUNNING=true

  db_ready=false
  for _ in $(seq 1 60); do
    if docker exec "${DB_CONTAINER}" pg_isready \
      -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; then
      db_ready=true
      break
    fi
    sleep 1
  done
  [[ "${db_ready}" == "true" ]]
else
  EXTERNAL_DB_PASSWORD="$(
    node -e '
      try {
        process.stdout.write(decodeURIComponent(new URL(process.argv[1]).password));
      } catch {
        process.exit(2);
      }
    ' "${DATABASE_URL}"
  )"
fi

SIDECAR_PROVENANCE_MANIFEST="${PROVENANCE}" \
  "${ROOT_DIR}/scripts/download-pinned-sidecar.sh" \
  "${SIDECAR_TARGET}" "${API_BINARY}" >/dev/null

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
  DATABASE_URL="${DATABASE_URL}" \
  MATRIC_GIT_SHA="${FORTEMI_COMMIT}" \
  HOST=127.0.0.1 \
  PORT="${API_PORT}" \
  REQUIRE_AUTH=true \
  FORTEMI_ALLOW_LOCAL_ISSUER=true \
  ISSUER_URL="${API_ROOT}" \
  ALLOWED_ORIGINS="${UI_ROOT}" \
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
  HOTM_E2E_PORT="${UI_PORT}" \
  HOTM_API_URL="${API_URL}" \
  HOTM_API_TOKEN="${api_token}" \
  VITE_API_BEARER_TOKEN="${api_token}" \
  npm run test:e2e:live-assets
) || browser_status=$?

browser_metrics="$(
  find "${ROOT_DIR}/ui/test-results" -type f \
    -name hotm-live-asset-browser-metrics.json -print | sed -n '1p'
)"
if [[ "${browser_status}" -eq 0 && -n "${browser_metrics}" ]]; then
  (
    cd "${ROOT_DIR}/ui"
    npm run verify:live-asset-metrics
  ) || browser_status=$?
  mkdir -p "${OUTPUT_DIR}"
  cp "${browser_metrics}" "${OUTPUT_DIR}/browser-metrics.json"
  cp "${browser_metrics}" "${EVIDENCE_DIR}/browser-metrics.json"
fi
if [[ "${browser_status}" -ne 0 || ! -f "${EVIDENCE_DIR}/browser-metrics.json" ]]; then
  echo "Live browser receipt failed or did not produce browser metrics" >&2
  exit 1
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
  cargo test --locked tests::live_fortemi_tauri_local_file_full_v1_recovery_receipt \
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
  cp "${OUTPUT_DIR}/tauri-validation.json" "${EVIDENCE_DIR}/tauri-validation.json"
  cp "${TAURI_RECEIPT_DIR}/receipt.json" "${EVIDENCE_DIR}/tauri-receipt.json"
fi

HOTM_COMMIT="$(git -C "${ROOT_DIR}" rev-parse HEAD)"
HOTM_DIRTY=false
if [[ -n "$(git -C "${ROOT_DIR}" status --porcelain)" ]]; then
  HOTM_DIRTY=true
fi

EVENT_CONTRACT_COMMIT="$(
  node -e '
    process.stdout.write(
      require(process.argv[1]).producer.commit,
    );
  ' "${ROOT_DIR}/ui/src/api/contracts/fortemi-event-catalog.json"
)"
OPENAPI_CONTRACT_COMMIT="$(
  node -e '
    process.stdout.write(
      require(process.argv[1]).producer.commit,
    );
  ' "${ROOT_DIR}/ui/src/api/contracts/fortemi-openapi-receipt.json"
)"
for contract_commit in "${EVENT_CONTRACT_COMMIT}" "${OPENAPI_CONTRACT_COMMIT}"; do
  git -C "${FORTEMI_DIR}" fetch -q --depth 1 origin "${contract_commit}"
done
git -C "${FORTEMI_DIR}" worktree add -q --detach \
  "${CONTRACT_FORTEMI_DIR}" "${EVENT_CONTRACT_COMMIT}"

event_catalog_status=0
node "${ROOT_DIR}/.aiwg/testing/scripts/verify-fortemi-event-catalog.mjs" \
  "${CONTRACT_FORTEMI_DIR}" || event_catalog_status=$?

openapi_contract_status=0
GITHUB_SHA="${HOTM_COMMIT}" \
  node "${ROOT_DIR}/.aiwg/testing/scripts/verify-fortemi-openapi-contract.mjs" \
    "${CONTRACT_FORTEMI_DIR}" \
    --write-ci-receipt "${OUTPUT_DIR}/openapi-consumer-receipt.json" \
  || openapi_contract_status=$?

contract_consumer_status=0
(
  cd "${ROOT_DIR}/ui"
  npm exec vitest run -- \
    src/api/__tests__/delivered-openapi-contract.test.ts \
    src/api/__tests__/events.test.ts \
    src/api/__tests__/systemCompatibility.test.ts
) || contract_consumer_status=$?

authority_contract_status=0
if [[ "${event_catalog_status}" -ne 0 || "${openapi_contract_status}" -ne 0 \
  || "${contract_consumer_status}" -ne 0 ]]; then
  authority_contract_status=1
fi

mkdir -p "${OUTPUT_DIR}"
cp "${EVIDENCE_DIR}/browser-metrics.json" "${OUTPUT_DIR}/browser-metrics.json"
if [[ "${tauri_status}" -eq 0 ]]; then
  cp "${EVIDENCE_DIR}/tauri-validation.json" "${OUTPUT_DIR}/tauri-validation.json"
  cp "${EVIDENCE_DIR}/tauri-receipt.json" "${OUTPUT_DIR}/tauri-receipt.json"
fi

ROOT_DIR="${ROOT_DIR}" \
OUTPUT_DIR="${OUTPUT_DIR}" \
HOTM_COMMIT="${HOTM_COMMIT}" \
FORTEMI_COMMIT="${FORTEMI_COMMIT}" \
NORMALIZED_OS="${NORMALIZED_OS}" \
NORMALIZED_ARCH="${NORMALIZED_ARCH}" \
SIDECAR_TARGET="${SIDECAR_TARGET}" \
EVENT_CATALOG_STATUS="${event_catalog_status}" \
OPENAPI_CONTRACT_STATUS="${openapi_contract_status}" \
CONTRACT_CONSUMER_STATUS="${contract_consumer_status}" \
node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.ROOT_DIR;
const outputDir = process.env.OUTPUT_DIR;
const eventCatalog = require(path.join(root, 'ui/src/api/contracts/fortemi-event-catalog.json'));
const openApi = require(path.join(root, 'ui/src/api/contracts/fortemi-openapi-receipt.json'));
const checks = {
  generatedOpenApi: Number(process.env.OPENAPI_CONTRACT_STATUS) === 0,
  generatedAsyncApiAndEventCatalog: Number(process.env.EVENT_CATALOG_STATUS) === 0,
  openApiAsyncApiEventAndCompatibilityConsumers:
    Number(process.env.CONTRACT_CONSUMER_STATUS) === 0,
};
const passed = Object.values(checks).every(Boolean);
const openApiReceiptPath = path.join(outputDir, 'openapi-consumer-receipt.json');
const receipt = {
  schemaVersion: 'hotm.live-authority-contract-gates.v1',
  issue: 'Fortemi/HotM#284',
  status: passed ? 'passed' : 'failed',
  platform: {
    os: process.env.NORMALIZED_OS,
    arch: process.env.NORMALIZED_ARCH,
    target: process.env.SIDECAR_TARGET,
  },
  identity: {
    hotmCommit: process.env.HOTM_COMMIT,
    liveSidecarCommit: process.env.FORTEMI_COMMIT,
    eventCatalogCommit: eventCatalog.producer.commit,
    eventCatalogSourceSha256: eventCatalog.producer.sourceSha256,
    asyncApiSourceSha256: eventCatalog.producer.asyncApi.sourceSha256,
    asyncApiSha256: eventCatalog.producer.asyncApi.sha256,
    openApiCommit: openApi.producer.commit,
    openApiSha256: openApi.producer.sha256,
    openApiSemanticSha256: openApi.consumer.semanticSha256,
    openApiConsumerReceiptSha256: fs.existsSync(openApiReceiptPath)
      ? crypto.createHash('sha256').update(fs.readFileSync(openApiReceiptPath)).digest('hex')
      : null,
  },
  checks,
};
fs.writeFileSync(
  path.join(outputDir, 'authority-contract-gates.json'),
  `${JSON.stringify(receipt, null, 2)}\n`,
);
NODE

redaction_status=0
redaction_secrets=("${api_token}" "${client_secret}" "${WORK_DIR}")
if [[ -n "${DB_PASSWORD}" ]]; then
  redaction_secrets+=("${DB_PASSWORD}")
fi
if [[ -n "${HOTM_LIVE_DATABASE_URL:-}" ]]; then
  redaction_secrets+=("${HOTM_LIVE_DATABASE_URL}")
fi
if [[ -n "${EXTERNAL_DB_PASSWORD}" ]]; then
  redaction_secrets+=("${EXTERNAL_DB_PASSWORD}")
fi
for secret in "${redaction_secrets[@]}"; do
  if grep -Fq "${secret}" "${API_LOG}"; then
    redaction_status=1
  fi
done

FORTEMI_HEALTH_COMMIT="$(node -e 'process.stdout.write(require(process.argv[1]).git_sha)' "${WORK_DIR}/health.json")"

HOTM_COMMIT="${HOTM_COMMIT}" \
HOTM_DIRTY="${HOTM_DIRTY}" \
FORTEMI_COMMIT="${FORTEMI_COMMIT}" \
FORTEMI_HEALTH_COMMIT="${FORTEMI_HEALTH_COMMIT}" \
FORTEMI_RELEASE="${FORTEMI_RELEASE}" \
FORTEMI_SHA256="${FORTEMI_SHA256}" \
NORMALIZED_OS="${NORMALIZED_OS}" \
NORMALIZED_ARCH="${NORMALIZED_ARCH}" \
SIDECAR_TARGET="${SIDECAR_TARGET}" \
DESKTOP_TARGET="${DESKTOP_TARGET}" \
DATABASE_PROVISIONING="${DATABASE_PROVISIONING}" \
BROWSER_STATUS="${browser_status}" \
TAURI_STATUS="${tauri_status}" \
AUTHORITY_CONTRACT_STATUS="${authority_contract_status}" \
REDACTION_STATUS="${redaction_status}" \
OUTPUT_DIR="${OUTPUT_DIR}" \
node <<'NODE'
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const outputDir = process.env.OUTPUT_DIR;
const browserMetrics = JSON.parse(
  fs.readFileSync(path.join(outputDir, 'browser-metrics.json'), 'utf8'),
);
const sha256File = (name) => {
  const file = path.join(outputDir, name);
  return fs.existsSync(file)
    ? crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
    : null;
};
const passed = Number(process.env.BROWSER_STATUS) === 0
  && Number(process.env.TAURI_STATUS) === 0
  && Number(process.env.AUTHORITY_CONTRACT_STATUS) === 0
  && Number(process.env.REDACTION_STATUS) === 0;
const receipt = {
  schemaVersion: 'hotm.live-asset-ci-receipt.v1',
  issue: 'Fortemi/HotM#284',
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
    fixture: {
      id: browserMetrics.corpus.fixtureId,
      browserTusBytes: browserMetrics.corpus.browserTusBytes,
      browserTusSha256: browserMetrics.corpus.browserTusSha256,
      uiUploadBytes: browserMetrics.corpus.uiUploadBytes,
      uiUploadSha256: browserMetrics.corpus.uiUploadSha256,
    },
  },
  execution: {
    os: process.env.NORMALIZED_OS,
    arch: process.env.NORMALIZED_ARCH,
    target: process.env.SIDECAR_TARGET,
    headless: true,
    authenticationRequired: true,
    storageBackend: 'filesystem',
    databaseProvisioning: process.env.DATABASE_PROVISIONING,
    browserTarget: 'playwright-chromium',
    desktopTarget: process.env.DESKTOP_TARGET,
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
    authorityContracts: {
      status: Number(process.env.AUTHORITY_CONTRACT_STATUS) === 0 ? 'passed' : 'failed',
      sha256: sha256File('authority-contract-gates.json'),
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
    authorityContractGatesPassed: Number(process.env.AUTHORITY_CONTRACT_STATUS) === 0,
    redactionScanPassed: Number(process.env.REDACTION_STATUS) === 0,
    productionShardConsumerPassed: Number(process.env.BROWSER_STATUS) === 0,
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
    'desktop targets other than Linux x86_64 and Darwin arm64',
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
  || "${authority_contract_status}" -ne 0 \
  || "${redaction_status}" -ne 0 || "${validation_status}" -ne 0 ]]; then
  exit 1
fi
