import { ApiPromise, WsProvider } from '@pezkuwi/api';

async function checkAllPools() {
  const provider = new WsProvider('wss://asset-hub-rpc.pezkuwichain.io');
  const api = await ApiPromise.create({ provider });

  console.log('Connected to Asset Hub\n');

  const userAddress = '5CyuFfbF95rzBxru7c9yEsX4XmQXUxpLUcbj9RLg9K1cGiiF';

  // Get all pools
  const poolKeys = await api.query.assetConversion.pools.keys();
  console.log('=== ALL POOLS ===');
  console.log('Total pools found:', poolKeys.length, '\n');

  for (const key of poolKeys) {
    const poolPair = key.args[0];
    console.log('Pool key:', JSON.stringify(poolPair.toHuman()));

    const poolInfo = await api.query.assetConversion.pools(poolPair);
    if (!poolInfo.isEmpty) {
      const poolData = poolInfo.unwrap().toJSON();
      console.log('LP Token ID:', poolData.lpToken);

      // Get LP supply
      const lpAsset = await api.query.poolAssets.asset(poolData.lpToken);
      if (lpAsset.isSome) {
        const supply = lpAsset.unwrap().toJSON().supply;
        console.log('Total LP Supply:', Number(BigInt(supply)) / 1e12);
      }

      // Get user's LP balance
      const userLp = await api.query.poolAssets.account(poolData.lpToken, userAddress);
      if (userLp.isSome) {
        const balance = userLp.unwrap().toJSON().balance;
        console.log('User LP Balance:', Number(BigInt(balance)) / 1e12);
      } else {
        console.log('User LP Balance: 0');
      }

      // Try to get price
      try {
        const asset1 = poolPair[0];
        const asset2 = poolPair[1];
        const oneUnit = BigInt(1e12);
        const quote = await api.call.assetConversionApi.quotePriceExactTokensForTokens(
          asset1,
          asset2,
          oneUnit.toString(),
          true
        );
        if (quote && !quote.isNone) {
          console.log('Price (1 asset1 -> asset2):', Number(BigInt(quote.unwrap().toString())) / 1e12);
        }
      } catch {
        // Try with 6 decimals for USDT
        try {
          const asset1 = poolPair[0];
          const asset2 = poolPair[1];
          const oneUnit = BigInt(1e12);
          const quote = await api.call.assetConversionApi.quotePriceExactTokensForTokens(
            asset1,
            asset2,
            oneUnit.toString(),
            true
          );
          if (quote && !quote.isNone) {
            console.log('Price (1 asset1 -> asset2):', Number(BigInt(quote.unwrap().toString())) / 1e6, 'USDT');
          }
        } catch {
          console.log('Could not get price');
        }
      }
    }
    console.log('---');
  }

  // Check all LP token balances for user
  console.log('\n=== USER LP TOKEN BALANCES ===');
  for (let lpId = 0; lpId < 5; lpId++) {
    const userLp = await api.query.poolAssets.account(lpId, userAddress);
    if (userLp.isSome) {
      const balance = userLp.unwrap().toJSON().balance;
      console.log(`LP Token ${lpId}: ${Number(BigInt(balance)) / 1e12}`);
    }
  }

  await api.disconnect();
}

checkAllPools().catch(console.error);
