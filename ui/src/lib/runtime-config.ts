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
