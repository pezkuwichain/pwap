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

  // Check native HEZ balance
  const { data: balance } = await api.query.system.account(founder.address);
  console.log('\nNative HEZ balance:', balance.free.toHuman());
  console.log('Reserved:', balance.reserved.toHuman());
  console.log('Frozen:', balance.frozen.toHuman());

  // Check wHEZ balance
  const whezBal = await api.query.assets.account(0, founder.address);
  console.log('\nwHEZ balance:', whezBal.isSome ? whezBal.unwrap().balance.toHuman() : '0');

  await api.disconnect();
}

main().catch(console.error);
