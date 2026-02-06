/**
 * Script to create LP staking reward pools
 * Run with: node scripts/create-staking-pools.mjs
 *
 * Requires MNEMONIC environment variable with admin wallet seed
 */

import { ApiPromise, WsProvider } from '@pezkuwi/api';
import { Keyring } from '@pezkuwi/api';

const ASSET_HUB_RPC = 'wss://asset-hub-rpc.pezkuwichain.io';

// LP Token IDs (from assetConversion pools)
const LP_TOKENS = {
  'HEZ-PEZ': 0,
  'HEZ-USDT': 1,
  'HEZ-DOT': 2,
};

// Reward token: PEZ (asset ID 1)
const REWARD_ASSET_ID = 1;

// Reward rate per block (in smallest units - 12 decimals)
// 0.01 PEZ per block = 10_000_000_000 (10^10)
const REWARD_RATE_PER_BLOCK = '10000000000';

// 100 years in blocks (6 second blocks)
const BLOCKS_100_YEARS = 525600000;

async function main() {
  const mnemonic = process.env.MNEMONIC;
  if (!mnemonic) {
    console.error('ERROR: Set MNEMONIC environment variable');
    console.log('Usage: MNEMONIC="foam hope topic phone year fold lyrics biology erosion feed false island" node scripts/create-staking-pools.mjs');
    process.exit(1);
  }

  const provider = new WsProvider(ASSET_HUB_RPC);
  const api = await ApiPromise.create({ provider });

  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromMnemonic(mnemonic);
  console.log('Admin address:', admin.address);

  // Get current block for expiry calculation
  const header = await api.rpc.chain.getHeader();
  const currentBlock = header.number.toNumber();
  const expiryBlock = currentBlock + BLOCKS_100_YEARS;
  console.log('Current block:', currentBlock);
  console.log('Expiry block (100 years):', expiryBlock);

  // Format asset location for LP tokens (poolAssets pallet, instance 55)
  const formatLpTokenLocation = (lpTokenId) => ({
    parents: 0,
    interior: { X2: [{ PalletInstance: 55 }, { GeneralIndex: lpTokenId }] }
  });

  // Format asset location for reward token (assets pallet, instance 50)
  const formatRewardTokenLocation = (assetId) => ({
    parents: 0,
    interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: assetId }] }
  });

  // Expiry format: { At: blockNumber }
  const expiry = { At: expiryBlock };

  console.log('\n=== Creating Staking Pools ===\n');

  for (const [poolName, lpTokenId] of Object.entries(LP_TOKENS)) {
    console.log(`Creating pool for ${poolName} (LP Token #${lpTokenId})...`);

    const stakedAssetLocation = formatLpTokenLocation(lpTokenId);
    const rewardAssetLocation = formatRewardTokenLocation(REWARD_ASSET_ID);

    try {
      const tx = api.tx.assetRewards.createPool(
        stakedAssetLocation,
        rewardAssetLocation,
        REWARD_RATE_PER_BLOCK,
        expiry,
        admin.address // admin
      );

      await new Promise((resolve, reject) => {
        tx.signAndSend(admin, ({ status, events, dispatchError }) => {
          if (status.isInBlock) {
            console.log(`  In block: ${status.asInBlock.toHex()}`);
          } else if (status.isFinalized) {
            console.log(`  Finalized: ${status.asFinalized.toHex()}`);

            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                reject(new Error(`${decoded.section}.${decoded.name}: ${decoded.docs.join(' ')}`));
              } else {
                reject(new Error(dispatchError.toString()));
              }
            } else {
              // Find pool created event
              const poolCreated = events.find(({ event }) =>
                event.section === 'assetRewards' && event.method === 'PoolCreated'
              );
              if (poolCreated) {
                console.log(`  ✅ Pool created:`, poolCreated.event.data.toHuman());
              }
              resolve();
            }
          }
        });
      });

      console.log(`  ✅ ${poolName} staking pool created!\n`);
    } catch (err) {
      console.error(`  ❌ Failed to create ${poolName} pool:`, err.message);
    }
  }

  // List created pools
  console.log('\n=== Created Pools ===');
  const pools = await api.query.assetRewards.pools.entries();
  for (const [key, value] of pools) {
    console.log('Pool ID:', key.args[0].toString());
    console.log('  Config:', value.toHuman());
  }

  await api.disconnect();
  console.log('\nDone!');
}

main().catch(console.error);
