/**
 * Input validation framework for HotM
 * Provides validation and sanitization for user inputs before sending to API
 */

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Constants for validation rules
 */
const MAX_NOTE_SIZE_BYTES = 100 * 1024; // 100KB
const MAX_TAG_LENGTH = 50;
const MAX_SEARCH_QUERY_LENGTH = 500;

/**
 * Validate note content before creation or update
 *
 * Rules:
 * - Cannot be empty or whitespace-only
 * - Maximum size: 100KB
 * - No null bytes allowed
 *
 * @param content - Note content to validate
 * @returns ValidationResult indicating if content is valid
 */
export function validateNoteContent(content: string): ValidationResult {
  // Check for empty content
  if (!content || content.trim().length === 0) {
    return {
      valid: false,
      error: 'Note content cannot be empty',
    };
  }

  // Check size limit (100KB)
  const sizeInBytes = new TextEncoder().encode(content).length;
  if (sizeInBytes > MAX_NOTE_SIZE_BYTES) {
    return {
      valid: false,
      error: 'Note content cannot exceed 100KB',
    };
  }

  // Check for null bytes (security concern)
  if (content.includes('\x00')) {
    return {
      valid: false,
      error: 'Note content contains invalid characters',
    };
  }

  return { valid: true };
}

/**
 * Validate tag name
 *
 * Rules:
 * - Cannot be empty or whitespace-only
 * - Maximum length: 50 characters
 * - Only alphanumeric characters, hyphens, and underscores allowed
 *
 * @param tag - Tag name to validate
 * @returns ValidationResult indicating if tag is valid
 */
export function validateTag(tag: string): ValidationResult {
  // Check for empty tag
  if (!tag || tag.trim().length === 0) {
    return {
      valid: false,
      error: 'Tag cannot be empty',
    };
  }

  // Check length limit
  if (tag.length > MAX_TAG_LENGTH) {
    return {
      valid: false,
      error: 'Tag cannot exceed 50 characters',
    };
  }

  // Check allowed characters: alphanumeric, hyphens, underscores
  const tagPattern = /^[a-zA-Z0-9_-]+$/;
  if (!tagPattern.test(tag)) {
    return {
      valid: false,
      error: 'Tag can only contain letters, numbers, hyphens, and underscores',
    };
  }

  return { valid: true };
}

/**
 * Validate search query
 *
 * Rules:
 * - Maximum length: 500 characters
 * - Empty queries are allowed (will return all notes)
 *
 * @param query - Search query to validate
 * @returns ValidationResult indicating if query is valid
 */
export function validateSearchQuery(query: string): ValidationResult {
  // Empty queries are allowed
  if (!query) {
    return { valid: true };
  }

  // Check length limit
  if (query.length > MAX_SEARCH_QUERY_LENGTH) {
    return {
      valid: false,
      error: 'Search query cannot exceed 500 characters',
    };
  }

  return { valid: true };
}

/**
 * Sanitize user input to prevent XSS attacks
 *
 * - Trims whitespace
 * - Escapes HTML special characters
 * - Preserves newlines and tabs
 *
 * @param input - User input to sanitize
 * @returns Sanitized string safe for display
 */
export function sanitizeInput(input: string): string {
  if (!input) {
    return '';
  }

  // Trim whitespace
  const trimmed = input.trim();

  // Escape HTML special characters
  return trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Validate and sanitize note content in one step
 *
 * @param content - Raw note content
 * @returns Tuple of [ValidationResult, sanitized content]
 */
export function validateAndSanitizeNote(
  content: string
): [ValidationResult, string] {
  const validation = validateNoteContent(content);
  if (!validation.valid) {
    return [validation, ''];
  }

  // Don't sanitize note content - markdown needs raw HTML support
  // Just trim whitespace
  return [validation, content.trim()];
}

/**
 * Validate and sanitize tag in one step
 *
 * @param tag - Raw tag name
 * @returns Tuple of [ValidationResult, sanitized tag]
 */
export function validateAndSanitizeTag(
  tag: string
): [ValidationResult, string] {
  // Trim first
  const trimmed = tag.trim();

  const validation = validateTag(trimmed);
  if (!validation.valid) {
    return [validation, ''];
  }

  // Tags don't need HTML sanitization (only alphanumeric allowed)
  return [validation, trimmed.toLowerCase()];
}

/**
 * Validate and sanitize search query in one step
 *
 * @param query - Raw search query
 * @returns Tuple of [ValidationResult, sanitized query]
 */
export function validateAndSanitizeSearch(
  query: string
): [ValidationResult, string] {
  const validation = validateSearchQuery(query);
  if (!validation.valid) {
    return [validation, ''];
  }

  // Trim but don't sanitize search queries (backend handles escaping)
  return [validation, query.trim()];
}

/**
 * Batch validate multiple tags
 *
 * @param tags - Array of tag names to validate
 * @returns Array of ValidationResults, one per tag
 */
export function validateTags(tags: string[]): ValidationResult[] {
  return tags.map(validateTag);
}

/**
 * Check if all validations passed
 *
 * @param results - Array of validation results
 * @returns true if all validations passed
 */
export function allValid(results: ValidationResult[]): boolean {
  return results.every((r) => r.valid);
}

/**
 * Get all error messages from validation results
 *
 * @param results - Array of validation results
 * @returns Array of error messages (empty if all valid)
 */
export function getErrors(results: ValidationResult[]): string[] {
  return results.filter((r) => !r.valid).map((r) => r.error || 'Unknown error');
}
