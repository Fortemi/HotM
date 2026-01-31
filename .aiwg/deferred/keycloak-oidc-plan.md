# Keycloak OIDC Authentication Plan (Deferred)

**Project**: HotM (Hall Of The Mind)
**Document Version**: 1.0
**Status**: DEFERRED (Post-MVP)
**Date**: 2026-01-31
**Author**: Security Architect
**Related Issues**: #60
**Related Documents**: migration-security-assessment.md, spa-security-config.md, secure-token-storage-plan.md

---

## 1. Executive Summary

This document outlines the plan for implementing Keycloak OIDC authentication for the HotM SPA. This feature is intentionally deferred to post-MVP to allow focus on core functionality while the application operates with basic API key authentication via the matric-memory backend.

**Deferral Rationale**:
- MVP targets limited user base with existing matric-memory API key model
- Keycloak infrastructure requires significant setup and operational overhead
- OIDC complexity warrants dedicated implementation sprint
- Current matric-memory authentication is sufficient for initial deployment

**Trigger for Implementation**:
- Production traffic exceeds 50 concurrent users
- Enterprise customer demand for SSO integration
- Regulatory/compliance requirements mandate identity provider
- matric-memory team readies OIDC support

---

## 2. Current State

### 2.1 Authentication Model (MVP)

| Aspect | Current Implementation |
|--------|----------------------|
| **Auth Provider** | matric-memory API backend |
| **Auth Method** | API key / Bearer token |
| **Token Type** | Simple bearer tokens |
| **Token Storage** | In-memory (React state) |
| **Session Management** | Backend-managed via matric-memory |
| **Multi-tenancy** | Single tenant per deployment |

### 2.2 Current Flow

```
┌─────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  HotM SPA   │─────>│ matric-memory   │─────>│   PostgreSQL    │
│  (React)    │      │  API Server     │      │   + pgvector    │
└─────────────┘      └─────────────────┘      └─────────────────┘
       │
       └── Bearer token in Authorization header
           (obtained via matric-memory auth endpoint)
```

### 2.3 Current Limitations

| Limitation | Impact | Addressed by OIDC |
|------------|--------|-------------------|
| No SSO integration | Users maintain separate credentials | Yes |
| No MFA support | Reduced security for sensitive data | Yes |
| Limited session controls | No centralized session management | Yes |
| No enterprise identity federation | Cannot integrate with corporate directories | Yes |
| Basic audit trail | Limited visibility into auth events | Yes |

---

## 3. Future State (Keycloak OIDC)

### 3.1 Target Architecture

```
┌─────────────┐      OIDC Flow        ┌─────────────────┐
│  HotM SPA   │<───────────────────-->│    Keycloak     │
│  (React)    │  Authorization Code   │  OIDC Provider  │
└──────┬──────┘      + PKCE           └─────────────────┘
       │                                      │
       │ Bearer Token                         │ Token Validation
       │ (Access Token)                       │
       v                                      v
┌─────────────────┐              ┌─────────────────┐
│ matric-memory   │<─────────────│   Keycloak      │
│  API Server     │  (optional)  │   Token Intro.  │
└─────────────────┘              └─────────────────┘
```

### 3.2 OIDC Configuration Target

| Setting | Value | Notes |
|---------|-------|-------|
| **Flow** | Authorization Code + PKCE | Most secure for SPAs |
| **Client Type** | Public client | No client secret in frontend |
| **Access Token TTL** | 15-30 minutes | Short-lived for security |
| **Refresh Token TTL** | 24-72 hours | Based on session requirements |
| **Token Storage** | In-memory (access), httpOnly cookie (refresh) | See secure-token-storage-plan.md |
| **Scopes** | openid, profile, email, hotm:notes | Custom scope for API access |

### 3.3 Benefits

| Benefit | Description |
|---------|-------------|
| **SSO** | Single sign-on across Keycloak-integrated applications |
| **MFA** | Multi-factor authentication support (TOTP, WebAuthn) |
| **Federation** | LDAP, Active Directory, SAML, social providers |
| **Session Management** | Centralized session control, single logout |
| **Audit Logging** | Comprehensive authentication event logging |
| **Standards Compliance** | OIDC/OAuth2 compliance for enterprise requirements |

---

## 4. Implementation Plan

### 4.1 Phase 1: Keycloak Infrastructure (Week 1-2)

#### 4.1.1 Server Deployment Options

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Docker Compose** | Simple setup, portable | Manual HA configuration | Development/Staging |
| **Kubernetes** | Scalable, HA built-in | Complex setup | Production |
| **Managed Service** | Zero ops overhead | Vendor lock-in, cost | Enterprise |

#### 4.1.2 Docker Compose Setup (Development)

