# Agent Profiles

This repository supports automation via specialized agent roles. Profiles are now organized in `docs/agents/` as dedicated files with front matter for agent orchestration.

## Common Guardrails
- Respect CODEOWNERS for review routing.
- Never commit secrets; use `.env` or repo secrets.
- Prefer small, reviewable PRs with passing checks.

## Profiles

### Backend API Engineer (Rust)
See: `agents/backend-api-engineer.md`
- Purpose: Add/modify Axum routes, services, and DB queries.
- Triggers: New API issue; schema change request.
- Inputs: `server/src/routes/*`, `server/src/db.rs`, `server/migrations/*`.
- Checks: `cargo fmt`, `clippy -D warnings`, `cargo test` (unit+integration).
- Outputs: Code + migration + tests + docs.

### UI Engineer (Tauri/React)
See: `agents/ui-engineer.md`
- Purpose: Implement UI features, fix UX regressions.
- Inputs: `ui/src/**`, `ui/vite.config.ts`, `ui/src-tauri/**`.
- Checks: `npm run test`, `npm run typecheck`, screenshots/GIFs.

### DB Migration Specialist
See: `agents/db-migration-specialist.md`
- Purpose: Safe schema evolution with `sqlx`.
- Steps: Author migration, run locally, update `setup_ci_db.sh` if needed, add rollback plan.

### Release Engineer
See: `agents/release-engineer.md`
- Purpose: Cut releases and verify artifacts.
- Steps: Follow `docs/sops/release.md`; bump versions, tag, build server and Tauri bundles; update changelog.

### Security & Privacy Reviewer
See: `agents/security-privacy-reviewer.md`
- Purpose: Enforce local-first, prevent data exfiltration.
- Checks: No unexpected network calls; secrets handling; PII boundaries documented.

### QA & Test Author
See: `agents/qa-test-author.md`
- Purpose: Increase coverage on new logic.
- Steps: Add Rust integration tests (`server/tests/*`) and Vitest specs (`ui/src/**/__tests__`).

### Program Manager (Vision & Roadmap)
See: `agents/program-manager.md`
- Purpose: Maintain product vision, roadmap, and release themes.
- Inputs: Strategy docs, issue backlog, user feedback.
- Outputs: Milestones, prioritized epics, acceptance criteria; ensures SOP/SDLC gates are followed.

### Engineering Manager (SDLC Adherence)
See: `agents/engineering-manager.md`
- Purpose: Enforce SDLC cadence and resourcing across teams.
- Checks: PR throughput/lead time, flaky tests, coverage trends; assigns owners per CODEOWNERS.

### Tech Lead (Quality Gates)
See: `agents/tech-lead.md`
- Purpose: Define architecture guardrails and review complex changes.
- Checks: ADRs/RFCs approved, performance and security implications addressed.

### Compliance Manager (Security/Privacy)
See: `agents/compliance-manager.md`
- Purpose: Verify SOPs, privacy posture, and policy updates; Stage 2 data handling.
- Checks: Secrets management, data flow diagrams, incident drills.

## Stage-Specific Considerations

### Stage 1 (MVP – Local Only)
- Feature flags off for remote calls by default.
- Validate Ollama model usage is local.
- Focus on API correctness, basic UX, and stability.

### Stage 2 (Sync/Inference Subscriptions)
- Add sync client/server modules behind config.
- Data model: device identities, conflict resolution, and encryption-in-transit.
- Billing hooks and usage metering; privacy review for data flows.

## Example Agent Spec (YAML)
```yaml
name: backend-api-engineer
triggers:
  - label: area/server
  - path: server/**
checks:
  - run: cargo fmt --all -- --check
  - run: cargo clippy --all -- -D warnings
  - run: cargo test --all
artifacts:
  - path: server/target/release/hotm-server
notes: Ensure migrations are reversible and documented.
```
