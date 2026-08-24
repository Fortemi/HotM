---
title: Fortemi Auth TenantStore Composition Receipt
status: passed-non-live
date: 2026-08-24
artifact_type: consumer-contract-receipt
auth_contract_version: 1.1.0
auth_profile: rust-node-jwt-v1
auth_authority_release: v2026.8.0
tenant_store_producer_commit: 0bcd537ba758177e89ddb9daf0810568197d38ea
tenant_store_producer_file_sha256: cd8b2f10c3e8c352fb1507b3739a51bdc88716d79459000a62b3c2f44532eaf5
related_issues:
  - HotM/HotM#231
  - Fortemi/fortemi#707
---

# Fortemi Auth TenantStore Composition Receipt

## Scope

This receipt covers the non-live HotM composition between the released Node JWT
consumer and Fortemi's system-scoped tenant registry. It does not claim a live
database connection, hosted deployment, transaction-scoped RLS, or end-to-end
tenant isolation.

The JWT authority tuple is exactly contract `1.1.0`, profile
`rust-node-jwt-v1`, signed release `v2026.8.0` at commit
`36ba38efdd5ed57da2f2c2638529ee166255e198`, manifest SHA-256
`ab846ba11f479b11638fb3f5bc7029f98ad498b028f6cf060171316b90552e94`,
and release-policy SHA-256
`828c6ff24f63b10f114b78e6f83a8db6bd53d53f903e4c4f246eaccb6eeac949`.

## Producer Boundary

Fortemi commit `0bcd537ba758177e89ddb9daf0810568197d38ea` implements `PgTenantStore` in
`crates/matric-api/src/hosted_auth.rs` with the system-scoped query
`SELECT id, status FROM tenant_registry WHERE id = $1`. The source file hashes
to `cd8b2f10c3e8c352fb1507b3739a51bdc88716d79459000a62b3c2f44532eaf5`.

HotM's internal adapter performs the same ID/status lookup with a parameterized
UUID, accepts only `active`, `suspended`, or `soft_deleted`, and rejects row
count, identifier, or status drift as `tenant_store_unavailable`. The application
composition creates one bounded pool from a dedicated tenant-registry URL and
closes it during shutdown. No connection value or database diagnostic enters a
response, fixture, or receipt.

## Executed Controls

- The exact authority JWT is accepted through the Postgres-backed store only
  when the fixture registry row is active.
- Missing, suspended, and soft-deleted rows all return the same
  `unknown_tenant` code and 403 status.
- The authority-owned unavailable, timeout, and malformed-response cases, plus
  local query failure, status drift, mismatched ID, duplicate rows, and
  row-count mismatch, reduce to `tenant_store_unavailable` and HTTP 503.
- The SQL text contains `$1::uuid`; the tenant identifier is supplied only as a
  bound value.
- Missing database configuration preserves the explicitly advertised
  `anonymous_local` path and leaves hosted admission fail-closed.
- Pool size and connect, idle, query, and statement timeouts are bounded;
  malformed values fail with `config_error`.
- Dependency manifests pin `pg` `8.23.0` and `@types/pg` `8.23.1`; installation
  updated the repository npm lockfile with lifecycle scripts disabled.

## Verification

- Focused authority, store, middleware, app, and compatibility tests passed.
- The production TypeScript build and no-emit typecheck passed.
- The full `agent-proxy` suite passed 28 files and 426 tests.
- `npm audit --omit=dev` reported zero vulnerabilities.
- Vendored authority bytes hash exactly to the manifest and release-policy
  digests stated above.

## Remaining External Evidence

Hosted promotion still requires an immutable live receipt from the Fortemi
runtime that proves:

1. the deployed Node process uses the intended least-privilege registry role and
   can read only tenant `id` and `status`;
2. a real authority JWT admits an active tenant while absent and inactive
   tenants remain indistinguishable and a forced store outage returns the
   redacted 503 response;
3. the same tenant reaches Fortemi `AuthContext` and the request-owned
   PostgreSQL transaction;
4. `app.current_tenant` is set transaction-locally before tenant data access;
5. forced RLS permits same-tenant access and denies cross-tenant access; and
6. rollback and connection reuse never retain or disclose a prior tenant
   context.

Before that live run, Fortemi's compatibility endpoint must advertise contract
`1.1.0`, profile `rust-node-jwt-v1`, and release `v2026.8.0`; its currently
pinned response advertises the previous tuple and is intentionally rejected.
