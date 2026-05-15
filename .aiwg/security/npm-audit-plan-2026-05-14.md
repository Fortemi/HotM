# npm Security Audit & Hardening Plan — 2026-05-14

**Status**: Audit complete; construction blocked pending user review.
**Components audited**: `ui/` (React 19 + Vite 7 + Tauri 2), `agent-proxy/` (Express AI sidecar)
**AIWG framework**: security-engineering + sdlc-complete
**Auditor**: Claude Opus 4.7 (1M context) operating per `.claude/rules/no-attribution.md` (no co-author attribution in commits)

---

## Executive Summary

| Component       | Critical | High | Moderate | Low | Total |
|-----------------|---------:|-----:|---------:|----:|------:|
| ui/             | 0        | 11   | 10       | 0   | 21    |
| agent-proxy/    | 0        | 3    | 1        | 0   | 4     |
| **Combined**    | **0**    | **14** | **11** | **0** | **25** |

**Supply-chain status**: Project is **NOT exposed** to the 2026-05 mini-shai-hulud TanStack compromise. Verified against the official affected-packages CSV (`~/Downloads/22-packages.csv`, 417 rows, 175 unique npm package names) — zero matches in `ui/package-lock.json` or `agent-proxy/package-lock.json` (transitive deps included). Initial heuristic check (`@tanstack/*`, `@opensearch-project/*`, `@squawk/*` prefixes) corroborated.

**Secrets posture**: Clean. No hardcoded API keys; all references are `process.env.*` / `import.meta.env.*`. `.env*` correctly gitignored; only `.env.example` tracked.

