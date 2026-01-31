# Secrets Management Policy

**Project**: HotM (Hall Of The Mind)
**Document Version**: 1.0
**Status**: APPROVED
**Effective Date**: 2026-01-31
**Author**: Security Architect
**Related Issues**: #53
**Related Documents**: migration-security-assessment.md, spa-security-config.md, ADR-007-spa-privacy-model.md

---

## 1. Purpose and Scope

This policy establishes requirements and procedures for the secure management of secrets throughout the HotM SPA project lifecycle. It applies to all secrets used in development, testing, staging, and production environments.

### 1.1 Definition of Secrets

**Secrets** are any sensitive data that, if exposed, could lead to unauthorized access, data breaches, or security incidents. This includes:

| Category | Examples |
|----------|----------|
| **API Keys** | matric-memory API keys, third-party service keys |
| **Authentication Tokens** | OIDC tokens, JWT secrets, session tokens |
| **Credentials** | Database passwords, service account credentials |
| **Cryptographic Keys** | TLS private keys, encryption keys, signing keys |
| **Configuration Secrets** | Environment-specific sensitive values |
| **OAuth Secrets** | Client secrets for OIDC/OAuth2 integrations |

### 1.2 Scope

This policy applies to:

- **All team members** with access to HotM development or deployment infrastructure
- **All environments**: development, testing, staging, production
- **All code repositories**: HotM SPA, deployment configurations, CI/CD pipelines
- **All deployment targets**: local development, Nginx servers, container environments

---

## 2. Core Principles

### 2.1 Fundamental Rules

| Rule | Description | Enforcement |
|------|-------------|-------------|
| **No Secrets in Git** | Secrets MUST NEVER be committed to version control | Pre-commit hooks, CI scanning |
| **Environment-Based Configuration** | Secrets loaded from environment at runtime | Application configuration |
| **Principle of Least Privilege** | Access limited to minimum necessary | Access controls, role separation |
| **Encryption at Rest** | Secrets encrypted when stored | Secret manager features |
| **Audit Trail** | All secret access logged | Secret manager audit logs |
| **Regular Rotation** | Secrets rotated on defined schedule | Automated rotation policies |

### 2.2 SPA-Specific Principles

**CRITICAL: The HotM SPA is a browser-based frontend application. Browser code is inherently public and inspectable.**

| Principle | Rationale |
|-----------|-----------|
| **No secrets in frontend code** | JavaScript bundles are visible to anyone with browser dev tools |
| **No secrets in static assets** | HTML, CSS, JS files served by Nginx are fully readable |
| **API keys are server-side only** | matric-memory handles authentication; SPA uses tokens, not keys |
| **Environment variables at build time** | Only non-sensitive configuration (API URLs) may be embedded |
| **No hardcoded credentials anywhere** | Even "test" credentials become attack vectors |

---

## 3. Storage Requirements

### 3.1 Prohibited Storage Locations

The following storage locations MUST NOT contain secrets:

| Location | Reason | Detection |
|----------|--------|-----------|
| Git repositories | Version control preserves history forever | Pre-commit hooks, git-secrets |
| Frontend source code | Bundled into public JavaScript | Code review, static analysis |
| Build artifacts (JS bundles) | Deployed to public servers | Bundle analysis |
| Client-side storage (localStorage, sessionStorage) | Accessible to XSS attacks | Code review, security audit |
| URL parameters | Visible in logs, referrer headers | Code review |
| Browser cookies (for API keys) | Accessible to XSS if not httpOnly | Security audit |
| Unencrypted configuration files | Readable by anyone with file access | File permission audits |
| Log files | Easily overlooked in security reviews | Log sanitization |

### 3.2 Approved Storage Locations

#### Development Environment

| Storage | Use Case | Access Control |
|---------|----------|----------------|
| `.env.local` (not committed) | Local development secrets | Developer machine only |
| Environment variables | Runtime configuration | Process isolation |
| Password managers (1Password, Bitwarden) | Individual developer credentials | Personal vault |

**Required `.gitignore` entries**:
```gitignore
# Environment files with secrets
.env
.env.local
.env.*.local
.env.development
.env.production

# Secret key files
*.pem
*.key
*.p12
*.pfx

# IDE-specific secret storage
.idea/secrets/
.vscode/*.secrets
```

#### Staging/Production Environment

