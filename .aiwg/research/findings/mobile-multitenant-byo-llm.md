---
title: "Multi-tenant SaaS + BYO-LLM patterns for hosted personal-data backends (May 2026)"
type: research-finding
created: 2026-05-17
topic: backend-architecture
quality_baseline: MODERATE
related_artifacts:
  - .aiwg/architecture/adr-mobile-cloud-architecture.md
  - .aiwg/planning/mobile-expansion-phase-plan.md
---

# Multi-tenant SaaS + BYO-LLM patterns for hosted personal-data backends (May 2026)

## Scope

The mobile-only-cloud architectural decision for HotM means `matric-api` (Rust + Postgres + pgvector) transitions from a Tauri sidecar bound to one user to a multi-tenant hosted service. This research identifies current best practices for isolation, secret handling, BYO-LLM proxying, auth, and operational floor for a small team.

## 1. Multi-tenancy isolation models

Three canonical patterns in 2024-2026 literature:

| Pattern | Isolation | Operational cost | When to pick |
|---|---|---|---|
| Shared schema + `tenant_id` column | Soft (app-enforced or RLS-enforced) | Lowest | Default for SaaS with <10k tenants where backups+billing don't need per-tenant separation |
| Schema-per-tenant | Stronger (separate `search_path`) | Medium (DDL per onboarding) | Compliance/audit needs; tenant-export simplicity |
| Database-per-tenant | Strongest (separate cluster role) | Highest (provisioning, connection pooling) | Enterprise / regulated workloads |

The current dominant recommendation for personal-data SaaS at our scale is **shared schema with `tenant_id` columns + Postgres Row-Level Security (RLS)** enforcing isolation at the database tier. AWS, Crunchy Data, and Supabase all publish architecture guidance converging on this pattern.

GRADE: HIGH — multiple independent recent sources from authoritative orgs.

Sources:
- [Multi-tenant data isolation with PostgreSQL Row Level Security (AWS, 2024)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/)
- [Row Level Security for Tenants in Postgres (Crunchy Data)](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres)
- [Row-level security recommendations (AWS Prescriptive Guidance)](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html)

## 2. Postgres RLS — production-grade in 2026?

**Yes, with caveats.** RLS is the recommended default for new multi-tenant Postgres deployments at SaaS scale. Production-shipping platforms (Supabase, AWS Aurora multi-tenant patterns, Crunchy Bridge) all use it. The 2025 guidance is:

**Use it for**: tenant data isolation as the *primary* defense; complementary to (not instead of) application-layer checks.

**Be careful with**:
- **Set the tenant context per connection, not per-tenant database user.** Standard pattern: connect as a single application role, then `SET LOCAL app.current_tenant = '<uuid>'` per request inside a transaction.
- **Index every column referenced in RLS policies.** A B-tree index on `tenant_id` is mandatory; an unindexed RLS predicate kills query performance.
- **Avoid Foreign Data Wrappers across RLS-protected tables** — latency multiplies.
- **For pgvector specifically**: RLS predicates apply to vector similarity queries (`<->`, `<=>`). Combine an HNSW or IVFFLAT index for vector distance with a B-tree on `tenant_id` so the planner can filter by tenant before scoring vectors. Supabase documents this exact pattern.

GRADE: HIGH — multiple cited 2024-2025 sources, consistent guidance.

