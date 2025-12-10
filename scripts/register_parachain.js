#!/usr/bin/env node

const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const fs = require('fs');

async function main() {
  const provider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider });

  // Read genesis files as hex strings
  const genesisHead = '0x' + fs.readFileSync('/tmp/teyrchain-genesis-head', 'utf8').trim();
  const genesisWasm = '0x' + fs.readFileSync('/tmp/teyrchain-genesis-wasm', 'utf8').trim();

  console.log(`Genesis head length: ${genesisHead.length} chars`);
  console.log(`Genesis WASM length: ${genesisWasm.length} chars`);

  // Create keyring and add Alice
  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');

  console.log('Registering parachain 2000...');

  // Para ID 2000
  const paraId = 2000;

  // Register parachain using sudo
  const tx = api.tx.sudo.sudo(
    api.tx.parasSudoWrapper.sudoScheduleParaInitialize(
      paraId,
      {
        genesisHead,
        validationCode: genesisWasm,
        paraKind: true, // true for parachain, false for parathread
      }
    )
  );

  // Sign and send transaction
  await new Promise(async (resolve, reject) => {
    const unsub = await tx.signAndSend(alice, ({ status, events, dispatchError }) => {
      console.log(`Transaction status: ${status.type}`);

      if (status.isInBlock) {
        console.log(`Included in block ${status.asInBlock.toHex()}`);

        // Check for errors
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            const { docs, name, section } = decoded;
            console.error(`Error: ${section}.${name}: ${docs.join(' ')}`);
          } else {
            console.error(`Error: ${dispatchError.toString()}`);
          }
          reject(dispatchError);
        }

        events.forEach(({ event }) => {
          const { section, method, data } = event;
          console.log(`Event: ${section}.${method}`, data.toString());
        });
      } else if (status.isFinalized) {
        console.log(`Finalized in block ${status.asFinalized.toHex()}`);
        unsub();
        resolve();
      }
    });
  });

  console.log('Parachain 2000 registered successfully!');
  await api.disconnect();
}

main().catch(console.error).finally(() => process.exit());
