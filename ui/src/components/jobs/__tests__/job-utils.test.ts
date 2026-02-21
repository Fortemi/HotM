import { describe, it, expect } from 'vitest';
import { getJobTypeColor, formatJobType, formatDuration } from '../job-utils';

describe('getJobTypeColor', () => {
  it('returns purple for airevision', () => {
    expect(getJobTypeColor('AiRevision')).toBe('bg-purple-500');
    expect(getJobTypeColor('airevision')).toBe('bg-purple-500');
  });

  it('returns blue for embedding', () => {
    expect(getJobTypeColor('Embedding')).toBe('bg-blue-500');
  });

  it('returns green for linking', () => {
    expect(getJobTypeColor('Linking')).toBe('bg-green-500');
  });

  it('returns orange for contextupdate', () => {
    expect(getJobTypeColor('ContextUpdate')).toBe('bg-orange-500');
  });

  it('returns pink for titlegeneration', () => {
    expect(getJobTypeColor('TitleGeneration')).toBe('bg-pink-500');
  });

  it('returns gray for unknown types', () => {
    expect(getJobTypeColor('UnknownType')).toBe('bg-gray-500');
  });
});

describe('formatJobType', () => {
  it('inserts spaces before capitals', () => {
    expect(formatJobType('AiRevision')).toBe('Ai Revision');
    expect(formatJobType('ContextUpdate')).toBe('Context Update');
  });

  it('capitalizes first letter', () => {
    expect(formatJobType('embedding')).toBe('Embedding');
  });

  it('handles single-word types', () => {
    expect(formatJobType('Linking')).toBe('Linking');
  });
});

describe('formatDuration', () => {
  it('returns empty string for falsy values', () => {
    expect(formatDuration(undefined)).toBe('');
    expect(formatDuration(0)).toBe('');
  });

  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(2500)).toBe('2.5s');
    expect(formatDuration(59999)).toBe('60.0s');
  });

  it('formats minutes', () => {
    expect(formatDuration(60000)).toBe('1.0m');
    expect(formatDuration(150000)).toBe('2.5m');
  });
});
