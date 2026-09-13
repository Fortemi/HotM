import { getRuntimeConfig } from '@/lib/runtime-config';

const STORAGE_KEY = 'hotm_api_bearer_token';
export const AUTH_CONTEXT_CHANGED_EVENT = 'hotm-auth-context-changed';
let activeTenantId: string | null = null;

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getApiBearerToken(): string | null {
  if (isBrowser()) {
    const stored = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (stored) return stored;
  }

  const runtimeToken = getRuntimeConfig('VITE_API_BEARER_TOKEN')?.trim();
  if (runtimeToken) return runtimeToken;

  const envToken = import.meta.env.VITE_API_BEARER_TOKEN?.trim();
  return envToken || null;
}

export function setApiBearerToken(token: string | null): void {
  if (!isBrowser()) return;

  const previousToken = getApiBearerToken();
  const previousTenant = getActiveTenantId();
  activeTenantId = null;
  const normalized = token?.trim();
  if (!normalized) {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, normalized);
  }
  if (previousToken !== getApiBearerToken() || previousTenant !== getActiveTenantId()) {
    window.dispatchEvent(new Event(AUTH_CONTEXT_CHANGED_EVENT));
  }
}

export function getAuthorizationHeader(): Record<string, string> {
  const token = getApiBearerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function hasApiBearerToken(): boolean {
  return getApiBearerToken() !== null;
}

export function getActiveTenantId(): string | null {
  if (activeTenantId) return activeTenantId;
  // A decoding hint only: the server still authenticates the bearer and tenant.
  // Never use this claim to grant access; it narrows which SSE events render.
  const token = getApiBearerToken();
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const tenant = payload['fortemi:tenant_id'];
    return typeof tenant === 'string' && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(tenant)
      ? tenant.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function setActiveTenantId(tenantId: string | null): void {
  const previous = getActiveTenantId();
  activeTenantId = tenantId?.trim() || null;
  if (isBrowser() && previous !== getActiveTenantId()) {
    window.dispatchEvent(new Event(AUTH_CONTEXT_CHANGED_EVENT));
  }
}

export function subscribeAuthContextChanges(listener: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const storageChanged = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage
      || (event.key !== null && event.key !== STORAGE_KEY)) return;
    activeTenantId = null;
    listener();
  };
  window.addEventListener(AUTH_CONTEXT_CHANGED_EVENT, listener);
  window.addEventListener('storage', storageChanged);
  return () => {
    window.removeEventListener(AUTH_CONTEXT_CHANGED_EVENT, listener);
    window.removeEventListener('storage', storageChanged);
  };
}
