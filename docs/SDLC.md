# Software Development Lifecycle (SDLC)

## Phases & Gates
- Ideation: Capture problem, success metrics, constraints. Output: Issue or RFC draft.
- Specification: Define API/UI, data model, risks. Output: RFC with acceptance criteria.
- Implementation: Code + tests behind feature flags.
- Review: CODEOWNERS approval; CI green; security check.
- Verification: Manual QA, integration tests, and performance sanity checks.
- Release: Follow `docs/sops/release.md`. Tag and publish artifacts.
- Post-Release: Monitoring, incident playbook, retrospective.

## Required Artifacts
- RFC for non-trivial changes (API, schema, sync). Template in `.github/ISSUE_TEMPLATE/rfc.md`.
- Test plan for user-facing features.
- Migration plan (if DB changes) and rollback steps.

## Roles (RACI)
- Program Manager (A/R): vision, roadmap, acceptance.
- Engineering Manager (A/R): resourcing, SDLC adherence, throughput.
- Tech Lead (C): architecture, performance, security implications.
- Release Engineer (R): release process and artifacts.
- Compliance Manager (C/A for Stage 2): privacy and data flows.

