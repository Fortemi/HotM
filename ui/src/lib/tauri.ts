/**
 * Tauri runtime detection and IPC utilities.
 *
 * Provides safe wrappers that work in both web and desktop contexts.
 * When running as a standalone web SPA, all Tauri calls gracefully no-op.
 *
 * Embedding-host integration: when HotM is loaded inside a shell that
 * publishes a `window.__HOTM_HOST__` adapter (see docs/host-adapter.md),
 * HTTP, SSE, and app config are routed through that adapter instead of
 * the Tauri HTTP plugin. This lets any Tauri/iframe host (not just the
 * standalone HotM Tauri app) embed HotM while keeping a single code
 * path in this repo.
 */

// --- Host adapter (generic embedding contract) ---

/**
 * Contract a shell can publish on `window.__HOTM_HOST__` to host HotM
 * inside its own window/iframe without relying on the Tauri HTTP plugin.
 *
 * All fields are optional except `network.sse.connect` and `network.fetch`
 * — both must be present for the adapter to be considered active.
 *
 * See `docs/host-adapter.md` for the full contract and lifecycle.
 */
export interface HotmHostAdapter {
  network: {
    sse: {
      connect(args: { url: string }): Promise<{ handle: string; event: string }>;
      close?(args: { handle: string }): Promise<void>;
    };
    fetch(args: {
      url: string;
      method?: string;
      headers?: Record<string, string>;
      body_b64?: string;
    }): Promise<{
      status: number;
      status_text?: string;
      headers?: Record<string, string>;
      body_b64?: string;
    }>;
  };
  config?: {
    api_base_url?: string;
  };
}

/** Return the host adapter if the embedding shell has published one. */
export function getHostAdapter(): HotmHostAdapter | null {
  if (typeof globalThis === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adapter = (globalThis as any).__HOTM_HOST__ as HotmHostAdapter | undefined;
  if (!adapter?.network?.sse?.connect || !adapter?.network?.fetch) return null;
  return adapter;
}

/** Convenience wrapper: adapter is present and usable. */
export function hasHostAdapter(): boolean {
  return getHostAdapter() !== null;
}

// --- Tauri detection ---

/** Detect whether the app is running inside a Tauri webview */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Invoke a Tauri IPC command. Returns `undefined` when not in Tauri.
 *
 * Uses dynamic import so the @tauri-apps/api module is never loaded
 * in web-only builds (tree-shaken away by Vite).
 */
export async function invokeTauri<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T | undefined> {
  if (!isTauri()) return undefined;
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// --- App Config (runtime API URL for desktop builds) ---

export interface AppConfig {
  api_base_url: string;
}

let _cachedConfig: AppConfig | null = null;

/**
 * Load app config from the host adapter or the Tauri config file.
 * Returns undefined when neither source is available.
 * Caches the result for synchronous access via getCachedConfig().
 */
export async function loadAppConfig(): Promise<AppConfig | undefined> {
  const adapter = getHostAdapter();
  if (adapter?.config?.api_base_url) {
    const config: AppConfig = { api_base_url: adapter.config.api_base_url };
    _cachedConfig = config;
    return config;
  }
  const config = await invokeTauri<AppConfig>("get_app_config");
  if (config) {
    _cachedConfig = config;
  }
  return config;
}

/** Return the cached config loaded at startup. Null if not loaded yet. */
export function getCachedConfig(): AppConfig | null {
  return _cachedConfig;
}

/** Save config to disk and update the cache. */
export async function saveAppConfig(config: AppConfig): Promise<void> {
  await invokeTauri("save_app_config", { config });
  _cachedConfig = config;
}

/** Reset cached config (for testing). */
export function _resetConfigCache(): void {
  _cachedConfig = null;
}

// --- HTTP fetch (bypasses webview network restrictions) ---

let _tauriFetch: typeof globalThis.fetch | null = null;

/**
 * Initialize the host-proxied fetch.
 *
 * Resolution order:
 *   1. `window.__HOTM_HOST__.network.fetch` — embedding-host adapter.
 *      Preferred when present because some hosts (Linux WebKit2GTK)
 *      cannot read from synthetic `ReadableStream` responses produced
 *      by the Tauri HTTP plugin's SSE path.
 *   2. `@tauri-apps/plugin-http` — standalone Tauri desktop mode.
 *   3. Native `window.fetch` — web SPA mode (returned on demand by
 *      getTauriFetch()).
 *
 * Must be called at startup before API requests are made.
 */
export async function initTauriFetch(): Promise<void> {
  const adapter = getHostAdapter();
  if (adapter) {
    _tauriFetch = makeAdapterFetch(adapter);
    return;
  }
  if (!isTauri()) return;
  try {
    const mod = await import("@tauri-apps/plugin-http");
    _tauriFetch = mod.fetch;
  } catch {
    // Plugin not available — fall back to native fetch
  }
}

/**
 * Get the appropriate fetch function.
 * Returns the host-adapter / Tauri plugin fetch when available,
 * or the native window.fetch for web SPA mode.
 */
export function getTauriFetch(): typeof globalThis.fetch {
  return _tauriFetch || globalThis.fetch;
}

/**
 * Build a `fetch` implementation that routes through the host adapter.
 * Handles both regular HTTP (`network.fetch`) and SSE (`network.sse.connect`)
 * by inspecting the Accept header for `text/event-stream`.
 *
 * For SSE, returns a Response backed by a ReadableStream that receives
 * events from the adapter via postMessage. Note: some webviews struggle
 * reading synthetic streams — the events API (see api/events.ts) prefers
 * the direct postMessage path (`connectHostProxy`) when an adapter is
 * present, which avoids this synthetic stream entirely.
 */
function makeAdapterFetch(adapter: HotmHostAdapter): typeof globalThis.fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const method = init?.method || "GET";
    const headers: Record<string, string> = {};
    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          headers[k] = v;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) headers[k] = v;
      } else {
        Object.assign(headers, init.headers);
      }
    }

    const accept = headers["accept"] || headers["Accept"] || "";
    if (accept.includes("text/event-stream")) {
      const { handle } = await adapter.network.sse.connect({ url });
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          function onMsg(ev: MessageEvent) {
            const d = ev.data as
              | {
                  __bt6_host_event?: boolean;
                  __hotm_host_event?: boolean;
                  event?: string;
                  handle?: string;
                  payload?: { type?: string; id?: string; data?: string };
                }
              | undefined;
            if (!d) return;
            const isEvent = d.__hotm_host_event || d.__bt6_host_event;
            if (!isEvent || d.event !== "network.sse" || d.handle !== handle)
              return;
            const p = d.payload;
            if (!p) return;
            if (p.type === "__close" || p.type === "__error") {
              window.removeEventListener("message", onMsg);
              try {
                controller.close();
              } catch {
                /* already closed */
              }
              return;
            }
            let lines = "";
            if (p.type && p.type !== "message") lines += `event: ${p.type}\n`;
            if (p.id) lines += `id: ${p.id}\n`;
            if (p.data) {
              for (const dl of p.data.split("\n")) lines += `data: ${dl}\n`;
            }
            lines += "\n";
            try {
              controller.enqueue(encoder.encode(lines));
            } catch {
              /* closed */
            }
          }
          window.addEventListener("message", onMsg);
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      });
    }

    let bodyB64 = "";
    if (init?.body) {
      const bodyStr =
        typeof init.body === "string"
          ? init.body
          : new TextDecoder().decode(init.body as ArrayBuffer);
      bodyB64 = btoa(unescape(encodeURIComponent(bodyStr)));
    }

    const r = await adapter.network.fetch({
      url,
      method,
      headers,
      ...(bodyB64 ? { body_b64: bodyB64 } : {}),
    });

    const bodyBytes = r.body_b64
      ? Uint8Array.from(atob(r.body_b64), (c) => c.charCodeAt(0))
      : new Uint8Array(0);

    return new Response(bodyBytes, {
      status: r.status,
      statusText: r.status_text || "",
      headers: r.headers || {},
    });
  };
}

