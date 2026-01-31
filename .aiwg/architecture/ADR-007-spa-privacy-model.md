# ADR-007: SPA Privacy Model for HotM

**Status**: Accepted
**Date**: 2026-01-31
**Deciders**: Development Team, Security Architect
**Context**: Migration from local-first desktop app to server-backed web SPA
**Supersedes**: ADR-003 (for SPA deployment mode only)

---

## 1. Title

ADR-007: SPA Privacy Model for HotM

---

## 2. Status

**Accepted**

This ADR establishes the privacy model for HotM when deployed as a web-based Single-Page Application (SPA) consuming the matric-memory API. It supersedes ADR-003 (Local-First Privacy Architecture) for SPA deployments while preserving ADR-003 principles for any future desktop builds.

---

## 3. Context

### 3.1 Background

HotM was originally designed as a local-first desktop application where:
- All user data remained on the user's local machine (PostgreSQL localhost)
- All AI processing occurred locally (Ollama)
- No network communication was required for core functionality
- Privacy was guaranteed by architecture (ADR-003)

### 3.2 SPA Migration Decision

ADR-004 (SPA Migration and matric-memory Integration) established that HotM will migrate from a Tauri desktop application to a web-based SPA to:
- Eliminate architectural redundancy with matric-memory
- Support 100+ external users via web access
- Simplify deployment (static files via Nginx)
- Leverage the production-ready matric-memory API

### 3.3 Privacy Model Conflict

The SPA migration fundamentally changes the data flow:

| Aspect | Desktop (ADR-003) | SPA (ADR-004+) |
|--------|-------------------|----------------|
| Data Storage | Local PostgreSQL | matric-memory server |
| AI Processing | Local Ollama | matric-memory server |
| Network Exposure | None (localhost only) | Internet-accessible |
| User Model | Single user, implicit trust | Multi-user, OIDC authentication |
| Data Control | User has full control | Server operator has access |

This creates a conflict with ADR-003's local-first privacy principles. A new privacy model is needed for the SPA deployment scenario.

### 3.4 Privacy Requirements

The migration security assessment identified these privacy requirements:
1. Define data handling responsibilities (frontend vs. API server)
2. Establish telemetry policy for SPA
3. Document user consent requirements
4. Address GDPR/CCPA compliance for server-based data storage
5. Define privacy expectations by deployment model (self-hosted vs. hosted)

---

## 4. Decision

### 4.1 Privacy Model for SPA

We adopt a **server-backed privacy model** with the following principles:

#### Principle 1: Data Residency Transparency

Users must understand where their data resides:

| Deployment Model | Data Location | Operator | Privacy Level |
|------------------|---------------|----------|---------------|
| **Self-Hosted matric-memory** | User's infrastructure | User/Organization | HIGH (ADR-003 equivalent) |
| **Hosted matric-memory (SaaS)** | Provider infrastructure | Service provider | MEDIUM (requires trust) |

**User Communication**: The SPA must clearly indicate the data residency model during onboarding or in settings.

#### Principle 2: No Sensitive Data in Browser

The SPA browser client MUST NOT store sensitive data:

| Storage Location | Allowed Content | Prohibited Content |
|------------------|-----------------|-------------------|
| Memory (React state) | Session data, cached API responses | N/A (cleared on tab close) |
| sessionStorage | Non-sensitive UI preferences | Auth tokens, note content, PII |
| localStorage | Theme preference, dismissed banners | Auth tokens, note content, PII |
| IndexedDB | Offline cache (future, opt-in only) | Unencrypted note content |
| Cookies | Session identifier (httpOnly) | Note content, PII |

#### Principle 3: Minimal Data Transmission

The SPA transmits only necessary data:

| Data Type | Transmission | Rationale |
|-----------|--------------|-----------|
| Note content | Required | Core functionality |
| Search queries | Required | Search functionality |
| Authentication tokens | Required | User identity |
| User preferences | Optional | Sync across devices |
| Analytics/telemetry | **PROHIBITED** | Privacy commitment |
| Error details with PII | **PROHIBITED** | Privacy protection |

#### Principle 4: Server-Side Privacy Responsibilities

Privacy responsibilities shift to the matric-memory API server:

