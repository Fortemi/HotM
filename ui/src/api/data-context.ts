import { getActiveTenantId, getApiBearerToken, subscribeAuthContextChanges } from './auth-context';
import { getActiveMemory, subscribeMemoryChanges } from './memory-context';

let identity: string | undefined;
let revision = 0;
let apiEndpoint: string | null = null;
const API_ENDPOINT_CHANGED_EVENT = 'hotm-api-endpoint-changed';

export function getDataApiEndpoint(): string | null { return apiEndpoint; }

export function setDataApiEndpoint(endpoint: string): void {
  const normalized = endpoint.replace(/\/+$/, '');
  if (normalized === apiEndpoint) return;
  apiEndpoint = normalized;
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(API_ENDPOINT_CHANGED_EVENT));
}

// Credentials stay private to this module; React keys and events use only a revision.
export function getDataContextRevision(): number {
  const next = JSON.stringify([apiEndpoint, getApiBearerToken(), getActiveTenantId(), getActiveMemory()]);
  if (next !== identity) {
    identity = next;
    revision += 1;
  }
  return revision;
}

export function subscribeDataContextChanges(listener: () => void): () => void {
  let observed = getDataContextRevision();
  const changed = () => {
    const next = getDataContextRevision();
    if (next !== observed) {
      observed = next;
      listener();
    }
  };
  const auth = subscribeAuthContextChanges(changed);
  const memory = subscribeMemoryChanges(changed);
  if (typeof window !== 'undefined') window.addEventListener(API_ENDPOINT_CHANGED_EVENT, changed);
  return () => {
    auth(); memory();
    if (typeof window !== 'undefined') window.removeEventListener(API_ENDPOINT_CHANGED_EVENT, changed);
  };
}

// A cache discriminator, not authentication or encryption. Never persist the input.
export async function getDataContextCacheIdentity(namespace: string): Promise<string | null> {
  const scope = captureDataContext();
  try {
    if (!globalThis.crypto?.subtle) return null;
    const bytes = new TextEncoder().encode(JSON.stringify(['hotm-cache-v2', identity, namespace]));
    const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
    scope.assertCurrent();
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  } finally { scope.close(); }
}

export class ContextChangedError extends Error {
  constructor() {
    super('The active data context changed during this operation.');
    this.name = 'ContextChangedError';
  }
}

export function captureDataContext() {
  const captured = getDataContextRevision();
  const controller = new AbortController();
  const unsubscribe = subscribeDataContextChanges(() => controller.abort());
  return {
    signal: controller.signal,
    assertCurrent(): void {
      if (controller.signal.aborted || captured !== getDataContextRevision()) {
        throw new ContextChangedError();
      }
    },
    close: unsubscribe,
  };
}
