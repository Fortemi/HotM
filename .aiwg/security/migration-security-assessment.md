# Security Migration Assessment: Desktop to SPA

**Project**: HotM (Hall Of The Mind)
**Assessment Date**: 2026-01-30
**Assessor**: Security Architect
**Migration Scope**: Tauri Desktop App (v0.1.2) to Web SPA (v0.2.0)
**Target Users**: 100+ external users via matric-memory API

---

## Executive Summary

This assessment evaluates the security implications of migrating HotM from a local-first Tauri desktop application to a web-based Single-Page Application (SPA) targeting 100+ external users. This migration represents a **fundamental shift in security posture** from a zero-network-exposure architecture to a web-accessible, multi-user system.

**Assessment Result**: **SIGNIFICANT SECURITY POSTURE CHANGE - Requires New Controls**

| Aspect | Desktop (Current) | SPA (Target) | Risk Delta |
|--------|-------------------|--------------|------------|
| Network Exposure | None (localhost only) | Internet-accessible | **CRITICAL INCREASE** |
| User Model | Single user, no auth | Multi-user, OIDC required | **HIGH INCREASE** |
| Data Flow | Local only | Client-Server over network | **HIGH INCREASE** |
| Attack Surface | Minimal (local process) | Web application + API | **HIGH INCREASE** |
| Compliance | By design (no collection) | Active data handling | **MEDIUM INCREASE** |

**Recommendation**: Proceed with migration, but implement security controls in phases with clear gates. Authentication is correctly identified as critical, even if initially deferred for MVP.

---

## 1. Changed Threat Model Analysis

### 1.1 Current Architecture (Desktop - Local-First)

**Security Properties (from ADR-003)**:
- All data stored locally (PostgreSQL on localhost:5432)
- All AI processing local (Ollama on localhost:11434)
- API server binds to 127.0.0.1:53211 only
- No network exposure, no authentication required
- No telemetry, no cloud dependencies
- Single-user model with implicit trust

**Threat Model Summary**:
| Threat Category | Risk Level | Rationale |
|-----------------|------------|-----------|
| Network attacks | NONE | No network exposure |
| Authentication bypass | N/A | No auth required (single user, localhost) |
| Session hijacking | N/A | No sessions |
| CSRF/XSS | LOW | Localhost only, single-user |
| Data exfiltration | LOW | Physical access required |
| API abuse | NONE | No external access |

### 1.2 Target Architecture (SPA - Web-Accessible)

**New Security Properties**:
- Frontend served via Nginx (HTTPS, internet-accessible)
- Backend API provided by matric-memory (separate infrastructure)
- Authentication via Keycloak OIDC (100+ users)
- Data flows over network (client to API server)
- Browser-based execution environment
- Multi-user model with explicit identity

**New Threat Model**:
| Threat Category | Risk Level | New Attack Vectors |
|-----------------|------------|-------------------|
| Network attacks | HIGH | MITM, packet sniffing, DNS poisoning |
| Authentication bypass | HIGH | Token theft, credential stuffing, session fixation |
| Session hijacking | HIGH | XSS token theft, session replay |
| CSRF | MEDIUM | Forged requests from malicious sites |
| XSS | HIGH | Script injection, DOM manipulation |
| Data exfiltration | MEDIUM | Network interception, API abuse |
| API abuse | HIGH | Rate limiting bypass, enumeration attacks |
| OIDC vulnerabilities | MEDIUM | Token replay, PKCE bypass, redirect manipulation |

### 1.3 STRIDE Analysis for SPA Migration

| STRIDE Category | Desktop Risk | SPA Risk | New Threats |
|-----------------|--------------|----------|-------------|
| **S**poofing | LOW | HIGH | Impersonation via stolen tokens, session hijacking |
| **T**ampering | LOW | MEDIUM | Request modification, token manipulation |
| **R**epudiation | LOW | MEDIUM | Denial of actions without proper audit logging |
| **I**nformation Disclosure | LOW | HIGH | Token leakage, API response exposure, cache data |
| **D**enial of Service | LOW | MEDIUM | API flooding, resource exhaustion |
| **E**levation of Privilege | LOW | MEDIUM | Token scope manipulation, role confusion |

---

## 2. ADR-003 Status and Applicability

### 2.1 Original ADR-003 Principles Review

