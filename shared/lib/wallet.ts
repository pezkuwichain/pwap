// ========================================
// PezkuwiChain - Substrate/Polkadot.js Configuration
// ========================================
// This file configures wallet connectivity for Substrate-based chains

import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import { getCurrentNetworkConfig } from '../blockchain/endpoints';

// Helper to get environment variables that works in both web (Vite) and React Native (Expo)
const getEnv = (key: string, defaultValue: string = ''): string => {
  // Check for Vite environment (web)
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return (import.meta.env as any)[key] || defaultValue;
  }
  // Check for Expo environment (React Native)
  if (typeof process !== 'undefined' && process.env) {
    // Expo uses EXPO_PUBLIC_ prefix, Vite uses VITE_ prefix
    const expoKey = key.replace('VITE_', 'EXPO_PUBLIC_');
    return process.env[expoKey] || process.env[key] || defaultValue;
  }
  return defaultValue;
};

// ========================================
// CHAIN CONFIGURATION
// ========================================
export const CHAIN_CONFIG = {
  name: getEnv('VITE_CHAIN_NAME', 'PezkuwiChain'),
  symbol: getEnv('VITE_CHAIN_TOKEN_SYMBOL', 'PEZ'),
  decimals: parseInt(getEnv('VITE_CHAIN_TOKEN_DECIMALS', '12')),
  ss58Format: parseInt(getEnv('VITE_CHAIN_SS58_FORMAT', '42')),
};

// ========================================
// SUBSTRATE ASSET IDs (Assets Pallet)
// ========================================
// ⚠️ IMPORTANT: HEZ is the native token and does NOT have an Asset ID
// Only wrapped/asset tokens are listed here
//
// Asset ID Allocation:
// - 0-999: Reserved for protocol tokens (wHEZ, PEZ, etc.)
// - 1000+: Bridged/wrapped external assets (wUSDT, etc.)
export const ASSET_IDS = {
  WHEZ: parseInt(getEnv('VITE_ASSET_WHEZ', '0')),  // Wrapped HEZ
  PEZ: parseInt(getEnv('VITE_ASSET_PEZ', '1')),    // PEZ utility token
  WUSDT: parseInt(getEnv('VITE_ASSET_WUSDT', '1000')), // Wrapped USDT (6 decimals, Asset ID 1000)
  USDT: parseInt(getEnv('VITE_ASSET_USDT', '3')),
  BTC: parseInt(getEnv('VITE_ASSET_BTC', '4')),
  ETH: parseInt(getEnv('VITE_ASSET_ETH', '5')),
  DOT: parseInt(getEnv('VITE_ASSET_DOT', '6')),
} as const;

// ========================================
// ASSET CONFIGURATIONS
// ========================================
export const ASSET_CONFIGS = {
  WHEZ: {
    id: ASSET_IDS.WHEZ,
    symbol: 'wHEZ',
    name: 'Wrapped HEZ',
    decimals: 12,
    minBalance: 1_000_000_000, // 0.001 HEZ
  },
  PEZ: {
    id: ASSET_IDS.PEZ,
    symbol: 'PEZ',
    name: 'PEZ Utility Token',
    decimals: 12,
    minBalance: 1_000_000_000, // 0.001 PEZ
  },
  WUSDT: {
    id: ASSET_IDS.WUSDT,
    symbol: 'wUSDT',
    name: 'Wrapped USDT',
    decimals: 6, // ⚠️ CRITICAL: wUSDT uses 6 decimals (USDT standard), not 12!
    minBalance: 1_000, // 0.001 USDT
  },
} as const;

// ========================================
// EXPLORER URLS
// ========================================
export const EXPLORER_URLS = {
  pezkuwiJs: getEnv('VITE_EXPLORER_URL', 'https://js.pezkuwichain.io'),
  custom: getEnv('VITE_CUSTOM_EXPLORER_URL', 'https://explorer.pezkuwichain.io'),
};

// ========================================
// WALLET ERROR MESSAGES
// ========================================
export const WALLET_ERRORS = {
  NO_EXTENSION: 'No Polkadot.js extension detected. Please install Polkadot.js or compatible wallet.',
  NO_ACCOUNTS: 'No accounts found. Please create an account in your wallet extension.',
  CONNECTION_FAILED: 'Failed to connect wallet. Please try again.',
  TRANSACTION_FAILED: 'Transaction failed. Please check your balance and try again.',
  USER_REJECTED: 'User rejected the request.',
  INSUFFICIENT_BALANCE: 'Insufficient balance to complete transaction.',
  INVALID_ADDRESS: 'Invalid address format.',
  API_NOT_READY: 'Blockchain API not ready. Please wait...',
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Format Substrate address for display (SS58 format)
 * @param address - Full substrate address
 * @returns Shortened address string (e.g., "5GrwV...xQjz")
 */
export const formatAddress = (address: string): string => {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

/**
 * Format balance from planck to human-readable format
 * @param balance - Balance in smallest unit (planck)
 * @param decimals - Token decimals (default 12 for PEZ)
 * @returns Formatted balance string
 */
export const formatBalance = (balance: string | number, decimals = 12): string => {
  if (!balance) return '0';
  const value = typeof balance === 'string' ? parseFloat(balance) : balance;
  return (value / Math.pow(10, decimals)).toFixed(4);
};

/**
 * Parse human-readable amount to planck (smallest unit)
 * @param amount - Human-readable amount
 * @param decimals - Token decimals
 * @returns Amount in planck
 */
export const parseAmount = (amount: string | number, decimals = 12): bigint => {
  const value = typeof amount === 'string' ? parseFloat(amount) : amount;
  return BigInt(Math.floor(value * Math.pow(10, decimals)));
};

/**
 * Get asset symbol by ID
 * @param assetId - Asset ID from Assets pallet
 * @returns Asset symbol or 'UNKNOWN'
 */
export const getAssetSymbol = (assetId: number): string => {
  const entry = Object.entries(ASSET_IDS).find(([_, id]) => id === assetId);
  return entry ? entry[0] : 'UNKNOWN';
};

/**
 * Get current network endpoint based on VITE_NETWORK env
 * @returns WebSocket endpoint URL
 */
export const getCurrentEndpoint = (): string => {
  return getCurrentNetworkConfig().wsEndpoint;
};

// ========================================
// TYPE DEFINITIONS
// ========================================

export interface PolkadotWalletState {
  isConnected: boolean;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  balance: string;
  error: string | null;
}

export const initialPolkadotWalletState: PolkadotWalletState = {
  isConnected: false,
  accounts: [],
  selectedAccount: null,
  balance: '0',
  error: null,
};