| Responsibility | Owner | Implementation |
|----------------|-------|----------------|
| Data encryption at rest | matric-memory | PostgreSQL encryption, filesystem encryption |
| Data encryption in transit | Both | TLS 1.2+ required |
| Access control | matric-memory | OIDC token validation, user isolation |
| Audit logging | matric-memory | Access logs without PII in logged queries |
| Data retention | matric-memory | Configurable retention policies |
| Data deletion | matric-memory | Account deletion API, GDPR right to erasure |
| Backup encryption | matric-memory | Encrypted backups |

#### Principle 5: User Consent and Control

Users must have control over their data:

| Right | Implementation | Owner |
|-------|----------------|-------|
| **Access** | Export API endpoint | matric-memory |
| **Rectification** | Edit/update APIs | matric-memory |
| **Erasure** | Delete account API | matric-memory |
| **Portability** | JSON/CSV export | matric-memory |
| **Consent** | Opt-in for optional features | SPA (UI) |

### 4.2 Telemetry Policy

**No telemetry collection in HotM SPA**.

| Category | Policy | Rationale |
|----------|--------|-----------|
| Usage analytics | **PROHIBITED** | Privacy commitment |
| Error tracking (Sentry) | **OPTIONAL** (must sanitize PII) | Debugging needs |
| Performance monitoring | **OPTIONAL** (no content data) | Performance optimization |
| Feature flags | **ALLOWED** (no user tracking) | Product development |

If error tracking is implemented:
- Must sanitize all PII before transmission
- Must be opt-in, not opt-out
- Must use self-hosted error tracking or GDPR-compliant service
- Must document in privacy policy

### 4.3 Session Management

| Aspect | Implementation | Rationale |
|--------|----------------|-----------|
| Access tokens | In-memory only (React state) | XSS protection |
| Refresh tokens | httpOnly cookies | Not accessible to JavaScript |
| Session duration | 30 minutes idle timeout | Abandoned session protection |
| Logout | Clear all tokens, server-side invalidation | Complete session termination |
| Concurrent sessions | Limited (e.g., 5 active) | Reduce attack surface |

### 4.4 Data Minimization

The SPA implements data minimization:

| Practice | Implementation |
|----------|----------------|
| Request only needed fields | GraphQL or sparse fieldsets (if supported) |
| Don't cache sensitive data | No localStorage for note content |
| Clear data on logout | Wipe React Query cache, clear cookies |
| Paginate large responses | Don't load entire note history at once |

---

## 5. Consequences

### 5.1 Positive Consequences

1. **Clear Privacy Expectations**: Users understand data flows to matric-memory server
2. **Regulatory Compliance Path**: GDPR/CCPA compliance achievable through documented processes
3. **Self-Hosting Option**: Privacy-conscious users can self-host matric-memory
4. **Browser Security**: No sensitive data persisted in browser storage
5. **Centralized Security**: Security controls managed at API layer (matric-memory)
6. **Scalable Model**: Supports 100+ users without per-user privacy infrastructure

### 5.2 Negative Consequences

1. **ADR-003 Supersession**: Local-first privacy no longer guaranteed for SPA users
2. **Trust Requirement**: Users must trust matric-memory operator (unless self-hosted)
3. **Network Dependency**: Privacy protections depend on network security (TLS)
4. **Shared Responsibility**: Privacy requires coordination between SPA and matric-memory teams
5. **Compliance Burden**: GDPR/CCPA requirements now apply (data processing occurs)

### 5.3 Neutral Consequences

1. **Documentation Required**: Privacy policy must be published for SPA
2. **User Communication**: Must clearly explain data residency during onboarding
3. **Audit Requirements**: May need to demonstrate compliance to enterprise customers

---

## 6. Deployment-Specific Privacy Models

### 6.1 Self-Hosted matric-memory (Privacy-Preserving)

For users/organizations running their own matric-memory instance:

| Aspect | Status | Notes |
|--------|--------|-------|
| Data sovereignty | **PRESERVED** | Data stays on user's infrastructure |
| Third-party access | **NONE** | No external parties involved |
| GDPR/CCPA | User's responsibility | User is both controller and processor |
| ADR-003 principles | **MOSTLY PRESERVED** | Data still local to user's control |
| Privacy policy | Optional | May not be required for personal use |