| Storage | Use Case | Access Control |
|---------|----------|----------------|
| **Environment Variables** | Runtime secrets | Host/container configuration |
| **AWS Secrets Manager** | Production secrets (recommended) | IAM policies, encryption |
| **HashiCorp Vault** | Enterprise secrets management (alternative) | ACL policies, audit logging |
| **Kubernetes Secrets** | Container deployments | RBAC, namespace isolation |

### 3.3 Secret Manager Requirements

When using a secret manager (AWS Secrets Manager, HashiCorp Vault, etc.):

| Requirement | Implementation |
|-------------|----------------|
| Encryption at rest | AES-256 or equivalent |
| Encryption in transit | TLS 1.2+ for all API calls |
| Access logging | All read/write operations logged |
| Version history | Previous versions retained for rollback |
| Automatic rotation | Supported for applicable secret types |
| IAM integration | Role-based access control |

---

## 4. Access Control

### 4.1 Role-Based Access

| Role | Development Secrets | Staging Secrets | Production Secrets |
|------|--------------------|-----------------|--------------------|
| **Developer** | Full access | Read-only | No direct access |
| **DevOps Engineer** | Full access | Full access | Full access (audited) |
| **Security Architect** | Audit access | Audit access | Audit access |
| **CI/CD Service Account** | Read-only (scoped) | Read-only (scoped) | Read-only (scoped) |
| **Production Application** | N/A | N/A | Read-only (runtime) |

### 4.2 Access Control Implementation

```yaml
# Example: AWS Secrets Manager IAM Policy (Production Read-Only)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:ACCOUNT:secret:hotm/production/*"
      ],
      "Condition": {
        "StringEquals": {
          "aws:PrincipalTag/Environment": "production"
        }
      }
    }
  ]
}
```

### 4.3 Service Account Principles

| Principle | Implementation |
|-----------|----------------|
| Dedicated accounts | Separate service account per application/environment |
| Minimal permissions | Only secrets needed for that service |
| No human access via service accounts | Service accounts for automation only |
| Regular credential rotation | Automated rotation where possible |
| Audit logging | All access logged and reviewed |

---

## 5. Rotation Policy

### 5.1 Rotation Schedule