| Principle | Desktop Status | SPA Applicability | Assessment |
|-----------|---------------|-------------------|------------|
| All data stays local | IMPLEMENTED | **NO LONGER APPLIES** | Data flows to matric-memory API server |
| All AI processing stays local | IMPLEMENTED | **PARTIALLY APPLIES** | NLP processing server-side (matric-memory) |
| No telemetry | IMPLEMENTED | **CAN BE PRESERVED** | Optional: privacy-friendly analytics only |
| No cloud sync (MVP) | IMPLEMENTED | **SUPERSEDED** | Sync happens via matric-memory API |
| Future sync via P2P only | PLANNED | **SUPERSEDED** | Client-server model, not P2P |

### 2.2 Privacy Assessment by Deployment Model

**Scenario 1: Self-Hosted matric-memory (Private Infrastructure)**
| Privacy Aspect | Assessment | Mitigation |
|---------------|------------|------------|
| Data sovereignty | User/org controls infrastructure | Acceptable |
| Third-party access | None (self-hosted) | Acceptable |
| Compliance | Organization-managed | GDPR/CCPA responsibility shifts to operator |
| Privacy principles | Mostly preserved | Document operator responsibilities |

**Scenario 2: Hosted matric-memory (Cloud/SaaS)**
| Privacy Aspect | Assessment | Mitigation |
|---------------|------------|------------|
| Data sovereignty | Provider controls data | **CRITICAL PRIVACY CHANGE** |
| Third-party access | Provider has access | Requires DPA, encryption at rest |
| Compliance | Provider responsibility | Verify provider compliance certifications |
| Privacy principles | **ADR-003 VIOLATED** | Requires new ADR superseding local-first |

### 2.3 ADR-003 Recommendation

**Action Required**: Create **ADR-007: SPA Privacy Model** to:
1. Document supersession of ADR-003 local-first principles for SPA deployment
2. Define new privacy model based on deployment scenario (self-hosted vs. hosted)
3. Establish data handling responsibilities (frontend vs. API server)
4. Define telemetry policy for SPA (opt-in analytics, no PII collection)
5. Document user consent requirements if hosted deployment

**ADR-003 Status**:
- **Desktop builds**: ADR-003 remains in effect
- **SPA deployment**: ADR-003 superseded by ADR-007 (to be created)

---

## 3. New Security Requirements

### 3.1 Authentication Requirements

| Requirement ID | Requirement | Priority | Phase |
|----------------|-------------|----------|-------|
| AUTH-001 | Implement Keycloak OIDC with Authorization Code Flow + PKCE | CRITICAL | MVP or Early Post-MVP |
| AUTH-002 | Access tokens: 15-60 minute TTL, short-lived | HIGH | With AUTH-001 |
| AUTH-003 | Refresh tokens: Secure storage, automatic renewal | HIGH | With AUTH-001 |
| AUTH-004 | Token storage: In-memory or httpOnly cookies (NOT localStorage) | CRITICAL | With AUTH-001 |
| AUTH-005 | Logout: Clear all tokens, invalidate server-side session | HIGH | With AUTH-001 |
| AUTH-006 | Session timeout: Automatic logout after inactivity (30 min default) | MEDIUM | Post-MVP |

**Token Storage Decision**:
| Storage Method | Security | Recommendation |
|----------------|----------|----------------|
| localStorage | LOW - XSS vulnerable | **NOT RECOMMENDED** |
| sessionStorage | MEDIUM - XSS vulnerable, cleared on tab close | Acceptable for development only |
| In-memory (React state) | HIGH - Not persistent, cleared on refresh | Recommended for access tokens |
| httpOnly cookies | HIGH - Not accessible to JS | Recommended for refresh tokens |

### 3.2 CORS Configuration Requirements

| Requirement ID | Requirement | Priority | Owner |
|----------------|-------------|----------|-------|
| CORS-001 | matric-memory API must whitelist exact SPA origin | CRITICAL | matric-memory team |
| CORS-002 | Avoid `Access-Control-Allow-Origin: *` in production | CRITICAL | matric-memory team |
| CORS-003 | Enable `Access-Control-Allow-Credentials: true` for cookie-based auth | HIGH | matric-memory team |
| CORS-004 | Restrict allowed methods to required verbs (GET, POST, PUT, DELETE) | MEDIUM | matric-memory team |
| CORS-005 | Restrict allowed headers to required set | LOW | matric-memory team |

**Example CORS Configuration (matric-memory API)**:
```
Access-Control-Allow-Origin: https://hotm.example.com
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Access-Control-Max-Age: 86400
```

