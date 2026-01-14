/**
 * Environment Configuration
 *
 * Centralized access to environment variables from .env files
 * Use .env.development for dev mode, .env.production for production
 */

import Constants from 'expo-constants';

export type Environment = 'development' | 'production' | 'staging';

interface EnvConfig {
  // Environment
  env: Environment;
  isDevelopment: boolean;
  isProduction: boolean;
  debug: boolean;

  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;

  // Blockchain
  network: string;
  wsEndpoint: string;
  chainName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  ss58Format: number;

  // Feature Flags
  enableTestAccounts: boolean;
  enableMockData: boolean;
  enableDebugMenu: boolean;
  skipBiometric: boolean;

  // API
  apiUrl: string;
  explorerUrl: string;
}

// Get value from expo-constants with fallback
function getEnvVar(key: string, defaultValue: string = ''): string {
  return Constants.expoConfig?.extra?.[key] || process.env[key] || defaultValue;
}

function getBoolEnvVar(key: string, defaultValue: boolean = false): boolean {
  const value = getEnvVar(key, String(defaultValue));
  return value === 'true' || value === '1';
}

function getNumberEnvVar(key: string, defaultValue: number = 0): number {
  const value = getEnvVar(key, String(defaultValue));
  return parseInt(value, 10) || defaultValue;
}

// Parse environment
const envString = getEnvVar('EXPO_PUBLIC_ENV', 'development') as Environment;

export const ENV: EnvConfig = {
  // Environment
  env: envString,
  isDevelopment: envString === 'development',
  isProduction: envString === 'production',
  debug: getBoolEnvVar('EXPO_PUBLIC_DEBUG', false),

  // Supabase
  supabaseUrl: getEnvVar('EXPO_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: getEnvVar('EXPO_PUBLIC_SUPABASE_ANON_KEY'),

  // Blockchain
  network: getEnvVar('EXPO_PUBLIC_NETWORK', 'development'),
  wsEndpoint: getEnvVar('EXPO_PUBLIC_WS_ENDPOINT', 'wss://beta-rpc.pezkuwichain.io:19944'),
  chainName: getEnvVar('EXPO_PUBLIC_CHAIN_NAME', 'PezkuwiChain'),
  tokenSymbol: getEnvVar('EXPO_PUBLIC_CHAIN_TOKEN_SYMBOL', 'HEZ'),
  tokenDecimals: getNumberEnvVar('EXPO_PUBLIC_CHAIN_TOKEN_DECIMALS', 12),
  ss58Format: getNumberEnvVar('EXPO_PUBLIC_CHAIN_SS58_FORMAT', 42),

  // Feature Flags
  enableTestAccounts: getBoolEnvVar('EXPO_PUBLIC_ENABLE_TEST_ACCOUNTS', false),
  enableMockData: getBoolEnvVar('EXPO_PUBLIC_ENABLE_MOCK_DATA', false),
  enableDebugMenu: getBoolEnvVar('EXPO_PUBLIC_ENABLE_DEBUG_MENU', false),
  skipBiometric: getBoolEnvVar('EXPO_PUBLIC_SKIP_BIOMETRIC', false),

  // API
  apiUrl: getEnvVar('EXPO_PUBLIC_API_URL', 'https://api.pezkuwichain.io'),
  explorerUrl: getEnvVar('EXPO_PUBLIC_EXPLORER_URL', 'https://explorer.pezkuwichain.io'),
};

// Log environment on startup (dev only)
if (ENV.isDevelopment && ENV.debug) {
  console.log('🔧 Environment Config:', {
    env: ENV.env,
    network: ENV.network,
    wsEndpoint: ENV.wsEndpoint,
    testAccounts: ENV.enableTestAccounts,
    mockData: ENV.enableMockData,
  });
}

export default ENV;
