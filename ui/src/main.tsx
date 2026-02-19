import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { isTauri, loadAppConfig } from "@/lib/tauri";
import { reinitializeApi } from "@/api";

async function bootstrap() {
  if (isTauri()) {
    await loadAppConfig();
    reinitializeApi();
  }

  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

bootstrap();
