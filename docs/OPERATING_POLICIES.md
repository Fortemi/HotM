# Operating Policies

## Branching & Releases
- Strategy: Trunk-based. Short-lived feature branches, frequent merges to `main` via PR.
- Versioning: CalVer `YYYY.M.PATCH` (e.g., `2026.2.3`). No leading zeros. Pre-release suffixes for channels: `-alpha.N`, `-beta.N`.
- Tags: `v<version>` (e.g., `v2026.2.3`). Each tag has a changelog entry and release artifacts.

## Reviews & CI Gates
- Required reviews: 1 (docs), 1–2 (code touching `ui/`). Owners auto-requested via CODEOWNERS.
- Blocking checks (target): build UI, run UI tests, typecheck; vulnerability scan (when enabled).
- PR size: Prefer <300 LOC net change. Split large changes with clear sequencing.

## Commits & Issues
- Commits: Imperative subject, scoped prefix when useful: `ui: fix editor lag`, `docs: update API spec`, `infra: update deployment`.
- Link issues using `Closes #<id>` and add acceptance criteria in the PR description.

## Security & Privacy
- Local-first by default. No telemetry or external calls without explicit user action and documentation.
- Secrets: Never commit. Use `.env` locally and store secrets in repo/environment secrets for CI.
- Data: PII handled only locally in Stage 1. Stage 2 sync requires encryption-in-transit, key management, and data retention policy.

## Release Channels
- Stage 1 (MVP – Local Only): weekly alpha cuts, Docker Compose supported; no auto-update.
- Stage 2 (Paid Sync/Inference): monthly betas; stable upon SLO adherence and incident-free burn-in.

## Quality Targets
- UI: Vitest coverage for new logic; visual verification for UI changes.
- Docs: Feature PRs update `docs/` and changelog as needed.
