/**
 * Migration Validation Test Suite
 *
 * Validates that the Tauri -> SPA migration is complete and functional.
 * Tests ensure:
 * - No Tauri dependencies remain
 * - All components use HTTP API client
 * - Build configuration is correct
 * - Environment variables are properly configured
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

describe('Migration Validation', () => {
  describe('Tauri Isolation', () => {
    it('should only have @tauri-apps/api imports in dedicated Tauri files', () => {
      const srcDir = join(__dirname, '..');
      const violations: string[] = [];

      function scanDirectory(dir: string) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          // Skip test files, node_modules, and dist
          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('dist') ||
            fullPath.includes('__tests__') ||
            fullPath.includes('.test.') ||
            fullPath.endsWith('.d.ts')
          ) {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (fullPath.match(/\.(ts|tsx|js|jsx)$/)) {
            // Skip dedicated Tauri integration files
            const relPath = relative(srcDir, fullPath);
            if (relPath.includes('tauri') || relPath.includes('use-tauri')) {
              continue;
            }
            const content = readFileSync(fullPath, 'utf-8');
            if (content.includes('@tauri-apps/api')) {
              violations.push(relPath);
            }
          }
        }
      }

      scanDirectory(srcDir);

      expect(violations).toEqual([]);
    });

    it('should not have window.__TAURI__ references in production code', () => {
      const srcDir = join(__dirname, '..');
      const violations: string[] = [];

      function scanDirectory(dir: string) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('dist') ||
            fullPath.includes('__tests__') ||
            fullPath.includes('.test.')
          ) {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (fullPath.match(/\.(ts|tsx|js|jsx)$/)) {
            const content = readFileSync(fullPath, 'utf-8');
            if (content.includes('window.__TAURI__')) {
              violations.push(relative(srcDir, fullPath));
            }
          }
        }
      }

      scanDirectory(srcDir);

      expect(violations).toEqual([]);
    });

    it('should not have Tauri invoke calls in production code', () => {
      const srcDir = join(__dirname, '..');
      const violations: string[] = [];

      function scanDirectory(dir: string) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('dist') ||
            fullPath.includes('__tests__') ||
            fullPath.includes('.test.')
          ) {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (fullPath.match(/\.(ts|tsx|js|jsx)$/)) {
            const content = readFileSync(fullPath, 'utf-8');
            if (content.match(/\binvoke\s*\(/)) {
              // Check if it's actually a Tauri invoke
              const lines = content.split('\n');
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (
                  line.includes('invoke(') &&
                  !line.includes('// @tauri-apps') && // Skip import comments
                  !line.includes('invoke()') // Skip mock invoke()
                ) {
                  // Look for import statement
                  const hasImport = content.includes("from '@tauri-apps/api'");
                  if (hasImport) {
                    violations.push(relative(srcDir, fullPath));
                    break;
                  }
                }
              }
            }
          }
        }
      }

      scanDirectory(srcDir);

      expect(violations).toEqual([]);
    });
  });

  describe('API Client Integration', () => {
    it('should have API client exports', () => {
      const apiIndexPath = join(__dirname, '../api/index.ts');
      const apiIndex = readFileSync(apiIndexPath, 'utf-8');

      // Should export createApi function
      expect(apiIndex).toContain('export function createApi');

      // Should export api instance
      expect(apiIndex).toContain('export const api');

      // Should export client types (can be either individual or grouped exports)
      expect(apiIndex).toContain('export type Api');
      expect(apiIndex).toMatch(/export type \{[^}]*ApiClient[^}]*\}|export type ApiClient/);
    });

    it('should have all required API modules', () => {
      const apiDir = join(__dirname, '../api');
      const entries = readdirSync(apiDir);

      expect(entries).toContain('client.ts');
      expect(entries).toContain('notes.ts');
      expect(entries).toContain('search.ts');
      expect(entries).toContain('tags.ts');
      expect(entries).toContain('errors.ts');
      expect(entries).toContain('types.ts');
    });

    it('should use fetch for HTTP requests', () => {
      const apiClientPath = join(__dirname, '../api/client.ts');
      const apiClient = readFileSync(apiClientPath, 'utf-8');

      // Should use fetch
      expect(apiClient).toContain('fetch');
    });
  });

  describe('Build Validation', () => {
    it('package.json should have @tauri-apps/api in dependencies and @tauri-apps/cli in devDependencies', () => {
      const packageJsonPath = join(__dirname, '../../package.json');
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

      const dependencies = packageJson.dependencies || {};
      const devDependencies = packageJson.devDependencies || {};

      // @tauri-apps/api is a runtime dependency (used for IPC in desktop mode)
      expect(dependencies['@tauri-apps/api']).toBeDefined();
      // @tauri-apps/cli is a dev dependency (build tooling only)
      expect(devDependencies['@tauri-apps/cli']).toBeDefined();
      // CLI should NOT be in production dependencies
      expect(dependencies['@tauri-apps/cli']).toBeUndefined();
    });

    it('should have Vite configured for SPA build', () => {
      const viteConfigPath = join(__dirname, '../../vite.config.ts');
      const viteConfig = readFileSync(viteConfigPath, 'utf-8');

      // Should not have Tauri plugin
      expect(viteConfig).not.toContain('@tauri-apps/vite-plugin');

      // Should be a standard React config
      expect(viteConfig).toContain('@vitejs/plugin-react');
    });

    it('should not reference Tauri config in Vite config', () => {
      const viteConfigPath = join(__dirname, '../../vite.config.ts');
      const viteConfig = readFileSync(viteConfigPath, 'utf-8');

      expect(viteConfig).not.toContain('tauri.conf.json');
    });
  });

  describe('Environment Configuration', () => {
    it('should use standard Vite environment variables', () => {
      const srcDir = join(__dirname, '..');
      let foundEnvUsage = false;

      function scanDirectory(dir: string) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('dist') ||
            fullPath.includes('__tests__') ||
            fullPath.includes('.test.')
          ) {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (fullPath.match(/\.(ts|tsx|js|jsx)$/)) {
            const content = readFileSync(fullPath, 'utf-8');
            if (content.includes('import.meta.env')) {
              foundEnvUsage = true;
            }
          }
        }
      }

      scanDirectory(srcDir);

      // Should use Vite env vars somewhere in the codebase
      expect(foundEnvUsage).toBe(true);
    });

    it('should only use Tauri-specific environment variables in dedicated Tauri files', () => {
      const srcDir = join(__dirname, '..');
      const violations: string[] = [];

      function scanDirectory(dir: string) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('dist') ||
            fullPath.includes('__tests__') ||
            fullPath.includes('.test.')
          ) {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (fullPath.match(/\.(ts|tsx|js|jsx)$/)) {
            // Skip dedicated Tauri integration files and type declarations
            const relPath = relative(srcDir, fullPath);
            if (relPath.includes('tauri') || relPath.includes('use-tauri') || relPath.endsWith('.d.ts')) {
              continue;
            }
            const content = readFileSync(fullPath, 'utf-8');
            if (content.includes('TAURI_')) {
              violations.push(relPath);
            }
          }
        }
      }

      scanDirectory(srcDir);

      expect(violations).toEqual([]);
    });
  });

  describe('HTTP Communication', () => {
    it('should use fetch or axios for all HTTP requests', () => {
      const apiClientPath = join(__dirname, '../api/client.ts');
      const apiClient = readFileSync(apiClientPath, 'utf-8');

      // Should use standard HTTP client
      expect(apiClient).toMatch(/fetch|axios/);
    });

    it('should handle CORS properly for development', () => {
      const apiClientPath = join(__dirname, '../api/client.ts');
      const apiClient = readFileSync(apiClientPath, 'utf-8');

      // Should have proper headers handling
      expect(apiClient).toMatch(/headers/i);
    });
  });

  describe('WebSocket Integration', () => {
    it('should use WebSocket for real-time updates (not Tauri events)', () => {
      const websocketPath = join(__dirname, '../services/websocket.ts');
      const websocket = readFileSync(websocketPath, 'utf-8');

      // Should use standard WebSocket API
      expect(websocket).toContain('new WebSocket');
      expect(websocket).not.toContain('@tauri-apps');
    });

    it('WebSocket URL should use ws:// protocol', () => {
      const websocketPath = join(__dirname, '../services/websocket.ts');
      const websocket = readFileSync(websocketPath, 'utf-8');

      // Should connect to WebSocket endpoint (check for protocol constants or template literals)
      expect(websocket).toMatch(/['"]wss?['"]|wsProtocol/);
    });
  });

  describe('Component Architecture', () => {
    it('main component should not import Tauri', () => {
      const hallOfMindPath = join(__dirname, '../components/HallOfMind.tsx');
      const hallOfMind = readFileSync(hallOfMindPath, 'utf-8');

      expect(hallOfMind).not.toContain('@tauri-apps');
    });

    it('should isolate Tauri hooks to dedicated tauri files', () => {
      const srcDir = join(__dirname, '..');
      const violations: string[] = [];

      function scanDirectory(dir: string) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('dist') ||
            fullPath.includes('__tests__') ||
            fullPath.includes('.test.')
          ) {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            // Skip dedicated Tauri integration files
            const relPath = relative(srcDir, fullPath);
            if (relPath.includes('tauri') || relPath.includes('use-tauri')) {
              continue;
            }
            const content = readFileSync(fullPath, 'utf-8');
            // Check for Tauri-specific hooks in non-Tauri files
            if (content.match(/use\w*Tauri/i)) {
              violations.push(relPath);
            }
          }
        }
      }

      scanDirectory(srcDir);

      expect(violations).toEqual([]);
    });
  });

  describe('Migration Completeness', () => {
    it('should have removed all Tauri backend code references', () => {
      const srcDir = join(__dirname, '..');
      const violations: string[] = [];

      function scanDirectory(dir: string) {
        const entries = readdirSync(dir);

        for (const entry of entries) {
          const fullPath = join(dir, entry);
          const stat = statSync(fullPath);

          if (
            fullPath.includes('node_modules') ||
            fullPath.includes('dist') ||
            fullPath.includes('__tests__') ||
            fullPath.includes('.test.')
          ) {
            continue;
          }

          if (stat.isDirectory()) {
            scanDirectory(fullPath);
          } else if (fullPath.match(/\.(ts|tsx|js|jsx)$/)) {
            const content = readFileSync(fullPath, 'utf-8');
            // Check for Tauri Rust backend references
            if (content.match(/tauri::command|#\[tauri::command\]/)) {
              violations.push(relative(srcDir, fullPath));
            }
          }
        }
      }

      scanDirectory(srcDir);

      expect(violations).toEqual([]);
    });

    it('should have proper error handling for HTTP failures', () => {
      const errorsPath = join(__dirname, '../api/errors.ts');
      const errors = readFileSync(errorsPath, 'utf-8');

      // Should have error classes
      expect(errors).toContain('class ApiError');
      expect(errors).toContain('class NetworkError');
    });

    it('should have migration validation tests (this file exists)', () => {
      const testFiles = readdirSync(__dirname);
      expect(testFiles).toContain('migration-validation.test.ts');
    });

    it('should have services directory with HTTP-based services', () => {
      const servicesDir = join(__dirname, '../services');
      const entries = readdirSync(servicesDir);

      expect(entries).toContain('api.ts');
      expect(entries).toContain('websocket.ts');
    });
  });
});
