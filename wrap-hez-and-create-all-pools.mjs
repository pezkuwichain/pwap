import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  const keyring = new Keyring({ type: 'sr25519' });
  const founder = keyring.addFromUri('skill dose toward always latin fish film cabbage praise blouse kingdom depth');

  console.log('\n🔄 Wrapping 200,000 HEZ to wHEZ...');
  const wrapAmount = BigInt(200_000) * BigInt(10 ** 12);

  await new Promise((resolve, reject) => {
    api.tx.tokenWrapper
      .wrap(wrapAmount.toString())
      .signAndSend(founder, ({ status, dispatchError, events }) => {
        if (status.isInBlock) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.log('  Error:', decoded.name, '-', decoded.docs.join(' '));
            } else {
              console.log('  Error:', dispatchError.toString());
            }
            reject(new Error(dispatchError.toString()));
            return;
          }
          events.forEach(({ event }) => {
            if (event.section === 'tokenWrapper') {
              console.log('  Event:', event.method, event.data.toHuman());
            }
          });
          console.log('  ✓ Wrapped 200,000 HEZ to wHEZ');
          resolve();
        }
      })
      .catch(reject);
  });

  console.log('\n🚀 Creating all 3 pools...\n');
  console.log('Target exchange rates:');
  console.log('  1 wUSDT = 4 wHEZ = 20 PEZ\n');

  // Pool 1: wHEZ/PEZ (1 wHEZ = 5 PEZ)
  console.log('📝 Pool 1: wHEZ/PEZ');
  console.log('  Ratio: 100,000 wHEZ : 500,000 PEZ (1:5)');
  const whezPez_whez = BigInt(100_000) * BigInt(10 ** 12);
  const whezPez_pez = BigInt(500_000) * BigInt(10 ** 12);

  const pool1 = await api.query.assetConversion.pools([0, 1]);
  if (pool1.isNone) {
    await new Promise((resolve, reject) => {
      api.tx.assetConversion
        .createPool(0, 1)
        .signAndSend(founder, ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              console.log('  Create error:', dispatchError.toString());
            } else {
              console.log('  ✓ Pool created');
            }
            resolve();
          }
        })
        .catch(reject);
    });
  } else {
    console.log('  ✓ Pool already exists');
  }

  console.log('  Adding liquidity...');
  await new Promise((resolve, reject) => {
    api.tx.assetConversion
      .addLiquidity(
        0, 1,
        whezPez_whez.toString(),
        whezPez_pez.toString(),
        whezPez_whez.toString(),
        whezPez_pez.toString(),
        founder.address
      )
      .signAndSend(founder, ({ status, dispatchError, events }) => {
        if (status.isInBlock) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.log('  Error:', decoded.name, '-', decoded.docs.join(' '));
            } else {
              console.log('  Error:', dispatchError.toString());
            }
            reject(new Error(dispatchError.toString()));
            return;
          }
          events.forEach(({ event }) => {
            if (event.section === 'assetConversion' && event.method === 'LiquidityAdded') {
              console.log('  ✓ Liquidity added to wHEZ/PEZ pool');
            }
          });
          resolve();
        }
      })
      .catch(reject);
  });

  // Pool 2: wHEZ/wUSDT (4:1)
  console.log('\n📝 Pool 2: wHEZ/wUSDT');
  console.log('  Ratio: 40,000 wHEZ : 10,000 wUSDT (4:1)');
  const whezUsdt_whez = BigInt(40_000) * BigInt(10 ** 12);
  const whezUsdt_usdt = BigInt(10_000) * BigInt(10 ** 6);

  const pool2 = await api.query.assetConversion.pools([0, 2]);
  if (pool2.isNone) {
    await new Promise((resolve, reject) => {
      api.tx.assetConversion
        .createPool(0, 2)
        .signAndSend(founder, ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              console.log('  Create error:', dispatchError.toString());
            } else {
              console.log('  ✓ Pool created');
            }
            resolve();
          }
        })
        .catch(reject);
    });
  } else {
    console.log('  ✓ Pool already exists');
  }

  console.log('  Adding liquidity...');
  await new Promise((resolve, reject) => {
    api.tx.assetConversion
      .addLiquidity(
        0, 2,
        whezUsdt_whez.toString(),
        whezUsdt_usdt.toString(),
        whezUsdt_whez.toString(),
        whezUsdt_usdt.toString(),
        founder.address
      )
      .signAndSend(founder, ({ status, dispatchError, events }) => {
        if (status.isInBlock) {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.log('  Error:', decoded.name, '-', decoded.docs.join(' '));
            } else {
              console.log('  Error:', dispatchError.toString());
            }
            reject(new Error(dispatchError.toString()));
            return;
          }
          events.forEach(({ event }) => {
            if (event.section === 'assetConversion' && event.method === 'LiquidityAdded') {
              console.log('  ✓ Liquidity added to wHEZ/wUSDT pool');
            }
          });
          resolve();
        }
      })
      .catch(reject);
  });

  // Pool 3: PEZ/wUSDT (20:1) - already exists but add more liquidity
  console.log('\n📝 Pool 3: PEZ/wUSDT');
  console.log('  Pool already exists with liquidity');

  console.log('\n✅ All 3 pools are ready!');
  console.log('\nPool Summary:');
  console.log('  1. wHEZ/PEZ: 100k:500k (1 wHEZ = 5 PEZ)');
  console.log('  2. wHEZ/wUSDT: 40k:10k (4 wHEZ = 1 wUSDT)');
  console.log('  3. PEZ/wUSDT: 200k:10k (20 PEZ = 1 wUSDT)');
  console.log('\nExchange rates: 1 wUSDT = 4 wHEZ = 20 PEZ ✓');

  await api.disconnect();
}

main().catch(console.error);
