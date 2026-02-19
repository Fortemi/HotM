/**
 * Tauri Config Test Suite
 *
 * Tests runtime config loading, caching, and API URL resolution
 * for the Tauri desktop app.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Tauri Config', () => {
  describe('Config caching in tauri.ts', () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it('getCachedConfig returns null before loadAppConfig is called', async () => {
      const { getCachedConfig } = await import('../lib/tauri');
      // Reset cache to ensure clean state
      const { _resetConfigCache } = await import('../lib/tauri');
      _resetConfigCache();
      expect(getCachedConfig()).toBeNull();
    });

    it('getCachedConfig returns null when not in Tauri', async () => {
      const { getCachedConfig, _resetConfigCache } = await import('../lib/tauri');
      _resetConfigCache();
      // Not in Tauri (no __TAURI_INTERNALS__), so cache stays null
      expect(getCachedConfig()).toBeNull();
    });

    it('loadAppConfig returns undefined when not in Tauri', async () => {
      const { loadAppConfig, _resetConfigCache } = await import('../lib/tauri');
      _resetConfigCache();
      const result = await loadAppConfig();
      expect(result).toBeUndefined();
    });

    it('isTauri returns false in test environment', async () => {
      const { isTauri } = await import('../lib/tauri');
      expect(isTauri()).toBe(false);
    });
  });

  describe('API URL resolution', () => {
    it('getApiBaseUrl falls through to localhost when no config or env var', async () => {
      // The api/index.ts module calls getCachedConfig() which returns null in tests,
      // and import.meta.env.VITE_API_BASE_URL is not set, so it should fall through
      // to the default localhost:3000.
      const apiIndexPath = join(__dirname, '../api/index.ts');
      const apiIndex = readFileSync(apiIndexPath, 'utf-8');

      // Verify the priority chain exists in the source
      expect(apiIndex).toContain('getCachedConfig');
      expect(apiIndex).toContain('VITE_API_BASE_URL');
      expect(apiIndex).toContain("'http://localhost:3000'");
    });

    it('reinitializeApi export exists', async () => {
      const apiIndexPath = join(__dirname, '../api/index.ts');
      const apiIndex = readFileSync(apiIndexPath, 'utf-8');

      expect(apiIndex).toContain('export function reinitializeApi');
    });

    it('api export is mutable (let, not const)', async () => {
      const apiIndexPath = join(__dirname, '../api/index.ts');
      const apiIndex = readFileSync(apiIndexPath, 'utf-8');

      expect(apiIndex).toContain('export let api');
    });
  });

  describe('Bootstrap flow', () => {
    it('main.tsx imports bootstrap dependencies', () => {
      const mainPath = join(__dirname, '../main.tsx');
      const main = readFileSync(mainPath, 'utf-8');

      expect(main).toContain('isTauri');
      expect(main).toContain('loadAppConfig');
      expect(main).toContain('reinitializeApi');
    });

    it('main.tsx gates config load behind isTauri check', () => {
      const mainPath = join(__dirname, '../main.tsx');
      const main = readFileSync(mainPath, 'utf-8');

      // Should check isTauri() before loading config
      expect(main).toContain('if (isTauri())');
      expect(main).toContain('await loadAppConfig()');
    });
  });

  describe('Tauri isolation preserved', () => {
    it('@tauri-apps/api imports stay in dedicated Tauri files only', () => {
      // api/index.ts imports from @/lib/tauri, NOT from @tauri-apps/api
      const apiIndexPath = join(__dirname, '../api/index.ts');
      const apiIndex = readFileSync(apiIndexPath, 'utf-8');

      expect(apiIndex).not.toContain('@tauri-apps/api');
      expect(apiIndex).toContain("from '@/lib/tauri'");
    });
  });

  describe('Rust config module', () => {
    it('config.rs exists with expected structure', () => {
      const configPath = join(__dirname, '../../src-tauri/src/config.rs');
      const config = readFileSync(configPath, 'utf-8');

      expect(config).toContain('struct AppConfig');
      expect(config).toContain('api_base_url');
      expect(config).toContain('fn load_config');
      expect(config).toContain('fn save_config');
      expect(config).toContain('"http://localhost:3000"');
    });

    it('lib.rs registers config commands', () => {
      const libPath = join(__dirname, '../../src-tauri/src/lib.rs');
      const lib = readFileSync(libPath, 'utf-8');

      expect(lib).toContain('mod config;');
      expect(lib).toContain('fn get_app_config');
      expect(lib).toContain('fn save_app_config');
      expect(lib).toContain('get_app_config, save_app_config');
    });
  });
});
