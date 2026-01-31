# Error Tracking and Monitoring

**Issue:** #58
**Status:** Implemented
**Last Updated:** 2026-01-31

## Overview

HotM uses Sentry for frontend error tracking, performance monitoring, and debugging production issues. Error tracking is privacy-focused and only enabled when explicitly configured.

## Architecture

```
┌─────────────────┐
│  React SPA      │
│  (Browser)      │
└────────┬────────┘
         │ Errors, Events
         ▼
┌─────────────────┐
│  Sentry SDK     │
│  (ui/src/lib/   │
│   sentry.ts)    │
└────────┬────────┘
         │ Sanitized Events
         ▼
┌─────────────────┐
│  Sentry.io      │
│  (Cloud)        │
└─────────────────┘
```

## Setup

### 1. Install Dependencies

Add Sentry SDK to package.json:

```bash
cd ui
npm install --save @sentry/react
```

### 2. Configure Environment Variables

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Add Sentry DSN (obtain from https://sentry.io):

```bash
# .env.local
VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
```

### 3. Initialize Sentry

Import and initialize in `main.tsx` **before** React render:

```typescript
import { initSentry } from './lib/sentry';

// Initialize error tracking
initSentry();

// Then render React app
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_SENTRY_DSN` | No | - | Sentry Data Source Name (project identifier) |
| `VITE_SENTRY_DEV_ENABLED` | No | `false` | Enable Sentry in development mode |
| `VITE_APP_VERSION` | No | `package.json` | Application version for release tracking |

### Privacy Settings

The Sentry configuration sanitizes all personally identifiable information:

- **User Emails:** Redacted before sending
- **IP Addresses:** Not collected
- **Note Content:** Removed from breadcrumbs and request bodies
- **Sensitive URLs:** Query parameters like `token`, `api_key`, `password` are redacted

**Example Sanitization:**
```typescript
// Before sanitization
event.user.email = "user@example.com"
event.breadcrumbs[0].data.url = "https://api/notes?token=abc123"
event.request.data = { content: "My private note" }

// After sanitization
event.user.email = "[REDACTED]"
event.breadcrumbs[0].data.url = "https://api/notes?token=[REDACTED]"
event.request.data = "[REDACTED - Note Content]"
```

### Sample Rates

| Environment | Traces | Replays | Errors |
|-------------|--------|---------|--------|
| Development | 100% | 0% | 0% (unless `VITE_SENTRY_DEV_ENABLED=true`) |
| Production | 10% | 0% | 100% |

**Note:** Session replays are disabled by default for privacy. Enable only with explicit user consent.

## Usage

### Automatic Error Capture

Errors are automatically captured:

```typescript
// Unhandled errors
throw new Error('Something went wrong');

// Promise rejections
fetch('/api/notes').then(res => res.json());

// React component errors
function MyComponent() {
  const data = undefined;
  return <div>{data.value}</div>; // TypeError captured
}
```

### Manual Error Capture

Use `captureError` for explicit error tracking:

```typescript
import { captureError } from '@/lib/sentry';

try {
  await saveNote(note);
} catch (error) {
  captureError(error as Error, {
    tags: { feature: 'note-save' },
    extra: { noteId: note.id },
  });
}
```

### Breadcrumbs

Add custom breadcrumbs for debugging:

```typescript
import { addBreadcrumb } from '@/lib/sentry';

addBreadcrumb('User opened note', { noteId: '123' });
addBreadcrumb('Search executed', { query: 'machine learning' });
```

### User Context

Set user context for error correlation:

```typescript
import { setUser, clearUser } from '@/lib/sentry';

// On login
setUser({ id: 'user-123', username: 'john' });

// On logout
clearUser();
```

**Privacy:** Only user ID and username are sent. No email or PII.

## Ignored Errors

Sentry ignores common non-critical errors:

- Browser extension errors (`chrome-extension://`, `moz-extension://`)
- Network errors (`NetworkError`, `Failed to fetch`)
- User abort actions (`AbortError`)
- ResizeObserver benign errors

**Full List:** See `ignoreErrors` in `ui/src/lib/sentry.ts`

## Performance Monitoring

Sentry tracks performance metrics:

- **Page Load Time:** Time to interactive
- **API Request Duration:** `/api/*` endpoints
- **Component Render Time:** React component performance

**Transaction Sampling:** 10% in production, 100% in development

## Error Triage Workflow

### 1. Error Detection

Sentry sends alerts via:
- Email notifications
- Slack integration
- PagerDuty (critical errors)

### 2. Error Investigation

**View in Sentry Dashboard:**
```
https://sentry.io/organizations/{org}/issues/
```

**Key Information:**
- Stack trace with source maps
- Breadcrumbs (user actions before error)
- Environment (browser, OS, version)
- Affected users count
- First/last seen timestamps

### 3. Error Resolution

**Mark as Resolved:**
```
Issues → Select issue → Resolve
```

**Assign to Team Member:**
```
Issues → Select issue → Assign to...
```

**Link to GitHub Issue:**
```
Issues → Select issue → Linked Issues → Create Issue
```

## Deployment Checklist

### Development

- [ ] Sentry DSN configured in `.env.local`
- [ ] `initSentry()` called before React render
- [ ] Test error capture: `throw new Error('Test error')`
- [ ] Verify errors appear in Sentry dashboard

### Staging

- [ ] Separate Sentry project for staging environment
- [ ] Environment tag set to `staging`
- [ ] Sample rate configured (100% for comprehensive testing)

### Production

- [ ] Production Sentry DSN in deployment secrets
- [ ] Environment tag set to `production`
- [ ] Sample rate reduced (10% for performance)
- [ ] Source maps uploaded (future enhancement)
- [ ] Release tracking enabled

## Source Maps (Future)

Upload source maps for readable stack traces:

```bash
# .github/workflows/frontend-build.yml
- name: Upload source maps to Sentry
  env:
    SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
  run: |
    cd ui
    npx @sentry/cli releases new "${{ github.sha }}"
    npx @sentry/cli releases files "${{ github.sha }}" upload-sourcemaps dist/assets
    npx @sentry/cli releases finalize "${{ github.sha }}"
```

## Alerting Rules

Configure Sentry alerts for critical errors:

| Rule | Condition | Channel |
|------|-----------|---------|
| High volume errors | >100 events/hour | Slack #hotm-alerts |
| Critical errors | Severity = error | Email + PagerDuty |
| New issue | First occurrence | Slack #hotm-alerts |
| Regression | Resolved issue returns | Email dev team |

## Privacy Compliance

### GDPR Compliance

- No PII collected without consent
- User can opt-out via browser settings
- Data retention: 90 days
- Right to deletion: Contact support

### Data Collected

**Allowed:**
- Error messages and stack traces
- Browser type and version
- Operating system
- Application version
- Anonymized user ID (if authenticated)

**Prohibited:**
- Email addresses
- IP addresses
- Note content
- API tokens
- Passwords

## Monitoring Dashboards

### Sentry Dashboard

**URL:** `https://sentry.io/organizations/{org}/issues/`

**Key Metrics:**
- Error rate (errors/hour)
- Affected users
- Most common errors
- Performance degradation

### Custom Dashboards

**Error Rate Over Time:**
```
Issues → Stats → Customize → Error Rate (24h)
```

**Errors by Browser:**
```
Issues → Stats → Group By: Browser
```

**Performance Bottlenecks:**
```
Performance → Transactions → Sort by P95 Duration
```

## Troubleshooting

### Errors Not Appearing in Sentry

**Check Configuration:**
```bash
# Verify DSN is set
echo $VITE_SENTRY_DSN

# Check initialization
console.log(import.meta.env.VITE_SENTRY_DSN)
```

**Common Issues:**
- DSN not configured (check `.env.local`)
- Development mode blocking (set `VITE_SENTRY_DEV_ENABLED=true`)
- Ad blocker blocking Sentry requests
- CORS issues (check CSP headers)

### Too Many Events

**Reduce sample rate:**
```typescript
// ui/src/lib/sentry.ts
tracesSampleRate: 0.05, // 5% instead of 10%
```

**Add more ignored errors:**
```typescript
ignoreErrors: [
  ...existingErrors,
  'SpecificErrorToIgnore',
],
```

### Missing Context

**Add more breadcrumbs:**
```typescript
addBreadcrumb('Feature activated', { feature: 'search' });
```

**Include more tags:**
```typescript
captureError(error, {
  tags: {
    feature: 'note-editor',
    user_type: 'premium',
  },
});
```

## Cost Management

### Sentry Pricing Tiers

| Tier | Events/Month | Cost | Use Case |
|------|--------------|------|----------|
| Free | 5,000 | $0 | Development/Testing |
| Team | 50,000 | $26/mo | Small production deployments |
| Business | 100,000+ | $80+/mo | High-traffic production |

### Cost Optimization

**Reduce event volume:**
- Lower sample rates
- Add more ignored errors
- Filter low-priority errors

**Monitor quota usage:**
```
Settings → Usage & Billing → Event Volume
```

## Related Documentation

- `ui/src/lib/sentry.ts` - Sentry initialization and configuration
- `ui/.env.example` - Environment variable template
- `.aiwg/security/spa-security-config.md` - Security headers and CSP
- `.aiwg/operations/monitoring.md` (future) - Comprehensive monitoring guide

## References

- [Sentry React Documentation](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Sentry Privacy Policy](https://sentry.io/privacy/)
- [GDPR Compliance Guide](https://docs.sentry.io/product/security/gdpr/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)

## Audit Trail

| Date | Change | Author |
|------|--------|--------|
| 2026-01-31 | Initial error tracking setup (#58) | Claude Code |
| 2026-01-31 | Sentry configuration with privacy sanitization | Claude Code |
| 2026-01-31 | Documentation and deployment guide | Claude Code |
