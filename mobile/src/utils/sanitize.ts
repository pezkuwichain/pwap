/**
 * Sanitize utilities for safe JavaScript injection into WebViews.
 *
 * ALWAYS use these when interpolating user data into injected scripts.
 * Prefer JSON.stringify() for complex objects.
 */

/**
 * Escape a string for safe injection into a JavaScript single-quoted string.
 * Prevents XSS via quote escaping, newline injection, and script tag breaking.
 */
export function escapeJsString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')     // backslash first
    .replace(/'/g, "\\'")       // single quotes
    .replace(/"/g, '\\"')       // double quotes
    .replace(/`/g, '\\`')       // backticks (template literals)
    .replace(/\n/g, '\\n')      // newlines
    .replace(/\r/g, '\\r')      // carriage returns
    .replace(/\0/g, '\\0')      // null bytes
    .replace(/<\/script/gi, '<\\/script'); // prevent script tag closing
}

/**
 * Safely encode a value for injection into JavaScript code.
 * Uses JSON.stringify which is inherently safe for JS contexts.
 */
export function safeJsValue(value: unknown): string {
  return JSON.stringify(value);
}
