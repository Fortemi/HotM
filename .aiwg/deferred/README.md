# Deferred Security Features

**Project**: HotM (Hall Of The Mind)
**Status**: Post-MVP Implementation Backlog
**Last Updated**: 2026-01-31

---

## Overview

This directory contains detailed implementation plans for security features that are intentionally deferred to post-MVP. These features are documented now to ensure:

1. **Clear implementation path** when triggers are met
2. **Effort estimation** for planning purposes
3. **Dependency tracking** between features
4. **Security posture documentation** for stakeholders

---

## Deferred Features Summary

| Feature | Issue | Priority | Trigger | Est. Effort | Est. Cost |
|---------|-------|----------|---------|-------------|-----------|
| [Keycloak OIDC Authentication](keycloak-oidc-plan.md) | #60 | P1 | 50+ users or enterprise demand | 2-3 weeks | Infrastructure |
| [Secure Token Storage](secure-token-storage-plan.md) | #61 | P1 | After OIDC implementation | 1 week | Development |
| [Penetration Testing](penetration-testing-plan.md) | #63 | P2 | Pre-launch or enterprise onboarding | 2-4 weeks | $5k-15k |

---

## Dependency Chain

```
Issue #60 (Keycloak OIDC)
    │
    │ Keycloak must be operational before
    │ secure token storage can be implemented
    │
    ▼
Issue #61 (Secure Token Storage)
    │
    │ Auth implementation should be stable
    │ before comprehensive security testing
    │
    ▼
Issue #63 (Penetration Testing)
```

---

## Implementation Triggers

### Keycloak OIDC (#60)

Implement when ANY of these conditions are met:
- Production traffic exceeds 50 concurrent users
- Enterprise customer requires SSO integration
- Regulatory/compliance mandates identity provider
- matric-memory team enables OIDC support

### Secure Token Storage (#61)

Implement when:
- Keycloak OIDC implementation is complete
- User feedback indicates session persistence is needed
- Security review recommends httpOnly cookie approach

### Penetration Testing (#63)

Conduct when ANY of these conditions are met:
- Before public launch announcement
- Before first enterprise customer onboarding
- As part of SOC 2 or compliance certification
- After major security-impacting changes

---

## Current Security Posture (MVP)

The MVP operates with the following security model:

| Aspect | MVP Implementation | Post-MVP Target |
|--------|-------------------|-----------------|
| Authentication | matric-memory API keys | Keycloak OIDC |
| Token Storage | In-memory (React state) | httpOnly cookies |
| Session Persistence | None (re-auth on refresh) | Cookie-based persistence |
| Security Validation | Automated scanning only | Pen test + scanning |
| Multi-factor Auth | Not supported | Keycloak MFA |
| SSO | Not supported | Keycloak federation |

---

## Related Documentation

| Document | Location | Purpose |
|----------|----------|---------|
| Security Migration Assessment | `.aiwg/security/migration-security-assessment.md` | Overall security posture change |
| SPA Security Config | `.aiwg/security/spa-security-config.md` | CORS, TLS, headers |
| Secrets Management Policy | `.aiwg/security/secrets-management-policy.md` | Secret handling procedures |
| ADR-007 SPA Privacy Model | `.aiwg/architecture/ADR-007-spa-privacy-model.md` | Privacy architecture |

---

## Review Schedule

These deferred plans should be reviewed:

- **Quarterly**: Assess if triggers have been met
- **Before major releases**: Evaluate if implementation should begin
- **After security incidents**: Reprioritize based on findings

---

*Last Review: 2026-01-31*
*Next Scheduled Review: 2026-04-30*
