/**
 * Tauri runtime detection and IPC utilities.
 *
 * Provides safe wrappers that work in both web and desktop contexts.
 * When running as a standalone web SPA, all Tauri calls gracefully no-op.
 */

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
 * Load app config from Tauri config file.
 * Returns undefined when not in Tauri or if no config exists.
 * Caches the result for synchronous access via getCachedConfig().
 */
export async function loadAppConfig(): Promise<AppConfig | undefined> {
  const config = await invokeTauri<AppConfig>("get_app_config");
  if (config) {
    _cachedConfig = config;
  }
  return config;
}

/** Return the cached config loaded at startup. Null if not in Tauri or not yet loaded. */
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

// --- Tauri HTTP fetch (bypasses webview network restrictions) ---

let _tauriFetch: typeof globalThis.fetch | null = null;

/**
 * Initialize the Tauri HTTP plugin fetch.
 * Must be called at startup before API requests are made.
 * In web mode this is a no-op.
 */
export async function initTauriFetch(): Promise<void> {
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
 * Returns the Tauri HTTP plugin fetch when running in desktop mode,
 * or the native window.fetch for web SPA mode.
 */
export function getTauriFetch(): typeof globalThis.fetch {
  return _tauriFetch || globalThis.fetch;
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
    if (!isTauri()) {
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
