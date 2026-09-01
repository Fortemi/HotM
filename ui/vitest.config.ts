import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify('test'),
    __GIT_SHA__: JSON.stringify('abc1234'),
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/components/__tests__/setup.ts',
    exclude: ['node_modules/**', 'e2e/**'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/**/__tests__/**',
        '**/*.test.*',
        '**/*.spec.*',
        '*.config.ts',
        'src-tauri/**'
      ]
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
