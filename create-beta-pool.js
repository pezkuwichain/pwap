const { ApiPromise, WsProvider, Keyring } = require('@polkadot/api');
const { cryptoWaitReady } = require('@polkadot/util-crypto');

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
  
  // In Substrate asset_conversion, asset1 should be < asset2
  // Native token (HEZ) is typically 0, PEZ is 1
  const asset1 = { parents: 0, interior: { Here: null } }; // Native HEZ
  const asset2 = { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: 1 }] } }; // PEZ token (asset ID 1)
  
  const txHash = await api.tx.assetConversion
    .createPool(asset1, asset2)
    .signAndSend(founder, { nonce: -1 });
    
  console.log('✅ Pool creation submitted:', txHash.toHex());
  console.log('');
  console.log('⏳ Waiting for pool to be created...');
  
  await new Promise(resolve => setTimeout(resolve, 15000));
  
  console.log('');
  console.log('✅ Pool should be created!');
  console.log('');
  console.log('💧 Next: Add liquidity via frontend');
  
  await api.disconnect();
}

main().catch(console.error);
