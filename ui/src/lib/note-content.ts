/**
 * Helpers for deriving structured metadata from raw note content.
 *
 * The Fortemi API exposes a `title` field on note creation (added in
 * Fortemi v2026.5.6 #675, bundled in HotM v2026.5.7). When the caller
 * supplies an explicit title, the sidecar skips the AI title-generation
 * pipeline step — caller value is authoritative.
 *
 * `extractTitleFromContent` detects a Markdown-convention H1 heading at
 * the start of content and returns it as the title. The H1 is left in the
 * content unchanged — this matches fortemi's `seed-support-archive.sh`
 * flow where notes end up with both title metadata and the H1 rendered
 * inline in the body. Callers that want to strip the heading can do so
 * separately.
 */

/**
 * Extract a title from leading ATX H1 (`# Heading`) in note content.
 *
 * Tolerates an optional YAML frontmatter block at the very start of the
 * content (the H1 is detected immediately after the closing `---`).
 *
 * @returns The H1 text without the `#` prefix, or `undefined` when no
 *   H1 is present at the start of the body. Whitespace-only or empty
 *   results are normalized to `undefined`.
 */
export function extractTitleFromContent(content: string): string | undefined {
  if (!content) return undefined;

  // Skip YAML frontmatter (--- ... ---) when present at the very start
  let body = content;
  const frontmatterMatch = content.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (frontmatterMatch) {
    body = content.slice(frontmatterMatch[0].length);
  }

  // Strip leading blank lines so `\n\n# Title` still matches
  body = body.replace(/^[\s\r\n]*/, '');

  // Match a single ATX H1 (`# ` followed by text on one line). Reject
  // `##`, `###`, etc. — those are subheadings, not titles. Greedy `+`
  // captures the full title text; `[^\r\n]` keeps it to a single line.
  // Trailing whitespace inside the captured group is stripped via .trim().
  const h1Match = body.match(/^# +([^\r\n]+)/);
  if (!h1Match) return undefined;

  const title = h1Match[1].trim();
  return title.length > 0 ? title : undefined;
}