```yaml
# docker-compose.keycloak.yml
version: '3.8'

services:
  keycloak:
    image: quay.io/keycloak/keycloak:23.0
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://keycloak-db:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: ${KC_DB_PASSWORD}
      KC_HOSTNAME: auth.example.com
      KC_PROXY: edge
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: ${KC_ADMIN_PASSWORD}
    command:
      - start
      - --optimized
    ports:
      - "8180:8080"
    depends_on:
      - keycloak-db
    volumes:
      - ./keycloak/themes:/opt/keycloak/themes

  keycloak-db:
    image: postgres:15
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: ${KC_DB_PASSWORD}
    volumes:
      - keycloak-db-data:/var/lib/postgresql/data

volumes:
  keycloak-db-data:
```

#### 4.1.3 Realm Configuration

```json
{
  "realm": "hotm",
  "enabled": true,
  "sslRequired": "external",
  "registrationAllowed": false,
  "loginWithEmailAllowed": true,
  "duplicateEmailsAllowed": false,
  "resetPasswordAllowed": true,
  "editUsernameAllowed": false,
  "bruteForceProtected": true,
  "permanentLockout": false,
  "maxFailureWaitSeconds": 900,
  "minimumQuickLoginWaitSeconds": 60,
  "waitIncrementSeconds": 60,
  "quickLoginCheckMilliSeconds": 1000,
  "maxDeltaTimeSeconds": 43200,
  "failureFactor": 5,
  "accessTokenLifespan": 1800,
  "accessTokenLifespanForImplicitFlow": 900,
  "ssoSessionIdleTimeout": 1800,
  "ssoSessionMaxLifespan": 36000,
  "offlineSessionIdleTimeout": 2592000,
  "accessCodeLifespan": 60,
  "accessCodeLifespanUserAction": 300,
  "accessCodeLifespanLogin": 1800,
  "actionTokenGeneratedByAdminLifespan": 43200,
  "actionTokenGeneratedByUserLifespan": 300,
  "defaultSignatureAlgorithm": "RS256"
}
```

### 4.2 Phase 2: OIDC Client Configuration (Week 2)

#### 4.2.1 Client Settings

| Setting | Value |
|---------|-------|
| Client ID | `hotm-spa` |
| Client Protocol | openid-connect |
| Access Type | public |
| Standard Flow Enabled | true |
| Implicit Flow Enabled | false |
| Direct Access Grants Enabled | false |
| Valid Redirect URIs | `https://hotm.example.com/*`, `http://localhost:5173/*` |
| Web Origins | `https://hotm.example.com`, `http://localhost:5173` |
| Backchannel Logout Session Required | true |

#### 4.2.2 Client Scope Configuration

```json
{
  "name": "hotm:notes",
  "description": "Access to HotM notes API",
  "protocol": "openid-connect",
  "attributes": {
    "include.in.token.scope": "true",
    "display.on.consent.screen": "true",
    "consent.screen.text": "Access your notes and analysis data"
  },
  "protocolMappers": [
    {
      "name": "audience-mapper",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "consentRequired": false,
      "config": {
        "included.client.audience": "matric-memory-api",
        "id.token.claim": "false",
        "access.token.claim": "true"
      }
    }
  ]
}
```

### 4.3 Phase 3: React Integration (Week 2-3)

#### 4.3.1 Dependencies

```json
{
  "dependencies": {
    "@react-keycloak/web": "^3.4.0",
    "keycloak-js": "^23.0.0"
  }
}
```

#### 4.3.2 Keycloak Provider Setup

```typescript
// src/auth/keycloak.ts
import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: import.meta.env.VITE_OIDC_AUTHORITY || 'https://auth.example.com',
  realm: 'hotm',
  clientId: 'hotm-spa',
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;
```

```typescript
// src/auth/AuthProvider.tsx
import { ReactKeycloakProvider } from '@react-keycloak/web';
import keycloak from './keycloak';

const initOptions = {
  onLoad: 'check-sso',
  silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html',
  pkceMethod: 'S256',
  checkLoginIframe: false,
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <ReactKeycloakProvider
      authClient={keycloak}
      initOptions={initOptions}
      onEvent={(event, error) => {
        console.log('Keycloak event:', event, error);
      }}
      onTokens={(tokens) => {
        // Token refresh handling
        if (tokens.token) {
          // Update API client with new token
          apiClient.setAuthToken(tokens.token);
        }
      }}
    >
      {children}
    </ReactKeycloakProvider>
  );
}
```

#### 4.3.3 Protected Routes

```typescript
// src/auth/ProtectedRoute.tsx
import { useKeycloak } from '@react-keycloak/web';
import { Navigate, Outlet } from 'react-router-dom';

export function ProtectedRoute() {
  const { keycloak, initialized } = useKeycloak();

  if (!initialized) {
    return <LoadingSpinner />;
  }

  if (!keycloak.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

#### 4.3.4 Auth Hook

```typescript
// src/auth/useAuth.ts
import { useKeycloak } from '@react-keycloak/web';

