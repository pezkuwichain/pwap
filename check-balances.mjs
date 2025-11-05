import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  const keyring = new Keyring({ type: 'sr25519' });
  const founder = keyring.addFromUri('skill dose toward always latin fish film cabbage praise blouse kingdom depth');

  console.log('Founder address:', founder.address);
  console.log('\nChecking balances...');

  const whezBal = await api.query.assets.account(0, founder.address);
  const pezBal = await api.query.assets.account(1, founder.address);
  const wusdtBal = await api.query.assets.account(2, founder.address);

  console.log('  wHEZ:', whezBal.isSome ? whezBal.unwrap().balance.toHuman() : '0');
  console.log('  PEZ:', pezBal.isSome ? pezBal.unwrap().balance.toHuman() : '0');
  console.log('  wUSDT:', wusdtBal.isSome ? wusdtBal.unwrap().balance.toHuman() : '0');

  console.log('\nChecking pools...');
  const pool1 = await api.query.assetConversion.pools([0, 1]);
  const pool2 = await api.query.assetConversion.pools([0, 2]);
  const pool3 = await api.query.assetConversion.pools([1, 2]);

  console.log('  wHEZ/PEZ pool exists:', pool1.isSome);
  console.log('  wHEZ/wUSDT pool exists:', pool2.isSome);
  console.log('  PEZ/wUSDT pool exists:', pool3.isSome);

  if (pool1.isSome) {
    console.log('\nwHEZ/PEZ pool details:', pool1.unwrap().toHuman());
  }

  await api.disconnect();
}

main().catch(console.error);
