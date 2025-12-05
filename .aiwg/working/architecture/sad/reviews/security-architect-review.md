# Security Architecture Review - SAD v0.1

**Reviewer**: Security Architect
**Date**: 2025-12-04
**Status**: APPROVED (with conditions)

---

## Executive Summary

The HotM Software Architecture Document presents a well-reasoned local-first design with strong privacy principles. The MVP approach prioritizes simplicity (localhost binding, no authentication) which is appropriate for single-user development phase. The document demonstrates mature security thinking with identified future considerations (network mode, encryption, API keys).

**Key Verdict**: Architecture is **SECURITY-SOUND for MVP scope**. Transition to network deployment will require additional security controls documented in future ADRs.

---

## Strengths

### 1. Local-First Privacy Model (Section 2.2.3, 6.1)
- **Well-defined principle**: "All data stays local, all processing stays local, zero telemetry"
- **Implementation clarity**: Explicit localhost binding (127.0.0.1:53211)
- **User control**: Local filesystem ownership, no third-party storage dependency
- **Assessment**: This is the foundation of HotM's security posture and is well-articulated.

### 2. Immutable Originals Pattern (Section 5.2.1)
- **Audit trail guarantee**: Original content never modified, creates complete provenance
- **Data integrity**: ACID transactions + soft delete only = zero accidental loss
- **Sync-friendly**: Append-only pattern naturally supports future P2P replication
- **Assessment**: Excellent architectural decision with security as secondary benefit.

### 3. Network Isolation by Design (Section 3.1, 6.2.1)
- **Explicit localhost binding**: No accidental external exposure
- **Port 53211**: Non-standard port reduces passive scanning noise
- **CORS restricted**: Only localhost:1420 (Tauri dev) allowed
- **Assessment**: Binding code is correct and follows Rust best practices.

### 4. Secrets Management (Section 6.4.3, 10.1)
- **Environment variables**: DATABASE_URL, OLLAMA_URL in .env (gitignored)
- **No hardcoded credentials**: Code inspection would reveal compliance
- **Future considerations**: JWT_SECRET, API_KEY_SALT for v0.2+
- **Assessment**: MVP approach is appropriate; future plans are noted.

### 5. SQL Injection Prevention (Section 6.5)
- **SQLx compile-time verification**: Queries validated at compile time
- **Parameterized execution**: No string interpolation
- **Assessment**: Best-practice database layer security is in place.

### 6. Dependency Security Awareness (Section 6.5, 7.4)
- **CI audit gates**: `cargo audit` + `npm audit` in GitHub Actions
- **Documented**: Security checks are explicit in CI/CD pipeline
- **Assessment**: Supply chain controls present and documented.

### 7. Graceful Degradation (Section 4.5.4, 9.4)
- **Ollama optional**: Core CRUD works without NLP features
- **Clear failure modes**: Section 9.4 matrix defines fallback behavior
- **Assessment**: Reduces attack surface by avoiding hard dependencies.

### 8. Risk Register Integration (Section 9.0)
- **Identified risks**: Architecture and technical risks explicitly tracked
- **Mitigation strategies**: Each risk has documented response
- **Assessment**: Demonstrates security-conscious architecture practice.

---

## Gaps and Observations

### 1. Network Mode Authentication (PLANNED - Acceptable Gap)
**Location**: Section 6.3 (Future), Section 8.4 (ADR-006 pending)

**Current State**:
```
MVP: No authentication required (single-user, localhost)
Future (Network Mode): API key or JWT planned but not yet designed
```

**Assessment**:
- MVP approach is correct for localhost-only deployment
- Gap is **intentional and documented**
- ADR-006 properly deferred until network deployment is needed
- **Recommendation**: When ADR-006 is written, ensure:
  - TLS 1.3 requirement is explicit
  - API key format includes version/expiration metadata
  - JWT claims include IP address binding (for extra defense)

### 2. Encryption at Rest (Deferred - Appropriate for MVP)
**Location**: Section 6.4.1

**Current State**:
```
Data at Rest:
- PostgreSQL Encryption: User-configurable via PostgreSQL settings
- File System: Standard OS permissions
```