| Secret Type | Rotation Frequency | Automated | Notes |
|-------------|-------------------|-----------|-------|
| API Keys (matric-memory) | 90 days | Yes (recommended) | Coordinate with matric-memory team |
| OIDC Client Secrets | 180 days | No | Requires Keycloak admin |
| TLS Certificates | 90 days (Let's Encrypt auto) | Yes | certbot auto-renewal |
| JWT Signing Keys | 365 days | No | Requires coordinated rollout |
| Database Credentials | 90 days | Yes (if supported) | AWS RDS supports auto-rotation |
| CI/CD Tokens | 90 days | No | GitHub Actions secrets |
| Encryption Keys | Never (unless compromised) | N/A | Key versioning instead |

### 5.2 Rotation Procedure

```
┌─────────────────────────────────────────────────────────────┐
│                    Secret Rotation Flow                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Generate new secret value                               │
│     ↓                                                       │
│  2. Store new secret in secret manager (new version)        │
│     ↓                                                       │
│  3. Update application configuration to use new secret      │
│     ↓                                                       │
│  4. Verify application works with new secret                │
│     ↓                                                       │
│  5. Revoke/disable old secret after grace period (24-48h)   │
│     ↓                                                       │
│  6. Document rotation in audit log                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 5.3 Emergency Rotation

If a secret is suspected or confirmed compromised:

1. **Immediate**: Generate and deploy new secret (bypass normal change process)
2. **Within 1 hour**: Revoke compromised secret
3. **Within 24 hours**: Conduct incident review
4. **Within 72 hours**: Document lessons learned and remediation

---

## 6. Environment Variable Naming Conventions

### 6.1 Standard Prefixes

| Prefix | Purpose | Example |
|--------|---------|---------|
| `HOTM_` | Application-specific configuration | `HOTM_API_BASE_URL` |
| `VITE_` | Frontend build-time variables (Vite) | `VITE_API_URL` |
| `REACT_APP_` | Legacy React variables (if applicable) | `REACT_APP_API_URL` |

### 6.2 Naming Rules

| Rule | Example (Correct) | Example (Incorrect) |
|------|-------------------|---------------------|
| SCREAMING_SNAKE_CASE | `HOTM_API_KEY` | `hotm_api_key`, `HotmApiKey` |
| Descriptive names | `MATRIC_MEMORY_API_URL` | `MM_URL`, `API` |
| Environment suffix | `DATABASE_URL_PRODUCTION` | `PROD_DB` |
| No secret values in names | `JWT_SECRET` | `JWT_SECRET_abc123xyz` |

### 6.3 SPA Environment Variables

**IMPORTANT**: In Vite-based SPAs, environment variables prefixed with `VITE_` are embedded in the JavaScript bundle at build time.

| Variable | Safe for `VITE_` prefix? | Rationale |
|----------|-------------------------|-----------|
| API base URL | Yes | Public endpoint, not sensitive |
| API version | Yes | Public information |
| Feature flags | Yes | UI behavior, not security |
| API keys | **NO** | Would be exposed in bundle |
| Secrets | **NO** | Would be exposed in bundle |
| Auth tokens | **NO** | Would be exposed in bundle |

**Example `.env` structure**:
```bash
# Safe for frontend embedding (VITE_ prefix)
VITE_API_URL=https://api.matric-memory.example.com
VITE_API_VERSION=v1
VITE_FEATURE_DARK_MODE=true

# Server-side only (no VITE_ prefix, not used in frontend)
DATABASE_URL=postgres://user:pass@localhost:5432/hotm
JWT_SECRET=super-secret-key-never-in-frontend
OIDC_CLIENT_SECRET=keycloak-client-secret
```

---

## 7. Emergency Procedures

### 7.1 Secret Compromise Response

**Severity Levels**:

| Level | Description | Response Time |
|-------|-------------|---------------|
| **Critical** | Production API keys, database credentials | Immediate (< 1 hour) |
| **High** | Staging credentials, TLS private keys | Within 4 hours |
| **Medium** | Development secrets, CI/CD tokens | Within 24 hours |
| **Low** | Test environment secrets | Within 72 hours |

### 7.2 Incident Response Checklist

```markdown
## Secret Compromise Incident Checklist

### Immediate Actions (< 1 hour)
- [ ] Identify scope of compromise (which secrets, which environments)
- [ ] Generate and deploy replacement secrets
- [ ] Revoke/disable compromised secrets
- [ ] Notify Security Architect and DevOps lead
- [ ] Check for unauthorized access using audit logs

### Short-term Actions (< 24 hours)
- [ ] Review audit logs for unauthorized usage
- [ ] Assess potential data exposure
- [ ] Notify affected parties if required (users, matric-memory team)
- [ ] Document timeline of events

### Follow-up Actions (< 72 hours)
- [ ] Conduct root cause analysis
- [ ] Implement preventive measures
- [ ] Update this policy if gaps identified
- [ ] Schedule post-incident review meeting
```

### 7.3 Contact List

| Role | Responsibility | Contact Method |
|------|----------------|----------------|
| Security Architect | Incident lead, policy decisions | Slack: #security-incidents |
| DevOps Engineer | Secret rotation, infrastructure | Slack: #devops |
| matric-memory Team | Backend API coordination | Slack: #matric-memory |
| Project Lead | Stakeholder communication | Direct message |

---

## 8. Development Workflow Integration

### 8.1 Pre-Commit Hooks

Install pre-commit hooks to prevent accidental secret commits:

```bash
# Install git-secrets (AWS tool for detecting secrets)
brew install git-secrets  # macOS
# or
apt-get install git-secrets  # Linux

# Configure for this repository
cd /mnt/dev-inbox/jmagly/hotm/ui
git secrets --install
git secrets --register-aws  # AWS patterns
git secrets --add 'sk_live_[a-zA-Z0-9]{24}'  # Stripe live keys
git secrets --add 'ghp_[a-zA-Z0-9]{36}'  # GitHub tokens
git secrets --add 'AKIA[A-Z0-9]{16}'  # AWS access keys
```

**Alternative: detect-secrets (Python)**:
```bash
pip install detect-secrets
detect-secrets scan > .secrets.baseline
detect-secrets audit .secrets.baseline
```

### 8.2 CI/CD Secret Management

**GitHub Actions Secrets**:
```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        env:
          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}
          API_KEY: ${{ secrets.MATRIC_MEMORY_API_KEY }}
        run: |
          # Secrets available as environment variables
          # Never echo or log these values
```

**Secret Masking**:
- GitHub Actions automatically masks secrets in logs
- Add custom masking: `echo "::add-mask::$MY_SECRET"`
- Never use `set -x` with secrets in scope

### 8.3 Local Development Setup

```bash
# 1. Copy template (committed to repo)
cp .env.example .env.local

# 2. Edit with actual values (never commit)
vim .env.local

