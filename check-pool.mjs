import { ApiPromise, WsProvider } from '@polkadot/api';

async function main() {
  const wsProvider = new WsProvider('ws://127.0.0.1:9944');
  const api = await ApiPromise.create({ provider: wsProvider });

  console.log('\n' + '='.repeat(70));
  console.log('   Beta Testnet - DEX Pool Status & Analysis');
  console.log('='.repeat(70) + '\n');

  const ONE_TOKEN = BigInt(10 ** 12);

  // Pool: wHEZ (0) / PEZ (1)
  const poolId = [0, 1];

  console.log('📊 Pool: wHEZ (Asset 0) / PEZ (Asset 1)\n');

  try {
    // Get pool info
    const poolInfo = await api.query.assetConversion.pools(poolId);

    if (poolInfo.isSome) {
      const lpTokenId = poolInfo.unwrap().toString();
      console.log(`✅ Pool exists - LP Token ID: ${lpTokenId}\n`);

      // Get pool account
      const poolAccount = await api.query.assetConversion.poolAccountIds(poolId);

      if (poolAccount.isSome) {
        const poolAddr = poolAccount.unwrap().toString();
        console.log(`🏦 Pool Account: ${poolAddr}\n`);

        // Get reserves
        const whezBalance = await api.query.assets.account(0, poolAddr);
        const pezBalance = await api.query.assets.account(1, poolAddr);

        if (whezBalance.isSome && pezBalance.isSome) {
          const whezReserve = BigInt(whezBalance.unwrap().balance.toString());
          const pezReserve = BigInt(pezBalance.unwrap().balance.toString());

          console.log('💰 Pool Reserves:');
          console.log(`   wHEZ: ${(Number(whezReserve) / Number(ONE_TOKEN)).toLocaleString('en-US', { minimumFractionDigits: 2 })} wHEZ`);
          console.log(`   PEZ:  ${(Number(pezReserve) / Number(ONE_TOKEN)).toLocaleString('en-US', { minimumFractionDigits: 2 })} PEZ\n`);

          // Calculate k (constant product)
          const k = whezReserve * pezReserve;
          console.log('💎 AMM Constant Product:');
          console.log(`   k = ${(Number(whezReserve) / Number(ONE_TOKEN)).toFixed(2)} × ${(Number(pezReserve) / Number(ONE_TOKEN)).toFixed(2)} = ${(Number(k) / Number(ONE_TOKEN ** BigInt(2))).toLocaleString('en-US')}\n`);

          // Current price
          const priceHezToPez = Number(pezReserve) / Number(whezReserve);
          const pricePezToHez = Number(whezReserve) / Number(pezReserve);

          console.log('💱 Current Prices:');
          console.log(`   1 HEZ = ${priceHezToPez.toFixed(4)} PEZ`);
          console.log(`   1 PEZ = ${pricePezToHez.toFixed(6)} HEZ\n`);

          // Swap simulation with 3% fee
          console.log('🔄 Swap Scenarios (3% LP Fee):');
          console.log('-'.repeat(70) + '\n');

          function calculateSwap(amountIn, reserveIn, reserveOut) {
            // 3% fee: effective amount = amountIn * 0.97
            const amountInWithFee = amountIn * BigInt(97) / BigInt(100);

            // AMM formula: (reserveIn + amountInWithFee) * (reserveOut - amountOut) = k
            // amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
            const numerator = amountInWithFee * reserveOut;
            const denominator = reserveIn + amountInWithFee;
            const amountOut = numerator / denominator;

            // Price impact
            const priceImpact = Number(amountOut) / Number(reserveOut) * 100;

            // Effective rate
            const effectiveRate = Number(amountOut) / Number(amountIn);

            return { amountOut, priceImpact, effectiveRate };
          }

          // HEZ → PEZ scenarios
          console.log('📈 HEZ → PEZ Swaps:\n');
          const hezAmounts = [100, 1000, 5000, 10000, 25000, 50000];

          for (const amount of hezAmounts) {
            const amountIn = BigInt(amount) * ONE_TOKEN;
            const { amountOut, priceImpact, effectiveRate } = calculateSwap(amountIn, whezReserve, pezReserve);

            console.log(`   ${amount.toLocaleString('en-US').padStart(7)} HEZ → ${(Number(amountOut) / Number(ONE_TOKEN)).toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(12)} PEZ (Rate: ${effectiveRate.toFixed(4)}, Impact: ${priceImpact.toFixed(2)}%)`);
          }

          // PEZ → HEZ scenarios
          console.log('\n📉 PEZ → HEZ Swaps:\n');
          const pezAmounts = [500, 5000, 25000, 50000, 100000, 250000];

          for (const amount of pezAmounts) {
            const amountIn = BigInt(amount) * ONE_TOKEN;
            const { amountOut, priceImpact, effectiveRate } = calculateSwap(amountIn, pezReserve, whezReserve);

            console.log(`   ${amount.toLocaleString('en-US').padStart(7)} PEZ → ${(Number(amountOut) / Number(ONE_TOKEN)).toLocaleString('en-US', { minimumFractionDigits: 2 }).padStart(12)} HEZ (Rate: ${effectiveRate.toFixed(6)}, Impact: ${priceImpact.toFixed(2)}%)`);
          }

          // Maximum recommended swaps
          console.log('\n⚠️  Recommended Limits (10% price impact):\n');

          // For 10% impact: solve for amountIn where amountOut/reserveOut = 0.10
          // This is approximate: amountOut ≈ 0.10 * reserveOut
          // 0.10 * reserveOut = (0.97 * amountIn * reserveOut) / (reserveIn + 0.97 * amountIn)
          // Solving: amountIn ≈ (0.10 * reserveIn) / (0.97 - 0.10)

          const maxHezFor10pct = Number(whezReserve) * 0.10 / 0.87 / Number(ONE_TOKEN);
          const maxPezFor10pct = Number(pezReserve) * 0.10 / 0.87 / Number(ONE_TOKEN);

          console.log(`   Max HEZ → PEZ: ~${maxHezFor10pct.toLocaleString('en-US', { maximumFractionDigits: 0 })} HEZ`);
          console.log(`   Max PEZ → HEZ: ~${maxPezFor10pct.toLocaleString('en-US', { maximumFractionDigits: 0 })} PEZ\n`);

        } else {
          console.log('❌ Pool reserves not found\n');
        }
      } else {
        console.log('❌ Pool account not found\n');
      }
    } else {
      console.log('❌ Pool does not exist\n');
    }

  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
  }

  console.log('='.repeat(70));
  console.log('   AMM Mechanisms');
  console.log('='.repeat(70) + '\n');

  console.log('🔧 Built-in Mechanisms:\n');

  console.log('1️⃣  Automatic Rebalancing (Self-Regulating):');
  console.log('   ✓ Pool OTOMATIK olarak dengelenir (x × y = k formülü)');
  console.log('   ✓ Fiyat değişimi supply/demand\'e göre gerçekleşir');
  console.log('   ✓ Arbitraj botları fiyat dengesini sağlar\n');

  console.log('2️⃣  Liquidity Provider (LP) Mechanism:');
  console.log('   ✓ Herkes pool\'a likidite ekleyebilir (addLiquidity)');
  console.log('   ✓ LP tokenları alırlar (pool payı temsil eder)');
  console.log('   ✓ Fee\'lerden gelir kazanırlar (%3 swap fee)');
  console.log('   ✓ İstedikleri zaman çıkabilirler (removeLiquidity)\n');

  console.log('3️⃣  Pool ASLA Boşalmaz:');
  console.log('   ✓ Matematiksel olarak imkansız (x × y = k)');
  console.log('   ✓ Reserve azaldıkça fiyat üstel olarak artar');
  console.log('   ✓ %90 reserve swap\'i için extreme yüksek ödeme gerekir');
  console.log('   ✓ Bu yüksek fiyat arbitraj fırsatı yaratır → likidite gelir\n');

  console.log('4️⃣  NO Automatic Burn Mechanism:');
  console.log('   ✗ Otomatik yakma mekanizması YOK');
  console.log('   ✗ Aşırı bakiye birikimi problemi olmaz');
  console.log('   ✓ Fazla token pool\'a girerse fiyat düşer → arbitraj');
  console.log('   ✓ Piyasa doğal olarak dengelenir\n');

  console.log('5️⃣  NO Automatic Liquidity Addition:');
  console.log('   ✗ Otomatik likidite ekleme YOK');
  console.log('   ✓ LP\'ler incentive ile (fee geliri) manuel ekler');
  console.log('   ✓ Yüksek volume → yüksek fee → daha fazla LP gelir');
  console.log('   ✓ Düşük liquidity → yüksek slippage → LP fırsatı\n');

  console.log('💡 Best Practices:');
  console.log('   • Büyük swapları birden fazla küçük swap\'a bölün');
  console.log('   • Slippage tolerance ayarlayın (örn: %5)');
  console.log('   • High impact swaplarda arbitraj beklentisi olsun');
  console.log('   • Liquidity arttırmak için incentive programları ekleyin\n');

  await api.disconnect();
}

main().catch(console.error);
