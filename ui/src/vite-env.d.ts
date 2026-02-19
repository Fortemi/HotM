/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Tauri runtime detection
interface Window {
  __TAURI_INTERNALS__?: Record<string, unknown>;
}
