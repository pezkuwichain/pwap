/**
 * XCM Configuration Wizard Backend Functions
 *
 * Handles parachain registration, HRMP channels, foreign asset registration,
 * and XCM transfer testing for PezkuwiChain.
 */

import type { ApiPromise } from '@polkadot/api';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';

// ========================================
// TYPES
// ========================================

export type RelayChain = 'westend' | 'rococo' | 'polkadot';

export interface ChainArtifacts {
  genesisPath: string;
  genesisSize: number;
  wasmPath: string;
  wasmSize: number;
}

export interface HRMPChannel {
  sender: number;
  receiver: number;
  channelId: string;
}

export interface AssetMetadata {
  name: string;
  symbol: string;
  decimals: number;
  minBalance: string;
}

export interface ForeignAsset {
  symbol: string;
  location: {
    parents: number;
    interior: any; // XCM Location interior
  };
  metadata: AssetMetadata;
}

export interface RegisteredAsset {
  assetId: number;
  symbol: string;
}

export interface XCMTestResult {
  txHash: string;
  success: boolean;
  balance: string;
  error?: string;
}

// ========================================
// STEP 1: RESERVE PARAID
// ========================================

/**
 * Reserve a ParaId on the relay chain
 *
 * @param api - Polkadot.js API instance (connected to relay chain)
 * @param relayChain - Target relay chain (westend/rococo/polkadot)
 * @param account - Account to sign the transaction
 * @returns Reserved ParaId number
 */
export async function reserveParaId(
  api: ApiPromise,
  relayChain: RelayChain,
  account: InjectedAccountWithMeta
): Promise<number> {
  return new Promise(async (resolve, reject) => {
    try {
      const injector = await window.injectedWeb3[account.meta.source]?.enable?.('PezkuwiChain');
      if (!injector) {
        throw new Error('Failed to get injector from wallet extension');
      }

      const signer = injector.signer;

      // Call registrar.reserve() on relay chain
      const tx = api.tx.registrar.reserve();

      let unsub: () => void;

      await tx.signAndSend(account.address, { signer }, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          if (unsub) unsub();
          return;
        }

        if (status.isInBlock) {
          // Extract ParaId from events
          const reservedEvent = events.find(({ event }) =>
            api.events.registrar.Reserved.is(event)
          );

          if (reservedEvent) {
            const paraId = reservedEvent.event.data[0].toNumber();
            resolve(paraId);
            if (unsub) unsub();
          } else {
            reject(new Error('ParaId reservation failed: No Reserved event found'));
            if (unsub) unsub();
          }
        }
      }).then(unsubscribe => { unsub = unsubscribe; });

    } catch (error) {
      reject(error);
    }
  });
}

// ========================================
// STEP 2: GENERATE CHAIN ARTIFACTS
// ========================================

/**
 * Generate genesis state and runtime WASM for parachain
 *
 * Note: This is a simplified version. In production, you'd call
 * your blockchain node CLI to generate these artifacts.
 *
 * @param chainName - Name of the parachain
 * @returns Paths to generated artifacts
 */
export async function generateChainArtifacts(
  chainName: string
): Promise<ChainArtifacts> {
  // In a real implementation, this would:
  // 1. Call: ./target/release/pezkuwi export-genesis-state --chain=<chain-spec> > genesis-head.hex
  // 2. Call: ./target/release/pezkuwi export-genesis-wasm --chain=<chain-spec> > runtime.wasm
  // 3. Return the file paths and sizes

  // For now, we'll return placeholder paths
  // The actual implementation should use Node.js child_process or a backend API

  return {
    genesisPath: `/tmp/pezkuwi-${chainName}-genesis.hex`,
    genesisSize: 0, // Would be actual file size
    wasmPath: `/tmp/pezkuwi-${chainName}-runtime.wasm`,
    wasmSize: 0, // Would be actual file size
  };
}

// ========================================
// STEP 3: REGISTER PARACHAIN
// ========================================

