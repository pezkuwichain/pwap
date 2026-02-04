import { ApiPromise } from '@pezkuwi/api';
import { KNOWN_TOKENS, PoolInfo, SwapQuote, UserLiquidityPosition, NATIVE_TOKEN_ID } from '../types/dex';

// LP tokens typically use 12 decimals on Asset Hub
const LP_TOKEN_DECIMALS = 12;

/**
 * Helper to convert asset ID to XCM Location format for assetConversion pallet
 * @param id - Asset ID (-1 for native token, positive for assets)
 */
export const formatAssetLocation = (id: number) => {
  if (id === NATIVE_TOKEN_ID) {
    // Native token from relay chain
    return { parents: 1, interior: 'Here' };
  }
  // Asset on Asset Hub - XCM location format with PalletInstance 50 (assets pallet)
  return { parents: 0, interior: { X2: [{ PalletInstance: 50 }, { GeneralIndex: id }] } };
};

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
 * Parse XCM Location to extract asset ID
 * @param location - XCM Location object
 * @returns asset ID (-1 for native, positive for assets)
 */
const parseAssetLocation = (location: unknown): number => {
  try {
    const loc = location as { parents?: number; interior?: unknown };

    // Native token: { parents: 1, interior: { here: null } } or { parents: 1, interior: 'Here' }
    if (loc.parents === 1) {
      const interior = loc.interior as { here?: null } | string;
      if (interior === 'Here' || (typeof interior === 'object' && 'here' in interior)) {
        return NATIVE_TOKEN_ID;
      }
    }

    // Asset on Asset Hub: { parents: 0, interior: { x2: [{ palletInstance: 50 }, { generalIndex: id }] } }
    // Note: Keys might be lowercase (x2, generalIndex) when coming from chain
    const interior = loc.interior as {
      X2?: Array<{ GeneralIndex?: number; generalIndex?: number }>;
      x2?: Array<{ GeneralIndex?: number; generalIndex?: number }>;
    };

    const x2 = interior?.X2 || interior?.x2;
    if (x2?.[1]) {
      const generalIndex = x2[1].GeneralIndex ?? x2[1].generalIndex;
      if (generalIndex !== undefined) {
        return generalIndex;
      }
    }

    // Try to parse as JSON and extract
    const locJson = JSON.stringify(location);
    const match = locJson.match(/generalIndex['":\s]+(\d+)/i);
    if (match) {
      return parseInt(match[1], 10);
    }

    return 0; // Default fallback
  } catch {
    return 0;
  }
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
      // Extract asset locations from storage key
      // The key args contain a tuple of XCM Locations: [[loc1, loc2]]
      const poolPair = key.args[0] as unknown as Array<{ toJSON: () => unknown }>;
      const asset1Location = poolPair[0];
      const asset2Location = poolPair[1];

      // Parse XCM Locations to get asset IDs
      const asset1 = parseAssetLocation(asset1Location.toJSON());
      const asset2 = parseAssetLocation(asset2Location.toJSON());

      // Get pool info (contains lpToken ID)
      const poolInfo = await api.query.assetConversion.pools([
        formatAssetLocation(asset1),
        formatAssetLocation(asset2)
      ]);

      if ((poolInfo as any).isNone) continue;

      const poolData = (poolInfo as any).unwrap().toJSON();
      const lpTokenId = poolData.lpToken;

      // Get LP token supply from poolAssets pallet
      let lpTokenSupply = '0';
      try {
        if (api.query.poolAssets?.asset) {
          const lpAssetDetails = await api.query.poolAssets.asset(lpTokenId);
          if ((lpAssetDetails as any).isSome) {
            lpTokenSupply = ((lpAssetDetails as any).unwrap() as any).supply.toString();
          }
        }
      } catch (error) {
        console.warn('Could not query LP token supply:', error);
      }

      // Get reserves using runtime API (quotePriceExactTokensForTokens)
      let reserve1 = '0';
      let reserve2 = '0';

      try {
        // Get token decimals first
        const token1 = KNOWN_TOKENS[asset1] || { decimals: 12 };
        const token2 = KNOWN_TOKENS[asset2] || { decimals: 12 };

        // Query price to verify pool has liquidity and estimate reserves
        const oneUnit = BigInt(Math.pow(10, token1.decimals));
        const quote = await (api.call as any).assetConversionApi.quotePriceExactTokensForTokens(
          formatAssetLocation(asset1),
          formatAssetLocation(asset2),
          oneUnit.toString(),
          true
        );

        if (quote && !(quote as any).isNone) {
          // Pool has liquidity - estimate reserves from LP supply
          if (lpTokenSupply !== '0') {
            const lpSupply = BigInt(lpTokenSupply);
            const price = Number((quote as any).unwrap().toString()) / Math.pow(10, token2.decimals);

            if (price > 0) {
              // LP supply ≈ sqrt(reserve1 * reserve2)
              // With price = reserve2/reserve1, solve for reserves
              const sqrtPrice = Math.sqrt(price);
              const r1 = Number(lpSupply) / sqrtPrice;
              const r2 = Number(lpSupply) * sqrtPrice;
              reserve1 = BigInt(Math.floor(r1)).toString();
              reserve2 = BigInt(Math.floor(r2)).toString();
            }
          }
        }
      } catch (error) {
        console.warn('Could not fetch reserves via runtime API:', error);
        // Fallback: calculate from LP supply using geometric mean
        if (lpTokenSupply !== '0') {
          reserve1 = lpTokenSupply;
          reserve2 = lpTokenSupply;
        }
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

    // Query all pool accounts
    const poolKeys = await api.query.assetConversion.pools.keys();

    for (const key of poolKeys) {
      try {
        // Extract asset locations from storage key
        const [asset1Location, asset2Location] = key.args;
        const asset1 = parseAssetLocation(asset1Location.toJSON());
        const asset2 = parseAssetLocation(asset2Location.toJSON());

        // Get pool info to get LP token ID
        const poolInfo = await api.query.assetConversion.pools([
          formatAssetLocation(asset1),
          formatAssetLocation(asset2)
        ]);

        if ((poolInfo as any).isNone) continue;

        const poolData = (poolInfo as any).unwrap().toJSON();
        const lpTokenId = poolData.lpToken;

        // Get user's LP token balance from poolAssets pallet
        let lpTokenBalance = '0';
        if (api.query.poolAssets?.account) {
          const lpAccount = await api.query.poolAssets.account(lpTokenId, userAddress);
          if ((lpAccount as any).isSome) {
            lpTokenBalance = ((lpAccount as any).unwrap() as any).balance.toString();
          }
        }

        // Skip if user has no LP tokens for this pool
        if (lpTokenBalance === '0' || BigInt(lpTokenBalance) === BigInt(0)) {
          continue;
        }

        // Get total LP supply
        let lpSupply = BigInt(0);
        if (api.query.poolAssets?.asset) {
          const lpAssetDetails = await api.query.poolAssets.asset(lpTokenId);
          if ((lpAssetDetails as any).isSome) {
            lpSupply = BigInt(((lpAssetDetails as any).unwrap() as any).supply.toString());
          }
        }

        if (lpSupply === BigInt(0)) {
          continue; // Avoid division by zero
        }

        const userLPBig = BigInt(lpTokenBalance);

        // Share percentage: (userLP / totalLP) * 100
        const sharePercentage = (userLPBig * BigInt(10000)) / lpSupply;
        const shareOfPool = (Number(sharePercentage) / 100).toFixed(2);

        // Estimate reserves and calculate user's share
        const token1 = KNOWN_TOKENS[asset1] || { decimals: 12, symbol: `Asset ${asset1}` };
        const token2 = KNOWN_TOKENS[asset2] || { decimals: 12, symbol: `Asset ${asset2}` };

        // Try to get price ratio for reserve estimation
        let asset1Amount = '0';
        let asset2Amount = '0';

        try {
          const oneUnit = BigInt(Math.pow(10, token1.decimals));
          const quote = await (api.call as any).assetConversionApi.quotePriceExactTokensForTokens(
            formatAssetLocation(asset1),
            formatAssetLocation(asset2),
            oneUnit.toString(),
            true
          );

          if (quote && !(quote as any).isNone) {
            const price = Number((quote as any).unwrap().toString()) / Math.pow(10, token2.decimals);

            if (price > 0) {
              // Estimate total reserves from LP supply
              const sqrtPrice = Math.sqrt(price);
              const totalReserve1 = Number(lpSupply) / sqrtPrice;
              const totalReserve2 = Number(lpSupply) * sqrtPrice;

              // User's share of reserves
              const userShare = Number(userLPBig) / Number(lpSupply);
              asset1Amount = BigInt(Math.floor(totalReserve1 * userShare)).toString();
              asset2Amount = BigInt(Math.floor(totalReserve2 * userShare)).toString();
            }
          }
        } catch (error) {
          console.warn('Could not estimate user position amounts:', error);
          // Fallback: use LP balance as approximation
          asset1Amount = ((userLPBig * BigInt(50)) / BigInt(100)).toString();
          asset2Amount = ((userLPBig * BigInt(50)) / BigInt(100)).toString();
        }

        positions.push({
          poolId: `${asset1}-${asset2}`,
          asset1,
          asset2,
          lpTokenBalance,
          shareOfPool,
          asset1Amount,
          asset2Amount,
          valueUSD: undefined,
          feesEarned: undefined,
        });
      } catch (error) {
        console.warn(`Error fetching LP position:`, error);
      }
    }

    return positions;
  } catch (error) {
    console.error('Failed to fetch user LP positions:', error);
    return [];
  }
};
