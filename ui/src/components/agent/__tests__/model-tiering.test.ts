import { describe, it, expect } from 'vitest';
import type { ChatModelInfo } from '@/api';
import { selectModelForTask, buildModelTierMap } from '../model-tiering';

const MODELS: ChatModelInfo[] = [
  {
    model: 'llama3.2:3b',
    context_window: 131072,
    max_output_tokens: 4096,
    supports_thinking: false,
    thinking_type: '',
    speed_tok_s: 80,
    parameter_size: '3B',
    family: 'llama',
  },
  {
    model: 'llama3.2:8b',
    context_window: 131072,
    max_output_tokens: 4096,
    supports_thinking: false,
    thinking_type: '',
    speed_tok_s: 45,
    parameter_size: '8B',
    family: 'llama',
  },
  {
    model: 'qwen2.5:14b',
    context_window: 32768,
    max_output_tokens: 4096,
    supports_thinking: false,
    thinking_type: '',
    speed_tok_s: 25,
    parameter_size: '14B',
    family: 'qwen',
  },
  {
    model: 'qwen2.5:72b',
    context_window: 131072,
    max_output_tokens: 8192,
    supports_thinking: true,
    thinking_type: 'extended',
    speed_tok_s: 8,
    parameter_size: '72B',
    family: 'qwen',
  },
];

describe('model-tiering', () => {
  describe('selectModelForTask', () => {
    it('returns default model when no models available', () => {
      expect(selectModelForTask('reasoning', [], 'fallback')).toBe('fallback');
    });

    it('selects larger models for reasoning tasks', () => {
      const model = selectModelForTask('reasoning', MODELS);
      // Should prefer the largest model with preferred family
      expect(model).toBeDefined();
      // 72b should score highest due to parameter size
      expect(model).toBe('qwen2.5:72b');
    });

    it('selects smaller/faster models for search tasks', () => {
      const model = selectModelForTask('search', MODELS);
      expect(model).toBeDefined();
      // 3b model: <= 8B parameter size, fast
      expect(model).toBe('llama3.2:3b');
    });

    it('selects tool-calling capable models for tool-calling tasks', () => {
      const model = selectModelForTask('tool-calling', MODELS);
      expect(model).toBeDefined();
      // Should balance speed and capability
    });

    it('returns default model when no candidates match criteria', () => {
      // Only model with tiny context window
      const tinyModels: ChatModelInfo[] = [
        {
          model: 'tiny',
          context_window: 256,
          max_output_tokens: 100,
          supports_thinking: false,
          thinking_type: '',
          speed_tok_s: 100,
          parameter_size: '0.5B',
          family: 'unknown',
        },
      ];
      const model = selectModelForTask('reasoning', tinyModels, 'fallback');
      // 256 context < 8192 minimum for reasoning
      expect(model).toBe('fallback');
    });

    it('respects speed requirements', () => {
      const model = selectModelForTask('search', MODELS);
      // 8B model with 45 tok/s passes speed threshold (30) but is too large (>8B)
      // 3B model with 80 tok/s passes both speed and size
      expect(model).toBe('llama3.2:3b');
    });
  });

  describe('buildModelTierMap', () => {
    it('returns a map with all task types', () => {
      const map = buildModelTierMap(MODELS, 'default');
      expect(map).toHaveProperty('reasoning');
      expect(map).toHaveProperty('tool-calling');
      expect(map).toHaveProperty('search');
      expect(map).toHaveProperty('analysis');
      expect(map).toHaveProperty('summarization');
    });

    it('assigns different models to different tasks', () => {
      const map = buildModelTierMap(MODELS);
      // Search should get a different (smaller) model than reasoning
      expect(map.search).not.toBe(map.reasoning);
    });

    it('handles empty model list with defaults', () => {
      const map = buildModelTierMap([], 'fallback');
      expect(map.reasoning).toBe('fallback');
      expect(map.search).toBe('fallback');
    });
  });
});