### 3.3 CSP Header Requirements (Nginx)

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| CSP-001 | Implement strict Content-Security-Policy header | HIGH |
| CSP-002 | Block inline scripts (require nonce or hash for inline) | HIGH |
| CSP-003 | Restrict connect-src to matric-memory API and Keycloak | HIGH |
| CSP-004 | Block framing (frame-ancestors 'none' or 'self') | MEDIUM |
| CSP-005 | Enable CSP violation reporting (report-uri or report-to) | LOW |

**Recommended CSP Configuration**:
```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https:;
  font-src 'self';
  connect-src 'self' https://api.matric-memory.example.com https://auth.example.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self';
" always;
```

### 3.4 Additional Security Headers (Nginx)

| Header | Value | Purpose |
|--------|-------|---------|
| X-Content-Type-Options | nosniff | Prevent MIME sniffing |
| X-Frame-Options | DENY | Prevent clickjacking |
| X-XSS-Protection | 0 | Disable legacy XSS filter (CSP preferred) |
| Referrer-Policy | strict-origin-when-cross-origin | Control referrer leakage |
| Permissions-Policy | geolocation=(), microphone=(), camera=() | Disable unused APIs |
| Strict-Transport-Security | max-age=31536000; includeSubDomains | Enforce HTTPS |

### 3.5 Rate Limiting Requirements

| Requirement ID | Requirement | Owner | Priority |
|----------------|-------------|-------|----------|
| RATE-001 | API rate limiting: 100 requests/minute per user | matric-memory | HIGH |
| RATE-002 | Auth endpoint rate limiting: 10 attempts/minute | Keycloak | HIGH |
| RATE-003 | Search endpoint rate limiting: 30 requests/minute | matric-memory | MEDIUM |
| RATE-004 | Return 429 Too Many Requests with Retry-After header | matric-memory | HIGH |
| RATE-005 | Frontend graceful handling of 429 responses | HotM SPA | MEDIUM |

### 3.6 Session Management Requirements

| Requirement ID | Requirement | Priority |
|----------------|-------------|----------|
| SESSION-001 | Server-side session tracking (Keycloak session) | HIGH |
| SESSION-002 | Session binding to user agent/IP (optional strictness) | MEDIUM |
| SESSION-003 | Concurrent session limit (e.g., max 5 active sessions) | LOW |
| SESSION-004 | Session revocation API (logout all sessions) | MEDIUM |
| SESSION-005 | Session activity logging (login, logout, refresh) | MEDIUM |

---

## 4. Security Gates for Migration

### 4.1 Pre-MVP Security Gate (Before Initial Release)

| Gate ID | Criterion | Status | Notes |
|---------|-----------|--------|-------|
| GATE-PRE-001 | HTTPS/TLS enabled for SPA hosting | [ ] | Nginx configuration |
| GATE-PRE-002 | Security headers configured (CSP, X-Frame-Options, etc.) | [ ] | Nginx configuration |
| GATE-PRE-003 | CORS properly configured on matric-memory API | [ ] | Coordinate with API team |
| GATE-PRE-004 | No sensitive data in client-side storage (check for PII, tokens in localStorage) | [ ] | Code review |
| GATE-PRE-005 | API keys/secrets not exposed in frontend code | [ ] | Build process review |
| GATE-PRE-006 | npm audit shows no high/critical vulnerabilities | [ ] | CI/CD enforcement |
| GATE-PRE-007 | React XSS protections verified (no dangerouslySetInnerHTML with user content) | [ ] | Code review |

### 4.2 Authentication Gate (Before Multi-User Access)

| Gate ID | Criterion | Status | Notes |
|---------|-----------|--------|-------|
| GATE-AUTH-001 | Keycloak OIDC implemented with PKCE | [ ] | Required for 100+ users |
| GATE-AUTH-002 | Token storage uses in-memory or httpOnly cookies | [ ] | NOT localStorage |
| GATE-AUTH-003 | Automatic token refresh implemented | [ ] | Before access token expiry |
| GATE-AUTH-004 | Logout clears all tokens and sessions | [ ] | Client and server |
| GATE-AUTH-005 | OIDC redirect URLs validated (no open redirects) | [ ] | Keycloak configuration |
| GATE-AUTH-006 | Auth errors handled gracefully (no sensitive info in errors) | [ ] | Code review |

### 4.3 Production Security Gate (Before Public Launch)

