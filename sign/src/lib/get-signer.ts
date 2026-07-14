/**
 * Extension-only signer helper - deliberately simpler than pwap-web's get-signer.ts (which also
 * supports WalletConnect for mobile). The real 5 multisig signatories operate from desktop/
 * server contexts, and this site's whole purpose is to be a minimal, easy-to-audit surface -
 * not pulling in the WalletConnect session-management stack keeps that true. Add it back here
 * only if a signer genuinely needs to sign from a phone.
 */
import { web3Enable, web3FromAddress } from '@pezkuwi/extension-dapp';

export async function getSigner(address: string) {
  await web3Enable('PezBridge Sign');
  return web3FromAddress(address);
}
