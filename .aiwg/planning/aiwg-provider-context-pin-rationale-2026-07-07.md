# AIWG Provider-Context Pin Rationale - HotM - 2026-07-07

## Purpose

Record the HotM repo-local AIWG provider-context decision for the July 2026 enterprise/backoffice checkpoint.

## Current State

- Repo config: `HotM/.aiwg/aiwg.config`
- Installed AIWG framework metadata: `all` `2026.7.11`; older `sdlc` metadata `2026.5.0-rc.36`
- Suite-root checkpoint authority: root `.aiwg/aiwg.config` records AIWG `2026.7.11`
- Live tracker: `Fortemi/aiwg-fortemi-skills#2`

## Pin Decision

HotM provider context was refreshed with `aiwg refresh --all --provider openai` during this checkpoint continuation. This rationale now records the refreshed state and the remaining review/warning acceptance gate.

## Construction-Loop Boundary

HotM child provider context is refreshed for Codex, but hosted/mobile production claims still require live CI, operator signoff, and `Fortemi/HotM#251` launch-rate proof. Use the suite-root `.aiwg/` checkpoint artifacts, HotM repo-local requirement/test/runbook artifacts, and executable verifiers as the proof source until those gates close.

## Required Follow-Up

- Review and accept the refreshed HotM provider artifacts in the follow-up for `Fortemi/aiwg-fortemi-skills#2`.
- Keep HotM fixture-backed preview work allowed.
- Do not use this pin to claim hosted/mobile production readiness, live CI completion, or final operator signoff.
