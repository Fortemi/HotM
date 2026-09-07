---
title: Independent live-server AsyncAPI authority conformance
status: passed_source_and_fixture_equivalence
date: 2026-09-07
producer_commit: c3bfd40b275decd5a24c4e9a656d830a383b3de2
canonical_sha256: a6c845b023815a739630fe212c26d83746516052fd2fb131cf7063b01b915462
packaged_sidecar_commit: 5ea08229c9f1565122df5f8e6906e89d98dc7e75
related_issues:
  - Fortemi/fortemi#1144
  - Fortemi/HotM#304
---

The live-server source receipt is
`ui/src/api/contracts/fortemi-live-asyncapi-authority-receipt.json`. It names
server AsyncAPI version 2026.9.7 and exact artifact/source hashes. The verifier
uses `git show` at immutable revisions, independently of the checkout state.

The complete parsed wire document matches the existing packaged 2026.7.19
baseline after excluding only `info` metadata. Channels, components, operations,
servers, protocol versions and any future top-level field remain part of the
comparison. The semantic SHA-256 is
`a836fe58de14b9956495eda4998b07179e1c36ed994e78fad2cecb2e98281df7`.

Verification passed:

- Seven verifier regressions cover informational version changes, payload drift,
  new semantic fields, artifact/source hash mismatches, fixture origin, moving
  refs and incomplete positive coverage.
- The original canonical event verifier passes all 48 events.
- The original payload verifier passes 48 positive envelopes and 192 negative
  mutations; generated fixtures, rules and its receipt remain byte-identical.
- UI typechecking and 65 event, realtime-bus and compatibility tests pass.
- The auth compatibility verifier retains its independent immutable source pin
  `088932c008af8e4f89ef6055ef85d700001c2dd5`.

The new gate runs alongside the original payload gate in SDLC CI. It does not
replace desktop binaries, alter `release/sidecar-provenance.json`, or establish
live SSE/WebSocket delivery, hosted authentication, tenant isolation, or full
suite parity. Server publication remains a separate delivery gate.
