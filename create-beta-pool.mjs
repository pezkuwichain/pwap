import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { cryptoWaitReady } from '@polkadot/util-crypto';

async function main() {
  await cryptoWaitReady();
  
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });
  
  // Founder account from seed phrase
  const keyring = new Keyring({ type: 'sr25519' });
  const founder = keyring.addFromUri('skill dose toward always latin fish film cabbage praise blouse kingdom depth');
  
  console.log('🔑 Founder address:', founder.address);
  console.log('');
  
  // Get founder balance
  const { data: balance } = await api.query.system.account(founder.address);
  console.log('💰 HEZ Balance:', balance.free.toHuman());
  console.log('');
  
  // Check PEZ balance (asset ID: 1)
  const pezBalance = await api.query.assets.account(1, founder.address);
  if (pezBalance.isSome) {
    console.log('💰 PEZ Balance:', pezBalance.unwrap().balance.toHuman());
  } else {
    console.log('💰 PEZ Balance: 0');
  }
  console.log('');
  
  // Create HEZ/PEZ pool
  console.log('🏊 Creating HEZ/PEZ pool...');
  
  // For asset conversion pools:
  // Native HEZ = { parents: 0, interior: 'Here' }
  // PEZ token (asset ID 1) = { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: 1 }] } }
  
  const asset1 = api.createType('MultiLocation', {
    parents: 0,
    interior: api.createType('Junctions', 'Here')
  });
  
  const asset2 = api.createType('MultiLocation', {
    parents: 0,
    interior: api.createType('Junctions', {
      X2: [
        api.createType('Junction', { PalletInstance: 50 }),
        api.createType('Junction', { GeneralIndex: 1 })
      ]
    })
  });
  
  console.log('Asset 1 (HEZ):', asset1.toHuman());
  console.log('Asset 2 (PEZ):', asset2.toHuman());
  console.log('');
  
  return new Promise((resolve, reject) => {
    api.tx.assetConversion
      .createPool(asset1, asset2)
      .signAndSend(founder, ({ status, events }) => {
        console.log('Transaction status:', status.type);
        
        if (status.isInBlock) {
          console.log('✅ Pool creation included in block:', status.asInBlock.toHex());
          console.log('');
          
          events.forEach(({ event: { data, method, section } }) => {
            console.log(`  ${section}.${method}:`, data.toHuman());
          });
          
          console.log('');
          console.log('✅ HEZ/PEZ pool created successfully!');
          console.log('');
          console.log('💧 Next: Add liquidity via Polkadot.js Apps or your frontend');
          console.log('   - Go to Developer > Extrinsics');
          console.log('   - Select assetConversion > addLiquidity');
          console.log('   - Add HEZ and PEZ tokens to the pool');
          
          api.disconnect();
          resolve();
        }
      })
      .catch(err => {
        console.error('❌ Error:', err);
        api.disconnect();
        reject(err);
      });
  });
}

main().catch(console.error).finally(() => process.exit(0));