/**
 * Register parachain on relay chain with genesis and WASM
 *
 * @param api - Polkadot.js API instance (relay chain)
 * @param paraId - Reserved ParaId
 * @param genesisFile - Genesis state file
 * @param wasmFile - Runtime WASM file
 * @param account - Account to sign transaction
 * @returns Transaction hash
 */
export async function registerParachain(
  api: ApiPromise,
  paraId: number,
  genesisFile: File,
  wasmFile: File,
  account: InjectedAccountWithMeta
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const injector = await window.injectedWeb3[account.meta.source]?.enable?.('PezkuwiChain');
      if (!injector) {
        throw new Error('Failed to get injector from wallet extension');
      }

      const signer = injector.signer;

      // Read files as hex strings
      const genesisHex = await readFileAsHex(genesisFile);
      const wasmHex = await readFileAsHex(wasmFile);

      // Call registrar.register() with paraId, genesis, and wasm
      const tx = api.tx.registrar.register(paraId, genesisHex, wasmHex);

      let unsub: () => void;

      await tx.signAndSend(account.address, { signer }, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          if (unsub) unsub();
          return;
        }

        if (status.isInBlock) {
          resolve(status.asInBlock.toString());
          if (unsub) unsub();
        }
      }).then(unsubscribe => { unsub = unsubscribe; });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper: Read File as hex string
 */
