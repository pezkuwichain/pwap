import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  const api = await ApiPromise.create({
    provider: new WsProvider('ws://127.0.0.1:9944')
  });

  console.log('\n🔍 Checking PEZ/wUSDT Pool State...\n');

  // Check if pool exists
  const pool = await api.query.assetConversion.pools([1, 2]);
  console.log('Pool exists:', pool.isSome);

  if (pool.isSome) {
    console.log('Pool data:', pool.unwrap().toHuman());

    // Get pool reserves
    const reserves = await api.query.assetConversion.poolReserves([1, 2]);
    console.log('\nPool reserves:', reserves.toHuman());
  }

  // Check assets exist
  const asset1 = await api.query.assets.asset(1);
  const asset2 = await api.query.assets.asset(2);
  console.log('\nPEZ (asset 1) exists:', asset1.isSome);
  console.log('wUSDT (asset 2) exists:', asset2.isSome);

  if (asset1.isSome) {
    console.log('PEZ metadata:', (await api.query.assets.metadata(1)).toHuman());
  }
  if (asset2.isSome) {
    console.log('wUSDT metadata:', (await api.query.assets.metadata(2)).toHuman());
  }

  // Check all existing pools
  console.log('\n📊 Checking all pools...');
  const allPoolIds = [
    [0, 1],
    [0, 2],
    [1, 2]
  ];

  for (const poolId of allPoolIds) {
    const poolExists = await api.query.assetConversion.pools(poolId);
    if (poolExists.isSome) {
      const reserves = await api.query.assetConversion.poolReserves(poolId);
      console.log(`\nPool [${poolId}]:`, poolExists.unwrap().toHuman());
      console.log(`  Reserves:`, reserves.toHuman());
    } else {
      console.log(`\nPool [${poolId}]: Does not exist`);
    }
  }

  await api.disconnect();
}

main().catch(console.error);
