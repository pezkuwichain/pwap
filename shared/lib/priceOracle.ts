/**
 * Price Oracle Service - Fetches prices from CoinGecko
 * USDT-based Hybrid Oracle AMM
 */

const COINGECKO_API = 'https://api.coingecko.com/api/v3';

// CoinGecko ID mappings
export const COINGECKO_IDS: Record<string, string> = {
  'wDOT': 'polkadot',
  'wETH': 'ethereum',
  'wBTC': 'bitcoin',
  'wUSDT': 'tether',
  'USDT': 'tether',
};

// Manual prices for tokens not on CoinGecko (in USD)
export const MANUAL_PRICES: Record<string, number> = {
  'HEZ': 1.0,     // Set your HEZ price
  'PEZ': 0.10,    // Set your PEZ price
  'wHEZ': 1.0,
};

// Price cache
interface PriceCache {
  prices: Record<string, number>;
  timestamp: number;
}

let priceCache: PriceCache | null = null;
const CACHE_TTL = 60 * 1000; // 1 minute cache

/**
 * Fetch prices from CoinGecko
 */
export async function fetchCoinGeckoPrices(): Promise<Record<string, number>> {
  try {
    const ids = [...new Set(Object.values(COINGECKO_IDS))].join(',');
    const response = await fetch(
      `${COINGECKO_API}/simple/price?ids=${ids}&vs_currencies=usd`
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();
    const prices: Record<string, number> = {};

    for (const [symbol, cgId] of Object.entries(COINGECKO_IDS)) {
      if (data[cgId]?.usd) {
        prices[symbol] = data[cgId].usd;
      }
    }

    return prices;
  } catch (error) {
    console.error('CoinGecko fetch failed:', error);
    return {};
  }
}

/**
 * Get all token prices (CoinGecko + manual)
 */
export async function getAllPrices(): Promise<Record<string, number>> {
  // Check cache
  if (priceCache && Date.now() - priceCache.timestamp < CACHE_TTL) {
    return priceCache.prices;
  }

  const coinGeckoPrices = await fetchCoinGeckoPrices();
  const prices: Record<string, number> = {
    ...MANUAL_PRICES,
    ...coinGeckoPrices,
  };

  // USDT is always $1
  prices['USDT'] = 1;
  prices['wUSDT'] = 1;

  priceCache = { prices, timestamp: Date.now() };
  return prices;
}

/**
 * Calculate swap using oracle prices
 * All swaps go through USDT as base currency
 */
export async function calculateOracleSwap(
  fromSymbol: string,
  toSymbol: string,
  fromAmount: number,
  feePercent: number = 0.3
): Promise<{
  toAmount: number;
  rate: number;
  fromPriceUsd: number;
  toPriceUsd: number;
  route: string[];
} | null> {
  const prices = await getAllPrices();

  const fromPrice = prices[fromSymbol];
  const toPrice = prices[toSymbol];

  if (!fromPrice || !toPrice) {
    console.warn(`Price not found: ${fromSymbol}=$${fromPrice}, ${toSymbol}=$${toPrice}`);
    return null;
  }

  // Calculate rate and output
  const rate = fromPrice / toPrice;
  const feeMultiplier = 1 - (feePercent / 100);

  // Determine route
  let route: string[];
  let totalFee = feePercent;

  if (fromSymbol === 'USDT' || fromSymbol === 'wUSDT') {
    // Direct: USDT → X
    route = [fromSymbol, toSymbol];
  } else if (toSymbol === 'USDT' || toSymbol === 'wUSDT') {
    // Direct: X → USDT
    route = [fromSymbol, toSymbol];
  } else {
    // Multi-hop: X → USDT → Y (double fee)
    route = [fromSymbol, 'USDT', toSymbol];
    totalFee = feePercent * 2;
  }

  const actualFeeMultiplier = 1 - (totalFee / 100);
  const toAmount = fromAmount * rate * actualFeeMultiplier;

  return {
    toAmount,
    rate,
    fromPriceUsd: fromPrice,
    toPriceUsd: toPrice,
    route,
  };
}

/**
 * Get exchange rate between two tokens
 */
export async function getExchangeRate(
  fromSymbol: string,
  toSymbol: string
): Promise<number | null> {
  const prices = await getAllPrices();
  const fromPrice = prices[fromSymbol];
  const toPrice = prices[toSymbol];

  if (!fromPrice || !toPrice) return null;
  return fromPrice / toPrice;
}

/**
 * Format USD price for display
 */
export function formatUsdPrice(price: number): string {
  if (price >= 1000) {
    return `$${price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
  } else if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else {
    return `$${price.toFixed(4)}`;
  }
}
