import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();

  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  const keyring = new Keyring({ type: 'sr25519' });
  const founder = keyring.addFromUri('skill dose toward always latin fish film cabbage praise blouse kingdom depth');

  console.log('\n🔍 Checking founder token balances...');
  console.log('Founder address:', founder.address);

  // Check balances
  const whezBalance = await api.query.assets.account(0, founder.address);
  const pezBalance = await api.query.assets.account(1, founder.address);
  const wusdtBalance = await api.query.assets.account(2, founder.address);

  console.log('\nCurrent balances:');
  console.log('  wHEZ:', whezBalance.isSome ? whezBalance.unwrap().balance.toString() : '0');
  console.log('  PEZ:', pezBalance.isSome ? pezBalance.unwrap().balance.toString() : '0');
  console.log('  wUSDT:', wusdtBalance.isSome ? wusdtBalance.unwrap().balance.toString() : '0');

  // Mint wHEZ to founder using sudo
  console.log('\n💰 Minting 200,000 wHEZ to founder via sudo...');
  const whezAmount = BigInt(200_000) * BigInt(10 ** 12);

  await new Promise((resolve, reject) => {
    api.tx.sudo
      .sudo(
        api.tx.assets.mint(0, founder.address, whezAmount.toString())
      )
      .signAndSend(founder, ({ status, dispatchError, events }) => {
        if (status.isInBlock) {
          if (dispatchError) {
            console.log('  Error:', dispatchError.toString());
            reject(new Error(dispatchError.toString()));
            return;
          }
          console.log('  ✓ wHEZ minted successfully');
          resolve();
        }
      })
      .catch(reject);
  });

  console.log('\n🚀 Creating all 3 beta testnet pools...\n');
  console.log('Target exchange rates:');
  console.log('  1 wUSDT = 4 wHEZ = 20 PEZ\n');

  // Pool 1: wHEZ/PEZ (1 wHEZ = 5 PEZ)
  console.log('📝 Pool 1: wHEZ/PEZ');
  console.log('  Ratio: 100,000 wHEZ : 500,000 PEZ (1:5)');
  const whezPez_whez = BigInt(100_000) * BigInt(10 ** 12);
  const whezPez_pez = BigInt(500_000) * BigInt(10 ** 12);

  // Check if pool exists
  const pool1 = await api.query.assetConversion.pools([0, 1]);
  if (pool1.isNone) {
    await new Promise((resolve, reject) => {
      api.tx.assetConversion
        .createPool(0, 1)
        .signAndSend(founder, ({ status, dispatchError, events }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              console.log('  Create pool error:', dispatchError.toString());
            } else {
              events.forEach(({ event }) => {
                if (event.section === 'assetConversion' && event.method === 'PoolCreated') {
                  console.log('  ✓ Pool created');
                }
              });
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
            console.log('  Error:', dispatchError.toString());
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
              console.log('  Create pool error:', dispatchError.toString());
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
            console.log('  Error:', dispatchError.toString());
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

  // Pool 3: PEZ/wUSDT (20:1)
  console.log('\n📝 Pool 3: PEZ/wUSDT');
  console.log('  Ratio: 200,000 PEZ : 10,000 wUSDT (20:1)');
  const pezUsdt_pez = BigInt(200_000) * BigInt(10 ** 12);
  const pezUsdt_usdt = BigInt(10_000) * BigInt(10 ** 6);

  const pool3 = await api.query.assetConversion.pools([1, 2]);
  if (pool3.isNone) {
    await new Promise((resolve, reject) => {
      api.tx.assetConversion
        .createPool(1, 2)
        .signAndSend(founder, ({ status, dispatchError }) => {
          if (status.isInBlock) {
            if (dispatchError) {
              console.log('  Create pool error:', dispatchError.toString());
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
        1, 2,
        pezUsdt_pez.toString(),
        pezUsdt_usdt.toString(),
        pezUsdt_pez.toString(),
        pezUsdt_usdt.toString(),
        founder.address
      )
      .signAndSend(founder, ({ status, dispatchError, events }) => {
        if (status.isInBlock) {
          if (dispatchError) {
            console.log('  Error:', dispatchError.toString());
            reject(new Error(dispatchError.toString()));
            return;
          }
          events.forEach(({ event }) => {
            if (event.section === 'assetConversion' && event.method === 'LiquidityAdded') {
              console.log('  ✓ Liquidity added to PEZ/wUSDT pool');
            }
          });
          resolve();
        }
      })
      .catch(reject);
  });

  console.log('\n✅ All 3 pools created successfully!');
  console.log('\nPool Summary:');
  console.log('  1. wHEZ/PEZ: 100k:500k (1 wHEZ = 5 PEZ)');
  console.log('  2. wHEZ/wUSDT: 40k:10k (4 wHEZ = 1 wUSDT)');
  console.log('  3. PEZ/wUSDT: 200k:10k (20 PEZ = 1 wUSDT)');
  console.log('\nExchange rates: 1 wUSDT = 4 wHEZ = 20 PEZ ✓');

  await api.disconnect();
}

main().catch(console.error);
