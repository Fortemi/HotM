import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "child_process";

const host = process.env.TAURI_DEV_HOST;

function getGitSha(): string {
  try {
    return execSync("git rev-parse --short HEAD", { encoding: "utf-8" }).trim();
  } catch {
    return "unknown";
  }
}

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || "dev"),
    __GIT_SHA__: JSON.stringify(process.env.VITE_GIT_SHA || getGitSha()),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      external: (id) => {
        // Exclude test files from production build
        return id.includes('.test.') || id.includes('__tests__') || id.includes('/test/');
      },
      output: {
        // Temporarily disabled manual chunking to diagnose white screen issue
        // manualChunks: {
        //   'mermaid-core': ['mermaid'],
        //   'ui-vendor': ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
        //   'react-vendor': ['react', 'react-dom'],
        //   'editor-vendor': ['@uiw/react-md-editor', 'react-markdown']
        // }
      }
    }
  },

  // Development server configuration
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
  },
  // Exclude Tauri source from file watching
  watchOptions: {
    ignored: ["**/src-tauri/**"],
  },
}));