/**
 * Listen for a Tauri event emitted from the Rust backend.
 * Returns an unsubscribe function; call it on component unmount.
 * No-ops when not running in Tauri (returns a no-op unsubscribe).
 */
export async function listenTauriEvent(
  event: string,
  handler: () => void,
): Promise<() => void> {
  if (!isTauri()) return () => {};
  try {
    const { listen } = await import("@tauri-apps/api/event");
    return listen(event, handler);
  } catch {
    return () => {};
  }
}

/** Render PlantUML to SVG via Tauri command. Returns undefined in web mode. */
export async function renderPlantUML(
  code: string,
): Promise<string | undefined> {
  return invokeTauri<string>("render_plantuml", { code });
}

/** Check PlantUML server availability via Tauri. Returns undefined in web mode. */
export async function ensurePlantUML(): Promise<void> {
  await invokeTauri<void>("ensure_plantuml");
}

// --- Tauri blob URL helper for cross-origin resources ---

import { useState, useEffect } from "react";

/**
 * React hook that resolves a remote URL to a displayable src.
 *
 * In browser mode the URL is returned as-is (same-origin or CORS works).
 * In Tauri mode the webview can't load cross-origin resources directly,
 * so we fetch through the HTTP plugin and return a blob: URL.
 *
 * Revokes the blob URL on unmount or URL change to prevent leaks.
 */
export function useBlobUrl(url: string | undefined): string | undefined {
  const [blobUrl, setBlobUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!url) {
      setBlobUrl(undefined);
      return;
    }

    // In browser mode, direct URLs work fine
    if (!isTauri() && !hasHostAdapter()) {
      setBlobUrl(url);
      return;
    }

    let revoked = false;
    let currentBlobUrl: string | null = null;

    getTauriFetch()(url)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (revoked) return;
        currentBlobUrl = URL.createObjectURL(blob);
        setBlobUrl(currentBlobUrl);
      })
      .catch((err) => {
        console.error("useBlobUrl failed:", err);
        if (!revoked) setBlobUrl(undefined);
      });

    return () => {
      revoked = true;
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
      }
    };
  }, [url]);

  return blobUrl;
}
