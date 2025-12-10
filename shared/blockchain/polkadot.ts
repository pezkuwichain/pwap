/**
 * Polkadot/Substrate blockchain utilities
 */

import type { BlockchainNetwork } from '../types/blockchain';
import { getCurrentNetworkConfig } from './endpoints';

/**
 * Pezkuwi blockchain network configuration
 * Uses BETA endpoint from centralized endpoints.ts (source of truth)
 */
export const PEZKUWI_NETWORK: BlockchainNetwork = {
  name: 'Pezkuwi',
  endpoint: getCurrentNetworkConfig().wsEndpoint,
  chainId: 'pezkuwi',
};

/**
 * Default endpoint (reads from environment variables)
 */
export const DEFAULT_ENDPOINT = getCurrentNetworkConfig().wsEndpoint;

/**
 * Get block explorer URL for a transaction
 * @param txHash - Transaction hash
 * @returns Block explorer URL
 */
export function getExplorerUrl(txHash: string): string {
  // Update with your actual block explorer URL
  return `https://explorer.pezkuwichain.app/tx/${txHash}`;
}