export function useAuth() {
  const { keycloak, initialized } = useKeycloak();

  const login = () => keycloak.login();
  const logout = () => keycloak.logout({ redirectUri: window.location.origin });
  const register = () => keycloak.register();

  const getToken = async () => {
    try {
      // Refresh token if expired or expiring soon (within 30 seconds)
      if (keycloak.isTokenExpired(30)) {
        await keycloak.updateToken(30);
      }
      return keycloak.token;
    } catch (error) {
      console.error('Failed to refresh token:', error);
      keycloak.login();
      return null;
    }
  };

  return {
    initialized,
    authenticated: keycloak.authenticated,
    user: keycloak.tokenParsed,
    login,
    logout,
    register,
    getToken,
    hasRole: (role: string) => keycloak.hasRealmRole(role),
    hasResourceRole: (role: string, resource: string) =>
      keycloak.hasResourceRole(role, resource),
  };
}
```

### 4.4 Phase 4: Token Refresh Handling (Week 3)

#### 4.4.1 Automatic Token Refresh

```typescript
// src/auth/tokenRefresh.ts
import keycloak from './keycloak';

const MIN_TOKEN_VALIDITY = 30; // seconds

export function setupTokenRefresh() {
  // Check token validity every 10 seconds
  setInterval(() => {
    if (keycloak.authenticated) {
      keycloak.updateToken(MIN_TOKEN_VALIDITY)
        .then((refreshed) => {
          if (refreshed) {
            console.log('Token refreshed');
            // Update API client
            apiClient.setAuthToken(keycloak.token!);
          }
        })
        .catch(() => {
          console.error('Token refresh failed');
          // Force re-login
          keycloak.login();
        });
    }
  }, 10000);
}

// Also refresh before API calls
export async function ensureValidToken(): Promise<string | null> {
  if (!keycloak.authenticated) {
    return null;
  }

  try {
    await keycloak.updateToken(MIN_TOKEN_VALIDITY);
    return keycloak.token!;
  } catch {
    keycloak.login();
    return null;
  }
}
```

#### 4.4.2 API Client Integration

```typescript
// src/api/client.ts
import { ensureValidToken } from '../auth/tokenRefresh';

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  setAuthToken(token: string) {
    this.token = token;
  }

  async fetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    // Ensure token is valid before request
    const token = await ensureValidToken();

    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401) {
      // Token invalid despite refresh - force re-login
      keycloak.login();
      throw new Error('Authentication expired');
    }

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return response.json();
  }
}

export const apiClient = new ApiClient(import.meta.env.VITE_API_URL);
```

### 4.5 Phase 5: Backend Integration (Week 3)

#### 4.5.1 matric-memory OIDC Support

**Prerequisites**:
- matric-memory team must implement OIDC token validation
- Keycloak realm public key must be available to API server

**Token Validation Flow**:
```
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  HotM SPA   │────>│ matric-memory   │────>│    Keycloak     │
│             │     │                 │     │ JWKS Endpoint   │
└─────────────┘     └─────────────────┘     └─────────────────┘
     │                    │                        │
     │ Authorization:     │ 1. Extract JWT         │
     │ Bearer <token>     │ 2. Verify signature    │
     │                    │    (cached JWKS)       │
     │                    │ 3. Validate claims     │
     │                    │    (aud, exp, iss)     │
     │                    │ 4. Extract user info   │
```

#### 4.5.2 Keycloak JWKS Configuration

```bash
# JWKS endpoint for matric-memory to fetch public keys
KEYCLOAK_JWKS_URL=https://auth.example.com/realms/hotm/protocol/openid-connect/certs

# Issuer for token validation
KEYCLOAK_ISSUER=https://auth.example.com/realms/hotm

