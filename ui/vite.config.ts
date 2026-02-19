import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],
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
