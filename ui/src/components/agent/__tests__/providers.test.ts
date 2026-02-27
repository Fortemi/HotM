import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_PROVIDER_CONFIG,
  DEFAULT_MODELS,
  requiresProxy,
  supportsStreaming,
  loadProviderConfig,
  saveProviderConfig,
} from '../providers';

describe('providers', () => {
  describe('DEFAULT_PROVIDER_CONFIG', () => {
    it('defaults to fortemi provider', () => {
      expect(DEFAULT_PROVIDER_CONFIG.provider).toBe('fortemi');
    });

    it('has default maxSteps and temperature', () => {
      expect(DEFAULT_PROVIDER_CONFIG.maxSteps).toBe(5);
      expect(DEFAULT_PROVIDER_CONFIG.temperature).toBe(0.7);
    });
  });

  describe('DEFAULT_MODELS', () => {
    it('has a model for each provider', () => {
      expect(DEFAULT_MODELS.fortemi).toBe('default');
      expect(DEFAULT_MODELS.ollama).toBe('llama3.2');
      expect(DEFAULT_MODELS.anthropic).toBe('claude-sonnet-4-6');
      expect(DEFAULT_MODELS.openai).toBe('gpt-4o');
    });
  });

  describe('requiresProxy', () => {
    it('returns true for cloud providers', () => {
      expect(requiresProxy('anthropic')).toBe(true);
      expect(requiresProxy('openai')).toBe(true);
    });

    it('returns false for local providers', () => {
      expect(requiresProxy('fortemi')).toBe(false);
      expect(requiresProxy('ollama')).toBe(false);
    });
  });

  describe('supportsStreaming', () => {
    it('returns false for fortemi', () => {
      expect(supportsStreaming('fortemi')).toBe(false);
    });

    it('returns true for all other providers', () => {
      expect(supportsStreaming('ollama')).toBe(true);
      expect(supportsStreaming('anthropic')).toBe(true);
      expect(supportsStreaming('openai')).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('loadProviderConfig returns defaults when nothing stored', () => {
      const config = loadProviderConfig();
      expect(config).toEqual(DEFAULT_PROVIDER_CONFIG);
    });

    it('saveProviderConfig writes to localStorage', () => {
      const config = { ...DEFAULT_PROVIDER_CONFIG, provider: 'ollama' as const };
      saveProviderConfig(config);
      expect(localStorage.getItem('hotm:agent-provider')).toBeTruthy();
    });

    it('round-trips provider config through storage', () => {
      const config = {
        ...DEFAULT_PROVIDER_CONFIG,
        provider: 'anthropic' as const,
        model: 'claude-sonnet-4-6',
        temperature: 0.5,
      };
      saveProviderConfig(config);
      const loaded = loadProviderConfig();
      expect(loaded.provider).toBe('anthropic');
      expect(loaded.model).toBe('claude-sonnet-4-6');
      expect(loaded.temperature).toBe(0.5);
    });

    it('loadProviderConfig merges stored with defaults', () => {
      localStorage.setItem(
        'hotm:agent-provider',
        JSON.stringify({ provider: 'openai' }),
      );
      const loaded = loadProviderConfig();
      expect(loaded.provider).toBe('openai');
      expect(loaded.maxSteps).toBe(5); // from defaults
      expect(loaded.temperature).toBe(0.7); // from defaults
    });

    it('loadProviderConfig handles corrupt data gracefully', () => {
      localStorage.setItem('hotm:agent-provider', 'not-json');
      const config = loadProviderConfig();
      expect(config).toEqual(DEFAULT_PROVIDER_CONFIG);
    });

    it('saveProviderConfig handles write errors gracefully', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceeded');
      });
      // Should not throw
      expect(() => saveProviderConfig(DEFAULT_PROVIDER_CONFIG)).not.toThrow();
      vi.restoreAllMocks();
    });
  });
});
