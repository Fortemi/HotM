# Stage 2 Architecture: Sync, Auth/Billing, and Encryption

## Goals
- Multi-device sync with low-latency merges and offline support.
- Paid subscriptions for sync and optional remote inference usage.
- Preserve local-first privacy; minimize data stored remotely.

## Components
- Client Sync Agent (in app): Tracks local changes, batches, retries offline, resolves conflicts.
- Sync Service (cloud): Auth, device registry, change journal, conflict merge, usage metering.
- Auth/Billing: Account + subscription service; payment provider webhooks; entitlement checks.
- Inference Gateway (optional): Remote inference with quota; caches results; logs usage.

## Data Model Additions
- Account: `account_id`, email, status, subscription tier, entitlements.
- Device: `device_id`, `account_id`, name, last_seen, capabilities.
- Journal: append-only change log: `journal_id`, `account_id`, `device_id`, time, type, payload hash.
- Note Envelope: immutable original + revision graph; metadata (tags, links) normalized.
- Keys (if E2EE): per-account master key (wrapped), per-device key, content keys per collection.

## Sync Protocol
- Change capture: client appends semantic changes (create note, add tag, edit revised) to local queue.
- Push: `POST /sync/push` with batch (idempotency key, causal cursor). Server validates, persists to Journal.
- Pull: `GET /sync/pull?cursor=…&limit=…` returns ordered changes since cursor.
- Causality: Monotonic journal cursor per account; client maintains last applied.
- Idempotency: All writes include `x-idempotency-key`; backend de-duplicates.
- Batching/Backoff: Exponential backoff; jitter; retry-safe on 5xx and network errors.

## Conflict Resolution
- Content: append-only revisions; last-writer-wins pointer to "current revised"; keep all branches for manual merge.
- Metadata (tags/links): set-union on add; explicit delete wins; maintain tombstones.
- Collections: LWW on rename; union on membership.
- Display surfacing: conflicts flagged in UI; offer compare/merge.

## Security & Encryption
- Transport: TLS everywhere; HSTS; token-based auth.
- Tokens: short-lived access tokens + refresh flow; device-bound if possible.
- Optional E2EE:
  - KEK: per-account master key derived from user secret; stored backend-side only in wrapped form.
  - DEK: per-collection/content keys; rotate on member changes.
  - Server sees envelopes and metadata needed for sync; content payloads encrypted (AEAD).
- Key Rotation: `/keys/rotate` endpoint; device enrollment requires key handshake.

## Auth & Billing
- Accounts: email-first sign-in (magic link/OTP) or OAuth; verified email required for sync.
- Subscriptions: tiers (Free local-only, Pro sync, Pro+ remote inference). Webhooks update entitlement cache.
- Enforcement: gateway checks entitlement before sync/inference; grace periods and retry on webhook lag.
- Usage: track bytes synced, inference tokens/requests; expose `/usage` for client display.

## Inference (Remote Option)
- Gateway proxies to provider(s); isolates keys; enforces per-account quotas.
- Cache: keyed by content hash + prompt template; TTL with invalidation on model/version changes.
- Privacy: redact PII where possible; configurable allow-list of tasks sent remotely.

## APIs (Sketch)
- `POST /devices/register` → `{ device_id }`
- `POST /sync/push` → `{ applied: n, cursor }`
- `GET /sync/pull?cursor=…` → `{ cursor, changes: [...] }`
- `POST /keys/rotate` → 204
- `GET /entitlements` → `{ sync: true, inference: false, plan: 'pro' }`
- `GET /usage` → `{ bytes_synced, inference_requests, period }`
- `POST /billing/webhook` → 204

## Reliability & Ops
- SLOs: sync p95 end-to-end < 800ms; availability ≥ 99.9%.
- Storage: multi-AZ DB; journal partitioned by account; periodic compaction.
- Observability: trace IDs across client/backend; error budgets; dead-letter for invalid changes.
- Backfills/Migrations: journal replayer to rebuild state; idempotent and resumable.

## Milestones
- Beta 1: device register, push/pull, LWW merges, TLS, auth, basic plan.
- Beta 2: E2EE opt-in, usage metering, webhooks, quotas.
- GA: conflict UI, compaction/replay, regional data residency, inference cache.
