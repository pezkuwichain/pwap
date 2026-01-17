import type { ApiPromise } from '@pezkuwi/api';
import { decodeAddress } from '@pezkuwi/util-crypto';

/**
 * Token metadata and balance information
 */
export interface TokenInfo {
  assetId: number | null; // null for native token (HEZ)
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceRaw: bigint;
  usdValue: string;
  priceUsd: number;
  change24h: number;
  logo: string | null;
  isNative: boolean;
  isFrozen: boolean;
}

/**
 * Price data from external API
 */
interface PriceData {
  [symbol: string]: {
    usd: number;
    usd_24h_change: number;
  };
}

// Known token logos mapping
export const TOKEN_LOGOS: { [symbol: string]: any } = {
  HEZ: require('../../../shared/images/hez_token_512.png'),
  PEZ: require('../../../shared/images/pez_token_512.png'),
  USDT: require('../../../shared/images/USDT(hez)logo.png'),
  DOT: require('../../../shared/images/dot.png'),
  BTC: require('../../../shared/images/bitcoin.png'),
  ETH: require('../../../shared/images/etherium.png'),
  BNB: require('../../../shared/images/BNB_logo.png'),
  ADA: require('../../../shared/images/ADAlogo.png'),
};

// Predefined known tokens on PezkuwiChain
// These will always be shown even if chain query fails
export const KNOWN_TOKENS: Array<{
  assetId: number | null;
  symbol: string;
  name: string;
  decimals: number;
  isNative: boolean;
}> = [
  { assetId: null, symbol: 'HEZ', name: 'Pezkuwi Coin', decimals: 12, isNative: true },
  { assetId: 1, symbol: 'PEZ', name: 'Pezkuwi Token', decimals: 12, isNative: false },
  { assetId: 1000, symbol: 'USDT', name: 'Tether USD', decimals: 6, isNative: false },
  { assetId: 1001, symbol: 'DOT', name: 'Polkadot (Bridged)', decimals: 10, isNative: false },
  { assetId: 1002, symbol: 'BTC', name: 'Bitcoin (Bridged)', decimals: 8, isNative: false },
  { assetId: 1003, symbol: 'ETH', name: 'Ethereum (Bridged)', decimals: 18, isNative: false },
];

// CoinGecko ID mapping for price fetching
const COINGECKO_IDS: { [symbol: string]: string } = {
  DOT: 'polkadot',
  BTC: 'bitcoin',
  ETH: 'ethereum',
  BNB: 'binancecoin',
  ADA: 'cardano',
  USDT: 'tether',
  HEZ: 'pezkuwi', // Try CoinGecko first, fallback to DOT/8
  PEZ: 'pezkuwi-token', // Try CoinGecko first, fallback to DOT/8
};

/**
 * Fetch current prices from CoinGecko API
 * HEZ/PEZ fallback: DOT price / 8 (if not on CoinGecko)
 */
