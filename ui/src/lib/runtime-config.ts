/**
 * Read a value from the runtime config injected by docker-entrypoint.sh.
 * Returns undefined when the key is missing or empty (so callers fall through
 * to build-time env or defaults).
 */
export function getRuntimeConfig(key: string): string | undefined {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const value = (window as any).__RUNTIME_CONFIG__?.[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function isLoopbackHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '[::1]'
    || normalized === '::1';
}

/**
 * Keep installed loopback deployments same-origin when runtime config was
 * generated with a different loopback spelling than the URL the operator used
 * in the browser, for example localhost vs 127.0.0.1 on the same port.
 */
export function normalizeBrowserApiBaseUrl(configuredUrl: string, currentOrigin?: string): string {
  const pageOrigin = currentOrigin
    ?? (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : null);
  if (!pageOrigin) return configuredUrl;

  try {
    const apiUrl = new URL(configuredUrl);
    const pageUrl = new URL(pageOrigin);
    if (
      apiUrl.protocol === pageUrl.protocol
      && apiUrl.port === pageUrl.port
      && isLoopbackHost(apiUrl.hostname)
      && isLoopbackHost(pageUrl.hostname)
      && apiUrl.hostname !== pageUrl.hostname
    ) {
      apiUrl.protocol = pageUrl.protocol;
      apiUrl.hostname = pageUrl.hostname;
      apiUrl.port = pageUrl.port;
      return apiUrl.toString().replace(/\/$/, '');
    }
  } catch {
    return configuredUrl;
  }

  return configuredUrl;
}
