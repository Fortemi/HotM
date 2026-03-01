/**
 * Tests for the provider factory.
 *
 * Verifies model resolution, API key requirements, and default model values.
 * Uses mocked SDK constructors to avoid real API calls.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the SDK modules before importing the provider factory
vi.mock('@ai-sdk/openai', () => {
  const mockChat = vi.fn(() => ({ modelId: 'mock-chat-model' }));
  const createOpenAI = vi.fn(() => {
    // Return a callable that also has .chat()
    const provider = Object.assign(
      vi.fn(() => ({ modelId: 'mock-provider-model' })),
      { chat: mockChat },
    );
    return provider;
  });
  return { createOpenAI };
});

vi.mock('@ai-sdk/anthropic', () => {
  const createAnthropic = vi.fn(() =>
    vi.fn(() => ({ modelId: 'mock-anthropic-model' })),
  );
  return { createAnthropic };
});

import { getModel, DEFAULT_MODELS, type ProviderName } from '../providers/index.js';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.OLLAMA_URL;
  delete process.env.FORTEMI_MODEL;
});

describe('DEFAULT_MODELS', () => {
  it('has defaults for all 4 providers', () => {
    expect(DEFAULT_MODELS.fortemi).toBeDefined();
    expect(DEFAULT_MODELS.ollama).toBe('qwen3:8b');
    expect(DEFAULT_MODELS.anthropic).toBe('claude-sonnet-4-6');
    expect(DEFAULT_MODELS.openai).toBe('gpt-4o');
  });
});

describe('getModel', () => {
  describe('ollama provider', () => {
    it('creates OpenAI-compatible provider with Ollama URL', () => {
      getModel('ollama');

      expect(createOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: expect.stringContaining('/v1'),
          apiKey: 'ollama',
        }),
      );
    });

    it('uses custom OLLAMA_URL when set', () => {
      process.env.OLLAMA_URL = 'http://custom-ollama:11434';
      getModel('ollama');

      expect(createOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          baseURL: 'http://custom-ollama:11434/v1',
        }),
      );
    });

    it('uses .chat() method (not provider())', () => {
      getModel('ollama', 'llama3:latest');

      const provider = vi.mocked(createOpenAI).mock.results[0].value;
      expect(provider.chat).toHaveBeenCalledWith('llama3:latest');
    });

    it('defaults to qwen3:8b model', () => {
      getModel('ollama');

      const provider = vi.mocked(createOpenAI).mock.results[0].value;
      expect(provider.chat).toHaveBeenCalledWith('qwen3:8b');
    });
  });

  describe('fortemi provider', () => {
    it('uses same path as ollama (aliased)', () => {
      getModel('fortemi');

      expect(createOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'ollama',
        }),
      );
    });
  });

  describe('anthropic provider', () => {
    it('throws when ANTHROPIC_API_KEY is not set', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => getModel('anthropic')).toThrow('ANTHROPIC_API_KEY');
    });

    it('creates Anthropic provider with API key', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      getModel('anthropic');

      expect(createAnthropic).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-test-key' }),
      );
    });

    it('defaults to claude-sonnet-4-6 model', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      getModel('anthropic');

      const provider = vi.mocked(createAnthropic).mock.results[0].value;
      expect(provider).toHaveBeenCalledWith('claude-sonnet-4-6');
    });

    it('uses custom model when specified', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      getModel('anthropic', 'claude-opus-4-6');

      const provider = vi.mocked(createAnthropic).mock.results[0].value;
      expect(provider).toHaveBeenCalledWith('claude-opus-4-6');
    });
  });

  describe('openai provider', () => {
    it('throws when OPENAI_API_KEY is not set', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => getModel('openai')).toThrow('OPENAI_API_KEY');
    });

    it('creates OpenAI provider with API key', () => {
      process.env.OPENAI_API_KEY = 'sk-openai-test';
      getModel('openai');

      // Called once for openai (ollama also uses createOpenAI but this is a separate call)
      expect(createOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-openai-test' }),
      );
    });

    it('uses .chat() method for Chat Completions API', () => {
      process.env.OPENAI_API_KEY = 'sk-openai-test';
      getModel('openai', 'gpt-4o-mini');

      const provider = vi.mocked(createOpenAI).mock.results[0].value;
      expect(provider.chat).toHaveBeenCalledWith('gpt-4o-mini');
    });
  });

  describe('unsupported provider', () => {
    it('throws for unknown provider names', () => {
      expect(() => getModel('unknown' as ProviderName)).toThrow('Unsupported provider');
    });
  });
});