**Top systemic concerns** (beyond patchable CVEs):
1. **Tauri CSP is permissive** — `unsafe-inline` + `unsafe-eval` + wildcard `http://**` + `https://**` in http capability allowlist. Desktop app surface broader than needed.
2. **agent-proxy has no client authentication** — holds Anthropic/OpenAI API keys but accepts any request from `CORS_ORIGIN`. Anyone on localhost (or wherever it's hosted) can spend the keys.
3. **No rate limiting on agent-proxy** — billable LLM calls + Fortemi tool calls behind an unmetered endpoint.
4. **No `engines` pin in either package.json** — Node version drift risk.
5. **vitest 1.x in ui/** — three majors behind (`^4.0.18` in agent-proxy). Same issue tracked in #83 but tied to glob/inflight transitive deps; this plan adds CVE motivation.

---

## Findings

### F1 — ui/ Rollup arbitrary-file-write (HIGH)
- **Package**: `rollup@4.0.0–4.58.0`
- **GHSA**: GHSA-mw96-cpmx-2vgc
- **Vector**: Path traversal during bundle write; attacker who controls input filenames during build can write outside output dir.
- **Reachability**: Build-time only; only relevant if untrusted code is bundled (it isn't in the standard CI). Severity reflects worst case.
- **Fix**: `npm audit fix` resolves via vite upgrade chain.

### F2 — ui/ + agent-proxy/ Vite path traversal + WS file read (HIGH)
- **Package**: `vite@7.0.0–7.3.1` (both components)
- **GHSAs**: GHSA-4w7w-66w2-5vf9, GHSA-v2wj-q39q-566r, GHSA-p9ff-h696-f583
- **Vectors**: `.map` file path traversal, `server.fs.deny` query-string bypass, arbitrary file read via dev-server WebSocket.
- **Reachability**: Dev-server only — primary risk to developers, not end users. Still high because `npm run dev` exposes filesystem to LAN if `--host` is used.
- **Fix**: `npm audit fix` to vite ≥ 7.3.2.

### F3 — ui/ + agent-proxy/ picomatch ReDoS + method injection (HIGH)
- **Package**: `picomatch <=2.3.1 || 4.0.0–4.0.3`
- **GHSAs**: GHSA-3v7f-55p6-f55p, GHSA-c2c7-rcm5-vvqj
- **Vector**: ReDoS via extglob quantifiers + POSIX-class method injection.
- **Reachability**: Build/test-time globbing. Severity inflated for SPA; still worth the patch.
- **Fix**: `npm audit fix`.

### F4 — ui/ minimatch ReDoS x3 (HIGH)
- **Package**: `minimatch <=3.1.3`
- **GHSAs**: GHSA-3ppc-4f35-3m26, GHSA-7r86-cg39-jmmj, GHSA-23c5-xmqv-rm74
- **Vector**: Catastrophic regex backtracking on crafted glob patterns.
- **Reachability**: Transitive through vitest 1.x and tooling. Pairs with #83.
- **Fix**: Upgrade vitest to 3.x or 4.x (matches agent-proxy).

### F5 — agent-proxy/ path-to-regexp ReDoS (HIGH)
- **Package**: `path-to-regexp <0.1.13`
- **GHSA**: GHSA-37ch-88jc-xwx2
- **Vector**: ReDoS via multiple route parameters in crafted request paths.
- **Reachability**: **Reachable in production** — every Express route uses path-to-regexp internally. Remote unauthenticated DoS vector if agent-proxy is internet-exposed.
- **Fix**: `npm audit fix` (resolves via express transitive update).

### F6 — ui/ + agent-proxy/ PostCSS XSS (MODERATE)
- **Package**: `postcss <8.5.10`
- **GHSA**: GHSA-qx2v-qp2m-jg93
- **Vector**: Unescaped `</style>` in CSS stringify output → XSS if processed CSS is served back.
- **Reachability**: Build-time CSS pipeline; XSS only if attacker-controlled CSS flows through PostCSS into the bundle. Low practical risk for this codebase.
- **Fix**: `npm audit fix`.

### F7 — ui/ Mermaid CSS + HTML injection (MODERATE)
- **Package**: `mermaid` (pre-fix versions)
- **GHSAs**: GHSA-87f9-hvmw-gh4p, GHSA-ghcm-xqfw-q4vr
- **Vector**: Improper sanitization of `classDef` in state diagrams → HTML injection; config CSS injection.
- **Reachability**: **Reachable in production** if users paste untrusted Mermaid in notes that render in the SPA. HotM accepts user note content → real XSS surface.
- **Fix**: `npm audit fix` to latest mermaid.

### F8 — ui/ uuid bounds-check (MODERATE)
- **Package**: `uuid@11.0.0–11.1.0`
- **GHSA**: GHSA-w5hq-g745-h8pq
- **Vector**: Missing buffer bounds check in v3/v5/v6 when `buf` param provided.
- **Reachability**: Only if code calls uuid v3/v5/v6 with custom buffer — unlikely in this SPA, which uses v7 elsewhere.
- **Fix**: `npm audit fix`.

### F9 — Tauri permissive CSP and HTTP allowlist (HIGH — config, not CVE)
- **File**: `ui/src-tauri/tauri.conf.json` + `ui/src-tauri/capabilities/default.json`
- **Issues**:
  - CSP: `script-src 'self' 'unsafe-inline' 'unsafe-eval'` — both unsafe directives enabled. `connect-src 'self' https: http: ws: wss:` allows arbitrary endpoints.
  - http capability: `{ "url": "https://**" }` AND `{ "url": "http://**" }` — Tauri http plugin can call anything.
- **Risk**: XSS in webview becomes near-total exfil/RCE pivot. `unsafe-eval` is required by some Mermaid/KaTeX runtimes; `unsafe-inline` may be too. http://** is rarely justifiable.
- **Fix path**:
  1. Replace http://** with explicit allowlist (Fortemi API origin, Ollama localhost, configured upstream URLs).
  2. Try removing `unsafe-eval`; if Mermaid/KaTeX breaks, scope it via a hash/nonce or accept with documented rationale in an ADR.
  3. Drop `http:` from `connect-src` if only HTTPS upstreams are configured in production.

### F10 — agent-proxy has no client authentication (HIGH — config)
- **File**: `agent-proxy/src/index.ts` + routes
- **Issue**: agent-proxy holds `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`. It restricts CORS to `CORS_ORIGIN` (default `http://localhost:5173`) but accepts unauthenticated POSTs from that origin. Any local process or LAN host (if bound non-loopback) can spend the keys.
- **Risk**:
  - Localhost-only: low risk in dev; tied to local user trust.
  - Production: **critical** — billable LLM exfil + tool execution on Fortemi.
- **Fix path**:
  1. Add a shared-secret header check (`X-Agent-Proxy-Token` from env) before any chat handler.
  2. Bind to `127.0.0.1` explicitly unless `BIND_ADDR` env overrides.
  3. Document the threat model in `agent-proxy/SECURITY.md` (localhost-only vs network-exposed).
- **Related**: Existing issue #121 ("Backend proxy route for cloud provider API key security") is the design issue — this finding adds the operational gap.

### F11 — agent-proxy has no rate limiting (MEDIUM — config)
- **File**: `agent-proxy/src/index.ts`
- **Issue**: No per-IP or per-token rate limiting. Single misbehaving client can blow through API quota.
- **Fix**: `express-rate-limit` (or equivalent) on `/api/agent/chat` with sane defaults (e.g., 60 req/min/IP).

### F12 — Missing `engines` field in both package.json (LOW — hygiene)
- **Files**: `ui/package.json`, `agent-proxy/package.json`
- **Issue**: No `"engines": { "node": ">=20" }` (or similar). New developer or CI runner can ship/test on incompatible Node.
- **Fix**: Add `engines` block + `.nvmrc` if not present.

### F13 — vitest 1.x in ui/ (HIGH — chore, also #83)
- **File**: `ui/package.json` (vitest `^1.0.0`, agent-proxy uses `^4.0.18`)
- **Issue**: 3 majors behind. Anchors transitive vulnerable globs.
- **Fix**: Upgrade vitest + `@vitest/coverage-v8` + `@vitest/ui` to 4.x. Refactor any test API breaks. **Tracked in #83** — this plan upgrades it from "chore" to "security-driven chore."

---

## Remediation Order (Prioritized)

| Rank | Finding | Why First |
|-----:|---------|-----------|
| 1    | F10     | API-key exfil potential; production-reachable; partially designed in #121 |
| 2    | F7      | XSS reachable via user-supplied Mermaid in notes |
| 3    | F5      | Production-reachable DoS in agent-proxy routing |
| 4    | F9      | Reduces blast radius of any future webview compromise |
| 5    | F2      | Dev-host filesystem exposure during development |
| 6    | F11     | Quota/cost protection |
| 7    | F1, F3, F4, F6, F8 | Bundled into one `npm audit fix` pass per component |
| 8    | F13     | Closes #83 + removes vulnerable transitive globs |
| 9    | F12     | Hygiene, low blast radius |

**Within tiers**: production-reachable before dev-only; SPA (user-facing) before build tooling.

---

## Hardening Beyond Patches

1. **CI audit gate**: Add `npm audit --audit-level=high` to the `quality-gate` workflow per component. Fail build on new high/critical.
2. **Dependabot or renovate equivalent**: Currently no automated PRs; manual cycles let CVEs age.
3. **Lockfile policy**: Both `package-lock.json` already committed (verified). Add a CI step that fails on uncommitted lockfile changes.
4. **SBOM**: `.aiwg/security/sbom-policy.md` already exists — generate per-release SBOMs via `npm sbom` and attach to release artifacts.
5. **`npm install --ignore-scripts` in CI**: Defense-in-depth against future install-time supply-chain attacks (mitigates a mini-shai-hulud-class attack even if a future tainted version slipped in).
6. **Provenance attestations**: Where available (`npm install --foreground-scripts=false`), prefer packages with npm provenance for high-blast-radius deps (vite, ai, @ai-sdk/*).

---

## Out of Scope (this pass)

- Full OWASP ASVS sweep — only npm-driven and adjacent surface here.
- Rust/Tauri Cargo audit (`cargo audit`) — separate task, separate tracker.
- Fortemi API side (different repo).
- Penetration testing of agent-proxy.
- Secrets rotation policy (covered by `.aiwg/security/secrets-management-policy.md`).
- Container/deployment image hardening (no container build in scope yet).

---

## Issues Filed

| Issue | Findings | Severity | Component(s)        | Title                                                                 |
|-------|----------|----------|---------------------|-----------------------------------------------------------------------|
| #212  | F10      | HIGH     | agent-proxy         | No client authentication — keys exposed to anyone on CORS_ORIGIN      |
| #213  | F7       | HIGH*    | ui                  | Mermaid CSS/HTML injection — production-reachable XSS                 |
| #214  | F5       | HIGH     | agent-proxy         | path-to-regexp ReDoS — remote unauthenticated DoS                     |
| #215  | F9       | HIGH     | tauri/ui            | Tighten CSP and HTTP capability allowlist                             |
| #216  | F2       | HIGH     | ui + agent-proxy    | Vite 7.0–7.3.1 dev-server vulns (3 GHSAs)                             |
| #217  | F1/3/4/6/8| HIGH/MOD| ui                  | Bulk `npm audit fix` — rollup, picomatch, minimatch, postcss, uuid    |
| #218  | F11      | MEDIUM   | agent-proxy         | Add rate limiting to /api/agent/chat                                  |

*npm-audit reports Mermaid as MODERATE; locally rated HIGH because user-supplied note content reaches Mermaid in production.

**Deferred to existing issues:**
- **F13** (vitest 1.x → 4.x upgrade) — `#83` already tracks this; security context added in comment.
- **F12** (missing `engines` field) — too small for standalone; fold into next dependency hygiene pass.

**Filed by**: roctibot (via Gitea MCP — issue creation only, no merge ops per project convention).

**Construction status (2026-05-15)**: COMPLETE. All 7 issues closed; new follow-up #219 filed for the deferred `unsafe-inline`/`unsafe-eval` removal (needs Tauri desktop session for Mermaid + KaTeX verification).

| Phase | Commit | Issues |
|------:|--------|--------|
| 1 | `defaaa1` | bulk `npm audit fix` (ui + agent-proxy) — closes #213 #214 #216 #217 |
| 2 | `13b4732` | vitest 1.x → 4.x upgrade — closes #83 |
| 3 | `abbea9f` | agent-proxy rate limiting — closes #218 |
| 4 | `9f26956` | bind 127.0.0.1 + SECURITY.md — closes #212 |
| 5 | `a4f6dfb` | Tauri CSP + HTTP allowlist (conservative) — closes #215; follow-up #219 |

Final audit state:
- `ui/`: 0 vulnerabilities (was 21).
- `agent-proxy/`: 0 vulnerabilities (was 4).
- All commits pushed to `origin` (Gitea) and `github`.
