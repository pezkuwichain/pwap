/**
 * Universal signer helper - works with both browser extension and WalletConnect
 *
 * Usage:
 *   const injector = await getSigner(selectedAccount.address, walletSource, api);
 *   // injector.signer works for signAndSend, signRaw, etc.
 */

import { web3Enable, web3FromAddress } from '@pezkuwi/extension-dapp';
import { createWCSigner, isWCConnected, validateSession } from '@/lib/walletconnect-service';
import type { ApiPromise } from '@pezkuwi/api';

type WalletSource = 'extension' | 'walletconnect' | 'native' | null;

interface SignerResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signer: any; // Compatible with @pezkuwi/api Signer
}

// Cache web3Enable to avoid "Too many authorization requests" error
let enablePromise: Promise<unknown[]> | null = null;

async function ensureWeb3Enabled(): Promise<void> {
  if (!enablePromise) {
    enablePromise = web3Enable('PezkuwiChain');
  }
  await enablePromise;
}

export async function getSigner(
  address: string,
  walletSource: WalletSource,
  api?: ApiPromise | null
): Promise<SignerResult> {
  if (walletSource === 'walletconnect') {
    if (!isWCConnected() || !validateSession()) {
      throw new Error('WalletConnect session expired. Please reconnect your wallet.');
    }
    if (!api) {
      throw new Error('API not ready');
    }
    const genesisHash = api.genesisHash.toHex();
    const wcSigner = createWCSigner(genesisHash, address);
    return { signer: wcSigner };
  }

  // Extension or native: use web3FromAddress
  await ensureWeb3Enabled();
  const injector = await web3FromAddress(address);
  return injector;
}
