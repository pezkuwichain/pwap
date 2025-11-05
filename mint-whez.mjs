import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  const keyring = new Keyring({ type: 'sr25519' });
  const founder = keyring.addFromUri('skill dose toward always latin fish film cabbage praise blouse kingdom depth');

  console.log('Minting 200,000 wHEZ to founder via sudo...');
  const whezAmount = BigInt(200_000) * BigInt(10 ** 12);

  await new Promise((resolve, reject) => {
    api.tx.sudo
      .sudo(
        api.tx.assets.mint(0, founder.address, whezAmount.toString())
      )
      .signAndSend(founder, ({ status, dispatchError, events }) => {
        console.log('Transaction status:', status.type);
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
            console.log('  Event:', event.section + '.' + event.method);
            if (event.section === 'sudo' && event.method === 'Sudid') {
              const result = event.data[0];
              if (result.isOk) {
                console.log('  ✓ Sudo call succeeded');
              } else {
                console.log('  ✗ Sudo call failed:', result.asErr.toString());
              }
            }
          });
          resolve();
        }
      })
      .catch(reject);
  });

  console.log('\nChecking balance after mint...');
  const whezBal = await api.query.assets.account(0, founder.address);
  console.log('wHEZ balance:', whezBal.isSome ? whezBal.unwrap().balance.toHuman() : '0');

  await api.disconnect();
}

main().catch(console.error);
