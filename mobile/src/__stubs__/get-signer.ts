// Stub for web-only get-signer module
// Mobile uses PezkuwiContext.getKeyPair() instead
export async function getSigner() {
  throw new Error('getSigner is not available on mobile. Use PezkuwiContext.getKeyPair() instead.');
}
