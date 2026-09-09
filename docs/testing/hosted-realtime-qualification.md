# Hosted realtime qualification: HotM #304

`ui/scripts/qualify-hosted-realtime.mjs` exercises the production browser UI
against the isolated hosted Fortemi API using real Keycloak qualification
service-account tokens. It does not test interactive OIDC sign-in: this release
has no browser bearer-entry form. The supported qualification procedure writes
`hotm_api_bearer_token` to localStorage and reloads the page. This matches
`ui/src/api/auth-context.ts` and the existing live asset test. Merely replacing
storage does not update a running SSE transport; reload recreates it.

## Prerequisites and invocation

Use the locked UI dependencies and installed Playwright Chromium. Run on either
titan or an explicitly selected qualification host with its own isolated stack.
The runner accepts an explicit loopback UI origin; it has no grissom dependency.
Grissom is the operator’s main workstation and must not be selected as a general
build or runtime resource. Running there requires an explicit operator choice.

The installed `/usr/local/bin/fortemi-qualification-token` helper must work on
the selected host through its existing TPM-backed reader. The server stack also
needs its own host-local runtime materialization and KMS workload inputs; the
client token helper alone does not provision a hosted server. Do not copy another
host’s TPM-encrypted files or point these tests at a personal API. Use the ITops
qualification deployment procedure to provision the isolated stack locally.
An SSH tunnel is an optional way to reach an already selected remote stack, not
a prerequisite for qualification.

The UI must proxy the hosted API on the **same origin**, with its runtime
`VITE_API_BASE_URL` ending in `/api/v1`. The released client and SSE transport
append endpoint paths to this base. A root-only runtime base can send `/events`
to the SPA fallback instead of `/api/v1/events`; correct deployment configuration
and verify actual paths rather than masking that failure in a test.

```bash
node ui/scripts/qualify-hosted-realtime.mjs \
  --base-url http://127.0.0.1:16621 \
  --receipt /tmp/hotm-304-live.json \
  --ui-image '<immutable UI image reference>' \
  --ui-revision '<UI source revision>' \
  --core-image '<immutable server image reference>' \
  --core-revision '<server source revision>'
```

`--base-url` and `--receipt` are mandatory. There is no personal-server default.
Image/revision arguments are optional operator assertions recorded separately
from observed API compatibility metadata. The script does not inspect Docker
images or attest that an asserted digest is running; attach deployment receipts
when qualifying a release. Exit 0 means the full live matrix and cleanup passed.
Any failed or incomplete run exits nonzero and leaves an incremental receipt.
Allow several minutes for actual token expiry.

Before Playwright launches or credentials are issued, the script fetches actual
compatibility and verifies the exact auth release/commit/claim profile and both
contract hashes, the internal hosted profile, and honest
`hosted_multi_tenant_ready: false`. Mismatched or unreachable targets stop here.
Apply the server package's migrations before starting its updated runtime, and
retain the non-owner NOSUPERUSER/NOBYPASSRLS identity. Broader hosted route
coverage is not established by this narrow qualification.

## Real browser checks

- Missing bearer: actual notes and SSE 401, `Auth Required`, absence of
  `Offline Mode`, disabled `Create Note` after filling the quick-note textarea.
- Forbidden identity: the same UI state with actual 403.
- Opening the activity drawer preserves terminal `state: auth-required` and
  does not restart SSE requests during the observation window.
- Valid tenant A and tenant B: notes/SSE 200, `state: connected`, `transport: sse`.
- Notes created by a separate HTTP client, with unique titles and `pipeline: []`,
  appear in the owning browser without a page reload. The foreign title remains
  absent in the other browser, and actual list responses confirm isolation.
- The real provider token expires without claim edits. SSE eventually returns
  actual 401, allowing the configured 60-second skew; notes reject the expired
  token and the browser returns to its auth-required state.
- A fresh replacement token is written to storage followed by reload. Notes and
  SSE recover and a new external note appears through realtime convergence.
- Hosted sessions must never attempt the legacy WebSocket transport.

The drawer selector is `button[aria-label="Open realtime activity"]` and works
at desktop/mobile widths. Status text is `state: connected` or
`state: auth-required`; the sidebar uses `Auth Required`/`Offline Mode`. The
quick-note input has placeholder `Quick note... (Ctrl+Enter to save)`.

## Boundaries and cleanup

The harness uses new browser contexts, no console capture, traces, screenshots,
videos, HAR, or browser storage-state files. Tokens remain in process memory,
ephemeral browser storage, and exclusive mode 0600 files in a private generated
mode 0700 `/dev/shm/fortemi-*` directory. Token values do not enter command
arguments, URLs, logs, or receipts. Exceptions are reduced to class names.

Service workers are blocked in the fresh browser contexts so they cannot bypass
request routing. A routing guard installed before credential injection aborts foreign HTTP(S)
origins, preventing stale UI configuration from contacting the personal service.
A fetch guard refuses redirects; any legacy WebSocket attempt is counted and
blocked. These guards do not synthesize response bodies or statuses. Any
foreign-origin or WebSocket attempt fails acceptance.

Cleanup issues fresh owning-tenant tokens and DELETEs exactly the recorded
fixture IDs, then requires 403/404 readback. This is soft deletion; audit history
remains. Failed cleanup records IDs for targeted recovery. Browser local/session
storage and cookies are cleared, contexts/browser closed, and generated tmpfs
files removed. SIGINT/SIGTERM mark the receipt interrupted and failed, cancel
pending qualification HTTP reads, and enter the same cleanup path. In-flight
mutations keep their bounded response window so returned fixture IDs can be
recorded before cleanup. Polls
check interruption; cleanup's bounded requests remain enabled even if another
signal arrives. Uncatchable process termination or host loss cannot guarantee
cleanup; use the incrementally recorded fixture IDs for recovery. Persistent profiles and pre-existing notes are never targets.

The existing `ui/e2e/tests/realtime-auth-status.spec.ts` covers synthetic 401/403,
observable SSE 410, opaque WebSocket 1006, and aborted health requests. Those
mocked checks remain useful regressions, but are not evidence of real backend
acceptance. This runner does not inject 410 or claim backend-outage qualification.
It must not be run against the installed personal/anonymous API.

The September 8 infrastructure receipts were produced on grissom. That records
where those checks ran; it does not establish a host requirement. Fresh acceptance
can run on either host once that host has the isolated stack and scoped runtime
inputs. Preserve separate database/storage volumes, loopback ports, provider
boundaries, and deployment identity receipts. Local syntax, browser launch, and
preflight refusal checks do not establish live backend acceptance.