**Recommendation**: Encourage privacy-conscious users to self-host matric-memory.

### 6.2 Hosted matric-memory (SaaS Model)

For users connecting to a hosted matric-memory service:

| Aspect | Status | Notes |
|--------|--------|-------|
| Data sovereignty | **PROVIDER-CONTROLLED** | Data on provider's infrastructure |
| Third-party access | **PROVIDER HAS ACCESS** | Provider can technically access data |
| GDPR/CCPA | Provider responsibility | Requires DPA, compliance certifications |
| ADR-003 principles | **NOT PRESERVED** | Data leaves user's control |
| Privacy policy | **REQUIRED** | Must document data handling practices |

**Requirements for hosted deployment**:
1. Data Processing Agreement (DPA) with users
2. Published privacy policy
3. GDPR compliance documentation (for EU users)
4. SOC 2 or equivalent certification (recommended for enterprise)
5. Encryption at rest verification

---

## 7. GDPR/Privacy Compliance

### 7.1 Data Processing Roles

| Role | Entity | Responsibilities |
|------|--------|------------------|
| **Data Subject** | End user | Owns their personal data |
| **Data Controller** | SPA operator (or user if self-hosted) | Determines purposes of processing |
| **Data Processor** | matric-memory operator | Processes data on behalf of controller |

### 7.2 Lawful Basis for Processing

| Processing Activity | Lawful Basis | Notes |
|--------------------|--------------|-------|
| Note storage and retrieval | Contract performance | Core service functionality |
| AI-powered features (summarization) | Legitimate interest | Enhances user experience |
| Search indexing | Contract performance | Core service functionality |
| Authentication | Contract performance | Account security |
| Optional analytics | Consent | Must be opt-in |

### 7.3 Required Documentation

| Document | Owner | Location |
|----------|-------|----------|
| Privacy Policy | SPA operator | Published on SPA website |
| Data Processing Agreement | matric-memory operator | Contract with users |
| Cookie Policy | SPA operator | Published on SPA website |
| Data Retention Policy | matric-memory operator | Internal documentation |
| Breach Notification Procedure | Both | Incident response plan |

### 7.4 User Rights Implementation

| GDPR Right | Implementation | Endpoint/Process |
|------------|----------------|------------------|
| Right to Access | Export all user data | `GET /api/v1/export` |
| Right to Rectification | Edit functionality | Standard CRUD APIs |
| Right to Erasure | Account deletion | `DELETE /api/v1/account` |
| Right to Portability | JSON/CSV export | `GET /api/v1/export?format=json` |
| Right to Object | Opt-out of optional processing | Settings UI |
| Right to Restriction | Disable account without deletion | Account settings |

---

## 8. Security Controls for Privacy

### 8.1 Technical Controls

| Control | Implementation | Protects Against |
|---------|----------------|------------------|
| TLS 1.2+ | All connections encrypted | Network eavesdropping |
| httpOnly cookies | Tokens not accessible to JS | XSS token theft |
| CORS restrictions | Whitelist SPA origin only | Cross-origin attacks |
| CSP headers | Restrict script sources | XSS injection |
| Input sanitization | Server-side validation | Injection attacks |
| Rate limiting | API request limits | Enumeration attacks |

### 8.2 Organizational Controls

| Control | Implementation | Frequency |
|---------|----------------|-----------|
| Access reviews | Review who has server access | Quarterly |
| Security training | Team privacy awareness | Annual |
| Penetration testing | External security assessment | Annual (production) |
| Audit log reviews | Review access patterns | Monthly |
| Incident response drills | Test breach procedures | Annual |

---

## 9. Implementation Checklist

### 9.1 SPA Implementation

- [ ] No note content in localStorage/sessionStorage
- [ ] Access tokens in memory only (React state)
- [ ] Refresh tokens in httpOnly cookies
- [ ] Logout clears all cached data
- [ ] No analytics/telemetry collection
- [ ] Error tracking sanitizes PII (if implemented)
- [ ] Data residency indicator in UI
- [ ] Privacy policy link in footer
- [ ] Cookie consent banner (if cookies used)

