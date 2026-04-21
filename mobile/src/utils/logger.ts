/**
 * Dev-only logger. All output suppressed in production builds.
 * Use this instead of console.log/warn/error throughout the codebase.
 */
export const logger = {
  log: (...args: unknown[]): void => {
    if (__DEV__) console.log('[Pezkuwi]', ...args);
  },
  warn: (...args: unknown[]): void => {
    if (__DEV__) console.warn('[Pezkuwi]', ...args);
  },
  error: (...args: unknown[]): void => {
    if (__DEV__) console.error('[Pezkuwi]', ...args);
  },
};
