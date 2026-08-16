import { getRuntimeConfig } from '@/lib/runtime-config';

const STORAGE_KEY = 'hotm_api_bearer_token';
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

  const normalized = token?.trim();
  if (!normalized) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, normalized);
}

export function getAuthorizationHeader(): Record<string, string> {
  const token = getApiBearerToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function hasApiBearerToken(): boolean {
  return getApiBearerToken() !== null;
}

export function getActiveTenantId(): string | null {
  return activeTenantId;
}

export function setActiveTenantId(tenantId: string | null): void {
  activeTenantId = tenantId?.trim() || null;
}