async function readFileAsHex(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      const hex = '0x' + Array.from(uint8Array)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      resolve(hex);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ========================================
// STEP 4: OPEN HRMP CHANNELS
// ========================================

/**
 * Open bidirectional HRMP channels with target parachains
 *
 * @param api - Polkadot.js API instance (relay chain)
 * @param paraId - Our ParaId
 * @param targetParas - List of target ParaIds (e.g., [1000] for Asset Hub)
 * @param account - Account to sign transactions
 * @returns Array of opened channels
 */
export async function openHRMPChannels(
  api: ApiPromise,
  paraId: number,
  targetParas: number[],
  account: InjectedAccountWithMeta
): Promise<HRMPChannel[]> {
  const channels: HRMPChannel[] = [];

  for (const targetParaId of targetParas) {
    // Open channel: paraId → targetParaId
    const outgoingChannel = await openHRMPChannel(api, paraId, targetParaId, account);
    channels.push(outgoingChannel);

    // Open channel: targetParaId → paraId (requires governance or target's approval)
    // Note: In practice, this requires the target parachain to initiate
    // For Asset Hub and system chains, this is usually done via governance
  }

  return channels;
}

/**
 * Open a single HRMP channel
 */
async function openHRMPChannel(
  api: ApiPromise,
  sender: number,
  receiver: number,
  account: InjectedAccountWithMeta
): Promise<HRMPChannel> {
  return new Promise(async (resolve, reject) => {
    try {
      const injector = await window.injectedWeb3[account.meta.source]?.enable?.('PezkuwiChain');
      if (!injector) {
        throw new Error('Failed to get injector from wallet extension');
      }

      const signer = injector.signer;

      // Call hrmp.hrmpInitOpenChannel(recipient, proposedMaxCapacity, proposedMaxMessageSize)
      const maxCapacity = 1000;
      const maxMessageSize = 102400; // 100 KB

      const tx = api.tx.hrmp.hrmpInitOpenChannel(receiver, maxCapacity, maxMessageSize);

      let unsub: () => void;

      await tx.signAndSend(account.address, { signer }, ({ status, events, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          if (unsub) unsub();
          return;
        }

        if (status.isInBlock) {
          const channelId = status.asInBlock.toString();
          resolve({ sender, receiver, channelId });
          if (unsub) unsub();
        }
      }).then(unsubscribe => { unsub = unsubscribe; });

    } catch (error) {
      reject(error);
    }
  });
}

// ========================================
// STEP 5: REGISTER FOREIGN ASSETS
// ========================================

/**
 * Register foreign assets from other chains (via XCM)
 *
 * @param api - Polkadot.js API instance (our parachain)
 * @param assets - List of foreign assets to register
 * @param account - Account to sign transactions
 * @returns List of registered assets with Asset IDs
 */
export async function registerForeignAssets(
  api: ApiPromise,
  assets: ForeignAsset[],
  account: InjectedAccountWithMeta
): Promise<RegisteredAsset[]> {
  const registered: RegisteredAsset[] = [];

  for (const asset of assets) {
    const registeredAsset = await registerSingleAsset(api, asset, account);
    registered.push(registeredAsset);
  }

  return registered;
}

/**
 * Register a single foreign asset
 */
async function registerSingleAsset(
  api: ApiPromise,
  asset: ForeignAsset,
  account: InjectedAccountWithMeta
): Promise<RegisteredAsset> {
  return new Promise(async (resolve, reject) => {
    try {
      const injector = await window.injectedWeb3[account.meta.source]?.enable?.('PezkuwiChain');
      if (!injector) {
        throw new Error('Failed to get injector from wallet extension');
      }

      const signer = injector.signer;

      // Get next available asset ID
      const nextAssetId = await getNextAssetId(api);

      // Create asset with metadata
      // Note: Adjust based on your pallet configuration
      const createTx = api.tx.assets.create(
        nextAssetId,
        account.address, // Admin
        asset.metadata.minBalance
      );

      const setMetadataTx = api.tx.assets.setMetadata(
        nextAssetId,
        asset.metadata.name,
        asset.metadata.symbol,
        asset.metadata.decimals
      );

      // Batch both transactions
      const tx = api.tx.utility.batchAll([createTx, setMetadataTx]);

      let unsub: () => void;

      await tx.signAndSend(account.address, { signer }, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
          } else {
            reject(new Error(dispatchError.toString()));
          }
          if (unsub) unsub();
          return;
        }

        if (status.isInBlock) {
          resolve({
            assetId: nextAssetId,
            symbol: asset.metadata.symbol,
          });
          if (unsub) unsub();
        }
      }).then(unsubscribe => { unsub = unsubscribe; });

    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get next available Asset ID
 */
async function getNextAssetId(api: ApiPromise): Promise<number> {
  // Query existing assets and find the next ID
  // This is a simplified version - adjust based on your implementation
  const assets = await api.query.assets.asset.entries();

  if (assets.length === 0) {
    return 1000; // Start from 1000 for foreign assets
  }

  const maxId = Math.max(...assets.map(([key]) => {
    const assetId = key.args[0].toNumber();
    return assetId;
  }));

  return maxId + 1;
}

// ========================================
// STEP 6: TEST XCM TRANSFER
// ========================================

/**
 * Test XCM transfer from Asset Hub USDT to our wUSDT
 *
 * @param api - Polkadot.js API instance (our parachain)
 * @param amount - Amount to transfer (in smallest unit)
 * @param account - Account to receive the transfer
 * @returns Test result with transaction hash and balance
 */
export async function testXCMTransfer(
  api: ApiPromise,
  amount: string,
  account: InjectedAccountWithMeta
): Promise<XCMTestResult> {
  try {
    // This is a placeholder for XCM testing
    // In reality, you'd need to:
    // 1. Connect to Asset Hub
    // 2. Send limitedReserveTransferAssets() to our parachain
    // 3. Monitor for AssetReceived event on our side

    // For now, return a mock success result
    return {
      txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      success: false,
      balance: '0',
      error: 'XCM testing requires connection to relay chain and Asset Hub',
    };
  } catch (error) {
    return {
      txHash: '',
      success: false,
      balance: '0',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Get relay chain endpoint based on network selection
 */
export function getRelayChainEndpoint(relayChain: RelayChain): string {
  const endpoints = {
    westend: 'wss://westend-rpc.polkadot.io',
    rococo: 'wss://rococo-rpc.polkadot.io',
    polkadot: 'wss://rpc.polkadot.io',
  };

  return endpoints[relayChain];
}

/**
 * Asset Hub ParaId by relay chain
 */
export function getAssetHubParaId(relayChain: RelayChain): number {
  const paraIds = {
    westend: 1000,  // Westend Asset Hub
    rococo: 1000,   // Rococo Asset Hub
    polkadot: 1000, // Polkadot Asset Hub (Statemint)
  };

  return paraIds[relayChain];
}
