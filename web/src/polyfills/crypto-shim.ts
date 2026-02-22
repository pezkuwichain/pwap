// Minimal crypto shim that delegates to the browser's native Web Crypto API
// Prevents crypto-browserify (and its inherits dependency) from being bundled
export default globalThis.crypto;
export const webcrypto = globalThis.crypto;
export const randomBytes = (size: number): Uint8Array => {
  const bytes = new Uint8Array(size);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
};
export const createHash = undefined;
export const createHmac = undefined;