### 9.2 API Integration

- [ ] All API calls over HTTPS
- [ ] Bearer token authentication
- [ ] API errors don't expose sensitive data
- [ ] Export API endpoint available
- [ ] Account deletion API endpoint available

### 9.3 Documentation

- [ ] Privacy policy published
- [ ] Cookie policy published (if applicable)
- [ ] Data handling documented in CLAUDE.md
- [ ] User onboarding explains data residency

---

## 10. Related Documents

| Document | Relationship |
|----------|--------------|
| **ADR-003**: Local-First Privacy | Superseded for SPA deployment |
| **ADR-004**: SPA Migration | Establishes SPA architecture |
| **migration-security-assessment.md** | Security implications of migration |
| **spa-security-config.md** | Technical security configuration |
| **secrets-management-policy.md** | Credential handling |

---

## 11. Alternatives Considered

### 11.1 Client-Side Encryption (E2EE)

**Approach**: Encrypt all note content client-side before sending to server

**Pros**:
- Server never sees plaintext content
- Privacy preserved even with untrusted server
- Maintains ADR-003 spirit

**Cons**:
- **Breaks server-side search**: Cannot search encrypted content
- **Breaks NLP features**: Cannot summarize/analyze encrypted content
- **Key management complexity**: User must manage encryption keys
- **Recovery impossible**: Lost key = lost data

**Decision**: Rejected. Core features (search, NLP) require server-side content access. E2EE fundamentally incompatible with current feature set.

### 11.2 Federated Architecture

**Approach**: Each user runs their own matric-memory instance, SPA connects to user's server

**Pros**:
- True data sovereignty (ADR-003 preserved)
- No central point of trust
- GDPR compliance by design

**Cons**:
- **Deployment complexity**: Every user needs server infrastructure
- **Not scalable**: Cannot serve 100+ non-technical users
- **Support burden**: Must support many deployment configurations
- **Defeats web accessibility goal**: Back to desktop-like complexity

**Decision**: Rejected as primary model. Self-hosting remains an option for privacy-conscious users.

### 11.3 Hybrid Approach (Local + Cloud Sync)

**Approach**: Keep local-first with optional cloud sync via E2EE

**Pros**:
- Preserves ADR-003 for local operations
- Sync available for users who want it
- Privacy-first default

**Cons**:
- **Maintains two architectures**: Desktop and web complexity
- **Search limitations**: Cloud-synced data can't use server search
- **Sync conflicts**: Complex merge logic needed
- **Not aligned with 100+ user goal**: Still requires local installation

**Decision**: Rejected. Does not address the goal of serving 100+ external users via web access.

---

## 12. Decision Rationale Summary

The SPA privacy model accepts the following trade-offs:

| Trade-off | Accepted Because |
|-----------|------------------|
| Data leaves user's device | Required for web-based multi-user access |
| Server operator can access data | Self-hosting option preserves privacy for concerned users |
| ADR-003 superseded for SPA | Desktop mode can still follow ADR-003 if maintained |
| GDPR/CCPA compliance required | Necessary for legitimate business operation |
| Trust in matric-memory operator | Industry-standard model; E2EE incompatible with features |

**Core Principle**: Privacy is achieved through **transparency, user control, and operator responsibility** rather than architectural isolation.

---

## 13. Decision Log

| Date | Action | Notes |
|------|--------|-------|
| 2026-01-30 | Migration security assessment | Identified need for ADR-007 |
| 2026-01-31 | ADR-007 drafted | Initial privacy model defined |
| 2026-01-31 | Status: ACCEPTED | Approved by Security Architect |

---

## 14. Review Schedule

| Review Type | Frequency | Trigger |
|-------------|-----------|---------|
| Annual review | 12 months | Calendar |
| Regulation change | As needed | GDPR/CCPA updates |
| Architecture change | As needed | Major SPA changes |
| Incident-triggered | As needed | Privacy incident |

**Next Review**: 2027-01-31 or upon significant architecture change

---

**Approved by**: Security Architect, Development Team
**Effective Date**: 2026-01-31

---

*End of ADR-007: SPA Privacy Model for HotM*
