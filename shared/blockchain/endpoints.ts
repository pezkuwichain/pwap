/**
 * Blockchain Network Endpoints Configuration
 * Production, Staging, and Development environments
 */

export interface NetworkConfig {
  name: string;
  endpoint: string;
  wsEndpoint: string;
  type: 'production' | 'staging' | 'development';
  description: string;
}

/**
 * Production Network Endpoints
 */
export const NETWORK_ENDPOINTS: Record<string, NetworkConfig> = {
  // Production Mainnet
  MAINNET: {
    name: 'Pezkuwi Mainnet',
    endpoint: 'https://rpc.pezkuwichain.io',
    wsEndpoint: 'wss://mainnet.pezkuwichain.io',
    type: 'production',
    description: 'Main production network for Pezkuwi blockchain',
  },

  // Beta Testnet (Current Active)
  BETA: {
    name: 'Pezkuwi Beta Testnet',
    endpoint: 'https://rpc.pezkuwichain.io',
    wsEndpoint: 'wss://rpc.pezkuwichain.io:9944',
    type: 'production',
    description: 'Beta testnet - Currently active for testing',
  },

  // Staging Environment
  STAGING: {
    name: 'Pezkuwi Staging',
    endpoint: 'https://staging.pezkuwichain.io',
    wsEndpoint: 'wss://staging.pezkuwichain.io',
    type: 'staging',
    description: 'Staging environment for pre-production testing',
  },

  // Alfa Testnet
  ALFA: {
    name: 'Pezkuwi Alfa Testnet',
    endpoint: 'https://alfa.pezkuwichain.io',
    wsEndpoint: 'wss://alfa.pezkuwichain.io',
    type: 'development',
    description: 'Alfa testnet for early feature testing',
  },

  // Development Environment
  DEV: {
    name: 'Pezkuwi Development',
    endpoint: 'https://dev.pezkuwichain.io',
    wsEndpoint: 'wss://dev.pezkuwichain.io',
    type: 'development',
    description: 'Development environment for feature testing',
  },

  // Local Development
  LOCAL: {
    name: 'Local Development',
    endpoint: 'http://127.0.0.1:9944',
    wsEndpoint: 'ws://127.0.0.1:9944',
    type: 'development',
    description: 'Local development node',
  },
};

/**
 * Default network based on environment
 */
export const DEFAULT_NETWORK =
  process.env.NODE_ENV === 'production'
    ? NETWORK_ENDPOINTS.BETA // Currently using Beta for production
    : NETWORK_ENDPOINTS.DEV;

/**
 * Port Configuration
 * - RPC HTTP: Port 9944 (proxied through HTTPS)
 * - Mainnet Validator: Port 9944
 * - Staging Validator: Port 9945
 * - Testnet Validator: Port 9946
 */
export const PORTS = {
  RPC: 9944,
  MAINNET_VALIDATOR: 9944,
  STAGING_VALIDATOR: 9945,
  TESTNET_VALIDATOR: 9946,
};

/**
 * Frontend Deployments
 */
export const FRONTEND_URLS = {
  PRODUCTION: 'https://pezkuwichain.app',
  BETA: 'https://beta.pezkuwichain.io',
  STAGING: 'https://staging.pezkuwichain.io',
  SDK_UI: 'https://pezkuwichain.app/sdk',
};

/**
 * Get network by name
 */
export function getNetwork(name: keyof typeof NETWORK_ENDPOINTS): NetworkConfig {
  return NETWORK_ENDPOINTS[name];
}

/**
 * Get all networks
 */
export function getAllNetworks(): NetworkConfig[] {
  return Object.values(NETWORK_ENDPOINTS);
}

/**
 * Get the current network configuration based on the VITE_NETWORK environment variable.
 * This serves as the single source of truth for the application's network configuration.
 * @returns {NetworkConfig} The active network configuration.
 */
export const getCurrentNetworkConfig = (): NetworkConfig => {
  let networkName = 'LOCAL';

  // Support both Vite (web) and React Native environments
  if (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_NETWORK) {
    networkName = process.env.EXPO_PUBLIC_NETWORK.toUpperCase();
  } else if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_NETWORK) {
    networkName = ((import.meta as any).env.VITE_NETWORK || 'local').toUpperCase();
  }

  const validNetworkKeys = Object.keys(NETWORK_ENDPOINTS);

  if (validNetworkKeys.includes(networkName)) {
    return NETWORK_ENDPOINTS[networkName as keyof typeof NETWORK_ENDPOINTS];
  }

  // Fallback to a default or local configuration if the name is invalid
  return NETWORK_ENDPOINTS.LOCAL;
};

/**
 * Check if endpoint is available
 */
export async function checkEndpoint(endpoint: string): Promise<boolean> {
  try {
    const response = await fetch(`${endpoint}/health`, { method: 'GET' });
    return response.ok;
  } catch {
    return false;
  }
}
export const NETWORKS = NETWORK_ENDPOINTS;
