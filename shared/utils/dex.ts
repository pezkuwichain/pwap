import { ApiPromise } from '@pezkuwi/api';
import { KNOWN_TOKENS, PoolInfo, SwapQuote, UserLiquidityPosition } from '../types/dex';

/**
 * Format balance with proper decimals
 * @param balance - Raw balance string
 * @param decimals - Token decimals
 * @param precision - Display precision (default 4)
 */
export const formatTokenBalance = (
  balance: string | number | bigint,
  decimals: number,
  precision: number = 4
): string => {
  const balanceBigInt = BigInt(balance);
  const divisor = BigInt(10 ** decimals);
  const integerPart = balanceBigInt / divisor;
  const fractionalPart = balanceBigInt % divisor;

  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  const displayFractional = fractionalStr.slice(0, precision);

  return `${integerPart}.${displayFractional}`;
};

/**
 * Parse user input to raw balance
 * @param input - User input string (e.g., "10.5")
 * @param decimals - Token decimals
 */
export const parseTokenInput = (input: string, decimals: number): string => {
  if (!input || input === '' || input === '.') return '0';

  // Remove non-numeric chars except decimal point
  const cleaned = input.replace(/[^\d.]/g, '');
  const [integer, fractional] = cleaned.split('.');

  const integerPart = BigInt(integer || '0') * BigInt(10 ** decimals);

  if (!fractional) {
    return integerPart.toString();
  }

  // Pad or truncate fractional part
  const fractionalPadded = fractional.padEnd(decimals, '0').slice(0, decimals);
  const fractionalPart = BigInt(fractionalPadded);

  return (integerPart + fractionalPart).toString();
};

/**
 * Calculate price impact for a swap
 * @param reserveIn - Reserve of input token
 * @param reserveOut - Reserve of output token
 * @param amountIn - Amount being swapped in
 */
export const calculatePriceImpact = (
  reserveIn: string,
  reserveOut: string,
  amountIn: string
): string => {
  const reserveInBig = BigInt(reserveIn);
  const reserveOutBig = BigInt(reserveOut);
  const amountInBig = BigInt(amountIn);

  if (reserveInBig === BigInt(0) || reserveOutBig === BigInt(0)) {
    return '0';
  }

  // Price before = reserveOut / reserveIn
  // Amount out with constant product: (amountIn * reserveOut) / (reserveIn + amountIn)
  const amountOut =
    (amountInBig * reserveOutBig) / (reserveInBig + amountInBig);

  // Price after = (reserveOut - amountOut) / (reserveIn + amountIn)
  const priceBefore = (reserveOutBig * BigInt(10000)) / reserveInBig;
  const priceAfter =
    ((reserveOutBig - amountOut) * BigInt(10000)) /
    (reserveInBig + amountInBig);

  // Impact = |priceAfter - priceBefore| / priceBefore * 100
  const impact = ((priceBefore - priceAfter) * BigInt(100)) / priceBefore;

  return (Number(impact) / 100).toFixed(2);
};

/**
 * Calculate output amount for a swap (constant product formula)
 * @param amountIn - Input amount
 * @param reserveIn - Reserve of input token
 * @param reserveOut - Reserve of output token
 * @param feeRate - Fee rate (e.g., 30 for 0.3%)
 */
export const getAmountOut = (
  amountIn: string,
  reserveIn: string,
  reserveOut: string,
  feeRate: number = 30
): string => {
  const amountInBig = BigInt(amountIn);
  const reserveInBig = BigInt(reserveIn);
  const reserveOutBig = BigInt(reserveOut);

  if (
    amountInBig === BigInt(0) ||
    reserveInBig === BigInt(0) ||
    reserveOutBig === BigInt(0)
  ) {
    return '0';
  }

  // amountInWithFee = amountIn * (10000 - feeRate) / 10000
  const amountInWithFee = (amountInBig * BigInt(10000 - feeRate)) / BigInt(10000);

  // amountOut = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee)
  const numerator = amountInWithFee * reserveOutBig;
  const denominator = reserveInBig + amountInWithFee;

  return (numerator / denominator).toString();
};

/**
 * Calculate required amount1 for given amount2 (maintaining ratio)
 * @param amount2 - Amount of token 2
 * @param reserve1 - Reserve of token 1
 * @param reserve2 - Reserve of token 2
 */
export const quote = (
  amount2: string,
  reserve1: string,
  reserve2: string
): string => {
  const amount2Big = BigInt(amount2);
  const reserve1Big = BigInt(reserve1);
  const reserve2Big = BigInt(reserve2);

  if (reserve2Big === BigInt(0)) return '0';

  return ((amount2Big * reserve1Big) / reserve2Big).toString();
};

/**
 * Fetch all existing pools from chain
 * @param api - Polkadot API instance
 */
