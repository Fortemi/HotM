# Penetration Testing Plan (Deferred)

**Project**: HotM (Hall Of The Mind)
**Document Version**: 1.0
**Status**: DEFERRED (Pre-Production)
**Date**: 2026-01-31
**Author**: Security Architect
**Related Issues**: #63
**Related Documents**: migration-security-assessment.md, keycloak-oidc-plan.md, secure-token-storage-plan.md

---

## 1. Executive Summary

This document outlines the penetration testing plan for the HotM SPA and matric-memory API before public launch or enterprise customer onboarding. Penetration testing provides independent validation of security controls and identifies vulnerabilities that automated scanning may miss.

**Deferral Rationale**:
- Penetration testing is most effective on stable production-like environments
- MVP focus is on core functionality; security hardening follows
- Testing should cover OIDC implementation (Issue #60) once complete
- Cost-benefit favors testing before broader user exposure, not during MVP

**Timing**: Before public launch or first enterprise customer onboarding

**Estimated Cost**: $5,000-15,000 for third-party engagement

---

## 2. Scope Definition

### 2.1 In-Scope Systems

| System | Description | Priority |
|--------|-------------|----------|
| **HotM SPA** | React frontend application | HIGH |
| **matric-memory API** | Backend API server | HIGH |
| **Authentication** | Keycloak OIDC (when implemented) | HIGH |
| **Nginx** | Reverse proxy, static file serving | MEDIUM |
| **Database** | PostgreSQL + pgvector (if direct access possible) | LOW |

### 2.2 In-Scope Attack Surfaces

| Surface | Components | Test Types |
|---------|------------|------------|
| **Web Application** | SPA routes, forms, file uploads | OWASP Top 10, business logic |
| **API Endpoints** | REST API, authentication, authorization | API security, injection, auth bypass |
| **Authentication** | OIDC flows, session management | Token security, SSO vulnerabilities |
| **Network** | TLS configuration, headers, CORS | Transport security, misconfigurations |
| **Client-Side** | JavaScript, storage, CSP bypass | XSS, DOM manipulation, data leakage |

### 2.3 Out of Scope

| Exclusion | Rationale |
|-----------|-----------|
| Physical security | Not applicable to cloud deployment |
| Social engineering | Outside technical pen test |
| DoS attacks (sustained) | Risk of service disruption |
| Third-party services | Separate vendor responsibility |
| Keycloak core | Test HotM integration only, not Keycloak itself |
| Host OS penetration | Covered by infrastructure security |

### 2.4 Testing Boundaries

```
┌─────────────────────────────────────────────────────────────────┐
│                        IN SCOPE                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌───────────────┐     ┌───────────────┐     ┌──────────────┐ │
│   │   HotM SPA    │────>│    Nginx      │────>│ matric-memory│ │
│   │   (React)     │     │ (TLS, Headers)│     │    API       │ │
│   └───────────────┘     └───────────────┘     └──────────────┘ │
│          │                                           │          │
│          │                                           │          │
│          ▼                                           ▼          │
│   ┌───────────────┐                         ┌──────────────┐   │
│   │   Keycloak    │                         │  PostgreSQL  │   │
│   │   (OIDC)      │                         │  (limited)   │   │
│   └───────────────┘                         └──────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                       OUT OF SCOPE                               │
├─────────────────────────────────────────────────────────────────┤
│   - Host operating systems                                       │
│   - Keycloak core vulnerabilities (use official security list)  │
│   - Cloud provider infrastructure (AWS, GCP, etc.)              │
│   - Third-party services (Ollama, external APIs)                │
│   - Sustained denial of service attacks                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Testing Approach

### 3.1 Testing Phases

| Phase | Duration | Activities |
|-------|----------|------------|
| **Phase 1: Reconnaissance** | 1 day | Asset discovery, technology fingerprinting |
| **Phase 2: Automated Scanning** | 2 days | OWASP ZAP, Burp Suite scans |
| **Phase 3: Manual Testing** | 3-5 days | Business logic, auth flows, API testing |
| **Phase 4: Exploitation** | 1-2 days | Validate findings, demonstrate impact |
| **Phase 5: Reporting** | 1-2 days | Document findings, remediation guidance |

### 3.2 Testing Methodology

**Framework**: OWASP Testing Guide v4.2, PTES (Penetration Testing Execution Standard)

| OWASP Category | Test Cases |
|----------------|------------|
| **A01:2021 Broken Access Control** | IDOR, privilege escalation, CORS bypass |
| **A02:2021 Cryptographic Failures** | TLS config, sensitive data exposure |
| **A03:2021 Injection** | XSS, SQLi, command injection |
| **A04:2021 Insecure Design** | Business logic flaws, race conditions |
| **A05:2021 Security Misconfiguration** | Default configs, verbose errors, headers |
| **A06:2021 Vulnerable Components** | Dependency analysis, CVE checks |
| **A07:2021 Auth Failures** | Session management, credential handling |
| **A08:2021 Integrity Failures** | CSRF, deserialization, unsigned data |
| **A09:2021 Logging Failures** | Log injection, insufficient logging |
| **A10:2021 SSRF** | Server-side request forgery |

---

## 4. Automated Scanning

### 4.1 OWASP ZAP Configuration

**Tool**: OWASP ZAP (Zed Attack Proxy)

```bash
# Docker-based ZAP scan
docker run -v $(pwd)/zap-reports:/zap/wrk:rw \
  -t owasp/zap2docker-stable zap-full-scan.py \
  -t https://hotm.example.com \
  -r zap-report.html \
  -x zap-report.xml \
  -J zap-report.json \
  -c zap-config.prop

# ZAP configuration file (zap-config.prop)
# Adjust for SPA behavior
```

**ZAP Scan Types**:

| Scan Type | Purpose | Duration |
|-----------|---------|----------|
| Spider | Crawl application, discover endpoints | 15-30 min |
| Ajax Spider | Crawl JavaScript-rendered content | 30-60 min |
| Active Scan | Test for vulnerabilities | 2-4 hours |
| API Scan | Test API endpoints (OpenAPI spec) | 1-2 hours |

**ZAP Rules Configuration**:

```xml
<!-- zap-rules.xml - Customize for HotM -->
<alertfilter>
  <!-- Ignore false positives -->
  <alertfilter>
    <ruleId>10038</ruleId> <!-- CSP header (intentional config) -->
    <url>https://hotm.example.com/.*</url>
    <enabled>false</enabled>
  </alertfilter>
</alertfilter>
```

### 4.2 Burp Suite Configuration

**Tool**: Burp Suite Professional (for manual testing and advanced scanning)

**Scan Configuration**:

| Setting | Value | Notes |
|---------|-------|-------|
| Scan Type | Crawl and Audit | Comprehensive |
| Crawl Strategy | Fastest | Adjust for SPA |
| Audit Configuration | Audit checks - all | Full coverage |
| Login Handling | Form-based / Session token | Configure for OIDC |
| Out-of-Scope URLs | Keycloak core, third-party | Avoid false positives |

**Burp Extensions Required**:

| Extension | Purpose |
|-----------|---------|
| Logger++ | Enhanced request/response logging |
| Autorize | Authorization testing |
| JWT Editor | Token manipulation |
| Upload Scanner | File upload testing |
| Param Miner | Hidden parameter discovery |

### 4.3 API-Specific Testing

**Tool**: OWASP ZAP API Scan with OpenAPI specification

```bash
# API scan using OpenAPI spec
docker run -v $(pwd):/zap/wrk:rw \
  -t owasp/zap2docker-stable zap-api-scan.py \
  -t https://api.matric-memory.example.com/api/v1/openapi.json \
  -f openapi \
  -r api-report.html
```

**Postman/Newman Security Tests**:

```javascript
// Postman pre-request script for auth bypass testing
pm.request.headers.add({
  key: "Authorization",
  value: "Bearer invalid_token_12345"
});

// Test for proper 401 response
pm.test("Invalid token returns 401", function () {
  pm.response.to.have.status(401);
});

// Test for proper error message (no stack trace)
pm.test("Error response is sanitized", function () {
  const response = pm.response.json();
  pm.expect(response).to.not.have.property('stack');
  pm.expect(response).to.not.have.property('trace');
});
```

---

## 5. Manual Testing Areas

### 5.1 Authentication Testing

| Test Case | Description | Risk |
|-----------|-------------|------|
| **AUTH-01** | Bypass login without credentials | Critical |
| **AUTH-02** | Session fixation attack | High |
| **AUTH-03** | Session timeout not enforced | Medium |
| **AUTH-04** | Concurrent session handling | Medium |
| **AUTH-05** | Password reset flow vulnerabilities | High |
| **AUTH-06** | Account enumeration via error messages | Medium |
| **AUTH-07** | Token replay after logout | High |
| **AUTH-08** | OIDC redirect manipulation | High |
| **AUTH-09** | PKCE bypass attempts | Critical |
| **AUTH-10** | Refresh token reuse after rotation | High |

### 5.2 Authorization Testing

| Test Case | Description | Risk |
|-----------|-------------|------|
| **AUTHZ-01** | Access other users' notes (IDOR) | Critical |
| **AUTHZ-02** | Privilege escalation (user to admin) | Critical |
| **AUTHZ-03** | API access without token | High |
| **AUTHZ-04** | Expired token still grants access | High |
| **AUTHZ-05** | Modified JWT claims accepted | Critical |
| **AUTHZ-06** | CORS allows unauthorized origins | Medium |
| **AUTHZ-07** | Direct object reference manipulation | High |

### 5.3 Business Logic Testing

| Test Case | Description | Risk |
|-----------|-------------|------|
| **BL-01** | Rate limiting bypass | Medium |
| **BL-02** | Note content injection | Medium |
| **BL-03** | Search query injection | Medium |
| **BL-04** | File upload bypasses (if applicable) | High |
| **BL-05** | Mass data export without limits | Medium |
| **BL-06** | API parameter tampering | Medium |
| **BL-07** | Race condition in note creation | Low |

### 5.4 Client-Side Testing

| Test Case | Description | Risk |
|-----------|-------------|------|
| **CLIENT-01** | Stored XSS via note content | High |
| **CLIENT-02** | Reflected XSS via URL parameters | High |
| **CLIENT-03** | DOM-based XSS | High |
| **CLIENT-04** | CSP bypass attempts | Medium |
| **CLIENT-05** | Sensitive data in browser storage | Medium |
| **CLIENT-06** | Source map exposure | Low |
| **CLIENT-07** | Debug endpoints accessible | Medium |

---

## 6. Testing Environment

### 6.1 Environment Requirements

| Requirement | Description |
|-------------|-------------|
| **Environment** | Staging or production-like |
| **Data** | Synthetic test data (no real user data) |
| **Access** | Test user accounts at various privilege levels |
| **Monitoring** | Disable alerting for pen test traffic |
| **Backup** | Full backup before testing begins |
| **Rollback** | Ability to restore if testing causes issues |

### 6.2 Test Account Requirements

| Account Type | Purpose | Credentials Handling |
|--------------|---------|---------------------|
| Standard User | Normal user flow testing | Provided securely |
| Admin User | Admin function testing | Provided securely |
| Expired User | Token expiry testing | Created for test |
| New User | Registration flow testing | Self-registered |
| Invalid User | Negative testing | Crafted by tester |

### 6.3 Pre-Test Checklist

```markdown
## Penetration Test Pre-Flight Checklist

### Environment Preparation
- [ ] Staging environment matches production configuration
- [ ] Synthetic test data populated
- [ ] Database backup created
- [ ] Rollback procedure documented and tested

### Access Provisioning
- [ ] Test accounts created with appropriate privileges
- [ ] VPN/network access granted to testing team
- [ ] Source code access (if white-box testing)
- [ ] API documentation shared

### Coordination
- [ ] Testing window communicated to stakeholders
- [ ] Monitoring/alerting adjusted for test traffic
- [ ] Emergency contact list established
- [ ] Incident response team on standby

### Documentation
- [ ] Scope document signed
- [ ] Rules of engagement agreed
- [ ] Authorization letter issued
- [ ] NDA executed (if third-party)
```

---

## 7. Vendor Options

### 7.1 Third-Party Vendor Selection Criteria

| Criterion | Weight | Evaluation Method |
|-----------|--------|-------------------|
| **Expertise** | 25% | Certifications (OSCP, OSWE, CREST), references |
| **Methodology** | 20% | OWASP alignment, documentation quality |
| **Experience** | 20% | Similar engagements, SPA/API expertise |
| **Communication** | 15% | Responsiveness, reporting quality |
| **Cost** | 10% | Within budget, value for scope |
| **Availability** | 10% | Timeline alignment |

### 7.2 Recommended Certifications

| Certification | Relevance |
|---------------|-----------|
| **OSCP** | Offensive Security Certified Professional |
| **OSWE** | Offensive Security Web Expert |
| **CREST** | CREST Registered Penetration Tester |
| **GWAPT** | GIAC Web Application Penetration Tester |
| **CEH** | Certified Ethical Hacker (baseline) |

### 7.3 Cost Estimation

| Engagement Type | Scope | Estimated Cost |
|-----------------|-------|----------------|
| **Basic Web App Test** | SPA only, automated + limited manual | $5,000-8,000 |
| **Comprehensive Test** | SPA + API + Auth, full manual testing | $10,000-15,000 |
| **Enterprise Engagement** | Above + source code review + retest | $20,000-30,000 |

### 7.4 Internal vs. External Testing

| Factor | Internal Team | Third-Party |
|--------|---------------|-------------|
| Cost | Lower (existing staff) | Higher (engagement fee) |
| Objectivity | May have blind spots | Fresh perspective |
| Knowledge | Deep app knowledge | May miss context |
| Availability | Subject to competing priorities | Dedicated engagement |
| Credibility | Internal validation | External attestation |
| Compliance | May not satisfy requirements | Preferred for compliance |

**Recommendation**: Third-party for initial production validation; internal for ongoing/iterative testing.

---

## 8. Remediation Process

### 8.1 Finding Severity Classification

| Severity | CVSS Score | Response Time | Examples |
|----------|------------|---------------|----------|
| **Critical** | 9.0-10.0 | 24-48 hours | RCE, auth bypass, data breach |
| **High** | 7.0-8.9 | 1 week | SQL injection, privilege escalation |
| **Medium** | 4.0-6.9 | 2 weeks | XSS, CSRF, information disclosure |
| **Low** | 0.1-3.9 | Next release | Missing headers, verbose errors |
| **Informational** | N/A | Discretionary | Best practice recommendations |

### 8.2 Remediation Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    FINDING REMEDIATION FLOW                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐│
│   │ Finding  │────>│ Triage   │────>│ Assign   │────>│ Fix    ││
│   │ Reported │     │ Severity │     │ Owner    │     │ Develop││
│   └──────────┘     └──────────┘     └──────────┘     └────────┘│
│                                                           │     │
│                                                           ▼     │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌────────┐│
│   │ Close    │<────│ Retest   │<────│ Deploy   │<────│ Review ││
│   │ Finding  │     │ (Verify) │     │ Fix      │     │ PR     ││
│   └──────────┘     └──────────┘     └──────────┘     └────────┘│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.3 Remediation Tracking

```markdown
## Finding Remediation Tracker

| ID | Finding | Severity | Owner | Status | Due Date | Retest Date |
|----|---------|----------|-------|--------|----------|-------------|
| PT-001 | XSS in note title | High | Frontend Dev | In Progress | 2026-02-15 | TBD |
| PT-002 | Missing rate limit | Medium | Backend Dev | Fixed | 2026-02-10 | 2026-02-12 |
| PT-003 | Verbose error message | Low | Backend Dev | Open | 2026-02-28 | TBD |
```

### 8.4 Retest Requirements

| Severity | Retest Required | Retest Method |
|----------|-----------------|---------------|
| Critical | Mandatory | Full retest by pen tester |
| High | Mandatory | Retest by pen tester or verified fix |
| Medium | Recommended | Internal verification |
| Low | Optional | Internal verification |
| Info | Not required | Best effort |

---

## 9. Reporting Requirements

### 9.1 Report Sections

| Section | Content |
|---------|---------|
| **Executive Summary** | High-level findings, risk rating, recommendations |
| **Methodology** | Testing approach, tools, scope |
| **Findings Summary** | Table of all findings with severity |
| **Detailed Findings** | Per-finding: description, evidence, impact, remediation |
| **Positive Findings** | Security controls that worked well |
| **Recommendations** | Prioritized remediation roadmap |
| **Appendices** | Raw tool output, request/response samples |

### 9.2 Finding Documentation Template

```markdown
## Finding: [Title]

**Severity**: [Critical/High/Medium/Low/Info]
**CVSS Score**: [0.0-10.0]
**CWE**: [CWE-XXX]
**OWASP Category**: [A01-A10]

### Description
[Technical description of the vulnerability]

### Evidence
[Screenshots, request/response samples, proof of concept]

### Impact
[Business and technical impact if exploited]

### Affected Components
- [Component 1]
- [Component 2]

### Remediation
[Specific steps to fix the vulnerability]

### References
- [CVE link if applicable]
- [OWASP reference]
- [Vendor documentation]
```

### 9.3 Deliverables

| Deliverable | Format | Audience |
|-------------|--------|----------|
| Executive Summary | PDF | Leadership, stakeholders |
| Technical Report | PDF | Development, security teams |
| Raw Findings Export | XML/JSON | Security tooling integration |
| Retest Report | PDF | Validation of fixes |
| Attestation Letter | PDF | Compliance, customers |

---

## 10. Timeline and Milestones

### 10.1 Engagement Timeline

```
Week 1          Week 2          Week 3          Week 4
│               │               │               │
├───────────────┼───────────────┼───────────────┤
│ Scoping       │ Testing       │ Reporting     │
│ Kickoff       │ Execution     │ Remediation   │
│               │               │               │
Day 1-2: Scope  Day 3-10:       Day 11-14:      Day 15+:
finalization    Active testing  Report writing  Fixes & Retest
```

### 10.2 Key Milestones

| Milestone | Target Date | Deliverable |
|-----------|-------------|-------------|
| Scope agreement signed | T-7 days | Signed SOW |
| Kickoff meeting | T+0 | Meeting notes, access confirmed |
| Testing complete | T+10 days | Testing completion notification |
| Draft report | T+12 days | Draft findings report |
| Final report | T+14 days | Final report with all findings |
| Remediation complete | T+30 days | All critical/high fixed |
| Retest complete | T+35 days | Retest report |
| Engagement closure | T+40 days | Final attestation |

---

## 11. Prerequisites

### 11.1 Technical Prerequisites

| Prerequisite | Status | Owner |
|--------------|--------|-------|
| Stable staging environment | Required | DevOps |
| OIDC implementation complete | Required for full auth testing | Development |
| API documentation current | Required | Development |
| Security headers implemented | Required | DevOps |
| Rate limiting active | Required | matric-memory team |

### 11.2 Administrative Prerequisites

| Prerequisite | Status | Owner |
|--------------|--------|-------|
| Budget approved | Required | Project Lead |
| Vendor selected (if external) | Required | Security Architect |
| Legal review (NDA, SOW) | Required | Legal |
| Stakeholder notification | Required | Project Lead |
| Testing window scheduled | Required | DevOps |

---

## 12. Document Control

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | DEFERRED |
| Author | Security Architect |
| Date | 2026-01-31 |
| Trigger for Implementation | Before public launch or enterprise onboarding |
| Estimated Cost | $5,000-15,000 (third-party) |
| Estimated Duration | 2-4 weeks (including remediation) |
| Related Issues | #63 |
| Related Documents | migration-security-assessment.md, keycloak-oidc-plan.md |

---

*End of Penetration Testing Plan*
