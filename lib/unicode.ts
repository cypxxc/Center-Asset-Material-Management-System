/**
 * Shared Unicode utility functions for CAMMS.
 * Serves as the single source of truth for all Unicode, UTF-8 normalization,
 * character cleaning, and length checking operations.
 */

/**
 * Strips the UTF-8 Byte Order Mark (BOM) if present at the start of a string.
 */
export function stripBom(str: string): string {
  if (str.startsWith('\uFEFF')) {
    return str.slice(1)
  }
  return str
}

/**
 * Strips invisible characters like Zero-Width Space (ZWSP), Word Joiner (WJ),
 * and text direction markers.
 * Note: Zero-Width Joiner (ZWJ) and Zero-Width Non-Joiner (ZWNJ) are preserved
 * because they are used in emoji sequences (e.g. family emojis) and script-specific ligatures.
 */
export function stripInvisibleCharacters(str: string): string {
  return str.replace(/[\u200B\u2060\uFEFF\u200E\u200F\u202A-\u202E]/g, '')
}

/**
 * Strips ASCII control characters (C0 and C1) except for tab (\t), newline (\n),
 * and carriage return (\r).
 */
export function stripControlCharacters(str: string): string {
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '')
}

/**
 * Checks if a character (or string) consists entirely of Unicode whitespace.
 */
export function isUnicodeWhitespace(char: string): boolean {
  return /^\s+$/.test(char)
}

/**
 * Returns the exact visual length of a string in grapheme clusters (emojis, combining characters).
 * Uses standard Intl.Segmenter when available, falls back to codepoint array conversion.
 */
export function getGraphemeLength(str: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    return [...new Intl.Segmenter().segment(str)].length
  }
  // Fallback to splitting by codepoint (handles surrogate pairs but not all complex ZWJ emojis/combining marks)
  return Array.from(str).length
}

/**
 * Normalizes a string for database storage:
 * - NFC Normalization
 * - Strips BOM and invisible spaces/controls
 * - Trims whitespace
 */
export function normalizeForStorage(str: string): string {
  if (!str) return ''
  const clean = stripControlCharacters(stripInvisibleCharacters(str.normalize('NFC')))
  return clean.trim()
}

/**
 * Normalizes a string for search queries:
 * - NFC Normalization
 * - Lowercase
 * - Trims whitespace
 */
export function normalizeForSearch(str: string): string {
  if (!str) return ''
  return stripInvisibleCharacters(str.normalize('NFC')).toLowerCase().trim()
}

/**
 * Normalizes a string for strict duplicate checks or value comparisons:
 * - NFC Normalization
 * - Strips invisible and control characters
 * - Lowercase
 * - Trims whitespace
 */
export function normalizeForCompare(str: string): string {
  if (!str) return ''
  const clean = stripControlCharacters(stripInvisibleCharacters(str.normalize('NFC')))
  return clean.toLowerCase().trim()
}

/**
 * Sanitizes a filename, preserving Unicode letters/digits (Thai, Chinese, Arabic, Japanese, etc.),
 * while replacing unsafe path/system control characters with underscores.
 */
export function normalizeFilename(filename: string): string {
  if (!filename) return ''
  // Strip BOM and control characters first
  const clean = stripControlCharacters(stripInvisibleCharacters(filename.normalize('NFC')))
  
  // Split name and extension
  const dotIndex = clean.lastIndexOf('.')
  let base = clean
  let ext = ''
  if (dotIndex !== -1) {
    base = clean.slice(0, dotIndex)
    ext = clean.slice(dotIndex) // includes the dot
  }
  
  // Replace unsafe path control characters: / \ : * ? " < > |
  const safeBase = base
    .replace(/[\\\/:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    
  // Safe extension (lowercase, no spaces or special symbols)
  const safeExt = ext.replace(/[\\\/:*?"<>|\s]/g, '').toLowerCase()
  
  return (safeBase || 'unnamed_file') + safeExt
}

/**
 * Prevents CSV Injection by neutralizing formula prefix characters.
 * If a string starts with =, +, -, @, \t, or \r, we prefix it with a single quote '.
 */
export function preventCSVInjection(str: string): string {
  if (!str) return ''
  const formulaChars = ['=', '+', '-', '@', '\t', '\r']
  if (formulaChars.some((char) => str.startsWith(char))) {
    return `'${str}`
  }
  return str
}

