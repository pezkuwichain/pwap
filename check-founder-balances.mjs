import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();

  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  const keyring = new Keyring({ type: 'sr25519' });
  const founder = keyring.addFromUri('skill dose toward always latin fish film cabbage praise blouse kingdom depth');

  console.log('💰 Founder Balances\n');
  console.log(`Address: ${founder.address}\n`);

  // Check wHEZ (asset 0)
  const whezBalance = await api.query.assets.account(0, founder.address);
  if (whezBalance.isSome) {
    const whez = Number(whezBalance.unwrap().balance.toString()) / 1e12;
    console.log(`wHEZ: ${whez.toLocaleString()}`);
  } else {
    console.log('wHEZ: 0');
  }

  // Check PEZ (asset 1)
  const pezBalance = await api.query.assets.account(1, founder.address);
  if (pezBalance.isSome) {
    const pez = Number(pezBalance.unwrap().balance.toString()) / 1e12;
    console.log(`PEZ: ${pez.toLocaleString()}`);
  } else {
    console.log('PEZ: 0');
  }

  // Check wUSDT (asset 2)
  const wusdtBalance = await api.query.assets.account(2, founder.address);
  if (wusdtBalance.isSome) {
    const wusdt = Number(wusdtBalance.unwrap().balance.toString()) / 1e6;
    console.log(`wUSDT: ${wusdt.toLocaleString()}`);
  } else {
    console.log('wUSDT: 0');
  }

  console.log('\n📊 Required for target pools:');
  console.log('- wHEZ/wUSDT (4:1): 40,000 wHEZ + 10,000 wUSDT');
  console.log('- PEZ/wUSDT (20:1): 200,000 PEZ + 10,000 wUSDT');
  console.log('\n(Plus current pool balances need to be removed first)');

  await api.disconnect();
}

main().catch(console.error);
