# Sentry Setup Instructions

**Issue:** #58
**Status:** Configuration Complete - Installation Required
**Last Updated:** 2026-01-31

## Overview

This document provides step-by-step instructions for completing the Sentry error tracking integration.

## Files Created

✅ **Configuration Files:**
- `ui/src/lib/sentry.ts` - Sentry initialization and privacy sanitization
- `ui/.env.example` - Environment variable template with Sentry DSN
- `.aiwg/operations/error-tracking.md` - Comprehensive error tracking documentation

## Installation Steps

### Step 1: Install Sentry SDK

```bash
cd ui
npm install --save @sentry/react
```

**Why:** Adds Sentry client library for error tracking and performance monitoring.

**Dependency Details:**
```json
{
  "dependencies": {
    "@sentry/react": "^7.100.0"
  }
}
```

### Step 2: Configure Environment Variables

Create `.env.local` from template:

```bash
cd ui
cp .env.example .env.local
```

Add your Sentry DSN to `.env.local`:

```bash
# .env.local
VITE_SENTRY_DSN=https://YOUR_PUBLIC_KEY@YOUR_ORG.ingest.sentry.io/YOUR_PROJECT_ID
```

**Obtain DSN:**
1. Sign up at https://sentry.io (free tier available)
2. Create new project → Select "React"
3. Copy DSN from project settings

### Step 3: Initialize Sentry in main.tsx

Update `ui/src/main.tsx` to initialize Sentry **before** React render:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initSentry } from './lib/sentry';
import './index.css';

// Initialize error tracking (before React render)
initSentry();

// Render React application
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

### Step 4: Test Error Capture

Add temporary test error to verify Sentry is working:

```typescript
// In any component (e.g., App.tsx)
useEffect(() => {
  // Test error - remove after verification
  throw new Error('Sentry test error - integration working!');
}, []);
```

