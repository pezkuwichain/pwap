// Production Rollup alias for vite-plugin-node-polyfills/shims/process (mirrors web/'s copy -
// see its comment for why: Rollup can't resolve the plugin's virtual module during a real
// build, only in dev). IMPORTANT: must not reference the `process` identifier at runtime -
// vite-plugin-node-polyfills rewrites it to `__process_polyfill`, creating a circular TDZ. Use
// bracket notation so the plugin leaves this file alone.
const g: Record<string, unknown> =
  typeof globalThis !== 'undefined' ? (globalThis as Record<string, unknown>)
  : typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>)
  : {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default (g['process'] ?? { env: {} }) as any;
