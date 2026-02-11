// Global polyfill shim for vite-plugin-node-polyfills
export default typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : {};
