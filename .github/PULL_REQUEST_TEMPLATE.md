## Summary

- Issue link(s): Closes #
- Type: Feature | Fix | Docs | Chore | Refactor | Security
- Scope: server | ui | docs | infra

## Changes

- What/why summary (1–3 bullets)
- Screenshots/GIFs for UI changes (if applicable)

## Checklists

### Server (Rust)
- [ ] `cargo fmt --all` and `cargo clippy --all -- -D warnings`
- [ ] `cargo test` passes locally
- [ ] Migrations added/updated in `server/migrations/` (if DB changes)
- [ ] Backward compatibility considered (API/DB)

### UI (Tauri/React)
- [ ] `npm run test` passes; coverage acceptable
- [ ] `npm run typecheck` passes
- [ ] `npm run build` succeeds
- [ ] Screenshots for UX/regressions reviewed

### Security & Privacy
- [ ] No secrets committed; uses `.env` and secret store
- [ ] Local-first constraints preserved (no telemetry/network unless explicit)
- [ ] Data handling documented if new surfaces added

### Documentation
- [ ] Updated `docs/*` and `AGENTS.md` if behavior or processes changed
- [ ] Added notes for release (breaking changes, manual steps)

## Testing Notes

- Manual validation steps
- Edge cases covered

## Release Notes

- One-line bullets for user-facing changes