| Gate ID | Criterion | Status | Notes |
|---------|-----------|--------|-------|
| GATE-PROD-001 | Rate limiting active on matric-memory API | [ ] | Verify with API team |
| GATE-PROD-002 | Security logging enabled (auth events, errors) | [ ] | Monitoring setup |
| GATE-PROD-003 | Error tracking excludes sensitive data (Sentry sanitization) | [ ] | Configuration review |
| GATE-PROD-004 | SBOM generated for production build | [ ] | npm sbom or equivalent |
| GATE-PROD-005 | Penetration test or security review completed | [ ] | Optional for initial launch |
| GATE-PROD-006 | Incident response plan documented | [ ] | At least basic runbook |

---

## 5. Recommendations and Prioritization

### 5.1 Pre-MVP Security Items (MUST HAVE)

| Priority | Item | Owner | Rationale |
|----------|------|-------|-----------|
| P0 | HTTPS/TLS for SPA | DevOps | Data in transit protection |
| P0 | Security headers (CSP, X-Frame-Options) | DevOps | XSS/clickjacking prevention |
| P0 | CORS configuration on matric-memory | matric-memory team | API access control |
| P0 | No secrets in frontend bundle | HotM team | Prevent credential exposure |
| P0 | npm audit clean (no high/critical) | CI/CD | Dependency security |
| P1 | Input sanitization for user content | HotM team | XSS prevention |
| P1 | API error handling (no stack traces) | HotM team | Information disclosure |

### 5.2 Early Post-MVP Security Items (SHOULD HAVE)

| Priority | Item | Owner | Rationale |
|----------|------|-------|-----------|
| P1 | Keycloak OIDC authentication | HotM team | Multi-user access required |
| P1 | Secure token storage (not localStorage) | HotM team | Token theft prevention |
| P1 | Rate limiting on API | matric-memory team | DoS prevention |
| P2 | Session timeout handling | HotM team | Abandoned session protection |
| P2 | CSP violation reporting | DevOps | Attack detection |

### 5.3 Deferred Security Items (NICE TO HAVE)

| Priority | Item | Owner | Rationale |
|----------|------|-------|-----------|
| P3 | Penetration testing | External | Validation of controls |
| P3 | SBOM generation and tracking | DevOps | Supply chain security |
| P3 | Advanced session controls (concurrent limit) | Keycloak | Reduced attack surface |
| P3 | Security audit logging (SIEM integration) | DevOps | Incident investigation |

### 5.4 Items Inherited from matric-memory

These security items are the responsibility of the matric-memory API team:

| Item | matric-memory Responsibility | HotM Responsibility |
|------|------------------------------|---------------------|
| Data encryption at rest | Implement in PostgreSQL | None (API consumer) |
| SQL injection prevention | Parameterized queries | None (API consumer) |
| API authentication validation | Token validation | Send valid tokens |
| Rate limiting enforcement | Implement limits | Handle 429 gracefully |
| CORS configuration | Configure allowed origins | Use configured origin |
| API input validation | Server-side validation | Client-side validation (defense in depth) |
| Database backups | Backup strategy | None (API consumer) |
| API availability | SLA and monitoring | Show offline state gracefully |

---

## 6. Risk Register Updates

### 6.1 New Security Risks (SPA Migration)

| Risk ID | Description | Likelihood | Impact | Mitigation | Owner |
|---------|-------------|------------|--------|------------|-------|
| SEC-001 | XSS attack via user-generated content | MEDIUM | HIGH | React escaping, CSP, input sanitization | HotM team |
| SEC-002 | Token theft via XSS | MEDIUM | HIGH | httpOnly cookies, CSP, token binding | HotM team |
| SEC-003 | OIDC misconfiguration (open redirect) | LOW | HIGH | Validate redirect URIs, security review | Keycloak admin |
| SEC-004 | CORS misconfiguration exposing API | LOW | HIGH | Strict origin whitelist, security review | matric-memory team |
| SEC-005 | Credential stuffing against Keycloak | MEDIUM | MEDIUM | Rate limiting, account lockout, MFA | Keycloak admin |
| SEC-006 | Session hijacking via token replay | LOW | HIGH | Short token TTL, token binding | HotM team |
| SEC-007 | Supply chain attack via npm packages | LOW | HIGH | npm audit, lockfile, Dependabot | HotM team |
| SEC-008 | API availability affecting all users | MEDIUM | HIGH | Graceful degradation, error handling | Both teams |

### 6.2 Retired Risks (No Longer Applicable)

