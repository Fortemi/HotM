# HotM Cryptographic Decisions - BYO-LLM Secret Storage

## Status

Draft architecture evidence for the hosted/mobile BYO-LLM path. This document does not authorize implementation or launch by itself. Applied-cryptographer review, implementation tests, and Fortemi KMS/backoffice gates remain required before production use.

## Scope

This decision covers storage of user-provided LLM provider keys in hosted HotM/Fortemi deployments. It does not cover desktop-local provider-key storage, OAuth session token handling, sidecar artifact provenance, or tenant RLS enforcement.

## Decisions

| Topic | Decision | Rationale / guardrail |
|---|---|---|
| KEK custody | Managed KMS at launch: AWS KMS, GCP KMS, or HashiCorp Vault Transit. | A host-local KEK file is not an accepted launch posture because host-root compromise, backups, and operational drift make the key boundary too weak for hosted provider secrets. |
| Envelope model | Per-user DEK wraps provider-secret material; KEK wraps the DEK. | Limits blast radius and allows KEK rotation by re-wrapping DEKs without decrypting provider secrets into durable storage. |
| AEAD | Use an audited AEAD provided by the selected implementation platform. Prefer XChaCha20-Poly1305 where nonce management benefits matter; AES-256-GCM is acceptable only with proven unique nonce generation. | Satisfies the no-unauthenticated-encryption rule and avoids CBC/MAC composition mistakes. |
| KDF | Use HKDF for domain-separated key derivation when derivation is required. Do not use ad hoc hashes or string concatenation. | Satisfies no-adhoc-kdf and no-key-reuse-across-purposes rules. |
| Associated data | Bind ciphertext to tenant ID, user ID, provider ID, key version, purpose label, and schema version. | Prevents cross-context replay and makes migration/rotation auditable. |
| Logging | Never log provider key plaintext, DEKs, KEK identifiers beyond coarse status, ciphertext blobs, support bundle contents, or KMS resource names. | Matches HUX-REQ-011 and the enterprise preview redaction boundary. |
| Rotation | KMS KEK rotation must produce a receipt showing DEK re-wrap count, failures, and rollback path without exposing secrets. | Makes launch readiness auditable without leaking material. |
| Failure mode | Fail closed when KMS unwrap, AEAD decrypt, associated-data validation, or key-version lookup fails. | Prevents accidental provider-key disclosure or use under the wrong tenant context. |

## Required Evidence Before Implementation Closure

- Applied-cryptographer review of this document.
- Unit tests for AEAD decrypt failure, associated-data mismatch, key-version mismatch, and rotation failure handling.
- Integration test proving tenant A cannot decrypt or use tenant B provider-secret material.
- Log/redaction test proving plaintext keys, DEKs, raw KMS identifiers, ciphertext blobs, and support-bundle contents do not appear in UI, telemetry, or server logs.
- KMS configuration receipt linked to `Fortemi/fortemi#1019` or `Fortemi-Enterprise/kms#2`.

## Traceability

- ADR: `HotM/.aiwg/architecture/adr-mobile-cloud-architecture.md`
- HotM enterprise redaction requirement: `HotM/.aiwg/requirements/enterprise-demo-requirements-2026-07.md` HUX-REQ-011
- KMS blockers: `Fortemi/fortemi#1019`, `Fortemi-Enterprise/kms#2`
