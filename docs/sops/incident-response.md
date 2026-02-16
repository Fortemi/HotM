# SOP: Incident Response

## Severity Levels
- SEV1: Data loss or widespread outage
- SEV2: Major feature down, no workaround
- SEV3: Degraded performance or partial impairment

## Response
1. Assign Incident Commander; create issue titled `INC-YYYYMMDD-<short>`.
2. Gather facts: client logs, recent deploys, configured backend endpoint, and network status.
3. Mitigate: rollback to last known good tag; disable failing features.
4. Communicate: update issue with timeline, user impact, ETA.
5. Root cause: document 5 Whys; add tests to prevent regression.

## For Stage 2
- Include sync service status, subscription/billing checks, and key rotation verification.