| Risk ID | Description | Reason for Retirement |
|---------|-------------|----------------------|
| (Desktop risks) | Local data loss without backup | Data now stored server-side |
| (Desktop risks) | Local hardware resource constraints | Processing moved to server |

---

## 7. Compliance Considerations

### 7.1 Privacy Compliance (GDPR/CCPA)

| Requirement | Desktop (ADR-003) | SPA (New Model) | Action Required |
|-------------|-------------------|-----------------|-----------------|
| Data collection | None | User accounts, notes | Privacy policy required |
| Data storage | Local only | matric-memory server | Document data location |
| Data processing | Local only | Server-side | Document processing purpose |
| User consent | Not required | Required for cookies/analytics | Consent mechanism |
| Data deletion | User controls local data | API-based deletion | Implement account deletion |
| Data portability | Local export | API export endpoint | Verify matric-memory supports |

### 7.2 Security Compliance

| Standard | Applicability | Actions |
|----------|--------------|---------|
| OWASP Top 10 | HIGH | Address XSS, injection, auth failures |
| PCI-DSS | LOW (no payment data) | N/A |
| SOC 2 | MEDIUM (if enterprise customers) | matric-memory team responsibility |
| ISO 27001 | LOW (no certification planned) | Follow best practices |

---

## 8. Architecture Security Diagram

```
+------------------+      HTTPS/TLS       +------------------+
|                  |<-------------------->|                  |
|  User Browser    |                      |   Nginx (SPA)    |
|  (React SPA)     |      CSP Headers     |   Static Files   |
|                  |                      |                  |
+--------+---------+                      +------------------+
         |
         | HTTPS + Bearer Token
         |
         v
+------------------+      HTTPS/TLS       +------------------+
|                  |<-------------------->|                  |
|  matric-memory   |    CORS Protected    |   PostgreSQL     |
|  API Server      |    Rate Limited      |   + pgvector     |
|                  |                      |                  |
+--------+---------+                      +------------------+
         |
         | OIDC Token Validation
         |
         v
+------------------+
|                  |
|    Keycloak      |
|   OIDC Provider  |
|                  |
+------------------+
```

**Security Boundaries**:
1. Browser to Nginx: TLS encryption, security headers
2. Browser to matric-memory: TLS, CORS, Bearer token, rate limiting
3. matric-memory to PostgreSQL: Private network, credentials
4. Browser to Keycloak: TLS, OIDC protocol, PKCE

---

## 9. Document Control

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | DRAFT |
| Author | Security Architect |
| Review Date | 2026-01-30 |
| Next Review | Before MVP deployment |
| Supersedes | N/A (new assessment) |
| Related Documents | ADR-003, ADR-007 (to be created), project-intake.md |

---

## 10. Action Items Summary

### Immediate (Week 1-2)
1. [ ] Create ADR-007: SPA Privacy Model (superseding ADR-003 for SPA)
2. [ ] Coordinate CORS configuration with matric-memory team
3. [ ] Define Nginx security headers configuration
4. [ ] Verify npm audit is clean (no high/critical)

### Short-term (Week 3-6)
5. [ ] Implement CSP headers in Nginx
6. [ ] Code review for XSS vulnerabilities (dangerouslySetInnerHTML)
7. [ ] Verify no secrets in frontend bundle
8. [ ] Begin Keycloak OIDC integration planning

### Medium-term (Week 7-12)
9. [ ] Complete Keycloak OIDC implementation
10. [ ] Implement secure token storage
11. [ ] Verify rate limiting on matric-memory API
12. [ ] Complete security gate checklist (GATE-AUTH-*)

### Pre-Production
13. [ ] Complete all production security gates (GATE-PROD-*)
14. [ ] Document incident response plan
15. [ ] Optional: Security review or penetration test

---

## Appendix A: Security Gate Checklist (Printable)

**Pre-MVP Security Gate**
- [ ] HTTPS/TLS enabled
- [ ] Security headers configured
- [ ] CORS configured
- [ ] No secrets in frontend
- [ ] npm audit clean
- [ ] XSS protections verified
- [ ] No sensitive data in localStorage

**Authentication Gate**
- [ ] OIDC with PKCE
- [ ] Secure token storage
- [ ] Token refresh working
- [ ] Logout complete
- [ ] No open redirects
- [ ] Error handling secure

**Production Gate**
- [ ] Rate limiting active
- [ ] Security logging enabled
- [ ] Error tracking sanitized
- [ ] SBOM generated
- [ ] Incident response documented

---

*End of Security Migration Assessment*
