---
title: Fortemi Auth Node Conformance Receipt — Custom CA Release
status: passed_source_and_consumer_conformance
date: 2026-09-07
profile: rust-node-jwt-v1
contract_version: 1.1.0
authority_repository: https://git.integrolabs.net/Fortemi/fortemi-auth
authority_release: v2026.9.0
authority_commit: cff36d293d73080c186e2f35115dd92a594982d2
authority_tag_object: fb4c74a0918c9d5206c48b511dff19f6e2072053
manifest_sha256: 2df0a35edad67cc3e8869286183a4d098b1eb8fc2161432ed0b54ba69b17e242
release_policy_sha256: bd77fbeba24991f969d07e5f45c5259504e52bb5ab9d7c4137abb22270c4abe8
related_issues:
  - Fortemi/fortemi-auth#50
  - Fortemi/fortemi#1144
  - Fortemi/HotM#304
---

This candidate advances HotM's exact hosted admission tuple for the server's
configurable CA support. The producer manifest is unchanged. The exact release policy and published signed authority identity are pinned
below. The server compatibility source is pinned to
`088932c008af8e4f89ef6055ef85d700001c2dd5` and the canonical verifier passes.

The historical July and August receipts remain unchanged. Node conformance
covers the named fixture-backed JWT profile and release admission only. It does
not establish private-CA TLS support in Node or the browser, live hosted login,
forced RLS, or reauthentication/realtime convergence.

## Verification

The finalized candidate policy and corpus are byte-identical to the authority
checkout `/tmp/fortemi-auth-ca-50` (verified with `cmp`). Agent-proxy typechecking
and all 222 tests in 14 files passed against the updated policy, including ten
release-policy cases. UI typechecking and all 14 system compatibility tests
passed. The realtime browser fixtures derive the advertised release from the
same producer policy using Node file loading. All ten candidate desktop/mobile
realtime browser checks passed in 18.7 seconds; machine receipt:
`/tmp/hotm-ca-1144-browser.json`. These use mocked transport responses.

Published signed authority `v2026.9.0` targets
`cff36d293d73080c186e2f35115dd92a594982d2`, tag object
`fb4c74a0918c9d5206c48b511dff19f6e2072053`. Producer PR #51 passed CI run
54930 and was fast-forwarded before publication. The release SBOM pipeline was
dispatched separately; no SBOM publication result is claimed by this receipt.

The server source commit `088932c008af8e4f89ef6055ef85d700001c2dd5` is pinned
in both UI and agent-proxy compatibility receipts. The canonical compatibility
source verifier passes against that exact commit. Server CI and release
publication remain separate delivery gates. No live-hosted result is claimed.


## CI browser fixture correction

PR CI run 54949 passed 85 mocked browser cases and exposed an initial-render
race in the compatibility-admission fixture. Network idle preceded React
navigation rendering, so the desktop test attempted a mobile sidebar action.
The fixture now waits for Quick Note or the sidebar toggle before branching.
All mutation-blocking and local-draft preservation assertions remain intact.
Twenty repeated cases (ten desktop, ten mobile) passed in one minute; receipt
`/tmp/hotm-ca-1144-admission-repeat.json`.
