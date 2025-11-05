import { ApiPromise, WsProvider } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();

  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log('Checking current asset state...\n');

  // Check if asset 2 exists
  console.log('Asset ID 2 (wUSDT):');
  try {
    const asset2 = await api.query.assets.asset(2);
    if (asset2.isSome) {
      console.log('  EXISTS:', asset2.unwrap().toHuman());
    } else {
      console.log('  DOES NOT EXIST');
    }
  } catch (e) {
    console.log('  ERROR:', e.message);
  }

  // Check asset 0 and 1
  console.log('\nAsset ID 0 (wHEZ):');
  try {
    const asset0 = await api.query.assets.asset(0);
    if (asset0.isSome) {
      console.log('  EXISTS:', asset0.unwrap().toHuman());
    } else {
      console.log('  DOES NOT EXIST');
    }
  } catch (e) {
    console.log('  ERROR:', e.message);
  }

  console.log('\nAsset ID 1 (PEZ):');
  try {
    const asset1 = await api.query.assets.asset(1);
    if (asset1.isSome) {
      console.log('  EXISTS:', asset1.unwrap().toHuman());
    } else {
      console.log('  DOES NOT EXIST');
    }
  } catch (e) {
    console.log('  ERROR:', e.message);
  }

  // Check next asset ID
  console.log('\nNext Asset ID:');
  try {
    const nextId = await api.query.assets.nextAssetId();
    console.log('  ', nextId.toHuman());
  } catch (e) {
    console.log('  ERROR:', e.message);
  }

  await api.disconnect();
}

main().catch(console.error);
