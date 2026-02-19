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