**Verification:**
1. Run app: `npm run dev`
2. Open browser console - error will appear
3. Check Sentry dashboard (https://sentry.io) - event should appear within 1-2 minutes
4. Remove test error after confirmation

### Step 5: Optional - User Context on Login

If implementing authentication, set user context:

```typescript
// On successful login
import { setUser } from '@/lib/sentry';

setUser({
  id: user.id,        // User identifier (anonymized)
  username: user.name // Optional username
});

// On logout
import { clearUser } from '@/lib/sentry';

clearUser();
```

## Configuration Options

### Development Mode

By default, Sentry does NOT send events in development. To enable:

```bash
# .env.local
VITE_SENTRY_DEV_ENABLED=true
```

### Custom Application Version

Override version detection:

```bash
# .env.local
VITE_APP_VERSION=0.1.2
```

### Sample Rates

Edit `ui/src/lib/sentry.ts` to adjust sampling:

```typescript
Sentry.init({
  // ...
  tracesSampleRate: 0.1,           // 10% of transactions (default)
  replaysSessionSampleRate: 0.0,   // Session replays (disabled for privacy)
  replaysOnErrorSampleRate: 0.0,   // Error replays (disabled)
});
```

## Privacy Configuration

### Automatic Sanitization

The current configuration automatically removes:
- ✅ User email addresses
- ✅ IP addresses
- ✅ Note content from breadcrumbs
- ✅ Sensitive URL parameters (token, api_key, password)
- ✅ Request body containing note data

### Manual Breadcrumb Filtering

Add custom filters in `sanitizeEvent()`:

```typescript
// ui/src/lib/sentry.ts
function sanitizeEvent(event: Sentry.Event): Sentry.Event | null {
  // Add custom sanitization logic
  if (event.request?.headers?.['Authorization']) {
    event.request.headers['Authorization'] = '[REDACTED]';
  }

  return event;
}
```

## Manual Error Capture

### Basic Error Capture

```typescript
import { captureError } from '@/lib/sentry';

try {
  await riskyOperation();
} catch (error) {
  captureError(error as Error);
}
```

### Error with Context

```typescript
import { captureError } from '@/lib/sentry';

captureError(error as Error, {
  tags: {
    feature: 'note-editor',
    action: 'save',
  },
  extra: {
    noteId: note.id,
    noteType: note.type,
  },
});
```

### Custom Messages

```typescript
import { captureError } from '@/lib/sentry';

captureError('User attempted unauthorized action', {
  tags: { severity: 'warning' },
});
```

## Deployment

### Production Environment

**GitHub Actions Secrets:**

1. Go to repository Settings → Secrets → Actions
2. Add `SENTRY_DSN` secret with production DSN
3. Update deployment workflow:

```yaml
# .github/workflows/deploy.yml
- name: Build with Sentry
  env:
    VITE_SENTRY_DSN: ${{ secrets.SENTRY_DSN }}
  run: npm run build
```

### Docker Deployment

**Dockerfile:**
```dockerfile
# Build stage
ARG SENTRY_DSN
ENV VITE_SENTRY_DSN=$SENTRY_DSN

RUN npm run build
```

**Docker Compose:**
```yaml
services:
  frontend:
    build:
      args:
        SENTRY_DSN: ${SENTRY_DSN}
```

## Monitoring

### View Errors

**Sentry Dashboard:** https://sentry.io/organizations/{org}/issues/

**Filter by environment:**
- Development: Tag `environment:development`
- Production: Tag `environment:production`

### Alert Configuration

**Recommended Alerts:**
1. High error rate (>100 errors/hour)
2. New error type
3. Regression (resolved error returns)

**Setup:**
1. Sentry → Alerts → Create Alert Rule
2. Select trigger conditions
3. Choose notification channel (email, Slack, PagerDuty)

## Troubleshooting

### Events Not Appearing

**Check DSN:**
```bash
cd ui
grep VITE_SENTRY_DSN .env.local
```

**Check initialization:**
```typescript
// In browser console
console.log(import.meta.env.VITE_SENTRY_DSN);
```

**Common issues:**
- Missing `.env.local` file
- DSN not set or invalid
- Development mode blocking (set `VITE_SENTRY_DEV_ENABLED=true`)
- Ad blocker blocking Sentry

### Too Many Events

**Reduce noise:**
```typescript
// ui/src/lib/sentry.ts
ignoreErrors: [
  ...existingErrors,
  'YourSpecificErrorToIgnore',
],
```

**Lower sample rate:**
```typescript
tracesSampleRate: 0.05, // 5% instead of 10%
```

### Missing Source Maps (Future Enhancement)

Source maps enable readable stack traces. Upload during build:

```bash
npm install --save-dev @sentry/cli

# In CI/CD
npx @sentry/cli releases new "$RELEASE_VERSION"
npx @sentry/cli releases files "$RELEASE_VERSION" upload-sourcemaps dist/assets
npx @sentry/cli releases finalize "$RELEASE_VERSION"
```

## Next Steps

1. **Install Sentry SDK:** `npm install --save @sentry/react`
2. **Create Sentry Account:** https://sentry.io/signup/
3. **Obtain DSN:** Create project and copy DSN
4. **Configure `.env.local`:** Add VITE_SENTRY_DSN
5. **Initialize in main.tsx:** Import and call `initSentry()`
6. **Test:** Add temporary error and verify in Sentry dashboard
7. **Production:** Add SENTRY_DSN to deployment secrets

## Documentation

**Comprehensive guides:**
- `.aiwg/operations/error-tracking.md` - Full error tracking documentation
- `ui/src/lib/sentry.ts` - Implementation with inline comments
- `ui/.env.example` - Environment variable reference

**External resources:**
- [Sentry React Guide](https://docs.sentry.io/platforms/javascript/guides/react/)
- [Privacy & GDPR](https://docs.sentry.io/product/security/gdpr/)
- [Performance Monitoring](https://docs.sentry.io/product/performance/)

## Verification Checklist

- [ ] Sentry SDK installed (`@sentry/react` in package.json)
- [ ] `.env.local` created with VITE_SENTRY_DSN
- [ ] `initSentry()` called in main.tsx before React render
- [ ] Test error captured and visible in Sentry dashboard
- [ ] Privacy sanitization tested (no PII in events)
- [ ] Production DSN added to deployment secrets
- [ ] Alerts configured for critical errors

## Support

**Questions?** See `.aiwg/operations/error-tracking.md` for detailed troubleshooting.

**Sentry Support:**
- Free tier: Community forum
- Paid tiers: Email support
- Documentation: https://docs.sentry.io

---

**Status:** Ready for installation - run `npm install --save @sentry/react` to complete setup.