export const fetchPools = async (api: ApiPromise): Promise<PoolInfo[]> => {
  try {
    const pools: PoolInfo[] = [];

    // Query all pool accounts
    const poolKeys = await api.query.assetConversion.pools.keys();

    for (const key of poolKeys) {
      // Extract asset IDs from storage key
      const [asset1Raw, asset2Raw] = key.args;
      const asset1 = Number(asset1Raw.toString());
      const asset2 = Number(asset2Raw.toString());

      // Get pool account
      const poolAccount = await api.query.assetConversion.pools([asset1, asset2]);

      if (poolAccount.isNone) continue;

      // Get reserves
      const reserve1Data = await api.query.assets.account(asset1, poolAccount.unwrap());
      const reserve2Data = await api.query.assets.account(asset2, poolAccount.unwrap());

      const reserve1 = reserve1Data.isSome ? (reserve1Data.unwrap() as any).balance.toString() : '0';
      const reserve2 = reserve2Data.isSome ? (reserve2Data.unwrap() as any).balance.toString() : '0';

      // Get LP token supply
      // Substrate's asset-conversion pallet creates LP tokens using poolAssets pallet
      // The LP token ID can be derived from the pool's asset pair
      // Try to query using poolAssets first, fallback to calculating total from reserves
      let lpTokenSupply = '0';
      try {
        // First attempt: Use poolAssets if available
        if (api.query.poolAssets && api.query.poolAssets.asset) {
          // LP token ID in poolAssets is typically the pool pair encoded
          // Try a simple encoding: combine asset IDs
          const lpTokenId = (asset1 << 16) | asset2; // Simple bit-shift encoding
          const lpAssetDetails = await api.query.poolAssets.asset(lpTokenId);
          if (lpAssetDetails.isSome) {
            lpTokenSupply = (lpAssetDetails.unwrap() as any).supply.toString();
          }
        }

        // Second attempt: Calculate from reserves using constant product formula
        // LP supply ≈ sqrt(reserve1 * reserve2) for initial mint
        // For existing pools, we'd need historical data
        if (lpTokenSupply === '0' && BigInt(reserve1) > BigInt(0) && BigInt(reserve2) > BigInt(0)) {
          // Simplified calculation: geometric mean of reserves
          // This is an approximation - actual LP supply should be queried from chain
          const r1 = BigInt(reserve1);
          const r2 = BigInt(reserve2);
          const product = r1 * r2;

          // Integer square root approximation
          let sqrt = BigInt(1);
          let prev = BigInt(0);
          while (sqrt !== prev) {
            prev = sqrt;
            sqrt = (sqrt + product / sqrt) / BigInt(2);
          }

          lpTokenSupply = sqrt.toString();
        }
      } catch (error) {
        console.warn('Could not query LP token supply:', error);
        // Fallback to '0' is already set
      }

      // Get token info
      const token1 = KNOWN_TOKENS[asset1] || {
        id: asset1,
        symbol: `Asset ${asset1}`,
        name: `Unknown Asset ${asset1}`,
        decimals: 12,
      };
      const token2 = KNOWN_TOKENS[asset2] || {
        id: asset2,
        symbol: `Asset ${asset2}`,
        name: `Unknown Asset ${asset2}`,
        decimals: 12,
      };

      pools.push({
        id: `${asset1}-${asset2}`,
        asset1,
        asset2,
        asset1Symbol: token1.symbol,
        asset2Symbol: token2.symbol,
        asset1Decimals: token1.decimals,
        asset2Decimals: token2.decimals,
        reserve1,
        reserve2,
        lpTokenSupply,
        feeRate: '0.3', // Default 0.3%
      });
    }

    return pools;
  } catch (error) {
    console.error('Failed to fetch pools:', error);
    return [];
  }
};

/**
 * Validate amounts are greater than zero
 */
export const validateAmount = (amount: string): boolean => {
  try {
    const amountBig = BigInt(amount);
    return amountBig > BigInt(0);
  } catch {
    return false;
  }
};

/**
 * Calculate minimum amount with slippage tolerance
 * @param amount - Expected amount
 * @param slippage - Slippage percentage (e.g., 1 for 1%)
 */
export const calculateMinAmount = (amount: string, slippage: number): string => {
  const amountBig = BigInt(amount);
  const slippageFactor = BigInt(10000 - slippage * 100);
  return ((amountBig * slippageFactor) / BigInt(10000)).toString();
};

/**
 * Get token symbol safely
 */
export const getTokenSymbol = (assetId: number): string => {
  return KNOWN_TOKENS[assetId]?.symbol || `Asset ${assetId}`;
};

/**
 * Get token decimals safely
 */
export const getTokenDecimals = (assetId: number): number => {
  return KNOWN_TOKENS[assetId]?.decimals || 12;
};

