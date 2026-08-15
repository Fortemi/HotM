# Agent Proxy Dependency Advisory Remediation

**Issue:** Fortemi/HotM#289
**Date:** 2026-08-15
**Evidence:** `.aiwg/evidence/agent-proxy-npm-audit-remediation-2026-08-15.json`

## Disposition

The production advisory was reachable through the request rate-limit middleware:
`express-rate-limit -> ip-address@10.2.0`. The three `ip-address` advisories were
GHSA-mwp4-54f8-5fhr, GHSA-4xrf-jv44-h6hh, and GHSA-22jq-vg5j-6vgg. A compatible
10.x override now resolves `ip-address@10.5.0`.

The remaining advisories were development-only: GHSA-2v37-7h3g-55p8 through
`vitest -> vite -> postcss -> nanoid@3.3.16`, and GHSA-fxqj-rqcc-2cmp at
`postcss@8.5.19`. Compatible overrides now resolve `nanoid@3.3.18` and
`postcss@8.5.26`; neither dependency is shipped by the agent-proxy runtime.

No forced or major-version upgrade was used. The resulting lockfile SHA-256 is
`d3cbcae9f59d205a8a9158bf0e5b019bf781dafd91ce1a943def50d81ca14e49`.
Both the production-only and full-tree npm audits report zero vulnerabilities.
The Gitea quality job now enforces the production high threshold and the full
moderate threshold instead of ignoring failures.
