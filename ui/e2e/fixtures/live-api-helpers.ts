/**
 * Live API Helpers for Smoke & UAT Tests
 *
 * Direct HTTP client for test data setup/teardown against the real Fortemi API.
 * Not routed through the UI — used for precondition setup and postcondition verification.
 *
 * All UAT-created notes are tagged `_hotm_uat` so orphans can be found and cleaned.
 */

const UAT_TAG = '_hotm_uat';

export function getApiBaseUrl(): string {
  const deployUrl = process.env.HOTM_DEPLOY_URL ?? 'http://localhost:4180';
  // HOTM_API_URL overrides if API is on a different host/port than the UI.
  // Default assumes API is colocated at the deploy URL under /api/v1.
  return process.env.HOTM_API_URL ?? `${deployUrl.replace(/\/$/, '')}/api/v1`;
}

export function getLiveMemoryName(): string | null {
  return process.env.HOTM_LIVE_MEMORY?.trim() || null;
}

export function getLiveApiToken(): string | null {
  return process.env.HOTM_API_TOKEN?.trim()
    || process.env.VITE_API_BEARER_TOKEN?.trim()
    || null;
}

function liveAuthHeaders(): Record<string, string> {
  const token = getLiveApiToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function assertAuthRequired(): Promise<void> {
  const base = getApiBaseUrl();
  const res = await fetch(`${base}/notes?limit=1`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status !== 401) {
    const text = await res.text().catch(() => '');
    throw new Error(`Expected unauthenticated /notes to return 401, got ${res.status}: ${text}`);
  }
}

export async function ensureLiveMemory(memoryName = getLiveMemoryName()): Promise<void> {
  const liveMemory = memoryName?.trim() || null;
  if (!liveMemory) return;

  const base = getApiBaseUrl();
  const res = await fetch(`${base}/archives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...liveAuthHeaders() },
    body: JSON.stringify({
      name: liveMemory,
      description: 'HotM live asset lifecycle e2e archive',
    }),
  });
  if (res.status === 201) return;

  const text = await res.text().catch(() => '');
  if (res.status === 400 && text.includes('already exists')) return;
  throw new Error(`ensureLiveMemory failed (${res.status}): ${text}`);
}

export async function deleteLiveMemory(memoryName: string | null): Promise<boolean> {
  const liveMemory = memoryName?.trim() || null;
  if (!liveMemory) return true;
  if (!liveMemory.startsWith('hotm_live_')) {
    throw new Error(`Refusing to delete non-test memory ${liveMemory}`);
  }

  const base = getApiBaseUrl();
  const res = await fetch(`${base}/archives/${encodeURIComponent(liveMemory)}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', ...liveAuthHeaders() },
  });
  return res.ok || res.status === 404;
}

/** Derive the API server root (without /api/v1 suffix) for root-level endpoints like /health */
function getApiRootUrl(): string {
  const base = getApiBaseUrl();
  return base.replace(/\/api\/v\d+\/?$/, '');
}

async function apiFetch(path: string, init?: RequestInit, memoryOverride?: string | null): Promise<Response> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const liveMemory = memoryOverride === undefined ? getLiveMemoryName() : memoryOverride?.trim() || null;
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...liveAuthHeaders(),
      ...(liveMemory ? { 'X-Fortemi-Memory': liveMemory } : {}),
      ...init?.headers,
    },
  });
  return res;
}

// ── Health ────────────────────────────────────────────────────────────

export interface HealthResult {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

export async function checkHealth(): Promise<HealthResult> {
  // Fortemi serves /health at the server root, not under /api/v1.
  // Try /api/v1/health first, fall back to root /health.
  try {
    let res = await apiFetch('/health');
    if (!res.ok) {
      const rootUrl = `${getApiRootUrl()}/health`;
      res = await fetch(rootUrl, {
        headers: { 'Content-Type': 'application/json', ...liveAuthHeaders() },
      });
    }
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: { error: String(err) } };
  }
}

// ── Notes ─────────────────────────────────────────────────────────────

export interface CreatedNote {
  id: string;
  [key: string]: unknown;
}

