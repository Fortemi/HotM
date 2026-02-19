import { useMemo, useCallback } from "react";
import {
  isTauri as detectTauri,
  renderPlantUML,
  ensurePlantUML,
  invokeTauri,
  getCachedConfig,
  saveAppConfig as saveConfig,
  type AppConfig,
} from "@/lib/tauri";

export interface UseTauriResult {
  /** Whether the app is running inside a Tauri desktop window */
  isTauri: boolean;
  /** Render PlantUML code to SVG. Returns undefined when not in Tauri. */
  renderPlantUML: (code: string) => Promise<string | undefined>;
  /** Check PlantUML server availability. No-op in web mode. */
  ensurePlantUML: () => Promise<void>;
  /** Generic Tauri invoke. Returns undefined when not in Tauri. */
  invoke: <T>(
    cmd: string,
    args?: Record<string, unknown>,
  ) => Promise<T | undefined>;
  /** Runtime app config loaded at startup. Null when not in Tauri. */
  appConfig: AppConfig | null;
  /** Save app config to disk and update cache. */
  saveAppConfig: (config: AppConfig) => Promise<void>;
}

/**
 * React hook providing Tauri desktop integration.
 *
 * Safe to call in any context — all methods gracefully degrade
 * when running as a standalone web SPA.
 */
export function useTauri(): UseTauriResult {
  const tauriDetected = useMemo(() => detectTauri(), []);

  const wrappedRenderPlantUML = useCallback(
    (code: string) => renderPlantUML(code),
    [],
  );

  const wrappedEnsurePlantUML = useCallback(async () => {
    await ensurePlantUML();
  }, []);

  const wrappedInvoke = useCallback(
    <T>(cmd: string, args?: Record<string, unknown>) =>
      invokeTauri<T>(cmd, args),
    [],
  );

  const appConfig = useMemo(() => getCachedConfig(), []);

  const wrappedSaveConfig = useCallback(
    (config: AppConfig) => saveConfig(config),
    [],
  );

  return {
    isTauri: tauriDetected,
    renderPlantUML: wrappedRenderPlantUML,
    ensurePlantUML: wrappedEnsurePlantUML,
    invoke: wrappedInvoke,
    appConfig,
    saveAppConfig: wrappedSaveConfig,
  };
}