# 3. Verify .gitignore excludes secret files
grep -q ".env.local" .gitignore && echo "Protected" || echo "WARNING: Add to .gitignore!"

# 4. Load in development
npm run dev  # Vite automatically loads .env.local
```

**Example `.env.example` (committed)**:
```bash
# HotM SPA Environment Configuration
# Copy this file to .env.local and fill in actual values
# NEVER commit .env.local to version control

# API Configuration (safe to embed in frontend)
VITE_API_URL=http://localhost:8080

# Auth Configuration (safe to embed in frontend - just URLs)
VITE_OIDC_AUTHORITY=http://localhost:8180/realms/hotm
VITE_OIDC_CLIENT_ID=hotm-spa

# The following are SERVER-SIDE ONLY - do not add VITE_ prefix
# DATABASE_URL=postgres://user:pass@localhost:5432/hotm
# OIDC_CLIENT_SECRET=your-client-secret-here
```

---

## 9. Verification and Compliance

### 9.1 Automated Scanning

| Tool | Purpose | Frequency |
|------|---------|-----------|
| git-secrets | Pre-commit secret detection | Every commit |
| detect-secrets | Repository-wide secret scanning | Weekly CI job |
| npm audit | Dependency vulnerability scanning | Every build |
| GitHub Secret Scanning | Repository secret detection | Continuous |
| TruffleHog | Git history secret detection | Monthly |

### 9.2 Manual Review Checklist

**Before each release**:
```markdown
## Pre-Release Security Checklist

- [ ] No secrets in JavaScript bundle (run `npm run build && grep -r "secret\|password\|key" dist/`)
- [ ] Environment variables correctly configured for target environment
- [ ] API keys rotated if approaching rotation date
- [ ] TLS certificates valid for at least 30 days
- [ ] Secret access audit logs reviewed
- [ ] No TODO/FIXME comments with sensitive data
```

### 9.3 Compliance Verification

| Requirement | Verification Method | Frequency |
|-------------|---------------------|-----------|
| No secrets in git | git-secrets scan, history audit | Every commit |
| Environment-based secrets | Code review, static analysis | Every PR |
| Access control active | IAM policy review | Quarterly |
| Rotation compliance | Secret manager reports | Monthly |
| Audit logging enabled | Log verification | Monthly |

---

## 10. Policy Maintenance

### 10.1 Review Schedule

| Review Type | Frequency | Participants |
|-------------|-----------|--------------|
| Policy review | Annual | Security Architect, DevOps, Project Lead |
| Incident-triggered review | As needed | Incident response team |
| Tool/technology review | Semi-annual | DevOps, Security Architect |

### 10.2 Change Management

Changes to this policy require:
1. Draft proposed changes
2. Review by Security Architect
3. Approval by Project Lead
4. Communication to all team members
5. Update effective date

### 10.3 Exceptions

Any exception to this policy requires:
1. Written justification
2. Risk assessment
3. Compensating controls documented
4. Security Architect approval
5. Time-limited scope (maximum 90 days)
6. Re-evaluation before renewal

---

## Document Control

| Field | Value |
|-------|-------|
| Document Version | 1.0 |
| Status | APPROVED |
| Author | Security Architect |
| Effective Date | 2026-01-31 |
| Next Review | 2027-01-31 |
| Related Documents | migration-security-assessment.md, spa-security-config.md, ADR-007-spa-privacy-model.md |

---

## Appendix A: Quick Reference Card

```
╔══════════════════════════════════════════════════════════════════╗
║                 SECRETS MANAGEMENT QUICK REFERENCE               ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                  ║
║  DO:                                                             ║
║  ✓ Store secrets in environment variables                       ║
║  ✓ Use .env.local for local development (git-ignored)          ║
║  ✓ Use secret managers for staging/production                   ║
║  ✓ Rotate secrets on schedule                                   ║
║  ✓ Report suspected compromises immediately                     ║
║                                                                  ║
║  DON'T:                                                          ║
║  ✗ Commit secrets to git (EVER)                                 ║
║  ✗ Put API keys in frontend code (VITE_ prefix)                 ║
║  ✗ Store secrets in localStorage/sessionStorage                 ║
║  ✗ Log secrets or include in error messages                     ║
║  ✗ Share secrets via Slack, email, or chat                      ║
║                                                                  ║
║  EMERGENCY CONTACT:                                              ║
║  Slack: #security-incidents                                      ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
```

---

*End of Secrets Management Policy*