export async function fetchTokenPrices(symbols: string[]): Promise<PriceData> {
  const prices: PriceData = {};

  // Always fetch DOT price for HEZ/PEZ fallback calculation
  const symbolsToFetch = [...new Set([...symbols, 'DOT'])];

  // Get CoinGecko IDs
  const geckoIds = symbolsToFetch
    .filter(s => COINGECKO_IDS[s])
    .map(s => COINGECKO_IDS[s]);

  if (geckoIds.length > 0) {
    try {
      const response = await fetch(
        `https://api.coingecko.com/api/v3/simple/price?ids=${geckoIds.join(',')}&vs_currencies=usd&include_24hr_change=true`,
        { headers: { 'Accept': 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();

        // Map back to our symbols
        for (const symbol of symbolsToFetch) {
          const geckoId = COINGECKO_IDS[symbol];
          if (geckoId && data[geckoId]) {
            prices[symbol] = {
              usd: data[geckoId].usd || 0,
              usd_24h_change: data[geckoId].usd_24h_change || 0,
            };
          }
        }
      } else {
        console.warn('[TokenService] CoinGecko API error:', response.status);
      }
    } catch (error) {
      console.warn('[TokenService] Failed to fetch prices:', error);
    }
  }

  // Fallback for HEZ: DOT price / 4
  if (!prices['HEZ'] && prices['DOT']) {
    const hezPrice = parseFloat((prices['DOT'].usd / 4).toFixed(2));
    prices['HEZ'] = {
      usd: hezPrice,
      usd_24h_change: prices['DOT'].usd_24h_change,
    };
    console.log(`[TokenService] HEZ price calculated from DOT/4: $${hezPrice}`);
  }

  // Fallback for PEZ: DOT price / 10
  if (!prices['PEZ'] && prices['DOT']) {
    const pezPrice = parseFloat((prices['DOT'].usd / 10).toFixed(2));
    prices['PEZ'] = {
      usd: pezPrice,
      usd_24h_change: prices['DOT'].usd_24h_change,
    };
    console.log(`[TokenService] PEZ price calculated from DOT/10: $${pezPrice}`);
  }

  return prices;
}

/**
 * Format balance with proper decimals
 */
function formatBalance(rawBalance: bigint, decimals: number): string {
  const divisor = BigInt(10 ** decimals);
  const intPart = rawBalance / divisor;
  const fracPart = rawBalance % divisor;

  if (fracPart === 0n) {
    return intPart.toString();
  }

  const fracStr = fracPart.toString().padStart(decimals, '0');
  // Trim trailing zeros but keep at least 2 decimals
  const trimmed = fracStr.replace(/0+$/, '').slice(0, 4);

  if (trimmed.length === 0) {
    return intPart.toString();
  }

  return `${intPart}.${trimmed}`;
}

/**
 * Fetch all tokens and their balances for an account
 * Uses KNOWN_TOKENS as base, then fetches balances from chain
 */
export async function fetchAllTokens(
  api: ApiPromise,
  accountAddress: string
): Promise<TokenInfo[]> {
  const tokens: TokenInfo[] = [];
  const addedAssetIds = new Set<number | null>();

  try {
    // Decode address for queries
    let accountId: Uint8Array;
    try {
      accountId = decodeAddress(accountAddress);
    } catch (e) {
      console.warn('[TokenService] Failed to decode address:', e);
      // Return known tokens with zero balances
      return KNOWN_TOKENS.map(kt => ({
        assetId: kt.assetId,
        symbol: kt.symbol,
        name: kt.name,
        decimals: kt.decimals,
        balance: '0.00',
        balanceRaw: 0n,
        usdValue: '$0.00',
        priceUsd: 0,
        change24h: 0,
        logo: TOKEN_LOGOS[kt.symbol] || null,
        isNative: kt.isNative,
        isFrozen: false,
      }));
    }

    // 1. Add all known tokens first
    for (const knownToken of KNOWN_TOKENS) {
      let balanceRaw = 0n;
      let isFrozen = false;

      try {
        if (knownToken.isNative) {
          // Native token (HEZ) - query system account
          const accountInfo = await api.query.system.account(accountId) as any;
          balanceRaw = BigInt(accountInfo.data.free.toString());
        } else if (api.query.assets?.account && knownToken.assetId !== null) {
          // Asset token - query assets pallet
          const assetAccount = await api.query.assets.account(knownToken.assetId, accountId) as any;
          if (assetAccount && !assetAccount.isEmpty && assetAccount.isSome) {
            const accountData = assetAccount.unwrap();
            balanceRaw = BigInt(accountData.balance.toString());
            isFrozen = accountData.status?.isFrozen || false;
          }
        }
      } catch (e) {
        console.log(`[TokenService] Could not fetch balance for ${knownToken.symbol}:`, e);
      }

      tokens.push({
        assetId: knownToken.assetId,
        symbol: knownToken.symbol,
        name: knownToken.name,
        decimals: knownToken.decimals,
        balance: formatBalance(balanceRaw, knownToken.decimals),
        balanceRaw,
        usdValue: '$0.00',
        priceUsd: 0,
        change24h: 0,
        logo: TOKEN_LOGOS[knownToken.symbol] || null,
        isNative: knownToken.isNative,
        isFrozen,
      });

      addedAssetIds.add(knownToken.assetId);
    }

    // 2. Fetch any additional registered assets from chain
    if (api.query.assets?.metadata) {
      try {
        const assetEntries = await api.query.assets.metadata.entries();

        for (const [key, value] of assetEntries) {
          const assetId = (key.args[0] as any).toNumber();

          // Skip if already added from known tokens
          if (addedAssetIds.has(assetId)) continue;

          const metadata = value as any;
          if (metadata.isEmpty) continue;

          const symbol = metadata.symbol.toHuman();
          const name = metadata.name.toHuman();
          const decimals = metadata.decimals.toNumber();

          // Fetch balance for this asset
          let balanceRaw = 0n;
          let isFrozen = false;

          try {
            const assetAccount = await api.query.assets.account(assetId, accountId) as any;
            if (assetAccount && !assetAccount.isEmpty && assetAccount.isSome) {
              const accountData = assetAccount.unwrap();
              balanceRaw = BigInt(accountData.balance.toString());
              isFrozen = accountData.status?.isFrozen || false;
            }
          } catch (e) {
            console.log(`[TokenService] Failed to fetch balance for asset ${assetId}`);
          }

          tokens.push({
            assetId,
            symbol,
            name,
            decimals,
            balance: formatBalance(balanceRaw, decimals),
            balanceRaw,
            usdValue: '$0.00',
            priceUsd: 0,
            change24h: 0,
            logo: TOKEN_LOGOS[symbol] || null,
            isNative: false,
            isFrozen,
          });

          addedAssetIds.add(assetId);
        }
      } catch (e) {
        console.log('[TokenService] Assets pallet query failed, using known tokens only');
      }
    }

    // 3. Fetch prices and update USD values
    const symbols = tokens.map(t => t.symbol);
    const prices = await fetchTokenPrices(symbols);

    for (const token of tokens) {
      if (prices[token.symbol]) {
        token.priceUsd = prices[token.symbol].usd;
        token.change24h = prices[token.symbol].usd_24h_change;

        const balanceNum = parseFloat(token.balance) || 0;
        const usdValue = balanceNum * token.priceUsd;
        token.usdValue = usdValue > 0 ? `$${usdValue.toFixed(2)}` : '$0.00';
      }
    }

    // Sort: native first, then PEZ, then by USD value descending
    tokens.sort((a, b) => {
      if (a.isNative && !b.isNative) return -1;
      if (!a.isNative && b.isNative) return 1;
      if (a.symbol === 'PEZ' && b.symbol !== 'PEZ') return -1;
      if (a.symbol !== 'PEZ' && b.symbol === 'PEZ') return 1;
      const aValue = parseFloat(a.usdValue.replace('$', '')) || 0;
      const bValue = parseFloat(b.usdValue.replace('$', '')) || 0;
      return bValue - aValue;
    });

  } catch (error) {
    console.error('[TokenService] Error fetching tokens:', error);
    // Return known tokens with zero balances on error
    return KNOWN_TOKENS.map(kt => ({
      assetId: kt.assetId,
      symbol: kt.symbol,
      name: kt.name,
      decimals: kt.decimals,
      balance: '0.00',
      balanceRaw: 0n,
      usdValue: '$0.00',
      priceUsd: 0,
      change24h: 0,
      logo: TOKEN_LOGOS[kt.symbol] || null,
      isNative: kt.isNative,
      isFrozen: false,
    }));
  }

  return tokens;
}

/**
 * Subscribe to balance changes for all tokens
 */
export async function subscribeToTokenBalances(
  api: ApiPromise,
  accountAddress: string,
  onUpdate: (tokens: TokenInfo[]) => void
): Promise<() => void> {
  const unsubscribes: (() => void)[] = [];

  try {
    const accountId = decodeAddress(accountAddress);

    // Subscribe to native balance
    const unsubNative = await api.query.system.account(accountId, async () => {
      const tokens = await fetchAllTokens(api, accountAddress);
      onUpdate(tokens);
    }) as unknown as () => void;

    unsubscribes.push(unsubNative);

  } catch (error) {
    console.error('[TokenService] Subscription error:', error);
  }

  return () => {
    unsubscribes.forEach(unsub => unsub());
  };
}

export function getTokenLogo(symbol: string): any {
  return TOKEN_LOGOS[symbol] || null;
}
