import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { isTauri, loadAppConfig, initTauriFetch } from "@/lib/tauri";
import { api, reinitializeApi } from "@/api";
import { reinitializeCompatApi } from "@/api/compat";

async function bootstrap() {
  if (isTauri()) {
    await loadAppConfig();
    await initTauriFetch();
    reinitializeApi();
    reinitializeCompatApi();
  }

  // Resolve compatibility early, but never prevent local/read-only UI startup.
  void api.compatibilityGate.preflight().catch(() => undefined);

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
