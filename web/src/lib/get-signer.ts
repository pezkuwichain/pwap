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
  signer: any; // Compatible with @pezkuwi/api Signer
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
  await web3Enable('PezkuwiChain');
  const injector = await web3FromAddress(address);
  return injector;
}