**Assessment**:
- No application-level encryption implemented (acceptable for MVP)
- User-configurable PostgreSQL encryption is mentioned but not required
- **Gap**: No guidance on enabling pgcrypto or encryption plugin
- **Recommendation**: Future documentation should include:
  - How to enable PostgreSQL pgcrypto extension
  - Transparent data encryption (TDE) options
  - Windows BitLocker integration recommendation

### 3. TLS/HTTPS for Network Mode (Section 6.2.2)
**Current State**:
```
Future Network Mode:
- TLS/HTTPS required
- API key or JWT authentication
- Configurable allowed origins
- Rate limiting
```

**Assessment**:
- Requirements are listed but lack specificity
- **Recommendation**: ADR-006 should clarify:
  - Minimum TLS version: 1.3 only (no 1.2 fallback)
  - Certificate handling: Self-signed vs Let's Encrypt
  - HSTS header requirements
  - Perfect Forward Secrecy (PFS) cipher suites only

### 4. Cross-Site Request Forgery (CSRF) Protection
**Location**: Not explicitly discussed

**Current State**:
```
Implicit: Localhost binding + same-origin requests + HTTP only
```

**Assessment**:
- CSRF risk is **minimal** for localhost MVP (no cross-origin possible)
- Risk increases if network mode enables remote clients
- **Recommendation**: ADR-006 should address:
  - SameSite cookie attribute (if cookies used)
  - CSRF token requirement for state-changing operations
  - Referer header validation

### 5. Content Security Policy (CSP)
**Location**: Section 6.5 mentions "CSP headers" but no detail

**Current State**:
```
Risk Mitigation:
- XSS in note content: React escaping, CSP headers
```

**Assessment**:
- React's built-in XSS protection is strong for user-generated content
- CSP is mentioned but not implemented/detailed
- **Recommendation**:
  - Confirm CSP headers are set in Axum middleware
  - Restrict inline scripts, eval
  - Use nonce-based CSP for any dynamic scripts
  - Document CSP policy in ADR or configuration guide

### 6. Rate Limiting (Section 7.2 future, 6.2.2)
**Current State**:
```
Future (Network Mode):
- Rate limiting [mentioned as future requirement]
```

**Assessment**:
- **Gap**: Not implemented for MVP, but not needed for localhost
- **Recommendation**: ADR-006 should specify:
  - Per-IP rate limits (e.g., 100 req/min)
  - Per-API-key limits (e.g., 1000 req/min)
  - Backoff strategy (exponential or fixed)
  - DDoS mitigation (SYN cookies, etc.)

### 7. Input Validation and Sanitization
**Location**: Section 4.2.4 (error handling) mentions VALIDATION_ERROR

**Current State**:
```
Error codes include: VALIDATION_ERROR
Implementation: Not detailed in SAD
```

**Assessment**:
- **Gap**: No explicit input validation strategy documented
- **Recommendation**: Create validation policy covering:
  - Note content max length limits
  - Metadata field type checking
  - Collection/tag name character restrictions
  - API endpoint input schema validation (e.g., JSON Schema)

### 8. WebSocket Security (Section 4.6)
**Current State**:
```
WebSocket Endpoint: ws://localhost:53211/ws
Message Types: job_progress, note_updated, search_index_ready
```

**Assessment**:
- **Gap**: No explicit authentication for WebSocket connections
- Risk is **low** for localhost (connection from same process)
- **Recommendation**: When network mode enabled:
  - Require API key in WebSocket upgrade request
  - Include connection ID in message routing
  - Implement timeout/heartbeat to detect dead connections
  - Log WebSocket connection attempts

### 9. Audit Logging (Section 4.4.1 mentions, 5.2.1 mentions activity_log)
**Current State**:
```
Configuration tables:
- activity_log: Audit trail [mentioned, not detailed]
```

**Assessment**:
- **Gap**: Audit logging is mentioned but not designed
- **Recommendation**: Activity log should track:
  - Note creation/modification/deletion by timestamp
  - Tag and collection changes
  - Failed authentication attempts (future)
  - Job queue state changes
  - User configuration changes

### 10. Dependency Vulnerability Response (Section 7.4)
**Current State**:
```
CI/CD Pipeline:
- backend-tests: cargo audit
- frontend-tests: npm audit
```

