import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  const keyring = new Keyring({ type: 'sr25519' });
  const founder = keyring.addFromUri('skill dose toward always latin fish film cabbage praise blouse kingdom depth');

  console.log('\n📝 Creating PEZ/wUSDT pool');
  console.log('  Ratio: 200,000 PEZ : 10,000 wUSDT (20:1)');
  console.log('  Exchange rate: 1 wUSDT = 20 PEZ\n');

  const pezAmount = BigInt(200_000) * BigInt(10 ** 12);
  const wusdtAmount = BigInt(10_000) * BigInt(10 ** 6);

  // Check if pool exists
  const poolExists = await api.query.assetConversion.pools([1, 2]);
  
  if (poolExists.isNone) {
    console.log('Creating pool...');
    await new Promise((resolve, reject) => {
      api.tx.assetConversion
        .createPool(1, 2)
        .signAndSend(founder, ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              console.log('  Error:', dispatchError.toString());
              reject(new Error(dispatchError.toString()));
              return;
            }
            console.log('  ✓ Pool created');
            resolve();
          }
        })
        .catch(reject);
    });
  } else {
    console.log('✓ Pool already exists');
  }

  console.log('Adding liquidity...');
  await new Promise((resolve, reject) => {
    api.tx.assetConversion
      .addLiquidity(
        1, 2,
        pezAmount.toString(),
        wusdtAmount.toString(),
        pezAmount.toString(),
        wusdtAmount.toString(),
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
              console.log('  ✓ Liquidity added to PEZ/wUSDT pool!');
              console.log('     Amounts:', event.data.toHuman());
            }
          });
          resolve();
        }
      })
      .catch(reject);
  });

  console.log('\n✅ PEZ/wUSDT pool is ready!');
  console.log('Exchange rate: 1 wUSDT = 20 PEZ ✓');

  await api.disconnect();
}

main().catch(console.error);
