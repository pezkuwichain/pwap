export interface AssetConfig {
  id: number;
  symbol: string;
  name: string;
  decimals: number;
  logo?: string;
  defaultAmount?: string;
  color?: string; // For theming (green, blue, orange, etc.)
}

// Pre-configured assets for easy use
export const MINTABLE_ASSETS: Record<string, AssetConfig> = {
  wUSDT: {
    id: 1000,
    symbol: 'wUSDT',
    name: 'Wrapped USDT',
    decimals: 6,
    logo: '/tokens/USDT.png',
    defaultAmount: '10000',
    color: 'green',
  },
  wDOT: {
    id: 1001,
    symbol: 'wDOT',
    name: 'Wrapped DOT',
    decimals: 10,
    logo: '/tokens/DOT.png',
    defaultAmount: '100',
    color: 'pink',
  },
  wETH: {
    id: 1002,
    symbol: 'wETH',
    name: 'Wrapped ETH',
    decimals: 18,
    logo: '/tokens/ETH.png',
    defaultAmount: '10',
    color: 'purple',
  },
  wBTC: {
    id: 1003,
    symbol: 'wBTC',
    name: 'Wrapped BTC',
    decimals: 8,
    logo: '/tokens/BTC.png',
    defaultAmount: '1',
    color: 'orange',
  },
};