/**
 * Calculate TVL (Total Value Locked) for a pool
 * @param reserve1 - Reserve of first token
 * @param reserve2 - Reserve of second token
 * @param decimals1 - Decimals of first token
 * @param decimals2 - Decimals of second token
 * @param price1USD - Price of first token in USD (optional)
 * @param price2USD - Price of second token in USD (optional)
 * @returns TVL in USD as string, or reserves sum if prices not available
 */
export const calculatePoolTVL = (
  reserve1: string,
  reserve2: string,
  decimals1: number = 12,
  decimals2: number = 12,
  price1USD?: number,
  price2USD?: number
): string => {
  try {
    const r1 = BigInt(reserve1);
    const r2 = BigInt(reserve2);

    if (price1USD && price2USD) {
      // Convert reserves to human-readable amounts
      const amount1 = Number(r1) / Math.pow(10, decimals1);
      const amount2 = Number(r2) / Math.pow(10, decimals2);

      // Calculate USD value
      const value1 = amount1 * price1USD;
      const value2 = amount2 * price2USD;
      const totalTVL = value1 + value2;

      return totalTVL.toFixed(2);
    }

    // Fallback: return sum of reserves (not USD value)
    // This is useful for display even without price data
    const total = r1 + r2;
    return formatTokenBalance(total.toString(), decimals1, 2);
  } catch (error) {
    console.error('Error calculating TVL:', error);
    return '0';
  }
};

/**
 * Calculate APR (Annual Percentage Rate) for a pool
 * @param feesEarned24h - Fees earned in last 24 hours (in smallest unit)
 * @param totalLiquidity - Total liquidity in pool (in smallest unit)
 * @param decimals - Token decimals
 * @returns APR as percentage string
 */
export const calculatePoolAPR = (
  feesEarned24h: string,
  totalLiquidity: string,
  decimals: number = 12
): string => {
  try {
    const fees24h = BigInt(feesEarned24h);
    const liquidity = BigInt(totalLiquidity);

    if (liquidity === BigInt(0)) {
      return '0.00';
    }

    // Daily rate = fees24h / totalLiquidity
    // APR = daily rate * 365 * 100 (for percentage)
    const dailyRate = (fees24h * BigInt(100000)) / liquidity; // Multiply by 100000 for precision
    const apr = (dailyRate * BigInt(365)) / BigInt(1000); // Divide by 1000 to get percentage

    return (Number(apr) / 100).toFixed(2);
  } catch (error) {
    console.error('Error calculating APR:', error);
    return '0.00';
  }
};

/**
 * Find best swap route using multi-hop
 * @param api - Polkadot API instance
 * @param assetIn - Input asset ID
 * @param assetOut - Output asset ID
 * @param amountIn - Amount to swap in
 * @returns Best swap route with quote
 */