# Expected audience
KEYCLOAK_AUDIENCE=matric-memory-api
```

---

## 5. Prerequisites

### 5.1 Infrastructure Prerequisites

| Prerequisite | Description | Owner |
|--------------|-------------|-------|
| Keycloak server | Production-ready Keycloak deployment | DevOps |
| TLS certificates | Valid certificates for auth.example.com | DevOps |
| PostgreSQL database | Database for Keycloak | DevOps |
| DNS configuration | auth.example.com pointing to Keycloak | DevOps |
| Load balancer | For Keycloak HA (production) | DevOps |

### 5.2 Application Prerequisites

| Prerequisite | Description | Owner |
|--------------|-------------|-------|
| matric-memory OIDC support | Backend token validation | matric-memory team |
| API scope definition | Custom scopes for API access | Security Architect |
| User provisioning process | How users get accounts | Product Owner |
| Role definitions | Roles needed for authorization | Product Owner |

### 5.3 Operational Prerequisites

| Prerequisite | Description | Owner |
|--------------|-------------|-------|
| Runbook for Keycloak | Operational documentation | DevOps |
| Monitoring/alerting | Keycloak health monitoring | DevOps |
| Backup strategy | Keycloak database backups | DevOps |
| Incident response | Auth-specific incident procedures | Security Architect |

---

## 6. Effort Estimation

### 6.1 Effort Breakdown

| Phase | Tasks | Effort (Days) |
|-------|-------|---------------|
| **Phase 1: Infrastructure** | Keycloak deployment, realm setup | 3-4 days |
| **Phase 2: Client Configuration** | OIDC client, scopes, roles | 1-2 days |
| **Phase 3: React Integration** | Auth provider, hooks, routes | 3-4 days |
| **Phase 4: Token Handling** | Refresh logic, API integration | 2-3 days |
| **Phase 5: Backend Integration** | matric-memory coordination | 2-3 days |
| **Testing & QA** | Auth flows, edge cases | 3-4 days |
| **Documentation** | User docs, runbooks | 1-2 days |

**Total Estimated Effort**: 15-22 days (2-3 weeks)

### 6.2 Team Requirements

| Role | Allocation | Duration |
|------|------------|----------|
| DevOps Engineer | 50% | Week 1-2 |
| Frontend Developer | 100% | Week 2-3 |
| matric-memory Developer | 25% | Week 3 |
| Security Architect | 25% | Throughout |
| QA Engineer | 50% | Week 3 |

---

## 7. Dependencies

### 7.1 External Dependencies

| Dependency | Status | Mitigation |
|------------|--------|------------|
| matric-memory OIDC support | Not implemented | Track matric-memory roadmap |
| Keycloak infrastructure | Not provisioned | DevOps planning required |
| TLS certificates | Available | Use existing cert process |
| DNS configuration | Available | Use existing DNS process |

### 7.2 Internal Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Stable SPA deployment | MVP in progress | Must be complete before auth work |
| API client abstraction | In progress | Required for token injection |
| Route protection patterns | Not implemented | Part of auth implementation |

---

## 8. Risk Assessment

### 8.1 Implementation Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Keycloak complexity | Medium | Medium | Start with minimal configuration |
| Token refresh edge cases | Medium | High | Comprehensive testing matrix |
| matric-memory integration delays | Medium | High | Early coordination, fallback auth |
| User migration (if existing users) | Low | Medium | Phased rollout, dual auth period |

### 8.2 Operational Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Keycloak availability | Low | Critical | HA deployment, monitoring |
| Token validation performance | Low | Medium | JWKS caching, key rotation planning |
| Session synchronization | Medium | Low | Clear session management policy |

---

## 9. Security Considerations

### 9.1 OIDC Security Best Practices

| Practice | Implementation |
|----------|----------------|
| PKCE required | S256 challenge method enforced |
| No implicit flow | Disabled in client configuration |
| Short-lived access tokens | 15-30 minute TTL |
| Secure token storage | See secure-token-storage-plan.md |
| State parameter | Automatic with keycloak-js |
| Nonce validation | Automatic with keycloak-js |

### 9.2 Attack Vectors Addressed

| Attack | Mitigation |
|--------|------------|
| Authorization Code Interception | PKCE prevents code reuse |
| Token Theft (XSS) | Short TTL, httpOnly refresh tokens |
| CSRF | State parameter, SameSite cookies |
| Session Fixation | New session on login |
| Open Redirect | Strict redirect URI validation |

---

## 10. Success Criteria

### 10.1 Functional Criteria

- [ ] Users can authenticate via Keycloak login page
- [ ] Access tokens are automatically refreshed before expiry
- [ ] Logout terminates session on both client and Keycloak
- [ ] Protected routes redirect unauthenticated users
- [ ] API requests include valid bearer tokens
- [ ] Token refresh handles network failures gracefully

### 10.2 Non-Functional Criteria

- [ ] Authentication flow completes in < 3 seconds
- [ ] Token refresh is imperceptible to users
- [ ] Keycloak availability > 99.9%
- [ ] Zero secrets exposed in frontend code

### 10.3 Security Criteria

- [ ] All OIDC security best practices implemented
- [ ] Security review passed before production
- [ ] Penetration test includes auth flows
- [ ] Audit logging captures all auth events

---

## Document Control

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | DEFERRED |
| Author | Security Architect |
| Date | 2026-01-31 |
| Trigger for Implementation | Production traffic > 50 users OR enterprise demand |
| Estimated Implementation | 2-3 weeks |
| Related Issues | #60 |
| Related Documents | migration-security-assessment.md, secure-token-storage-plan.md |

---

*End of Keycloak OIDC Authentication Plan*
