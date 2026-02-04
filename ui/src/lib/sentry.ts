/**
 * Sentry Error Tracking Configuration (Stub)
 *
 * Issue: #58
 *
 * This is a stub implementation that provides the same API as Sentry
 * but doesn't require the @sentry/react package to be installed.
 *
 * To enable Sentry:
 *   1. Install: npm install @sentry/react
 *   2. Replace this file with the full implementation
 *   3. Add Sentry DSN to .env: VITE_SENTRY_DSN=https://...@sentry.io/...
 *
 * Privacy:
 *   - PII is sanitized before sending
 *   - User identifiers are anonymized
 *   - Sensitive data is filtered from breadcrumbs
 */

/**
 * Initialize Sentry error tracking (stub - no-op)
 *
 * Only initializes if @sentry/react is installed and VITE_SENTRY_DSN is set.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  if (dsn) {
    console.info('[Sentry] @sentry/react not installed - error tracking disabled');
    console.info('[Sentry] To enable: npm install @sentry/react');
  }
}

/**
 * Manually capture an error with context (stub - logs to console)
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
  console.error('[Sentry stub] Error captured:', error, context);
}

/**
 * Add custom breadcrumb for debugging (stub - no-op)
 *
 * @param message - Breadcrumb message
 * @param data - Additional data
 */
export function addBreadcrumb(message: string, data?: Record<string, unknown>): void {
  // No-op in stub
  void message;
  void data;
}

/**
 * Set user context for error tracking (stub - no-op)
 *
 * @param user - User information (anonymized)
 */
export function setUser(user: { id: string; username?: string } | null): void {
  // No-op in stub
  void user;
}

/**
 * Clear user context (stub - no-op)
 */
export function clearUser(): void {
  // No-op in stub
}
