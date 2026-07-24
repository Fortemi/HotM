# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2026.7.0] - 2026-07-24

This is a profile-scoped suite-contract baseline. It releases the proven
`core-v1` recovery window and exact REST, event, and compatibility consumers.
The guarded `2.0.0/full-v1` path is included, but live full-v1 recovery remains
blocked on signed Fortemi exports and is not a release capability claim.

### Added

- **Fortemi compatibility guard (#244):** require compatibility schema `1`,
  revision `2026-07-06`, and a satisfied minimum HotM client version before
  capability normalization or advanced server flows.
- **Guarded full-v1 recovery path (#272):** stream exact
  `2.0.0/full-v1` exports directly to disk, validate the complete manifest
  inventory within explicit archive bounds, and require a signed
  zero-mutation Fortemi preflight before any recovery mutation. The path stays
  fail-closed because current Fortemi exports omit `signature.json`
  (Fortemi #1088).
- **Self-contained container image (#241):** publish `hotm-bundle`, combining
  the HotM UI with an immutable Fortemi PostgreSQL/API/MCP image, alongside
  the backwards-compatible `hotm-ui` image. CI records both image digests in
  an uploaded publication receipt.

### Fixed

- Preserve Fortemi's explicit `degraded` capability state in compatibility
  normalization and both administrator status views instead of collapsing it
  to `unknown`, retaining the server's reason code for operator diagnosis
  (#252).
- Reset Backup Manager API mock implementations between UI test cases so
  queued one-shot results cannot make the quality gate order-dependent (#271).

### Changed

- **Vault-backed release authority:** ordinary commits and stable release tags
  use distinct OpenBao-custodied GPG keys through TPM-sealed AppRoles. Private
  material stays in tmpfs, exact fingerprints are verified, and desktop release
  jobs reject tags not signed by the published release key.
- **Fortemi OpenAPI consumer gate (#270):** repinned the immutable producer
  artifact and now requires every delivered operation to retain its
  schema-bearing RFC 9457 rate-limit response.
- **Knowledge Shard upload preflight (#269):** validates the actual TAR
  component inventory, SHA-256 digests, JSON records, and record counts before
  sending a `core-v1` archive to Fortemi, accepts the exact registered schema
  migration window (`1.0.0`, `1.1.0`, and `1.2.0`), and suppresses post-import
  inference so the restored portable snapshot is not immediately mutated.
- **Exact event and API authorities:** the SSE consumer is pinned to the
  delivered Fortemi event catalog and generated AsyncAPI receipt, while the
  OpenAPI gate validates every delivered operation and its schema-bearing
  rate-limit response.
- **Pinned desktop runtime:** refresh the sidecar provenance manifest to
  immutable release `sidecar-45aff7e6f439` with per-platform byte sizes and
  SHA-256 checksums.

### Compatibility

- Released recovery scope is `core-v1`, accepting exact schemas `1.0.0`,
  `1.1.0`, and `1.2.0`.
- `record-v1` is rejected by HotM recovery.
- `2.0.0/full-v1` is implemented only as a fail-closed boundary. This release
  does not claim full-v1 interoperability, complete backup, suite-wide
  portability, or schema parity.

## [2026.6.0] - 2026-06-02

Installer and desktop capture reliability release. Linux fresh installs now provision local transcription by default, while desktop video attachment upload paths use the native host adapter and surface upload progress consistently.

### Added

- **Default Linux transcription provisioning** via Speaches/Whisper. `scripts/install.sh` now installs Docker when needed and starts `hotm-speaches` on `127.0.0.1:8000`, so audio/video transcription jobs are enabled in the default desktop profile.
- **Installer controls for component startup**: `--no-whisper`, `--whisper-model`, and `--whisper-image` let operators disable local transcription or pin the local transcription model/image for constrained deployments.
- **Desktop component config** for `components.ollama`, `components.whisper`, `ollama_base_url`, and `whisper_base_url`, allowing the launcher to pass only the services expected by the active profile.

### Fixed

- **Desktop video attachments upload through the native Tauri adapter** instead of relying on browser file handling that could silently skip the transfer after a note was created.
- **Large local uploads** now route through the desktop upload/TUS path with a higher sidecar upload ceiling and visible upload progress events.
- **Linux local-mode sidecar startup** now passes the correct auth and service environment, preventing API-connected/offline-mode mismatches after reinstall.
- **Installer fresh-host behavior** tightened around PGDG key recovery, `--local-deb` path handling, and target-home resolution for logs/config written during sudo-driven installs.
- **Retrying queued jobs** removes stale completed/failed event cards when the same job is queued or started again.
- **npm audit advisory for `ws`** cleared by updating the transitive dev dependency from `8.19.0` to `8.21.0`.

### Compatibility

- No breaking changes to existing HotM data or UI workflows.
- Linux default installs now run local transcription infrastructure. Operators who do not want the Docker-backed Speaches service on a host should install with `--no-whisper`; the installer writes `components.whisper=false` so transcription jobs are not scheduled for that profile.

### Verification

- Gitea CI on `main` was green for the merged installer/transcription work before release prep.
- Local checks from the installer validation pass: `bash -n scripts/install.sh`, `npm run typecheck`, targeted Vitest coverage for job events and Tauri config, `cargo check`, `npm run tauri:build`, local `.deb` install, Speaches `/health` probe, and desktop launch smoke with the Whisper model ready.

## [2026.5.14] - 2026-05-26

Feature release for the latest Fortemi API surface integration. HotM now documents and exercises the newer Fortemi create-note, reprocess, backup import, document type, webhook, and capability-health contracts, and adds operator-facing Admin screens for the surfaces that need direct UI control.

### Added

- **Admin > API Surface** - dedicated capability/status screen showing the active sidecar endpoint, version/status, database and Ollama state, realtime counters, advertised capabilities, degraded-mode guidance, and HotM's wired UI feature coverage.
- **Admin > Document Types** - manage custom Fortemi document types from HotM while keeping system document types protected from deletion.
- **Admin > Webhooks** - register, test, and delete outbound Fortemi webhooks for lifecycle integrations.
- **OpenAPI compatibility contract tests** covering create-note field additions (`title`, revision mode, document type, context filters, processing options), response aliases, `POST /notes/reprocess`, backup import, document types, and webhook routes.
- **AIWG release-planning artifacts**: requirements, traceability matrix, gate report, API compatibility report, manifest schema JSON, and a cited feature/UI integration plan grounded in the local `research-papers` corpus.

### Changed

- **Quick Note now stays intentionally lightweight.** Advanced capture controls remain in the canonical Quick Capture workflow, avoiding duplicate partial create-note paths.
- **API health normalization preserves Fortemi metadata** such as advertised capabilities, SSE state, and job-processing status instead of reducing the payload to only status/database/Ollama fields.
- **`docs/openapi.json` expanded** as HotM's local compatibility snapshot for the latest UI-used Fortemi API surface.

### Compatibility

- No breaking changes to existing HotM UI workflows.
- Uses Fortemi v2026.5.13 source-route audit evidence for latest-surface confirmation. A generated upstream Fortemi OpenAPI artifact was not present in the local source checkout, so canonical upstream OpenAPI diffing remains a follow-up control.

### Verification

- `npm test -- --run src/api/__tests__/index.test.ts src/api/__tests__/openapi-contract.test.ts src/components/admin/__tests__/ApiCapabilitiesPanel.test.tsx src/components/admin/__tests__/AdminPanel.test.tsx src/components/admin/__tests__/DocumentTypesPanel.test.tsx src/components/admin/__tests__/WebhooksPanel.test.tsx src/components/capture/__tests__/useNoteCommit.test.ts src/components/backup/__tests__/BackupManager.test.tsx`: 79 / 79 passing.
- `npm run typecheck`: pass.
- `node .aiwg/testing/scripts/validate-manifest-schema.mjs`: pass.
- `git diff --check`: pass.

## [2026.5.13] - 2026-05-18

Sidecar tracking release. Bundled Fortemi sidecar moves from v2026.5.6 to v2026.5.7 — picked up automatically at build time via the `sidecar-latest` download in `.gitea/workflows/tauri-build.yml` and `.gitea/workflows/desktop-release.yml`. No HotM source changes beyond the version bump and one doc fix.

### Fortemi v2026.5.7 highlights (inherited)

- **PostgreSQL 18 declared hard requirement.** Fortemi migrations now rely on PG 18 built-ins (`uuidv7()` and others). HotM's installer scripts and macOS/Linux desktop docs already target PG 18 since v2026.5.0, so end users see no behavior change — this release just brings the Docker compose example in line.
- **Dependency advisories cleared** in the sidecar: Pillow ≥12.2.0 (open3d-renderer), `ip-address` ≥10.1.1 and `fast-uri` ≥3.1.2 (mcp-server), `hono` ≥4.12.18 + `@hono/node-server` ≥1.19.13, `rand` 0.10.1, `rustls-webpki` 0.103.13, `openssl` crate 0.10.79. Fortemi also added cargo-deny, cargo audit, and npm audit pre-merge gates so future bumps land faster.
- Streaming PoC and unified workstation Docker stack landed in Fortemi but are not exposed through HotM's UI yet.

### Fixed

- **`docs/installation/docker.md` Postgres image pin**: `pgvector/pgvector:pg17` → `pgvector/pgvector:pg18`. The example compose snippet drifted behind the Linux and macOS install docs (both PG 18 since v2026.5.0). Following the old snippet against current Fortemi migrations would have produced the same `function uuidv7() does not exist` failure mode the desktop installers already prevent.

### Changed

- **`ui/src-tauri/gen/schemas/capabilities.json` regenerated.** Source `capabilities/default.json` was tightened in v2026.5.11's CSP hardening (`http://**` → `http://localhost:*/**` + `http://127.0.0.1:*/**`); the generated schema artifact had not been re-emitted on disk. Cargo build was already producing the tightened output — this commits the file to match.

### Notes

- agent-proxy unchanged.
- No Tauri / WebKit2GTK / WebView2 version changes.
- Verification: `ui/` typecheck pass, full test suite pass, `npm run build` pass.

## [2026.5.12] - 2026-05-16

Targeted follow-up to v2026.5.11's security batch. The v2026.5.11 CSP tightening kept `'unsafe-inline'` and `'unsafe-eval'` in `script-src` and Mermaid's `securityLevel: 'loose'` pending a runtime test. A direct survey of the production bundle showed neither directive was actually load-bearing — both came from defensive boilerplate, not from any code path that runs.

Closes [#219](https://git.integrolabs.net/Fortemi/HotM/issues/219).

### Security

- **Dropped `'unsafe-inline'` and `'unsafe-eval'` from CSP `script-src`** in `ui/src-tauri/tauri.conf.json`:
  ```diff
  - script-src 'self' 'unsafe-inline' 'unsafe-eval'
  + script-src 'self'
  ```
  Any XSS that gets past the post-v2026.5.11 net can no longer construct code via `eval()` / `new Function()` or execute inline `<script>` blocks. The blast radius of any future webview compromise is dramatically reduced.

  `style-src 'self' 'unsafe-inline'` is intentionally kept — 37+ source files use React's `style={{}}` prop plus Radix UI internals inject inline styles for animations. CSS injection has a fundamentally smaller blast radius than script execution; the directives that mattered are the ones removed.

- **Mermaid `securityLevel: 'loose'` → `'strict'`** in `ui/src/components/MermaidRenderer.tsx`. The `loose` setting allowed HTML in node labels — the actual reachable XSS surface that v2026.5.11's npm-advisory patch (#213) addressed only at the library-version level. `strict` is the Mermaid library default and disallows HTML/script in labels entirely. No in-tree usage of HTML-in-labels detected.

### Methodology

Pre-change bundle survey on the production `dist/` artifact (4.0 MB main bundle + 930 KB lazy `ModelPreview` chunk):

| Check | Result |
|---|---|
| `eval(...)` calls | **0** (4 raw substring matches were syntax-highlighter regex tokens like `/eval(?:cmd)?|exactp/`) |
| `new Function(...)` calls | **0** |
| `Function("...")` constructor calls | **0** (1 raw match was KaTeX's `r.callFunction` method call) |
| Inline `<script>` blocks in `index.html` | **0** (both script tags use `src=`) |

Heavy deps analyzed in `node_modules` vs the actual built artifact:
- `mermaid` 11.x: zero eval/Function in shipped dist (the modernized release doesn't use them)
- `katex`: produces static HTML; no runtime eval
- `d3` (transitive): 2 source files use `Function()` — tree-shaken out, not in bundle
- `three.js` (via `@google/model-viewer`): 9 source files use eval/Function — lazy `ModelPreview` chunk built from this had **0** eval/Function calls in output

The conventional wisdom that Mermaid/KaTeX require `unsafe-eval` proved untrue for this codebase. Vite's tree-shaking plus Mermaid 11's modernization had already eliminated the paths that would have needed those directives.

### Verification

- `ui/`: typecheck pass, 1427 / 1427 tests pass, `npm run build` pass, `npm audit` 0 vulnerabilities.
- `act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml`: success.
- Platform-native Tauri webview runtime verification (WebKit on macOS, WebView2 on Windows, WebKitGTK on Linux) is the remaining manual step — open DevTools after a desktop build, render a note with Mermaid + KaTeX, confirm no `Refused to execute inline script` / `Refused to evaluate string` console messages. The CSP engines on those platforms differ slightly from Vite's bundling assumptions; if anything trips, selectively allow back via `'unsafe-hashes'` or hash/nonce rather than re-adding blanket directives.

### Notes

- agent-proxy unchanged — no runtime version bump there; agent-proxy's CSP doesn't apply (it's an Express server, not a webview).
- No Fortemi sidecar version change. Bundled Fortemi version stays v2026.5.6.

## [2026.5.11] - 2026-05-15

Security-hardening release. Full npm audit + dependency cleanup across both Node components, plus structural hardening on the agent-proxy sidecar and Tauri webview. **`npm audit` reports 0 vulnerabilities in both `ui/` and `agent-proxy/`** after this release (was 25 total: 21 in `ui/`, 4 in `agent-proxy/`). Verified clean against the full 2026-05 mini-shai-hulud TanStack supply-chain compromise (175 unique compromised npm package names cross-checked against both lockfiles).

7 issues closed: #83, #212, #213, #214, #215, #216, #217, #218. One follow-up filed: #219 (drop `unsafe-inline`/`unsafe-eval` from Tauri CSP — needs desktop runtime test against Mermaid + KaTeX).

### Security

- **Mermaid CSS/HTML injection** ([#213](https://git.integrolabs.net/Fortemi/HotM/issues/213), GHSA-87f9-hvmw-gh4p + GHSA-ghcm-xqfw-q4vr) — `mermaid` patched via the ui audit-fix pass. Production-reachable XSS pathway closed: user-authored note content rendered through Mermaid no longer admits crafted `classDef` or config payloads.
- **path-to-regexp ReDoS** ([#214](https://git.integrolabs.net/Fortemi/HotM/issues/214), GHSA-37ch-88jc-xwx2) — `path-to-regexp` patched via the agent-proxy audit-fix pass. Remote unauthenticated event-loop-wedge against `/api/agent/chat` is no longer reachable.
- **Vite 7.0–7.3.1 dev-server vulns** ([#216](https://git.integrolabs.net/Fortemi/HotM/issues/216), three GHSAs: -4w7w-66w2-5vf9, -v2wj-q39q-566r, -p9ff-h696-f583) — `vite` patched in both components. `fs.deny` bypass, `.map` path traversal, and arbitrary file read via dev-server WebSocket all closed.
- **Bulk ui patches** ([#217](https://git.integrolabs.net/Fortemi/HotM/issues/217)) — rollup arbitrary file write (GHSA-mw96-cpmx-2vgc), picomatch ReDoS + method injection (GHSA-3v7f-55p6-f55p, -c2c7-rcm5-vvqj), minimatch ReDoS x3 (GHSA-3ppc-4f35-3m26, -7r86-cg39-jmmj, -23c5-xmqv-rm74), postcss XSS (GHSA-qx2v-qp2m-jg93), uuid bounds check (GHSA-w5hq-g745-h8pq) — all cleared in one `npm audit fix` sweep.
- **agent-proxy bound to 127.0.0.1 by default** ([#212](https://git.integrolabs.net/Fortemi/HotM/issues/212)) — was binding to all interfaces (Node default). `BIND_ADDR` env var added with localhost default; setting `0.0.0.0` is now an explicit opt-in. New `agent-proxy/SECURITY.md` documents the localhost-sidecar threat model, defense-in-depth layers, and operator checklist.
- **agent-proxy rate limit** ([#218](https://git.integrolabs.net/Fortemi/HotM/issues/218)) — `express-rate-limit` middleware on `/api/agent/chat` (60 req/min/IP default, configurable via `AGENT_PROXY_RATE_LIMIT_RPM`, `0` to disable). `/health` stays unmetered. 4 new tests exercise the actual middleware against a live local Express server.
- **Tauri CSP and HTTP allowlist tightened** ([#215](https://git.integrolabs.net/Fortemi/HotM/issues/215)) — CSP `connect-src` dropped blanket `http:` and `ws:`; kept `https:` and `wss:`; re-permitted plain `http`/`ws` only for `localhost` / `127.0.0.1` (dev sidecars: Fortemi, agent-proxy, Ollama, PlantUML). Tauri http capability dropped `http://**`; kept `https://**` plus `http://localhost:*/**` and `http://127.0.0.1:*/**`. Removing `unsafe-inline` / `unsafe-eval` is deferred to follow-up [#219](https://git.integrolabs.net/Fortemi/HotM/issues/219).

### Changed

- **vitest 1.x → 4.x in `ui/`** (closes [#83](https://git.integrolabs.net/Fortemi/HotM/issues/83)). Matches `agent-proxy/` on the same major. Side effects required for the upgrade:
  - `vitest.config.ts` — added `restoreMocks: true` for vitest 4's stricter spy isolation
  - 2 test files rewrote `vi.fn().mockImplementation(arrow)` → `vi.fn(function(this){})` for constructor-shape mocks (tus.Upload, DefaultChatTransport) — arrow-based `mockImplementation` is no longer constructable with `new` in vitest 4
  - `use-tauri.test.ts` — snapshot-then-compare pattern instead of hardcoded `toHaveBeenCalledTimes(1)` for React 19 render counts
  - `CriteriaEditor.test.tsx` — explicit generic on `vi.fn<(args) => ret>()` for callback props (vitest 4's `ReturnType<typeof vi.fn>` now includes `Constructable`)

### Documentation

- **`.aiwg/security/npm-audit-plan-2026-05-14.md`** (new) — full hardening plan and phase commit map.
- **`agent-proxy/SECURITY.md`** (new) — threat model and operator checklist for the agent-proxy sidecar.
- **`docs/host-adapter.md`** — documents `window.__HOTM_HOST__` as the canonical adapter global; clarifies that the v2026.5.0-era compatibility-fallback has been removed.
- **`AIWG.md`** — regenerated for AIWG framework v2026.5.4.

### Verification

- `ui/`: typecheck pass, 1427 / 1427 tests pass, `npm run build` pass, `npm audit` 0 vulnerabilities.
- `agent-proxy/`: typecheck pass, 116 unique tests pass, `npm run build` pass, `npm audit` 0 vulnerabilities.
- `act_runner exec -j quality-gate -W .gitea/workflows/ui-ci.yml`: success on every release-candidate commit.
- Supply-chain check against the official mini-shai-hulud CSV: zero matches.

### Notes

- No Fortemi sidecar version change. Bundled Fortemi version stays v2026.5.6.
- Tauri runtime verification on platform-native webviews (WebKit / WebView2 / WebKitGTK) is the open work in [#219](https://git.integrolabs.net/Fortemi/HotM/issues/219); needs a desktop session, not just a `vite build`.

## [2026.5.10] - 2026-05-11

Installer-parity patch — caught during mutsu smoke test. The Linux `.deb` postinst and the macOS `setup-macos.sh` enabled different Postgres extension sets, even though both target the same Fortemi sidecar.

### Fixed

- **Linux postinst extension set aligned with macOS.** The `.deb` postinst previously enabled `vector, postgis, pg_trgm, pgcrypto`. Fortemi migrations do not use `pgcrypto` (the `gen_random_uuid()` references are Postgres 13+ built-ins, not the pgcrypto function). Fortemi's FTS migration *does* enable `unaccent` via `CREATE EXTENSION IF NOT EXISTS unaccent` — a trusted extension that the matric role can create at migration time, so the divergence wasn't user-visible, just inconsistent.
  - Postinst now enables: `vector, postgis, pg_trgm, unaccent` (matching macOS).
  - Comment in `postinst.sh` documents which extension each line is for and why `uuid-ossp` (created by fortemi's initial migration) and `pgcrypto` (unused) are absent.
  - `docs/installation/desktop-linux.md` table updated to reflect the new extension list.

### Notes

- The .deb already Depends on `postgresql-contrib-18`, which ships both `pg_trgm` and `unaccent` — no apt resolution change. Existing installs upgraded from earlier versions retain `pgcrypto` (harmless leftover); the new postinst is idempotent so re-running it just adds `unaccent` without removing `pgcrypto`. Operators who want a tidy state can `DROP EXTENSION pgcrypto` manually.
- No sidecar changes. Bundled Fortemi version stays v2026.5.6.

## [2026.5.9] - 2026-05-11

Bug-fix release for the [v2026.5.8 epic #202](https://git.integrolabs.net/Fortemi/HotM/issues/202) landing — caught during live install smoke test. Two response-shape mismatches between the UI types and the Fortemi server.

### Fixed

- **`InferenceConfig.embedding_backend` shape** — server wraps the override as `AttributedValue<string>` (matching every other config field's source-attribution shape), not a bare string. The UI type now matches; the form hydrates and dirty-checks via `cfg.embedding_backend?.value`. Previously a server-set override would store the entire `{ source, value }` object as the form's selected backend, producing an unselected dropdown after `getConfig()`.
- **`POST /inference/config` response shape** — the server returns `{ current, previous, status, warnings }`, not `InferenceConfig` directly. The UI now reads `result.current` for the effective config and `result.previous` for the dry-run modal's "before" panel. `result.warnings` is surfaced in the save toast — important for per-archive saves where the server attaches the deferred-hot-swap notice. Previously `setConfig(result)` would store the wrapper object and crash on the subsequent `result.ollama.base_url.value` access.
- **`updateConfig` return type** — `Promise<UpdateConfigResponse>` instead of `Promise<InferenceConfig>`. `updateConfigValidated` (deprecated) updated to match. No call site outside `InferenceSettings.tsx` consumed the return value, so the type tightening is non-breaking.

### Verification

Live smoke test against the Fortemi v2026.5.6 sidecar:
- `GET /api/v1/inference/config` returns the wrapped `embedding_backend` correctly
- `POST /api/v1/inference/config` (plain, validate, dry_run) returns the `{ current, previous, status, warnings }` envelope
- `GET /api/v1/inference/config/audit` returns `{ entries: [...] }` matching the existing types
- `npm run typecheck` clean
- `npm test -- --run`: **1427 / 1427 passing**

## [2026.5.8] - 2026-05-11

Closes [epic #202](https://git.integrolabs.net/Fortemi/HotM/issues/202) — full UI consumption of Fortemi's runtime inference-config surface. Six child issues land together: SSE subscriptions, OpenRouter provider, save modes, embedding routing, audit log, per-archive overrides.

### Added

- **OpenRouter provider** ([#204](https://git.integrolabs.net/Fortemi/HotM/issues/204)) — new collapsible card in `InferenceSettings` with `base_url`, `api_key`, `generation_model`, and the OpenRouter-specific `http_referer` + `app_name` (X-Title) headers. Generation-only — no embedding model field. Provider capability badges (Generation / Embedding / Vision) now render on every provider card sourced from the new `PROVIDER_PROFILES` catalog.
- **Save modes** ([#206](https://git.integrolabs.net/Fortemi/HotM/issues/206)) — Save split-button gains three additional modes: **Validate before save** (`?validate=true`, probes touched providers), **Atomic save** (`?atomic=true`, 503 if any probe fails with per-provider detail), and **Preview changes** (`?dry_run=true`, opens a side-by-side JSON diff modal without persisting or emitting an SSE event). `api.inference.updateConfig` now accepts an options object that builds the query string.
- **Embedding routing** ([#205](https://git.integrolabs.net/Fortemi/HotM/issues/205)) — new **Routing** card above the provider cards. Default backend dropdown (all four providers) plus "Route embeddings independently" toggle + dropdown filtered to embedding-capable providers only. Tri-state semantics on `embedding_backend` (omit / clear / set) match the Fortemi `Option<Option<String>>` field. Active routing summary line ("Generation: openrouter — Embeddings: ollama") updates live.
- **Audit log viewer** ([#207](https://git.integrolabs.net/Fortemi/HotM/issues/207)) — new **Audit Log** tab in AdminPanel. Paginated table over `GET /api/v1/inference/config/audit` with action-colored badges (set/reset/set_archive/reset_archive), expandable rows showing the before/after JSON diff, and filters for actor + action + limit (max 200). Auto-refreshes on `InferenceConfigChanged` SSE events. API keys remain redacted server-side via `redact_api_key()`.
- **Per-archive inference overrides** ([#208](https://git.integrolabs.net/Fortemi/HotM/issues/208)) — `ArchiveManager` cards gain an **Inference** action that opens a dialog rendering `<InferenceSettings scope={{ archive }} />`. The settings component takes an optional `scope` prop and routes every API call through the `X-Fortemi-Memory` header. Composition over inheritance — single component serves both global and archive scope; no fork. A deferred-hot-swap warning banner explains that overrides persist but are not yet routed in the live runtime.

### Changed

- **`api.inference.updateConfig`** — new optional second argument `options` (`{ validate?, atomic?, dryRun? }`) and third argument `scope` (`{ archive? }`). `updateConfigValidated` is now marked `@deprecated` — kept for back-compat; new callers should pass `{ validate: true }` to `updateConfig` instead.
- **All `api.inference.*` methods** — `getConfig`, `updateConfig`, `resetConfig` accept an optional `RequestScope` arg that adds the archive-routing header when set.
- **`RealtimeEventType` + SSE subscriber list** ([#203](https://git.integrolabs.net/Fortemi/HotM/issues/203)) — extended with `InferenceConfigChanged` and `InferenceAvailabilityChanged`. `InferenceSettings` auto-refreshes when the form is clean, surfaces a non-destructive amber banner when dirty. `InferenceStatusIndicator` flips dot color on availability change without a full refetch. Handles `__reset__` + `__reset_archive__` sentinels.

### Tests

5 new cases in `realtimeEventBus.test.ts` covering tri-state null on `embedding_backend`, sentinel pass-through, and event mapping. Full suite: **1427 / 1427 passing**.

### Known follow-ups (filed separately under #202)

- Fortemi-side enhancement to add `archive_name` to the `InferenceConfigChanged` event payload so the per-archive UI can filter event handling to the open scope. Today the filter falls back to no-op when `archive_name` is absent.
- Fortemi-side live runtime per-archive routing (the gap acknowledged in the #655 PR description — overrides persist but don't hot-swap to the live registry).

## [2026.5.7] - 2026-05-11

Rebuild against [Fortemi v2026.5.6](https://github.com/Fortemi/Fortemi/releases/tag/v2026.5.6) — the bundled `hotm-matric-api` sidecar picks up two API additions and one important seed-path fix.

### Changed

- **Bundled sidecar rebuilt against Fortemi v2026.5.6.** Pulls in:
  - **`defer_inference` flag on `POST /api/v1/backup/import`** (Fortemi #677) — When `true`, imported notes land as raw content only; the full NLP pipeline (embeddings, metadata, NER, linking, title generation) is skipped. FTS works immediately via the insert-trigger-maintained tsvector. Semantic backfill is on-demand via `POST /api/v1/notes/reprocess`. Default `false` preserves prior behavior. Fixes the case where a manual `/backup/import` of a large archive could pin Ollama for hours on edge hardware.
  - **`title` field on `CreateNoteRequest` and `POST /api/v1/notes`** (Fortemi #675) — Optional explicit title. When provided, the AI title-generation pipeline step is skipped (caller's value is authoritative). Bulk-create accepts it on every item.
- **`ui/src-tauri/Cargo.toml` and `Cargo.lock` version sync.** Previous releases (`v2026.5.5`, `v2026.5.6`) left the Rust crate version pinned at `2026.5.4` — only `ui/package.json` and `tauri.conf.json` were bumped. This release brings all four version pins back in sync at `2026.5.7`. No user-visible effect on the .app bundle (the Tauri build reads version from `tauri.conf.json`); fixes `cargo metadata` parity for downstream tooling.

### AIWG

- Framework refreshed to a kernel-only deployment model. `.agents/skills/` now ships ~10 quickref skills (one per installed framework + core utilities); the bulk of the SDLC, research, marketing, forensics, ops, knowledge-base, security-engineering, and media-curator skills moved to `.claude/skills/` and are reached via `aiwg discover` / `aiwg show` rather than pre-loaded. No runtime impact on the desktop app.

## [2026.5.6] - 2026-05-10

### Changed

- **Bundled Fortemi sidecar** refreshed to current `Fortemi/fortemi` `sidecar-latest` at build time. No HotM contract change.

### Fixed

- **`install.sh` re-adds the PGDG GPG key when the source list survives a purge but the keyring does not** ([#200](https://git.integrolabs.net/Fortemi/HotM/issues/200)). Reinstalls on hosts that previously ran `apt purge postgresql-common` (which removes the keyring as a config file but leaves `/etc/apt/sources.list.d/pgdg.list` in place) used to silently fall back to cached apt index lists, with every subsequent `apt-get update` warning `NO_PUBKEY 7FCC7D46ACCC4CF8` until the keyring was manually restored. `add_pgdg_repo()` now treats source-list and keyring as independent prerequisites and re-fetches whichever is missing.
- **`install.sh` recovers cleanly when an orphan `ollama` group survived a prior install** ([#201](https://git.integrolabs.net/Fortemi/HotM/issues/201)). The upstream Ollama installer's `useradd` failed (`group ollama exists`) and exited non-zero, which under `set -euo pipefail` aborted `install.sh` immediately after the upstream installer's misleading "Install complete" banner — leaving the user with no `ollama` user, no `/etc/systemd/system/ollama.service`, no model pulls, and no final status banner. The script now pre-cleans an orphan group, wraps `curl | sh` so a non-zero upstream exit does not abort the script, and surfaces an explicit warning with a remediation hint if the systemd service still doesn't exist after install. Fresh-host installs are unaffected.

## [2026.5.5] - 2026-05-10

### Changed

- **Bundled Fortemi sidecar** refreshed to current `Fortemi/fortemi` `sidecar-latest` at build time. Picks up Fortemi-side improvements without changing HotM's contract — host-adapter, API surface, and `.deb` install behavior are all identical to v2026.5.4.

### Documentation

- **Bring-Your-Own-LLM onboarding** ([#198](https://git.integrolabs.net/Fortemi/HotM/issues/198)). `docs/quick-start.md` now opens with a three-path decision tree (Desktop bundle / Docker UI + external Fortemi / BYO-LLM) and a dedicated *Bring Your Own LLM* section showing the `--no-ollama` install one-liner and the Fortemi env vars to switch backends. `scripts/install.sh` advertises `--no-ollama` in the usage block and prints the Fortemi config hints when invoked. `.env.example` now distinguishes UI vars (`VITE_API_BASE_URL` only) from Fortemi backend vars with an explicit "NOT read by HotM UI" notice. `docker-compose.prod.yml` carries a header block clarifying the stack is UI-only and Fortemi's inference backend is invisible to the UI. Addresses real user feedback that the bundled-Ollama defaults conflicted with existing llama.cpp setups.

### Fixed

- **Flaky dialog-close tests under quality-gate parallel load** ([#199](https://git.integrolabs.net/Fortemi/HotM/issues/199)). Three `EmbeddingSetManager` Cancel-close tests (create / edit / delete) intermittently timed out at the 5000 ms vitest default. Root cause: Radix Dialog's `Presence` waits for `animationend` events that jsdom does not fire reliably under heavy event-loop contention — load-induced timeout, not a test code race. Per-test timeout bumped to 15 s on the three affected tests with an inline note linking the issue. Verified across 5 consecutive `act_runner exec -j quality-gate` runs (all green).

## [2026.5.4] - 2026-05-09

### Added

- **Docsite build + deploy workflows** ([`.gitea/workflows/docsite-build.yml`](.gitea/workflows/docsite-build.yml), [`.gitea/workflows/docsite-deploy.yml`](.gitea/workflows/docsite-deploy.yml)). Mirrors the docsite CI pattern landed in [Fortemi v2026.5.1](https://github.com/Fortemi/Fortemi/releases/tag/v2026.5.1): PR-time build validation against `docs/`, plus a deploy-on-push pipeline targeting `docs.fortemi.io/hotm`. Docs config moved into `docs/config.json` so both runners build the site reproducibly.

### Changed

- **AIWG framework refresh** to `2026.5.0-rc.21`. Pulls in the current SDLC framework bundle. No runtime impact — `.aiwg/` tooling only.

## [2026.5.3] - 2026-05-08

### Fixed

- **Ollama service failed to start on dirty re-installs** ([#196](https://github.com/Fortemi/HotM/releases/tag/v2026.5.2)). The upstream Ollama installer's idempotency logic skips data-directory creation when the `ollama` system user already exists from a prior install. On boxes where `/usr/share/ollama` was wiped manually but the user persisted, `ollama.service` then crash-looped with `could not create directory mkdir /usr/share/ollama: permission denied`. `install.sh` now defensively `install -d -o ollama:ollama /usr/share/ollama` after the upstream curl-pipe-bash. No-op on a true fresh install.

### Removed

- **`scripts/setup-linux.sh`** — fully superseded by `scripts/install.sh` and the `.deb` postinst hook in `v2026.5.2`. Deprecation banner shipped in `v2026.5.2`; deleted in this release per follow-up.

### Documentation

- **`docs/quick-start.md`** rewritten around the single-command install. Stale references to `setup-linux.sh` and pinned version strings (`HotM_2026.2.0_*`) replaced with the current `install.sh` one-liner and links to the latest-release page.

## [2026.5.2] - 2026-05-08

### Added

- **Single-command Linux installer** ([#196](https://github.com/Fortemi/HotM/releases/tag/v2026.5.2)). `scripts/install.sh` is now the supported one-liner: it adds the [PGDG](https://wiki.postgresql.org/wiki/Apt) apt repo, installs the `.deb` (which now pulls Postgres 18 + pgvector + postgis automatically via Depends/Recommends), runs the post-install hook to seed the `matric` database and extensions, and triggers the official Ollama installer with background model pulls. Idempotent — re-running skips anything already in place.
  - Resolves the latest release via the GitHub releases API with a tag-pattern filter (`^v[0-9]+\.[0-9]+\.[0-9]+$`).
  - Verifies `SHA256SUMS.txt` against the downloaded `.deb`.
  - Flags: `--version`, `--no-ollama`, `--skip-models`, `--embed-model`, `--gen-model`, `--local-deb` (for testing pre-release builds).
- **`.deb` postinst hook** that creates the `matric` role + database, enables `vector`, `postgis`, `pg_trgm`, and `pgcrypto` extensions, and self-checks `uuidv7()` resolves before declaring success.
- **PGDG repo bootstrap** in `install.sh`. Verifies the host's codename has a published PGDG release before writing the source — fails fast on unsupported distros instead of silently substituting.

### Changed

- **Postgres 18 is now the supported runtime.** The `.deb` declares `Depends: postgresql-18, postgresql-contrib-18` (was `postgresql (>= 14)`) and `Recommends: postgresql-18-pgvector, postgresql-18-postgis-3`. This pins the `matric` cluster to PG 18 specifically — required because the matric-api migration `20260215000000` calls `uuidv7()`, a PG 18 built-in (RFC 9562) that doesn't exist on PG 13–17.
- **`docs/installation/desktop-linux.md`** rewritten around the single-command path. Documents what `install.sh` does step-by-step so users can audit before piping. Manual install path retained for advanced users; troubleshooting section adds a `function uuidv7() does not exist` entry pointing at PG 18 / PGDG.
- **`scripts/setup-linux.sh`** marked DEPRECATED — superseded by `install.sh` + the `.deb` postinst. Retained for dev environments running matric-api from source without the `.deb`.

### Removed

- **`setup_ollama.sh`** at repo root. Duplicated the Ollama install logic and used a different model name (`gpt-oss:20b`) than the rest of the project. Models are now standardized in one place: `install.sh` pulls `nomic-embed-text` for embeddings and `qwen3.5:9b` for generation.

### Notes

- The dpkg package name is `hot-m` (Tauri's bundler kebab-cases the `productName` "HotM" when generating the deb's control file). Use `apt remove hot-m` / `dpkg-reconfigure hot-m`. The user-facing app and binaries (`/usr/bin/hotm`, `/usr/bin/hotm-matric-api`) are still named `hotm`.
- Verified end-to-end on a fresh Ubuntu 25.10 host (questing-pgdg): apt resolves `postgresql-18 18.3-1.pgdg25.10+1`, `postgresql-18-pgvector 0.8.2`, `postgresql-18-postgis-3 3.6.3`; postinst seeds matric DB cleanly; matric-api migrations complete with no errors using native PG 18 `uuidv7()`.

## [2026.5.1] - 2026-05-07

### Removed

- **Legacy host-adapter fallback symbol** — the runtime no longer accepts adapters published under the previous (pre-`__HOTM_HOST__`) symbol name. Embedders must publish `window.__HOTM_HOST__`. The deprecated fallback and one-time deprecation warning introduced in v2026.5.0 are gone, along with their tests. Any embedder still on the legacy symbol must rename to `__HOTM_HOST__` before upgrading.

### Changed

- **Documentation cleanup** — removed historical project-name references from public-facing docs (`README.md`, `CHANGELOG.md`, `docs/host-adapter.md`, `docs/releases/v2026.4.1.md`, `docs/releases/v2026.5.0.md`). No behavior change beyond the host-adapter symbol removal above.

## [2026.5.0] - 2026-05-06

### Changed

- **Version aligned with Fortemi v2026.5.0** — HotM bumps to 2026.5.0 to track the matching Fortemi minor release ([Filesystem attachment durability + CI Docker fix](https://git.integrolabs.net/Fortemi/fortemi/releases/tag/v2026.5.0)). No HotM API contract changes; this release pairs the desktop bundle and Docker UI image with the latest Fortemi sidecar.

### Fixed

- **`__HOTM_HOST__` adapter contract v1** — the host-adapter now accepts an optional `version` field so embedders can declare the contract revision they implement ([#192](https://git.integrolabs.net/Fortemi/HotM/pulls/192)).
- **macOS Gatekeeper first-launch flow** — `setup-macos.sh` and the install docs now walk users through the System Settings → Privacy & Security approval needed for the self-signed `.app` bundle.
- **macOS install parity with Linux desktop** — `setup-macos.sh` reaches feature parity with the Linux setup script (sidecar staging, .env handling, Ollama detection).

### CI

- `ui-ci.yml` checkout aligned with the Fortemi workflow pattern, fixing intermittent `${GITHUB_SERVER_URL}` resolution failures on local act_runner runs ([#191](https://git.integrolabs.net/Fortemi/HotM/pulls/191)).

### Internal

- AIWG framework refreshed to 2026.4.0-rc.31; the Codex provider deployment is dropped (Codex is no longer a supported AIWG target for this repo).

## [2026.4.1] - 2026-04-29

### Fixed

- **All POST/PUT/PATCH bodies were silently empty in standalone-Tauri mode** — Tauri v2 defaults command argument deserialization to camelCase, so the snake_case `body_b64` key sent by the documented `HotmHostAdapter` contract (and by the auto-injected `__HOTM_HOST__.network.fetch` adapter) was silently dropped. `hotm_fetch` received `body_b64: None` and reqwest sent an empty body. Every request through the host-fetch proxy that carried a body — Admin Panel **Test Connection** (most user-visible), note creation, configuration writes, agent tool calls — hit matric-api with `Content-Type: application/json` and zero bytes, producing the "Bad Request / Connection Failed" error even when Ollama and matric-api were fully reachable. GET requests were unaffected. Diagnosed via tcpdump on the loopback port; fixed by adding `#[tauri::command(rename_all = "snake_case")]` to `hotm_fetch` so the documented snake_case JS contract works end-to-end.

### Changed

- **Bundled Fortemi sidecar renamed to `hotm-matric-api`** (closes [#187](https://git.integrolabs.net/Fortemi/HotM/issues/187)) — the Tauri-bundled sidecar binary now installs as `hotm-matric-api` instead of `matric-api`, eliminating the `/usr/bin/` namespace collision with sibling Tauri apps that bundle their own `matric-api`.
  - Linux: bundled at `/usr/bin/hotm-matric-api`
  - macOS: inside the .app at `Contents/MacOS/hotm-matric-api`
  - Windows: alongside `hotm.exe` as `hotm-matric-api.exe`
  - Tauri sidecar API call updated: `.sidecar("hotm-matric-api")`
  - Tauri capability updated: `shell:allow-execute → name: hotm-matric-api`
  - CI workflows now stage the binary as `binaries/hotm-matric-api-<triple>`; the upstream Fortemi sidecar release artifact name (`matric-api-<triple>`) is unchanged
  - **Post-upgrade note for users with HotM installed alongside another package that previously claimed `/usr/bin/matric-api` via `dpkg --force-overwrite`**: after this upgrade, HotM removes `/usr/bin/matric-api` (it is no longer in the package contents). If you need the old path back for the sibling app, reinstall it via `sudo apt-get install --reinstall <sibling-package>` to restore its file ownership.

### Notes

- This is a partial fix for [#187](https://git.integrolabs.net/Fortemi/HotM/issues/187). The bundled sidecar still lives under `/usr/bin/` rather than the Debian-Policy-recommended `/usr/lib/hot-m/` private path. A future change to relocate the binary to `/usr/lib/hot-m/hotm-matric-api` (or the macOS/Windows equivalents) is tracked separately when Tauri's `externalBin` mechanism supports private install paths.

## [2026.4.0] - 2026-04-22

### Added

- **Embedded AI agent** — conversational AI assistant powered by Fortemi's local LLM stack, with tool execution, session management, and full note integration
  - XState v5 intent-driven flow machine with conversational-first behavior (tools withheld on first turn to encourage natural dialogue)
  - Dynamic model selection from Fortemi API with default model `qwen3:14b`
  - Server-side tool execution via Vercel AI SDK — archive/notes search, concept lookup, attachment access
  - Attachment-aware tools with inline preview cards (thumbnails, action buttons, media players)
  - Session management: create, export, restore; save session JSON as a note attachment
  - Multi-session UX with clean handoff between conversations
  - Agent proxy service bundled as a Docker image, published alongside the UI image
- **Native desktop app** — HotM now ships as a standalone Tauri application bundling the Fortemi sidecar
  - Fortemi `matric-api` sidecar bundled as an `externalBin`; spawned on a free loopback port at launch
  - `sidecar:ready` event signals the React SPA when the backend is accepting connections
  - Host-proxy pattern: `hotm_fetch` and `hotm_sse_connect` Tauri commands proxy HTTP/SSE through the Rust reqwest backend, bypassing WebKit2GTK network restrictions
  - `CmdOrCtrl+Alt+H` global shortcut to toggle window visibility from anywhere on the desktop
  - `--minimized` / `/minimized` launch flag for autostart-on-login scenarios
  - System tray with Show/Hide/Quit menu items; close-to-tray behaviour (sidecar stays alive)
  - `get_app_config` / `save_app_config` Tauri commands for persistent configuration
  - macOS `.dmg` and Linux `.AppImage` + `.deb` packages built on every push to `main`
- **`__HOTM_HOST__` adapter** — embedding shell protocol for third-party integration
  - Shells inject `window.__HOTM_HOST__` with `network.fetch` and `network.sse` overrides
  - Standalone Tauri mode injects its own adapter automatically at startup
  - Web/Docker mode falls through to native `fetch`/`EventSource`
- **Inference settings panel** — configure local and cloud LLM providers from the Admin panel
  - Connection test button with live provider health check
  - Provider status indicator in the main nav
  - llama.cpp provider support alongside Ollama
  - Granular regeneration controls: model, revision mode, context filter, processing steps, job types
- **Overhauled Regenerate AI panel** — fine-grained control over NLP reprocessing with real-time job progress (#165)
- **Runtime API URL configuration for Docker** — `window.__RUNTIME_CONFIG__` injected by the nginx entrypoint; API base URL is never baked into the bundle at build time
- **Automated installer** — setup manifest and shell scripts for unattended Fortemi+HotM deployment
- **CI: `publish-dist` workflow** — packages `ui/dist` as `hotm-ui-dist.tar.gz` and publishes to the `hotm-latest` rolling Gitea release on every push to `main`; consumed by downstream CI

### Changed

- API base URL resolution is now purely runtime: Tauri config → Docker runtime config → `VITE_API_BASE_URL` → `http://localhost:3000/api/v1`. Build-time baking removed.
- Large file uploads (≥ 50 MB) in Capture panel now route through TUS automatically
- Attachment uploads queued through `uploadStore` for consistent background-transfer behaviour
- Agent proxy: upgraded from direct OpenAI Responses API to Chat Completions API for broader provider compatibility
- Admin system info tab uses `healthCheck()` endpoint (resolves 404 regression from `/api/v1` base URL change)
- Offline detector decoupled from Fortemi inference capabilities — inference unavailability no longer incorrectly marks the app as offline
- Default Ollama generation model updated from `qwen3.5:9b` to `qwen3:14b`

### Fixed

- WebSocket fallback URL now includes the `/api/v1` prefix
- `InferenceStatusIndicator` guards against undefined providers
- Agent: tool execution pipeline, session serialization, search result navigation, and response cutoffs
- Agent: `useRef` strict initialization for React 19 compatibility
- Capture: `save-as-note` surfaces attachment failures as partial state rather than a hard error
- CI: Gitea registry publishing uses `BUILD_REPO_TOKEN` for authentication
- CI: sidecar download corrected to `Fortemi/fortemi@sidecar-latest` (previous workflows referenced a non-existent `Fortemi/matric-api` repository)
- CI: macOS DMG build uses Tauri-produced bundle directly; custom ad-hoc re-signing of `matric-api` was failing strict codesign validation on the build host due to dylib paths baked in by Fortemi CI

## [2026.2.18] - 2026-02-24

### Changed

- **API base URL refactor** — moved hardcoded `/api/v1/` prefix from 196 occurrences across 24 API modules into `VITE_API_BASE_URL` configuration. The default is now `http://localhost:3000/api/v1`. Deployments behind reverse proxies or future API versions can change the path at config time without code changes. Added `getServerRoot()` utility for OAuth/health endpoints at the server root. (Closes #114)
- CI/CD pipeline migrated from GitHub Actions to Gitea Actions workflows
- Release pipeline hardened with file-based response parsing and jq-based JSON body generation
- Internal domain references removed from all defaults and examples

## [2026.2.4] - 2026-02-22

### Added

- **Persistent pop-out media player** — floating video/audio player that stays mounted across view navigation
  - MINI mode (280×210 video, 280×68 audio) with always-visible controls
  - EXPANDED mode (480×398 video, 400×80 audio) with minimize button
  - Fullscreen mode with custom controls and seek bar thumbnail previews
  - Drag-to-move with snap-to-corners (persists position to localStorage)
  - Global keyboard shortcuts: Alt+P (play/pause), Alt+←/→ (skip ±10s), Alt+M (mute), Alt+Shift+P (dismiss), Alt+Shift+E (cycle size)
  - Pop-out button on VideoControls and StreamingMedia (PictureInPicture2 icon)
  - Blob URL lifecycle management with ownership transfer to context provider
  - Double-click video to toggle fullscreen
- **Rich media previews** — tabbed preview dialog with streaming video, 3D model viewer, audio player, and file info bar
  - Native browser streaming via Fortemi download endpoints with Range request support
  - Blob download fallback when direct URL playback fails (e.g. memory routing headers)
  - 3D model preview using model-viewer for compressed GLB files
  - Error boundary to prevent UI crashes from unsupported media
- **Custom video controls** — scrubbar with seek-preview thumbnails, play/pause, volume, CC toggle, fullscreen
- **Expert mode overlay** — real-time playback stats (bitrate, resolution, codec) for video and audio players
- **SRT/subtitle support** — VTT/SRT transcript display with interactive seek-to-segment panel and default captions
- **Embedding set management** — dedicated view for managing embedding configurations with criteria editor
- **Job Queue view** — centralized job event store with pending queue, API-seeded recent activity, and note ID display
- **Background upload queue** — global transfer status indicator with concurrent upload management
- **TUS resumable uploads** — resumable uploads for files >= 50 MB via tus protocol
- **Linked notes tab** — in attachments browser with dedup key for cross-note references
- **Unified search** — concept, temporal, and location filter support with renamed search view
- **Capture processing options** — version history UX and media optimize toggle during upload
- **Attachment extraction status** — display extraction progress and AI-generated descriptions

### Changed

- SSE event system overhauled for Fortemi v2026.2.10 compatibility
- Attachment API client updated for new Fortemi download/streaming endpoints
- Replaced Three.js with model-viewer for compressed GLB support (smaller bundle, better compat)
- Replaced Radix ScrollArea with native overflow for job activity list (jsdom compat)
- Tauri reqwest bumped to 0.13 to resolve tauri-plugin-http conflicts

### Fixed

- Video controls overlay and fullscreen layout — controls now overlay video bottom edge instead of rendering below; fullscreen fills viewport without 500px cap
- Mini player close button — drag handler no longer intercepts button clicks in title bar
- Video CORS blocking with audio transcript support
- Media preview bugs with transcript and scene display
- GLB model preview uses direct download URL
- Embeddings screen crash from API response format mismatch
- Empty memory search results — API field mapping and title fetching corrected
- Real error messages surfaced for failed attachment uploads
- Recent activity card normalized to match pending queue design
- Blob playback reliability with subtitle endpoint fallback
- Missing graphology-types peer dependency

## [2026.2.3] - 2026-02-20

### Added

- **Quick Capture** — dedicated note entry view with sticky classification settings
  - Archive, collection, concept, and tag selection persisted via localStorage
  - AI enhancement level selector (Full / Light / None)
  - Document type classification selector (auto-detect or explicit)
  - File attachment support with drag-and-drop and file picker
  - "Attachment-as-note" — submit files with auto-generated content from filenames
  - Session log showing captured notes with metadata
  - Keyboard shortcuts (Shift+Enter to commit, Escape to clear)
- **Regenerate AI dropdown** — select enhancement level (Full / Light / None) when regenerating a note
- **Standalone attachments browser** — browse all attachments from sidebar navigation
- **Standalone concept browser** — full-width SKOS concept browser with scheme tabs
- **Note titles in related notes** panel

### Changed

- Sidebar navigation: removed Quick Access and Tag Filter sections
- ConceptBrowser converted from modal to full-width standalone view
- Related notes use `/related` endpoint with LLM context

### Fixed

- Black screen crash when navigating to Capture (document-types API response shape mismatch)
- Links API response shape (incoming not backlinks)
- SSE auto-reconnection preserved with native EventSource
- Title derivation in notesFromSummaries
- License updated to BSL-1.1 in About page
- Version and commit SHA injected at build time
- System Info tab shows real Fortemi API data

## [2026.2.2] - 2026-02-19

### Added

- Admin panel: API endpoint and config source display on System Info tab
- Tauri v2 research report

### Fixed

- Tauri HTTP plugin routing for compat API, WebSocket, and SSE
- Compat API reinitialization after Tauri config loads
- Attachment preview and graph layout in Tauri desktop shell

## [2026.2.0] - 2026-02-19

First formal release of HotM as a standalone React SPA.

### Added

- **Dashboard** with archive-scoped health summaries and notes workspace
- **Graph Explorer** built on Sigma.js and Graphology with ForceAtlas2 layout
  - Click-to-explore, double-click-to-open note navigation
  - Back/forward history for node selections
  - Label backgrounds and hover-only label display
  - Filter sidebar with tag and concept scoping
  - Node enrichment with per-note tags and concepts from API
  - Sparse graph fallback for small datasets
- **Realtime event bus** with SSE and WebSocket transports and automatic fallback
- **Realtime debug inspector** for monitoring event streams
- **Archive management** with job pause/resume controls and scoped job counts
- **Memory search** — AI-assisted contextual retrieval
- **Concept browser** — NLP-extracted concept navigation
- **Advanced search** — multi-field filters, tag/concept scoping, date ranges
- **Note templates** for structured capture
- **Attachments panel** with PDF preview
- **Mobile read mode** with responsive layout
- **Note provenance** display in metadata panel
- **Metadata edit lock** and title typing animation
- **Federated search** across multiple Fortemi archives
- **Job queue monitoring** with stalled WebSocket detection
- **Docker deployment** via `docker-compose.prod.yml` with nginx serving
- **Playwright E2E test suite** for critical user journeys
- **CI/CD pipelines** — GitHub Actions and Gitea runners for tests, builds, and image publishing

### Changed

- **Architecture**: migrated from Tauri desktop wrapper to pure React SPA consuming Fortemi API
- **Graph renderer**: migrated from custom canvas renderer to Sigma.js/Graphology stack
- **API client**: complete rewrite as typed per-domain modules (notes, search, tags, collections, health, etc.)
- **Embedding config**: hardened parsing with flexible field mapping
- **Note list**: paginated with total counts
- **Health panel**: archive-scoped summaries instead of global-only view

### Fixed

- Graph dense cluster readability with sqrt-blend density spreading
- Stale closure bugs in graph node/edge reducers via ref-based state
- Sidebar pointer event capture by Sigma canvas
- Keyboard event propagation from graph filter sidebar
- SSE event stream stability with proper fallback
- Concept list deduplication
- Note refresh on background job completion
- WebGL global stubs in test setup for Sigma compatibility

[2026.4.1]: https://github.com/Fortemi/HotM/compare/v2026.4.0...v2026.4.1
[2026.4.0]: https://github.com/Fortemi/HotM/compare/v2026.2.18...v2026.4.0
[2026.2.18]: https://github.com/Fortemi/HotM/compare/v2026.2.4...v2026.2.18
[2026.2.4]: https://github.com/Fortemi/HotM/compare/v2026.2.3-alpha...v2026.2.4
[2026.2.3]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.3
[2026.2.2]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.2
[2026.2.0]: https://github.com/Fortemi/HotM/releases/tag/v2026.2.0
