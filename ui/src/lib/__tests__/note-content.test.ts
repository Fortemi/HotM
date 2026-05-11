import { describe, it, expect } from 'vitest';
import { extractTitleFromContent } from '../note-content';

describe('extractTitleFromContent', () => {
  it('returns undefined for empty content', () => {
    expect(extractTitleFromContent('')).toBeUndefined();
  });

  it('extracts a simple H1 at the start', () => {
    const content = '# Meeting Notes 2026-05-11\n\nBody content here.';
    expect(extractTitleFromContent(content)).toBe('Meeting Notes 2026-05-11');
  });

  it('extracts H1 even without trailing newline', () => {
    expect(extractTitleFromContent('# Solo Title')).toBe('Solo Title');
  });

  it('tolerates leading blank lines before the H1', () => {
    const content = '\n\n# Title After Whitespace\n\nBody';
    expect(extractTitleFromContent(content)).toBe('Title After Whitespace');
  });

  it('skips YAML frontmatter and extracts the H1 that follows', () => {
    const content = '---\nauthor: roctinam\ntags: [meeting]\n---\n# Real Title\n\nBody';
    expect(extractTitleFromContent(content)).toBe('Real Title');
  });

  it('handles CRLF line endings (Windows-pasted content)', () => {
    expect(extractTitleFromContent('# Pasted From Windows\r\n\r\nBody')).toBe(
      'Pasted From Windows',
    );
  });

  it('rejects H2 — only H1 counts as a title', () => {
    expect(extractTitleFromContent('## Subheading\n\nBody')).toBeUndefined();
  });

  it('rejects H3+ — only H1 counts as a title', () => {
    expect(extractTitleFromContent('### Sub-sub\n\nBody')).toBeUndefined();
  });

  it('returns undefined when content has no heading at all', () => {
    expect(extractTitleFromContent('Just a body paragraph with no heading.')).toBeUndefined();
  });

  it('returns undefined when content starts with text that mentions # mid-line', () => {
    expect(extractTitleFromContent('See section #1 below.')).toBeUndefined();
  });

  it('returns undefined for an empty H1 (only `# `)', () => {
    expect(extractTitleFromContent('# \n\nBody')).toBeUndefined();
  });

  it('trims trailing whitespace from the title', () => {
    expect(extractTitleFromContent('#   Padded Title   \n\nBody')).toBe('Padded Title');
  });

  it('treats `#Title` (no space) as not a heading per ATX spec', () => {
    // ATX H1 requires a space between `#` and the title text.
    expect(extractTitleFromContent('#NoSpace\n\nBody')).toBeUndefined();
  });

  it('does not extract H1 that appears after non-empty content', () => {
    expect(extractTitleFromContent('Some intro line\n# Heading later\n\nBody')).toBeUndefined();
  });

  it('handles single-line H1 followed by EOF', () => {
    expect(extractTitleFromContent('# Title\n')).toBe('Title');
  });

  it('leaves source content semantically unchanged (helper returns title only)', () => {
    // Verify the helper does NOT mutate or rewrite the content; that responsibility
    // stays with call sites which may strip or preserve the H1 separately.
    const original = '# Heading\n\nBody';
    extractTitleFromContent(original);
    expect(original).toBe('# Heading\n\nBody');
  });
});