Sources:
- [RAG with Permissions (Supabase Docs)](https://supabase.com/docs/guides/ai/rag-with-permissions) — pgvector + RLS combination
- [Row Level Security (Supabase Docs)](https://supabase.com/docs/guides/database/postgres/row-level-security) — general guidance
- [Multi-tenant vector search with Amazon Aurora PostgreSQL (AWS, 2024)](https://aws.amazon.com/blogs/database/multi-tenant-vector-search-with-amazon-aurora-postgresql-and-amazon-bedrock-knowledge-bases/) — production case study with pgvector

**Implication for HotM:** the existing `matric-api` schema needs:
1. Every user-data table gains a `tenant_id UUID NOT NULL` column with a B-tree index.
2. RLS policies that read `current_setting('app.current_tenant')::uuid`.
3. The Rust client (sqlx or equivalent) sets `app.current_tenant` at transaction start per request.
4. Schema migrations need explicit ordering (RLS-enable AFTER backfilling `tenant_id`).
5. A test suite that proves a tenant cannot read another tenant's data — this is the single most important regression check for the lifetime of the product.

## 3. BYO-LLM proxy architecture

"Bring Your Own Key" (BYOK / BYO-LLM) is a well-trodden pattern in 2025-2026. The user provides credentials for whatever LLM provider they choose (Anthropic, OpenAI, OpenRouter, local Ollama via an exposed endpoint); the hosted service proxies their requests using those credentials. The user pays the provider directly; the service operator does not take on inference cost.

**Reference implementations:**

- **OpenRouter** ([Bring Your Own API Keys](https://openrouter.ai/announcements/bring-your-own-api-keys)) — production BYOK at scale. Architecture: user key stored encrypted; OpenRouter proxies requests but uses the user's key for the actual provider call. User pays the provider directly.
- **LiteLLM** ([Claude Code BYOK tutorial](https://docs.litellm.ai/docs/tutorials/claude_code_byok)) — LiteLLM's `forward_llm_provider_auth_headers: true` setting forwards the user's `x-api-key` to the upstream provider, overriding any proxy-configured key.
- **Helicone** — request observability / logging in front of LLM providers. BYOK by default.
- **VoidLLM** ([github](https://github.com/voidmind-io/voidllm)) — zero-knowledge LLM proxy — explicitly never logs prompt/response content. Privacy-first positioning.

GRADE: MODERATE — practitioner documentation and product pages; no peer-reviewed work, but the pattern is unambiguously established.

**Canonical BYO-LLM proxy shape**:

```
Client request:
  POST /v1/inference/chat
  Authorization: Bearer <hotm-session-token>
  Body: { "messages": [...], "model": "claude-sonnet-4-7" }
       ↓
HotM API server:
  1. Validate session token → resolve user_id
  2. Fetch user's encrypted LLM provider keys from DB
  3. Decrypt with envelope-encryption KEK (see §4)
  4. Select provider based on model name → call provider HTTP API
       with user's decrypted key
  5. Stream provider response back to client
  6. Log: user_id, model, token counts (for analytics/billing)
  7. Do NOT log: prompt content, response content (unless user opts in)
```

**Privacy posture decisions HotM needs to make explicitly**:
1. Are prompts/responses logged at all? Default to NO — log only metadata (timing, token count, model, success/failure). This is the differentiator against generic SaaS LLM apps.
2. Are responses cached server-side? Caching is a feature but invalidates the "zero-knowledge" claim. Recommend opt-in.
3. Is there a request-level audit log the user can review? Yes, but it should be metadata-only by default.

## 4. Per-user secret storage (BYO-LLM keys)

Two production patterns:

**Pattern A — Envelope encryption (recommended)**:
- A single Key Encryption Key (KEK) lives in a secret manager (AWS KMS, HashiCorp Vault, GCP KMS, or a service-managed dedicated key file).
- Each user's LLM provider key is encrypted with a randomly-generated per-user Data Encryption Key (DEK).
- The DEK is encrypted with the KEK and stored alongside the encrypted key.
- To use: KMS unwraps the DEK → DEK decrypts the LLM key → memory-only, scrubbed after use.
- Key rotation: rotating the KEK only requires re-wrapping DEKs, not touching encrypted user keys.

**Pattern B — Direct KMS encryption**:
- Each user's LLM provider key is encrypted directly with the service KEK.
- Simpler operationally, lower performance ceiling at scale (every decrypt is a KMS call).
- Suitable for HotM's scale.

GRADE: MODERATE — well-documented patterns; specific cited examples include AWS KMS encryption docs and Vault transit secrets engine documentation.

**HotM-specific constraints from existing crypto rules**:
- `no-key-reuse-across-purposes.md`: the encryption KEK must not be the same key used for session tokens or any other purpose. Distinct keys derived via HKDF with explicit domain-separation labels.
- `no-adhoc-kdf.md`: when deriving DEKs from a user-specific salt + master IKM, use HKDF or proper KDF, never `SHA-256(secret || salt)`.
- `no-unauthenticated-encryption.md`: AEAD only (XChaCha20-Poly1305 or AES-GCM), never raw AES-CBC for storing keys.
- `crypto-flag-verification.md`: if any CLI tools are involved in key bootstrap (e.g., initial key sealing), the invocations need explicit flag review.

**Recommendation:** AWS KMS or self-hosted HashiCorp Vault + envelope encryption. For solo-dev scale, a simpler approach is acceptable: a single KEK file on the service host, loaded into memory at startup, used to wrap per-user DEKs. The KEK file is mode 600, root-owned, and never logged. Plan to upgrade to KMS when scale or compliance demands.

## 5. Auth for mobile thin clients

The 2026 consensus for mobile clients: **OAuth 2.0 with PKCE** (Proof Key for Code Exchange). HTTP-Basic, plain bearer-token, and OAuth-without-PKCE flows are all considered insufficient for mobile.

**Build vs buy for the IdP/auth layer:**

| Option | Cost | Lock-in | When |
|---|---|---|---|
| Auth0 / Clerk / WorkOS | $$$ | High | Enterprise, team scale |
| Supabase Auth | $ | Medium | If already using Supabase Postgres |
| Self-hosted Keycloak | Operational cost only | Low | Mid-scale, willing to operate IdP |
| Roll your own | Low cost, high risk | None | Only if auth is core competence |

For HotM at current scale and given existing issue #2 already scoping "OAuth2/API Key Authentication", the practical choices are:

1. **Clerk or Auth0 free tier** — fastest path; ~$25-50/mo above free tier. Lock-in is real but reversible.
2. **Self-hosted Keycloak alongside `matric-api`** — full control; adds an ops surface (Keycloak's Postgres, realm config, upgrades).

**Recommendation**: Clerk for the first launch. Re-evaluate if user count and cost cross a threshold.

GRADE: MODERATE — practitioner consensus; specific recommendations vary by team.

## 6. Cost-control and abuse prevention

For a public-facing multi-tenant backend with LLM proxying:

| Risk | Mitigation |
|---|---|
| Free-tier abuse (sign up → hammer LLM proxy) | Per-tenant rate limits; daily/monthly quotas; require verified email |
| Cost runaway (user's LLM key gets stolen) | Tenant-level spend ceilings; alerts at thresholds |
| Spam signup | Cloudflare Turnstile or hCaptcha on signup |
| Data exfiltration (e.g., user uploads massive content) | Per-tenant storage quotas |
| Brute-force on auth | Lockout-after-N-failures; account-recovery flow |

Tools commonly used by small teams (2024-2026):
- **Upstash Redis** for rate-limit counters (token-bucket primitives).
- **Cloudflare** for DDoS, bot management, Turnstile.
- **Sentry** for error monitoring and abnormal-pattern alerts.

**Implication for HotM:** add at minimum a token-bucket rate limiter at the API gateway tier before launch. Per-tenant spend ceilings come later but should be on the roadmap.

GRADE: MODERATE — standard practitioner knowledge.

## 7. Operational floor for solo-dev / small-team

Honest assessment for a Rust + Postgres + pgvector + KMS + auth provider stack:

**Realistic minimum monthly cost** at <100 active users:
- Postgres + pgvector: $10-30/mo (Fly Postgres, Neon, Supabase Pro). pgvector is supported on all three.
- Application hosting: $5-30/mo for `matric-api` (Fly.io machine, Render, Railway).
- Object storage for attachments: $5-25/mo (Backblaze B2 / R2 / S3).
- Domain + TLS: $20/year.
- Auth (if paid tier): $0-50/mo depending on choice.
- Monitoring (Sentry / Better Stack): $0-25/mo (free tier sufficient at this scale).
- **Total: roughly $50-150/mo** in the first year at low usage.

**Operational realities not in dollar costs:**
- Database backups and the ability to restore from them. Test restores quarterly.
- Domain ownership, TLS certificate auto-renewal monitoring.
- An incident response path (Sentry alert → Discord/email → human).
- A security update cadence for the Rust crate dependencies.
- A user data-deletion path that actually removes data (GDPR / consumer-data-rights compliance).

GRADE: MODERATE — cost numbers from public pricing as of 2026; operational guidance is standard practitioner knowledge.

**Honest call for HotM**: this is not free. Going from "users install desktop and it just works" to "we host a multi-tenant backend" adds real monthly cost and real ongoing ops attention. The mobile expansion business case must absorb this cost.

## 8. Bottom line for the ADR

1. **Use shared-schema + RLS** for tenant isolation in Postgres. Index every RLS-referenced column. Combine with pgvector via per-tenant filtering before vector scoring.
2. **BYO-LLM proxy** with envelope encryption for per-user keys. Default to metadata-only logging (no prompt/response content). Allow opt-in observability.
3. **OAuth 2.0 + PKCE** for mobile auth. Recommend Clerk or Auth0 for the first launch over rolling our own. This is the same decision blocking issue #2 (P0).
4. **Rate limits + per-tenant quotas + spend ceilings** are launch requirements, not future work.
5. **Plan for $50-150/mo ongoing cost** plus weekly ops attention. The mobile expansion is a SaaS infrastructure track parallel to the mobile UI track.

## Open questions to settle in the ADR

- Free tier vs paid-only? Implications for abuse-prevention sizing and business model.
- Self-hosted by privacy-focused users? Should `matric-api`'s multi-tenant mode also be deployable by individual users on their own infrastructure (e.g., for a household-scale "private cloud")?
- Compliance posture: do we explicitly *not* claim HIPAA/SOC2 at launch?

## Sources

- [Multi-tenant data isolation with PostgreSQL Row Level Security (AWS Database Blog, 2024)](https://aws.amazon.com/blogs/database/multi-tenant-data-isolation-with-postgresql-row-level-security/) — HIGH
- [Row-level security recommendations (AWS Prescriptive Guidance, SaaS multitenant PostgreSQL)](https://docs.aws.amazon.com/prescriptive-guidance/latest/saas-multitenant-managed-postgresql/rls.html) — HIGH
- [Row Level Security for Tenants in Postgres (Crunchy Data)](https://www.crunchydata.com/blog/row-level-security-for-tenants-in-postgres) — HIGH
- [RAG with Permissions (Supabase, 2024)](https://supabase.com/docs/guides/ai/rag-with-permissions) — HIGH
- [Row Level Security (Supabase Docs)](https://supabase.com/docs/guides/database/postgres/row-level-security) — HIGH
- [Multi-tenant vector search with Amazon Aurora PostgreSQL and Amazon Bedrock Knowledge Bases (AWS, 2024)](https://aws.amazon.com/blogs/database/multi-tenant-vector-search-with-amazon-aurora-postgresql-and-amazon-bedrock-knowledge-bases/) — HIGH
- [OpenRouter — Bring Your Own API Keys](https://openrouter.ai/announcements/bring-your-own-api-keys) — MODERATE
- [LiteLLM — Claude Code with Bring Your Own Key (BYOK)](https://docs.litellm.ai/docs/tutorials/claude_code_byok) — MODERATE
- [LiteLLM AI Gateway (LLM Proxy) docs](https://docs.litellm.ai/docs/simple_proxy) — MODERATE
- [VoidLLM (github.com/voidmind-io/voidllm)](https://github.com/voidmind-io/voidllm) — LOW (single-project repo)
- [LLM-API-Key-Proxy (github.com/Mirrowel)](https://github.com/Mirrowel/LLM-API-Key-Proxy) — LOW
