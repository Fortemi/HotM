---
title: Fortemi Auth TenantStore Composition Receipt
status: passed-non-live
date: 2026-08-24
artifact_type: consumer-contract-receipt
auth_contract_version: 1.1.0
auth_profile: rust-node-jwt-v1
auth_authority_release: v2026.8.1
tenant_store_producer_commit: 65a77ccd380e19f4fb23ff14286d7f9880fb8308
tenant_store_producer_file_sha256: a5979c414b28b0dafde6234ff34222e92af99c80b65206078b1b442f6c0c511e
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
`rust-node-jwt-v1`, signed release `v2026.8.1` at commit
`1b6ddb1b58a12efc5b631386ad783cb12edec518`, manifest SHA-256
`2df0a35edad67cc3e8869286183a4d098b1eb8fc2161432ed0b54ba69b17e242`,
and release-policy SHA-256
`d70491c336a62508ef3c7937af709dd121a6ec4f421ceab66486af3f371de8db`.

## Producer Boundary

Fortemi commit `65a77ccd380e19f4fb23ff14286d7f9880fb8308` implements `PgTenantStore` in
`crates/matric-api/src/hosted_auth.rs` with the system-scoped query
`SELECT id, status FROM tenant_registry WHERE id = $1`. The source file hashes
to `a5979c414b28b0dafde6234ff34222e92af99c80b65206078b1b442f6c0c511e`.

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
- The source-only `agent-proxy` suite passed 14 files and 222 tests; ignored
  compiled output is excluded so stale build artifacts cannot re-enter Vitest.
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

The signed producer source now advertises contract `1.1.0`, profile
`rust-node-jwt-v1`, and release `v2026.8.1`. A deployed hosted response and the
runtime chain above remain deliberately unclaimed until the live run.
