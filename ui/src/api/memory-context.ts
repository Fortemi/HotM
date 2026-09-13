/**
 * Client-side memory/archive selection for Fortemi multi-memory routing.
 */

const STORAGE_KEY = 'hotm_active_memory';
const MEMORY_HEADER = 'X-Fortemi-Memory';
export const MEMORY_CHANGED_EVENT = 'hotm-memory-changed';

export function subscribeMemoryChanges(listener: () => void): () => void {
  if (!isBrowser()) return () => undefined;
  const storageChanged = (event: StorageEvent) => {
    if (event.storageArea === window.localStorage
      && (event.key === null || event.key === STORAGE_KEY)) listener();
  };
  window.addEventListener(MEMORY_CHANGED_EVENT, listener);
  window.addEventListener('storage', storageChanged);
  return () => {
    window.removeEventListener(MEMORY_CHANGED_EVENT, listener);
    window.removeEventListener('storage', storageChanged);
  };
}

function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getMemoryRoutingHeaderName(): string {
  return MEMORY_HEADER;
}

export function getActiveMemory(): string | null {
  if (!isBrowser()) {
    return null;
  }

  const value = window.localStorage.getItem(STORAGE_KEY)?.trim();
  if (!value || value === 'public') {
    return null;
  }
  return value;
}

export function setActiveMemory(memoryName: string | null): void {
  if (!isBrowser()) {
    return;
  }

  const normalized = memoryName?.trim();
  if (!normalized || normalized === 'public') {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new CustomEvent(MEMORY_CHANGED_EVENT, { detail: { memory: null } }));
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, normalized);
  window.dispatchEvent(new CustomEvent(MEMORY_CHANGED_EVENT, { detail: { memory: normalized } }));
}

export function clearActiveMemory(): void {
  if (!isBrowser()) {
    return;
  }
  window.localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(MEMORY_CHANGED_EVENT, { detail: { memory: null } }));
}
