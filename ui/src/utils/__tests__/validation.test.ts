/**
 * Tests for input validation framework
 */

import { describe, it, expect } from 'vitest';
import {
  validateNoteContent,
  validateTag,
  validateSearchQuery,
  sanitizeInput,
  
} from '../validation';

describe('validateNoteContent', () => {
  it('should accept valid note content', () => {
    const result = validateNoteContent('This is a valid note');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should reject empty content', () => {
    const result = validateNoteContent('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Note content cannot be empty');
  });

  it('should reject whitespace-only content', () => {
    const result = validateNoteContent('   \n\t  ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Note content cannot be empty');
  });

  it('should reject content exceeding 100KB', () => {
    const largeContent = 'a'.repeat(100 * 1024 + 1);
    const result = validateNoteContent(largeContent);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Note content cannot exceed 100KB');
  });

  it('should reject content with null bytes', () => {
    const result = validateNoteContent('Hello\x00World');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Note content contains invalid characters');
  });

  it('should accept content at exactly 100KB', () => {
    const maxContent = 'a'.repeat(100 * 1024);
    const result = validateNoteContent(maxContent);
    expect(result.valid).toBe(true);
  });

  it('should accept markdown content with special characters', () => {
    const markdown = '# Heading\n\n**Bold** and *italic* text\n\n- List item\n- Another item';
    const result = validateNoteContent(markdown);
    expect(result.valid).toBe(true);
  });
});

describe('validateTag', () => {
  it('should accept valid tag', () => {
    const result = validateTag('valid-tag');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept alphanumeric tags', () => {
    const result = validateTag('tag123');
    expect(result.valid).toBe(true);
  });

  it('should accept tags with hyphens', () => {
    const result = validateTag('my-tag-name');
    expect(result.valid).toBe(true);
  });

  it('should accept tags with underscores', () => {
    const result = validateTag('my_tag_name');
    expect(result.valid).toBe(true);
  });

  it('should reject empty tag', () => {
    const result = validateTag('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Tag cannot be empty');
  });

  it('should reject whitespace-only tag', () => {
    const result = validateTag('   ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Tag cannot be empty');
  });

  it('should reject tag exceeding 50 characters', () => {
    const longTag = 'a'.repeat(51);
    const result = validateTag(longTag);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Tag cannot exceed 50 characters');
  });

  it('should reject tags with special characters', () => {
    const result = validateTag('invalid@tag');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Tag can only contain letters, numbers, hyphens, and underscores');
  });

  it('should reject tags with spaces', () => {
    const result = validateTag('invalid tag');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Tag can only contain letters, numbers, hyphens, and underscores');
  });

  it('should accept tag at exactly 50 characters', () => {
    const maxTag = 'a'.repeat(50);
    const result = validateTag(maxTag);
    expect(result.valid).toBe(true);
  });
});

describe('validateSearchQuery', () => {
  it('should accept valid search query', () => {
    const result = validateSearchQuery('search term');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should accept empty search query', () => {
    const result = validateSearchQuery('');
    expect(result.valid).toBe(true);
  });

  it('should reject query exceeding 500 characters', () => {
    const longQuery = 'a'.repeat(501);
    const result = validateSearchQuery(longQuery);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Search query cannot exceed 500 characters');
  });

  it('should accept query with special search operators', () => {
    const result = validateSearchQuery('title:test AND tag:important');
    expect(result.valid).toBe(true);
  });

  it('should accept query at exactly 500 characters', () => {
    const maxQuery = 'a'.repeat(500);
    const result = validateSearchQuery(maxQuery);
    expect(result.valid).toBe(true);
  });
});

describe('sanitizeInput', () => {
  it('should trim whitespace', () => {
    expect(sanitizeInput('  hello  ')).toBe('hello');
  });

  it('should escape HTML tags', () => {
    expect(sanitizeInput('<script>alert("xss")</script>'))
      .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should escape special HTML entities', () => {
    expect(sanitizeInput('a & b < c > d')).toBe('a &amp; b &lt; c &gt; d');
  });

  it('should handle quotes', () => {
    expect(sanitizeInput('he said "hello"')).toBe('he said &quot;hello&quot;');
    expect(sanitizeInput("it's here")).toBe("it&#x27;s here");
  });

  it('should handle already-sanitized input', () => {
    const sanitized = sanitizeInput('&lt;test&gt;');
    expect(sanitized).toBe('&amp;lt;test&amp;gt;');
  });

  it('should preserve newlines and tabs', () => {
    expect(sanitizeInput('line1\nline2\tindented')).toBe('line1\nline2\tindented');
  });

  it('should handle empty string', () => {
    expect(sanitizeInput('')).toBe('');
  });

  it('should handle complex XSS attempts', () => {
    const xss = '<img src=x onerror="alert(1)">';
    expect(sanitizeInput(xss)).toBe('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });

  it('should handle SQL injection attempts', () => {
    const sql = "'; DROP TABLE users; --";
    expect(sanitizeInput(sql)).toBe("&#x27;; DROP TABLE users; --");
  });
});