export async function createTestNote(
  content: string,
  title?: string,
): Promise<CreatedNote> {
  const body = {
    content,
    format: 'markdown',
    source: 'uat',
    title: title ?? `UAT test note ${Date.now()}`,
    tags: [UAT_TAG],
  };
  const res = await apiFetch('/notes', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`createTestNote failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  // Fortemi returns { note_id: string } on create
  return { id: data.note_id ?? data.id, ...data };
}

export interface NoteListResult {
  notes: Array<Record<string, unknown>>;
  total: number;
  raw: Record<string, unknown>;
}

export async function listNotes(limit = 20): Promise<NoteListResult> {
  const res = await apiFetch(`/notes?limit=${limit}&sort_by=created_at_utc&sort_order=desc`);
  if (!res.ok) {
    throw new Error(`listNotes failed (${res.status})`);
  }
  const raw = await res.json();
  const notes: Array<Record<string, unknown>> = raw.notes ?? [];
  return { notes, total: raw.total ?? notes.length, raw };
}

export async function getNote(id: string): Promise<Record<string, unknown>> {
  const res = await apiFetch(`/notes/${id}`);
  if (!res.ok) {
    throw new Error(`getNote(${id}) failed (${res.status})`);
  }
  return res.json();
}

// ── Search ────────────────────────────────────────────────────────────

export interface SearchResult {
  results: Array<Record<string, unknown>>;
  total: number;
  raw: Record<string, unknown>;
}

export async function search(query: string, limit = 10): Promise<SearchResult> {
  const res = await apiFetch(`/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  if (!res.ok) {
    throw new Error(`search failed (${res.status})`);
  }
  const raw = await res.json();
  const results: Array<Record<string, unknown>> = raw.results ?? raw.notes ?? [];
  return { results, total: raw.total ?? results.length, raw };
}

// ── Tags ──────────────────────────────────────────────────────────────

export interface TagListResult {
  tags: Array<Record<string, unknown>>;
  raw: unknown;
}

export async function listTags(): Promise<TagListResult> {
  const res = await apiFetch('/tags');
  if (!res.ok) {
    throw new Error(`listTags failed (${res.status})`);
  }
  const raw = await res.json();
  const tags: Array<Record<string, unknown>> = raw.tags ?? (Array.isArray(raw) ? raw : []);
  return { tags, raw };
}

// ── Cleanup ───────────────────────────────────────────────────────────

export async function deleteNote(id: string): Promise<boolean> {
  const res = await apiFetch(`/notes/${id}`, { method: 'DELETE' });
  return res.ok;
}

export async function downloadAttachmentBytes(attachmentId: string, memoryName?: string | null): Promise<Uint8Array> {
  const res = await apiFetch(`/attachments/${attachmentId}/download`, {
    headers: {},
  }, memoryName);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`downloadAttachmentBytes failed (${res.status}): ${text}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function listNoteAttachments(noteId: string, memoryName?: string | null): Promise<Array<Record<string, unknown>>> {
  const res = await apiFetch(`/notes/${noteId}/attachments`, {
    headers: {},
  }, memoryName);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`listNoteAttachments failed (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.attachments ?? (Array.isArray(data) ? data : []);
}

export async function exportFullV1Shard(): Promise<Uint8Array> {
  const res = await apiFetch(
    '/backup/knowledge-shard?schema_version=2.0.0&profile=full-v1&include_blobs=true',
    { headers: {} },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`exportFullV1Shard failed (${res.status}): ${text}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export async function importFullV1Shard(shard: Uint8Array, memoryName: string): Promise<Record<string, unknown>> {
  const res = await apiFetch('/backup/knowledge-shard/import', {
    method: 'POST',
    body: JSON.stringify({
      shard_base64: Buffer.from(shard).toString('base64'),
      dry_run: false,
      on_conflict: 'replace',
      skip_embedding_regen: true,
      verify_signature: 'trusted-local-only',
    }),
  }, memoryName);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`importFullV1Shard failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Clean up all notes tagged with _hotm_uat.
 * Safe to call multiple times — idempotent.
 */
export async function cleanup(): Promise<{ deleted: number; errors: number }> {
  let deleted = 0;
  let errors = 0;

  try {
    // List notes filtered by our UAT tag
    const res = await apiFetch(`/notes?tags=${UAT_TAG}&limit=200`);
    if (!res.ok) return { deleted: 0, errors: 0 };

    const data = await res.json();
    const notes: Array<{ id: string }> = data.notes ?? [];

    for (const note of notes) {
      try {
        const ok = await deleteNote(note.id);
        if (ok) deleted++;
        else errors++;
      } catch {
        errors++;
      }
    }
  } catch {
    // API may not support tag filtering — try listing all and filtering client-side
    try {
      const res = await apiFetch('/notes?limit=200');
      if (!res.ok) return { deleted, errors };

      const data = await res.json();
      const notes: Array<{ id: string; tags?: string[] }> = data.notes ?? [];
      const uatNotes = notes.filter(
        (n) => Array.isArray(n.tags) && n.tags.includes(UAT_TAG),
      );

      for (const note of uatNotes) {
        try {
          const ok = await deleteNote(note.id);
          if (ok) deleted++;
          else errors++;
        } catch {
          errors++;
        }
      }
    } catch {
      // Best effort — nothing more we can do
    }
  }

  return { deleted, errors };
}

/**
 * Global cleanup intended for use as Playwright globalTeardown.
 * Logs results to stdout.
 */
export async function globalCleanup(): Promise<void> {
  console.log('[UAT Cleanup] Cleaning up _hotm_uat tagged notes...');
  const result = await cleanup();
  console.log(
    `[UAT Cleanup] Done: ${result.deleted} deleted, ${result.errors} errors`,
  );
}

export { UAT_TAG };