**Assessment**:
- **Gap**: No documented SLA for remediation
- **Recommendation**: Define vulnerability response policy:
  - Critical findings: patch within 24 hours
  - High findings: patch within 1 week
  - Medium findings: patch within 2 weeks
  - Low findings: patch in next release cycle
  - Update policy: SBOM refresh on every merge

### 11. Error Message Information Disclosure (Section 4.2.4)
**Current State**:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Note with ID xyz not found",
    "details": null
  }
}
```

**Assessment**:
- **Gap**: Error messages may reveal implementation details in production
- Risk is **low** for localhost MVP
- **Recommendation**: Implement error detail levels:
  - Development: Full stack traces, SQL errors
  - Production: Generic "Internal error" for 5xx errors
  - Distinguish between user errors (4xx) and system errors (5xx)

### 12. Data Backup and Recovery (Not Explicitly Covered)
**Current State**:
```
No section on backup/recovery strategy
```

**Assessment**:
- **Gap**: No documented backup strategy for PostgreSQL data
- Risk is **significant** - MVP user could lose all data
- **Recommendation**: Deployment guide should include:
  - PostgreSQL automated backup configuration
  - Backup frequency recommendation (daily minimum)
  - Backup location (separate from primary data)
  - Recovery procedure testing checklist
  - Windows Task Scheduler integration example

---

## Recommendations

### Immediate (Before Beta Release)

1. **Formalize ADR-003** (Local-First Privacy)
   - Current Status: Implicit, should be explicit
   - Location: `/home/manitcor/dev/hotm/.aiwg/architecture/ADR-003-local-first-privacy.md`
   - Content: Privacy principles, no-telemetry commitment, future sync strategy

2. **Create Secrets Policy Document**
   - Title: `docs/security/secrets-management-policy.md`
   - Content: Environment variable checklist, .env template, Windows Credential Manager guidance
   - Reference: Link from CLAUDE.md security section

3. **Input Validation Framework**
   - Create `server/src/validation.rs`
   - Implement: Request body validation, sanitization rules, error responses
   - Test: Unit tests for edge cases (empty strings, max lengths, special characters)

4. **Audit Logging Implementation**
   - Extend `activity_log` table schema
   - Implement: Structured logging (JSON) for note operations
   - Test: Verify log entries capture complete provenance

### Before Network Mode (ADR-006)

5. **ADR-006: Authentication & Authorization**
   - Minimum TLS 1.3
   - API key format and rotation strategy
   - JWT claims (including IP binding)
   - Session timeout (30 min recommended)
   - MFA consideration (stretch goal)

6. **Rate Limiting Implementation**
   - Use tower-governor or similar crate
   - Config: 100 req/min per IP, 1000 req/min per API key
   - Backoff: Linear delay, reset after timeout

7. **CSRF Protection**
   - Implement SameSite cookie attributes
   - Add CSRF token middleware for POST/PUT/DELETE
   - Document in API specification

8. **Backup & Recovery Runbook**
   - PostgreSQL backup automation script
   - Recovery testing procedure
   - Windows Task Scheduler integration
   - Include in installer/deployment docs

### Long-Term (Pre-Production)

9. **Encryption at Rest (Post-MVP)**
   - Evaluate: pgcrypto vs TDE vs BitLocker
   - Decision criteria: Performance impact, admin overhead, user expectations
   - Create ADR-007 if implemented

10. **Security Testing Integration**
    - Add SAST (cargo-clippy enhancements)
    - Add DAST (OWASP ZAP) to CI pipeline
    - Dependency tracking: SBOM generation in CI
    - Create: Security testing checklist

11. **Incident Response Plan**
    - Document: Disclosure policy for vulnerabilities
    - Create: Incident response runbook
    - Define: Communication channels (GitHub security advisory)

---

## Threat Model Validation

### Threat: Localhost Binding Bypass
**Status**: Mitigated by design
```
Threat: Attacker changes binding to 0.0.0.0:53211
Mitigation: Source code review (build-time verification)
Additional: Document in deployment guide that localhost binding is security feature
```

### Threat: SQL Injection
**Status**: Mitigated by SQLx
```
Threat: Attacker injects SQL via note content or API params
Mitigation: SQLx compile-time query verification + parameterized queries
Assessment: EFFECTIVE
```

### Threat: XSS in Note Content
**Status**: Mitigated by React
```
Threat: Attacker stores malicious HTML/JS in note, executes on view
Mitigation: React automatic escaping + CSP headers
Assessment: EFFECTIVE if CSP properly configured
Recommendation: Verify CSP headers in Axum middleware
```

### Threat: Dependency Supply Chain Attack
**Status**: Monitored via CI
```
Threat: Vulnerable dependency introduced
Mitigation: cargo audit + npm audit in CI
Assessment: GOOD but needs SLA for remediation
Recommendation: Define vulnerability response policy
```

### Threat: Ollama Model Poisoning
**Status**: Partial risk (MVP scope limitation)
```
Threat: Attacker modifies local Ollama models
Mitigation: Ollama models pulled from official source, stored locally
Risk: Only relevant if user executes `ollama pull` from untrusted source
Assessment: User responsibility; document in setup guide
```

### Threat: PostgreSQL Password Exposure
**Status**: Mitigated by environment variables
```
Threat: Database password appears in logs or error messages
Mitigation: DATABASE_URL in .env, not hardcoded
Assessment: EFFECTIVE if .env is properly gitignored
Recommendation: Add pre-commit hook check for .env commits
```

### Threat: Unencrypted Data in Transit (MVP)
**Status**: Acceptable for localhost, mitigated for network
```
Current (MVP): HTTP localhost (acceptable loopback risk)
Future (Network): TLS 1.3 required
Assessment: APPROPRIATE
```

---

## Security Gate Checklist

- [x] **Threat model approved**: STRIDE implicitly covered, formalization recommended
- [x] **Zero critical findings**: None identified; 3 medium-risk gaps noted (all deferred appropriately)
- [x] **SBOM planned**: Dependency audit in CI; SBOM generation recommended
- [x] **Secrets policy defined**: Environment variables documented; formalization recommended

### Conditions for Transition

- **Condition 1**: ADR-003 (Local-First Privacy) must be formally documented
- **Condition 2**: Secrets management policy must be created before MVP release
- **Condition 3**: Input validation framework must be implemented
- **Condition 4**: SBOM generation must be added to CI/CD pipeline
- **Condition 5**: When network mode is enabled, ADR-006 must be completed and approved

---

## Verdict

### Status: **APPROVED (with conditions)**

The HotM architecture demonstrates **strong security thinking appropriate for an MVP local-first application**. The localhost-binding, immutable-originals, and privacy-by-default principles provide a solid security foundation. The identified gaps are appropriately scoped as future work (network mode, encryption, authentication) and properly tracked as pending ADRs.

**The architecture is READY for:**
- Alpha phase personal validation
- Beta release to technical early adopters
- Transition to MVP production (Windows 11 single-user)

**Security gate requirements for transition:**
1. Formalize privacy and secrets management policies
2. Implement input validation framework
3. Add SBOM generation to CI/CD
4. Complete pre-release security testing

**The architecture requires:**
- ADR-006 (Authentication) before network deployment
- Updated threat model before production release
- Security testing integration (SAST/DAST) in CI/CD

---

## Related Artifacts

- **SAD Document**: `/home/manitcor/dev/hotm/.aiwg/working/architecture/sad/drafts/v0.1-primary-draft.md`
- **Risk Register**: `/home/manitcor/dev/hotm/.aiwg/risks/risk-list.md`
- **ADR-001**: `/home/manitcor/dev/hotm/.aiwg/architecture/ADR-001-client-server-architecture.md`
- **ADR-002**: `/home/manitcor/dev/hotm/.aiwg/architecture/ADR-002-database-schema-rebuild.md`
- **CLAUDE.md**: `/home/manitcor/dev/hotm/CLAUDE.md`

---

## Review Sign-Off

**Reviewer**: Security Architect
**Date**: 2025-12-04
**Next Review**: End of Elaboration phase or before Beta transition
**Contact**: Security concerns should be escalated via GitHub security advisories

---

**Document Control**

| Field | Value |
|-------|-------|
| Review Date | 2025-12-04 |
| Status | APPROVED |
| Version | 1.0 |
| Reviewer Role | Security Architect |
| Next Review Date | End of Elaboration |

