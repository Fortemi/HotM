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
