/**
 * Shared constants for Pezkuwi Web App Projects
 */

import type { TokenInfo } from '../types/tokens';

/**
 * Application version
 */
export const APP_VERSION = '1.0.0';

/**
 * Supported languages
 */
export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'kmr', name: 'Kurdî' },
  { code: 'ckb', name: 'سۆرانی' },
  { code: 'ar', name: 'العربية' },
  { code: 'fa', name: 'فارسی' },
] as const;

/**
 * Default language
 */
export const DEFAULT_LANGUAGE = 'en';

/**
 * API timeouts (in milliseconds)
 */
export const TIMEOUTS = {
  API_REQUEST: 30000,
  BLOCKCHAIN_QUERY: 60000,
  TRANSACTION: 120000,
} as const;

/**
 * Kurdistan color palette
 */
export const KURDISTAN_COLORS = {
  kesk: '#00A94F', // Green (Kesk)
  sor: '#EE2A35',  // Red (Sor)
  zer: '#FFD700',  // Yellow/Gold (Zer)
  spi: '#FFFFFF',  // White (Spî)
  res: '#000000',  // Black (Reş)
} as const;

/**
 * Special ID for Native token (relay chain HEZ)
 * Used in pool creation - pools must pair with Native
 */
export const NATIVE_TOKEN_ID = -1;

/**
 * Known tokens on the Pezkuwi blockchain (Asset Hub)
 *
 * Asset IDs on Asset Hub:
 * - Native (-1): HEZ from Relay Chain (for pool pairing)
 * - Asset 1: PEZ (Pezkuwi Token)
 * - Asset 2: wHEZ (Wrapped HEZ via tokenWrapper)
 * - Asset 1000: wUSDT (Wrapped USDT)
 */
export const KNOWN_TOKENS: Record<number, TokenInfo> = {
  [NATIVE_TOKEN_ID]: {
    id: NATIVE_TOKEN_ID,
    symbol: 'HEZ',
    name: 'Native HEZ (Relay Chain)',
    decimals: 12,
    logo: '/shared/images/hez_token_512.png',
  },
  2: {
    id: 2,
    symbol: 'wHEZ',
    name: 'Wrapped HEZ',
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
  1000: {
    id: 1000,
    symbol: 'wUSDT',
    name: 'Wrapped USDT',
    decimals: 6,
    logo: '/shared/images/USDT(hez)logo.png',
  },
};

/**
 * Display token symbols (what users see vs. blockchain IDs)
 * Example: Users see "USDT" but it's wUSDT (asset ID 2) on blockchain
 */
export const TOKEN_DISPLAY_SYMBOLS: Record<string, string> = {
  'wHEZ': 'HEZ',   // Display HEZ instead of wHEZ
  'wUSDT': 'USDT', // Display USDT instead of wUSDT
  'PEZ': 'PEZ',    // PEZ stays as is
};
