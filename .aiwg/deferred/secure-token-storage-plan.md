# Secure Token Storage Plan (Deferred)

**Project**: HotM (Hall Of The Mind)
**Document Version**: 1.0
**Status**: DEFERRED (Post-MVP)
**Date**: 2026-01-31
**Author**: Security Architect
**Related Issues**: #61
**Related Documents**: migration-security-assessment.md, keycloak-oidc-plan.md

---

## 1. Executive Summary

This document outlines secure token storage strategies for the HotM SPA post-OIDC implementation. Token storage is a critical security decision for browser-based applications, balancing XSS protection against CSRF risks and user experience requirements.

**Deferral Rationale**:
- Token storage strategy depends on OIDC implementation (Issue #60)
- Current MVP uses simple in-memory tokens (adequate for limited deployment)
- Advanced storage mechanisms require careful security analysis
- Implementation should follow OIDC integration, not precede it

**Estimated Effort**: 1 week (after OIDC implementation)

---

## 2. Current State

### 2.1 MVP Token Handling

| Aspect | Current Implementation | Security Level |
|--------|----------------------|----------------|
| **Storage Location** | React state (in-memory) | HIGH |
| **Persistence** | None (lost on refresh) | N/A |
| **XSS Vulnerability** | Minimal (not in DOM-accessible storage) | LOW |
| **CSRF Vulnerability** | N/A (not using cookies) | N/A |
| **User Experience** | Re-authentication on page refresh | POOR |

### 2.2 Current Limitations

| Limitation | User Impact |
|------------|-------------|
| Token lost on page refresh | User must re-authenticate |
| Token lost on new tab | Each tab requires separate auth |
| No silent SSO | Visible redirect on session resume |
| No background token refresh | Potential session interruption |

---

## 3. Token Storage Options Analysis

### 3.1 Comparison Matrix

| Storage Method | XSS Protection | CSRF Protection | Persistence | Complexity |
|----------------|---------------|-----------------|-------------|------------|
| **In-memory (React state)** | Excellent | N/A | None | Low |
| **sessionStorage** | Poor | N/A | Tab lifetime | Low |
| **localStorage** | Poor | N/A | Permanent | Low |
| **HttpOnly cookies** | Excellent | Requires mitigation | Configurable | Medium |
| **IndexedDB with encryption** | Medium | N/A | Permanent | High |
| **Browser Credential API** | Excellent | N/A | Permanent | High |

### 3.2 Security Trade-offs

#### 3.2.1 XSS vs CSRF

**XSS (Cross-Site Scripting)**:
- Attack where malicious scripts run in user's browser context
- Can steal tokens from JavaScript-accessible storage (localStorage, sessionStorage)
- Mitigations: CSP, input sanitization, avoiding token in JS-accessible storage

**CSRF (Cross-Site Request Forgery)**:
- Attack where malicious site triggers requests to HotM using user's cookies
- Only applies when authentication relies on automatically-sent cookies
- Mitigations: SameSite cookies, CSRF tokens, origin validation

**Key Insight**: There is an inherent trade-off:
- JavaScript-accessible storage = Vulnerable to XSS, immune to CSRF
- HttpOnly cookies = Immune to XSS, vulnerable to CSRF (requires mitigation)

#### 3.2.2 Recommendation

**Primary Strategy**: HttpOnly cookies for refresh tokens + In-memory for access tokens

| Token Type | Storage | Rationale |
|------------|---------|-----------|
| Access Token | In-memory (React state) | Short-lived, XSS-resistant, used for API calls |
| Refresh Token | HttpOnly cookie | Long-lived, completely XSS-immune, handles session persistence |

---

## 4. Implementation Options

### 4.1 Option A: HttpOnly Cookies (Recommended)

**Architecture**:
```
┌─────────────┐                           ┌─────────────────┐
│  HotM SPA   │                           │    Keycloak     │
│             │── 1. Login ──────────────>│                 │
│             │<─ 2. Set-Cookie: ─────────│ (httpOnly,      │
│             │    refresh_token          │  Secure,        │
│             │                           │  SameSite=Lax)  │
│             │                           └─────────────────┘
│             │
│             │── 3. /token/refresh ─────>┌─────────────────┐
│             │   (cookie auto-sent)      │   Token BFF     │
│             │<─ 4. access_token (JSON)──│   (Backend)     │
│             │                           └─────────────────┘
│             │
│             │── 5. API Request ────────>┌─────────────────┐
│             │   Authorization: Bearer   │ matric-memory   │
│             │   <access_token>          │     API         │
│             │<─ 6. Response ────────────│                 │
└─────────────┘                           └─────────────────┘
```

**Implementation Requirements**:

1. **Backend for Frontend (BFF)** - A lightweight backend component that:
   - Sets httpOnly cookies after Keycloak authentication
   - Provides a `/token/refresh` endpoint that reads the refresh token cookie
   - Returns new access tokens to the SPA

2. **Cookie Configuration**:
```
Set-Cookie: refresh_token=<value>;
  HttpOnly;
  Secure;
  SameSite=Lax;
  Path=/api/auth;
  Max-Age=2592000
```

3. **CSRF Mitigation**:
   - `SameSite=Lax` prevents CSRF from cross-origin POST
   - Origin header validation on BFF endpoints
   - Optional: Double-submit cookie pattern

**Pros**:
- Refresh tokens completely invisible to JavaScript
- XSS cannot steal refresh tokens
- Automatic token refresh without user credentials
- Industry best practice for SPAs

**Cons**:
- Requires backend component (BFF)
- Additional infrastructure complexity
- Cookie management across subdomains can be complex

### 4.2 Option B: Browser Credential Management API

**Architecture**:
```
┌─────────────┐                           ┌─────────────────┐
│  HotM SPA   │── navigator.credentials   │   Browser       │
│             │   .store() ──────────────>│   Credential    │
│             │                           │   Manager       │
│             │<─ navigator.credentials ──│                 │
│             │   .get()                  └─────────────────┘
└─────────────┘
```

**Implementation**:

```typescript
// Store credential after successful authentication
async function storeCredential(token: string, username: string) {
  if ('credentials' in navigator && 'PasswordCredential' in window) {
    const credential = new PasswordCredential({
      id: username,
      password: token,
      name: 'HotM Access',
    });

    await navigator.credentials.store(credential);
  }
}

// Retrieve credential for silent re-authentication
async function getStoredCredential() {
  if ('credentials' in navigator) {
    const credential = await navigator.credentials.get({
      password: true,
      mediation: 'silent', // No UI prompt
    });

    return credential?.password;
  }
  return null;
}
```

**Pros**:
- Browser-managed secure storage
- Works with browser password managers
- Silent authentication possible
- Native browser security

**Cons**:
- Limited browser support (primarily Chrome, Edge)
- Designed for passwords, not tokens (semantic mismatch)
- User can delete credentials
- Not suitable for refresh tokens (no auto-renewal)

### 4.3 Option C: IndexedDB with Encryption

**Architecture**:
```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  HotM SPA   │────>│   Web Crypto    │────>│   IndexedDB     │
│             │     │   API           │     │   (encrypted)   │
│  Token ─────│─────│───> Encrypt ────│─────│───> Store       │
│             │     │                 │     │                 │
│  <───────── │─────│─── Decrypt <────│─────│─── Retrieve     │
└─────────────┘     └─────────────────┘     └─────────────────┘
```

**Implementation**:

```typescript
// Generate encryption key (stored separately, e.g., derived from user input)
async function generateKey(): Promise<CryptoKey> {
  return await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

// Encrypt token before storage
async function encryptToken(token: string, key: CryptoKey): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token)
  );

  // Prepend IV to ciphertext
  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv);
  result.set(new Uint8Array(encrypted), iv.length);

  return result.buffer;
}

// Store in IndexedDB
async function storeEncryptedToken(encrypted: ArrayBuffer) {
  const db = await openDatabase();
  const tx = db.transaction('tokens', 'readwrite');
  tx.objectStore('tokens').put({ id: 'refresh', data: encrypted });
  await tx.complete;
}
```

**Pros**:
- Large storage capacity
- Persistent across sessions
- Encryption adds security layer
- No server-side component needed

**Cons**:
- Encryption key must be stored somewhere (chicken-egg problem)
- Vulnerable to XSS if key is derived from accessible data
- Complex implementation
- Browser DevTools can still access IndexedDB
- Encryption doesn't prevent XSS extraction (script can use the same encryption flow)

---

## 5. Recommended Strategy

### 5.1 Recommended Approach: HttpOnly Cookies + In-Memory

Based on security analysis, the recommended approach for HotM is:

| Token Type | Storage | Rationale |
|------------|---------|-----------|
| **Access Token** | In-memory (React context) | Short TTL, used for API calls, tolerable if stolen briefly |
| **Refresh Token** | HttpOnly cookie (server-set) | Long TTL, critical for session, must be XSS-immune |

### 5.2 Implementation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         HotM SPA (Browser)                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────────┐     ┌──────────────────────────────┐    │
│   │  React AuthContext│     │   Token Refresh Service      │    │
│   │                  │     │                              │    │
│   │  accessToken ────│─────│── Schedules refresh before  │    │
│   │  (in-memory)     │     │   token expiry               │    │
│   │                  │     │                              │    │
│   │  isAuthenticated │     │── Calls /api/auth/refresh    │    │
│   │  user            │     │   (cookie sent automatically)│    │
│   └──────────────────┘     └──────────────────────────────┘    │
│                                                                  │
└────────────────────────────────┬────────────────────────────────┘
                                 │
                    API Requests │ Authorization: Bearer <accessToken>
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Nginx (Reverse Proxy)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   /api/auth/*  ──────────────────────────>  Auth BFF Service    │
│                                              (token endpoint)    │
│                                                                  │
│   /api/v1/*    ──────────────────────────>  matric-memory API   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Auth BFF Service

A minimal backend service is required for httpOnly cookie management:

**Endpoints**:

| Endpoint | Method | Purpose | Cookie Handling |
|----------|--------|---------|-----------------|
| `/api/auth/callback` | POST | Exchange auth code for tokens | Sets refresh_token cookie |
| `/api/auth/refresh` | POST | Exchange refresh for access | Reads refresh_token cookie |
| `/api/auth/logout` | POST | Terminate session | Clears refresh_token cookie |

**Implementation Options**:

1. **Nginx + Lua** - Lightweight, no additional service
2. **Node.js Express** - Simple, JavaScript ecosystem
3. **Rust + Axum** - Consistent with HotM backend
4. **matric-memory extension** - Integrate into existing API

---

## 6. Security Considerations

### 6.1 Cookie Security Configuration

```
Set-Cookie: refresh_token=<value>;
  HttpOnly;           # Cannot be accessed by JavaScript
  Secure;             # Only sent over HTTPS
  SameSite=Lax;       # CSRF protection (allows top-level navigation)
  Path=/api/auth;     # Only sent to auth endpoints
  Max-Age=2592000;    # 30 days (or match refresh token TTL)
  Domain=.example.com # If subdomains need access
```

### 6.2 CSRF Mitigation

| Mitigation | Implementation | Priority |
|------------|----------------|----------|
| SameSite=Lax | Cookie attribute | Required |
| Origin validation | BFF checks Origin header | Required |
| Referer validation | BFF checks Referer header | Recommended |
| Double-submit cookie | Anti-CSRF token pattern | Optional |

### 6.3 XSS Mitigation (Defense in Depth)

Even with httpOnly cookies, XSS should be prevented:

| Mitigation | Implementation | Status |
|------------|----------------|--------|
| CSP headers | Nginx configuration | Required |
| Input sanitization | React escaping, DOMPurify | Required |
| Subresource Integrity | Script SRI hashes | Recommended |
| Regular security audits | Automated + manual | Required |

---

## 7. Implementation Timeline

### 7.1 Prerequisites

- [ ] Keycloak OIDC implementation complete (Issue #60)
- [ ] Auth BFF service design approved
- [ ] Infrastructure for BFF provisioned

### 7.2 Implementation Phases

| Phase | Duration | Tasks |
|-------|----------|-------|
| **Phase 1: BFF Development** | 2 days | Implement auth endpoints, cookie handling |
| **Phase 2: SPA Integration** | 2 days | Update auth provider, token refresh logic |
| **Phase 3: Testing** | 2 days | Security testing, edge cases |
| **Phase 4: Documentation** | 1 day | Runbook updates, security documentation |

**Total Estimated Effort**: 1 week

### 7.3 Dependency Chain

```
Issue #60 (Keycloak OIDC)
    │
    ▼
Issue #61 (Secure Token Storage) <── This Plan
    │
    ▼
Issue #63 (Penetration Testing)
```

---

## 8. Testing Requirements

### 8.1 Functional Tests

| Test Case | Expected Result |
|-----------|-----------------|
| Login flow | Refresh token cookie set, access token in memory |
| Page refresh | Session persists via cookie refresh |
| New tab | Session shared via cookie |
| Logout | Cookie cleared, session terminated |
| Token expiry | Automatic refresh before expiry |
| Network failure during refresh | Graceful degradation, re-login prompt |

### 8.2 Security Tests

| Test Case | Expected Result |
|-----------|-----------------|
| XSS attempt to read refresh token | Token not accessible |
| CSRF POST to /api/auth/refresh | Request blocked (SameSite) |
| Cookie theft via DevTools | Cookie httpOnly, not visible in JS |
| Token replay after logout | Token invalid |
| Concurrent session limit | Enforced per policy |

---

## 9. Document Control

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | DEFERRED |
| Author | Security Architect |
| Date | 2026-01-31 |
| Trigger for Implementation | After Keycloak OIDC (Issue #60) |
| Estimated Implementation | 1 week |
| Related Issues | #61 |
| Related Documents | migration-security-assessment.md, keycloak-oidc-plan.md |

---

*End of Secure Token Storage Plan*