export const findBestSwapRoute = async (
  api: ApiPromise,
  assetIn: number,
  assetOut: number,
  amountIn: string
): Promise<SwapQuote> => {
  try {
    // Get all available pools
    const pools = await fetchPools(api);

    // Direct swap path
    const directPool = pools.find(
      (p) =>
        (p.asset1 === assetIn && p.asset2 === assetOut) ||
        (p.asset1 === assetOut && p.asset2 === assetIn)
    );

    let bestQuote: SwapQuote = {
      amountIn,
      amountOut: '0',
      path: [assetIn, assetOut],
      priceImpact: '0',
      minimumReceived: '0',
      route: `${getTokenSymbol(assetIn)} → ${getTokenSymbol(assetOut)}`,
    };

    // Try direct swap
    if (directPool) {
      const isForward = directPool.asset1 === assetIn;
      const reserveIn = isForward ? directPool.reserve1 : directPool.reserve2;
      const reserveOut = isForward ? directPool.reserve2 : directPool.reserve1;

      const amountOut = getAmountOut(amountIn, reserveIn, reserveOut);
      const priceImpact = calculatePriceImpact(reserveIn, reserveOut, amountIn);
      const minimumReceived = calculateMinAmount(amountOut, 1); // 1% slippage

      bestQuote = {
        amountIn,
        amountOut,
        path: [assetIn, assetOut],
        priceImpact,
        minimumReceived,
        route: `${getTokenSymbol(assetIn)} → ${getTokenSymbol(assetOut)}`,
      };
    }

    // Try multi-hop routes (through intermediate tokens)
    // Common intermediate tokens: wHEZ (0), PEZ (1), wUSDT (2)
    const intermediateTokens = [0, 1, 2].filter(
      (id) => id !== assetIn && id !== assetOut
    );

    for (const intermediate of intermediateTokens) {
      try {
        // Find first hop pool
        const pool1 = pools.find(
          (p) =>
            (p.asset1 === assetIn && p.asset2 === intermediate) ||
            (p.asset1 === intermediate && p.asset2 === assetIn)
        );

        // Find second hop pool
        const pool2 = pools.find(
          (p) =>
            (p.asset1 === intermediate && p.asset2 === assetOut) ||
            (p.asset1 === assetOut && p.asset2 === intermediate)
        );

        if (!pool1 || !pool2) continue;

        // Calculate first hop
        const isForward1 = pool1.asset1 === assetIn;
        const reserveIn1 = isForward1 ? pool1.reserve1 : pool1.reserve2;
        const reserveOut1 = isForward1 ? pool1.reserve2 : pool1.reserve1;
        const amountIntermediate = getAmountOut(amountIn, reserveIn1, reserveOut1);

        // Calculate second hop
        const isForward2 = pool2.asset1 === intermediate;
        const reserveIn2 = isForward2 ? pool2.reserve1 : pool2.reserve2;
        const reserveOut2 = isForward2 ? pool2.reserve2 : pool2.reserve1;
        const amountOut = getAmountOut(amountIntermediate, reserveIn2, reserveOut2);

        // Calculate combined price impact
        const impact1 = calculatePriceImpact(reserveIn1, reserveOut1, amountIn);
        const impact2 = calculatePriceImpact(
          reserveIn2,
          reserveOut2,
          amountIntermediate
        );
        const totalImpact = (
          parseFloat(impact1) + parseFloat(impact2)
        ).toFixed(2);

        // If this route gives better output, use it
        if (BigInt(amountOut) > BigInt(bestQuote.amountOut)) {
          const minimumReceived = calculateMinAmount(amountOut, 1);
          bestQuote = {
            amountIn,
            amountOut,
            path: [assetIn, intermediate, assetOut],
            priceImpact: totalImpact,
            minimumReceived,
            route: `${getTokenSymbol(assetIn)} → ${getTokenSymbol(intermediate)} → ${getTokenSymbol(assetOut)}`,
          };
        }
      } catch (error) {
        console.warn(`Error calculating route through ${intermediate}:`, error);
        continue;
      }
    }

    return bestQuote;
  } catch (error) {
    console.error('Error finding best swap route:', error);
    return {
      amountIn,
      amountOut: '0',
      path: [assetIn, assetOut],
      priceImpact: '0',
      minimumReceived: '0',
      route: 'Error',
    };
  }
};

/**
 * Fetch user's LP token positions across all pools
 * @param api - Polkadot API instance
 * @param userAddress - User's wallet address
 */
export const fetchUserLPPositions = async (
  api: ApiPromise,
  userAddress: string
): Promise<UserLiquidityPosition[]> => {
  try {
    const positions: UserLiquidityPosition[] = [];

    // First, get all available pools
    const pools = await fetchPools(api);

    for (const pool of pools) {
      try {
        // Try to find LP token balance for this pool
        let lpTokenBalance = '0';

        // Method 1: Check poolAssets pallet
        if (api.query.poolAssets && api.query.poolAssets.account) {
          const lpTokenId = (pool.asset1 << 16) | pool.asset2;
          const lpAccount = await api.query.poolAssets.account(lpTokenId, userAddress);
          if (lpAccount.isSome) {
            lpTokenBalance = (lpAccount.unwrap() as any).balance.toString();
          }
        }

        // Skip if user has no LP tokens for this pool
        if (lpTokenBalance === '0' || BigInt(lpTokenBalance) === BigInt(0)) {
          continue;
        }

        // Calculate user's share of the pool
        const lpSupply = BigInt(pool.lpTokenSupply);
        const userLPBig = BigInt(lpTokenBalance);

        if (lpSupply === BigInt(0)) {
          continue; // Avoid division by zero
        }

        // Share percentage: (userLP / totalLP) * 100
        const sharePercentage = (userLPBig * BigInt(10000)) / lpSupply; // Multiply by 10000 for precision
        const shareOfPool = (Number(sharePercentage) / 100).toFixed(2);

        // Calculate underlying asset amounts
        const reserve1Big = BigInt(pool.reserve1);
        const reserve2Big = BigInt(pool.reserve2);

        const asset1Amount = ((reserve1Big * userLPBig) / lpSupply).toString();
        const asset2Amount = ((reserve2Big * userLPBig) / lpSupply).toString();

        positions.push({
          poolId: pool.id,
          asset1: pool.asset1,
          asset2: pool.asset2,
          lpTokenBalance,
          shareOfPool,
          asset1Amount,
          asset2Amount,
          // These will be calculated separately if needed
          valueUSD: undefined,
          feesEarned: undefined,
        });
      } catch (error) {
        console.warn(`Error fetching LP position for pool ${pool.id}:`, error);
        // Continue with next pool
      }
    }

    return positions;
  } catch (error) {
    console.error('Failed to fetch user LP positions:', error);
    return [];
  }
};
