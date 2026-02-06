export interface TokenInfo {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
}

export interface PoolInfo {
  id: string; // asset1-asset2 pair
  asset1: number;
  asset2: number;
  asset1Symbol: string;
  asset2Symbol: string;
  asset1Decimals: number;
  asset2Decimals: number;
  reserve1: string; // Raw balance string
  reserve2: string;
  lpTokenSupply: string;
  volume24h?: string;
  tvl?: string;
  apr7d?: string;
  feeRate?: string;
}

export interface UserLiquidityPosition {
  poolId: string;
  asset1: number;
  asset2: number;
  lpTokenBalance: string;
  shareOfPool: string; // Percentage as string (e.g., "2.5")
  asset1Amount: string;
  asset2Amount: string;
  valueUSD?: string;
  feesEarned?: string;
}

export interface SwapQuote {
  amountIn: string;
  amountOut: string;
  path: number[]; // Asset IDs in route
  priceImpact: string; // Percentage as string
  minimumReceived: string; // After slippage
  route: string; // Human readable (e.g., "wHEZ → PEZ → wUSDT")
}

export interface AddLiquidityParams {
  asset1: number;
  asset2: number;
  amount1: string;
  amount2: string;
  amount1Min: string;
  amount2Min: string;
  recipient: string;
}

export interface RemoveLiquidityParams {
  asset1: number;
  asset2: number;
  lpTokenAmount: string;
  amount1Min: string;
  amount2Min: string;
  recipient: string;
}

export interface SwapParams {
  path: number[];
  amountIn: string;
  amountOutMin: string;
  recipient: string;
  deadline?: number;
}

export interface PoolCreationParams {
  asset1: number;
  asset2: number;
  feeRate?: number;
}

// Native token ID constant (relay chain HEZ)
export const NATIVE_TOKEN_ID = -1;

// Known tokens on testnet (assets pallet)
export const KNOWN_TOKENS: Record<number, TokenInfo> = {
  [-1]: {
    id: -1,
    symbol: 'HEZ',
    name: 'Native HEZ',
    decimals: 12,
    logo: '/shared/images/hez_token_512.png',
  },
  1: {
    id: 1,
    symbol: 'PEZ',
    name: 'Pezkuwi Token',
    decimals: 12,
    logo: '/shared/images/pez_token_512.png',
  },
  2: {
    id: 2,
    symbol: 'wHEZ',
    name: 'Wrapped HEZ',
    decimals: 12,
    logo: '/shared/images/hez_token_512.png',
  },
  1000: {
    id: 1000,
    symbol: 'wUSDT',
    name: 'Wrapped USDT',
    decimals: 6,
    logo: '/shared/images/USDT(hez)logo.png',
  },
  1001: {
    id: 1001,
    symbol: 'DOT',
    name: 'Wrapped DOT',
    decimals: 10,
    logo: '/shared/images/dot.png',
  },
  1002: {
    id: 1002,
    symbol: 'ETH',
    name: 'Wrapped ETH',
    decimals: 18,
    logo: '/shared/images/etherium.png',
  },
  1003: {
    id: 1003,
    symbol: 'BTC',
    name: 'Wrapped BTC',
    decimals: 8,
    logo: '/shared/images/bitcoin.png',
  },
};

// LP Token info (poolAssets pallet - separate from assets pallet)
export interface LPTokenInfo {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
  logo: string;
  poolPair: [number, number]; // [asset1, asset2]
}

// Known LP tokens (from poolAssets pallet)
export const LP_TOKENS: Record<number, LPTokenInfo> = {
  0: {
    id: 0,
    symbol: 'HEZ-PEZ LP',
    name: 'HEZ-PEZ Liquidity',
    decimals: 12,
    logo: '/shared/images/lp_token_512.png',
    poolPair: [NATIVE_TOKEN_ID, 1],
  },
  1: {
    id: 1,
    symbol: 'HEZ-USDT LP',
    name: 'HEZ-USDT Liquidity',
    decimals: 12,
    logo: '/shared/images/lp_token_512.png',
    poolPair: [NATIVE_TOKEN_ID, 1000],
  },
};

// Transaction status
export enum TransactionStatus {
  IDLE = 'idle',
  PENDING = 'pending',
  SUCCESS = 'success',
  ERROR = 'error',
}
