import { ApiPromise, WsProvider } from '@polkadot/api';
import { cryptoWaitReady, blake2AsHex } from '@polkadot/util-crypto';
import { stringToU8a, u8aConcat, bnToU8a } from '@polkadot/util';

async function derivePoolAccount(api, asset1, asset2) {
  // PalletId for AssetConversion: "py/ascon" (8 bytes)
  const PALLET_ID = stringToU8a('py/ascon');

  // Create PoolId tuple (u32, u32)
  const poolId = api.createType('(u32, u32)', [asset1, asset2]);

  // Create (PalletId, PoolId) tuple: ([u8; 8], (u32, u32))
  const palletIdType = api.createType('[u8; 8]', PALLET_ID);
  const fullTuple = api.createType('([u8; 8], (u32, u32))', [palletIdType, poolId]);

  // Hash the SCALE-encoded tuple using BLAKE2-256
  const accountHash = blake2AsHex(fullTuple.toU8a(), 256);

  // Create AccountId from the hash
  const poolAccountId = api.createType('AccountId32', accountHash);
  return poolAccountId.toString();
}

async function main() {
  await cryptoWaitReady();

  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log('🔍 Checking pool balances in detail\n');

  // Check wHEZ/wUSDT pool (0, 2)
  console.log('=== Pool: wHEZ/wUSDT (0, 2) ===');
  const pool1Info = await api.query.assetConversion.pools([0, 2]);

  if (pool1Info.isSome) {
    const lpToken = pool1Info.unwrap().toJSON().lpToken;
    console.log(`LP Token ID: ${lpToken}`);

    const poolAccount = await derivePoolAccount(api, 0, 2);
    console.log(`Pool Account: ${poolAccount}`);

    // Query wHEZ balance (asset 0)
    const whezBalance = await api.query.assets.account(0, poolAccount);
    if (whezBalance.isSome) {
      const whez = Number(whezBalance.unwrap().balance.toString()) / 1e12;
      console.log(`wHEZ in pool: ${whez.toLocaleString()}`);
    } else {
      console.log('wHEZ balance: 0');
    }

    // Query wUSDT balance (asset 2)
    const wusdtBalance = await api.query.assets.account(2, poolAccount);
    if (wusdtBalance.isSome) {
      const wusdt = Number(wusdtBalance.unwrap().balance.toString()) / 1e6;
      console.log(`wUSDT in pool: ${wusdt.toLocaleString()}`);

      // Calculate rate
      const whezRaw = whezBalance.isSome ? Number(whezBalance.unwrap().balance.toString()) / 1e12 : 0;
      if (whezRaw > 0) {
        console.log(`Rate: 1 wUSDT = ${(whezRaw / wusdt).toFixed(4)} wHEZ`);
        console.log(`Rate: 1 wHEZ = ${(wusdt / whezRaw).toFixed(4)} wUSDT`);
      }
    } else {
      console.log('wUSDT balance: 0');
    }
  } else {
    console.log('❌ Pool does not exist!');
  }

  // Check PEZ/wUSDT pool (1, 2)
  console.log('\n=== Pool: PEZ/wUSDT (1, 2) ===');
  const pool2Info = await api.query.assetConversion.pools([1, 2]);

  if (pool2Info.isSome) {
    const lpToken = pool2Info.unwrap().toJSON().lpToken;
    console.log(`LP Token ID: ${lpToken}`);

    const poolAccount = await derivePoolAccount(api, 1, 2);
    console.log(`Pool Account: ${poolAccount}`);

    // Query PEZ balance (asset 1)
    const pezBalance = await api.query.assets.account(1, poolAccount);
    if (pezBalance.isSome) {
      const pez = Number(pezBalance.unwrap().balance.toString()) / 1e12;
      console.log(`PEZ in pool: ${pez.toLocaleString()}`);
    } else {
      console.log('PEZ balance: 0');
    }

    // Query wUSDT balance (asset 2)
    const wusdtBalance = await api.query.assets.account(2, poolAccount);
    if (wusdtBalance.isSome) {
      const wusdt = Number(wusdtBalance.unwrap().balance.toString()) / 1e6;
      console.log(`wUSDT in pool: ${wusdt.toLocaleString()}`);

      // Calculate rate
      const pezRaw = pezBalance.isSome ? Number(pezBalance.unwrap().balance.toString()) / 1e12 : 0;
      if (pezRaw > 0) {
        console.log(`Rate: 1 wUSDT = ${(pezRaw / wusdt).toFixed(4)} PEZ`);
        console.log(`Rate: 1 PEZ = ${(wusdt / pezRaw).toFixed(6)} wUSDT`);
      }
    } else {
      console.log('wUSDT balance: 0');
    }
  } else {
    console.log('❌ Pool does not exist!');
  }

  await api.disconnect();
}

main().catch(console.error);
