/**
 * Sentry Error Tracking Configuration
 *
 * Issue: #58
 *
 * Initializes Sentry for frontend error tracking and performance monitoring.
 * Only active when VITE_SENTRY_DSN environment variable is set.
 *
 * Usage:
 *   1. Add Sentry DSN to .env: VITE_SENTRY_DSN=https://...@sentry.io/...
 *   2. Import and call initSentry() in main.tsx before React render
 *   3. Errors are automatically captured and sent to Sentry
 *
 * Privacy:
 *   - PII is sanitized before sending
 *   - User identifiers are anonymized
 *   - Sensitive data is filtered from breadcrumbs
 */

import * as Sentry from '@sentry/react';

/**
 * Sanitize event data to remove personally identifiable information
 */
function sanitizeEvent(event: Sentry.Event): Sentry.Event | null {
  // Remove user email if present
  if (event.user?.email) {
    event.user.email = '[REDACTED]';
  }

  // Remove IP address
  if (event.user?.ip_address) {
    event.user.ip_address = null;
  }

  // Sanitize breadcrumb data
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(breadcrumb => {
      // Remove sensitive query parameters
      if (breadcrumb.data?.url) {
        try {
          const url = new URL(breadcrumb.data.url);
          // Remove sensitive params like tokens, api_key, etc.
          ['token', 'api_key', 'apikey', 'key', 'secret', 'password'].forEach(param => {
            if (url.searchParams.has(param)) {
              url.searchParams.set(param, '[REDACTED]');
            }
          });
          breadcrumb.data.url = url.toString();
        } catch {
          // Invalid URL, leave as-is
        }
      }

      // Remove note content from breadcrumbs (privacy)
      if (breadcrumb.data?.note_content) {
        breadcrumb.data.note_content = '[REDACTED]';
      }

      return breadcrumb;
    });
  }

  // Remove request body if it contains note data
  if (event.request?.data) {
    try {
      const data = typeof event.request.data === 'string'
        ? JSON.parse(event.request.data)
        : event.request.data;

      if (data.content || data.original || data.revised) {
        event.request.data = '[REDACTED - Note Content]';
      }
    } catch {
      // Ignore parsing errors
    }
  }

  return event;
}

/**
 * Initialize Sentry error tracking
 *
 * Only initializes if VITE_SENTRY_DSN is set in environment.
 * Safe to call in all environments (dev, staging, production).
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Only initialize if DSN is configured
  if (!dsn) {
    console.info('[Sentry] DSN not configured, error tracking disabled');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE, // 'development', 'production', etc.

      // Release tracking for version correlation
      release: `hotm-ui@${import.meta.env.VITE_APP_VERSION || '0.1.0'}`,

      // Sample rate for performance monitoring
      // 0.1 = 10% of transactions sent to Sentry
      tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,

      // Replays for session recording (disabled by default)
      // Only enable in production with user consent
      replaysSessionSampleRate: 0.0,
      replaysOnErrorSampleRate: 0.0,

      // Privacy: sanitize all events before sending
      beforeSend(event, hint) {
        // Don't send events in development (unless explicitly enabled)
        if (import.meta.env.DEV && !import.meta.env.VITE_SENTRY_DEV_ENABLED) {
          console.warn('[Sentry] Event captured but not sent (dev mode):', hint.originalException || hint.syntheticException);
          return null;
        }

        // Sanitize PII
        return sanitizeEvent(event);
      },

      // Ignore common non-critical errors
      ignoreErrors: [
        // Browser extensions
        'top.GLOBALS',
        'chrome-extension://',
        'moz-extension://',

        // Network errors that are expected
        'NetworkError',
        'Failed to fetch',

        // User abort actions
        'AbortError',
        'The user aborted a request',

        // ResizeObserver errors (benign)
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed with undelivered notifications',
      ],

      // Filter breadcrumbs to reduce noise
      beforeBreadcrumb(breadcrumb) {
        // Don't log console.log breadcrumbs
        if (breadcrumb.category === 'console' && breadcrumb.level !== 'error') {
          return null;
        }

        // Don't log UI click breadcrumbs (privacy)
        if (breadcrumb.category === 'ui.click') {
          // Keep the category but remove specific element info
          breadcrumb.message = 'User interaction';
          breadcrumb.data = {};
        }

        return breadcrumb;
      },

      // Integration configuration
      integrations: [
        // React error boundary integration
        new Sentry.BrowserTracing({
          // Only trace API requests, not all fetch calls
          traceFetch: true,
          traceXHR: true,

          // Don't trace third-party requests
          shouldCreateSpanForRequest: (url) => {
            // Only trace our own API
            return url.includes('/api/') || url.includes(window.location.origin);
          },
        }),
      ],
    });

    console.info('[Sentry] Error tracking initialized');
  } catch (error) {
    console.error('[Sentry] Failed to initialize:', error);
  }
}

/**
 * Manually capture an error with context
 *
 * @param error - Error object or message
 * @param context - Additional context (user, tags, extra data)
 */
export function captureError(
  error: Error | string,
  context?: {
    user?: { id?: string; username?: string };
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): void {
  if (!import.meta.env.VITE_SENTRY_DSN) {
    console.error('[Sentry] Error captured but not sent (DSN not configured):', error);
    return;
  }

  // Set context if provided
  if (context?.user) {
    Sentry.setUser({
      id: context.user.id,
      username: context.user.username,
    });
  }

  if (context?.tags) {
    Sentry.setTags(context.tags);
  }

  if (context?.extra) {
    Sentry.setExtras(context.extra);
  }

  // Capture the error
  if (typeof error === 'string') {
    Sentry.captureMessage(error, 'error');
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Add custom breadcrumb for debugging
 *
 * @param message - Breadcrumb message
 * @param data - Additional data
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  Sentry.addBreadcrumb({
    message,
    level: 'info',
    data,
  });
}

/**
 * Set user context for error tracking
 *
 * @param user - User information (anonymized)
 */
export function setUser(user: { id: string; username?: string } | null): void {
  if (user) {
    Sentry.setUser({
      id: user.id,
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
}

/**
 * Clear user context (call on logout)
 */
export function clearUser(): void {
  Sentry.setUser(null);
}
