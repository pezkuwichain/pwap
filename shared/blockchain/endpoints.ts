/**
 * Blockchain Network Endpoints Configuration
 * Production, Testnet (Zagros), and Development environments
 */

export interface NetworkConfig {
  name: string;
  endpoint: string;
  wsEndpoint: string;
  assetHubEndpoint?: string;
  peopleChainEndpoint?: string;
  type: 'production' | 'testnet' | 'development';
  description: string;
}

/**
 * Production Network Endpoints
 */
export const NETWORK_ENDPOINTS: Record<string, NetworkConfig> = {
  // Production Mainnet (Primary)
  MAINNET: {
    name: 'Pezkuwi Mainnet',
    endpoint: 'https://rpc.pezkuwichain.io',
    wsEndpoint: 'wss://rpc.pezkuwichain.io',
    assetHubEndpoint: 'wss://asset-hub-rpc.pezkuwichain.io',
    peopleChainEndpoint: 'wss://people-rpc.pezkuwichain.io',
    type: 'production',
    description: 'Main production network for Pezkuwi blockchain',
  },

  // Production alias using mainnet subdomain
  PRODUCTION: {
    name: 'Pezkuwi Mainnet',
    endpoint: 'https://mainnet.pezkuwichain.io',
    wsEndpoint: 'wss://mainnet.pezkuwichain.io',
    assetHubEndpoint: 'wss://asset-hub-rpc.pezkuwichain.io',
    peopleChainEndpoint: 'wss://people-rpc.pezkuwichain.io',
    type: 'production',
    description: 'Production mainnet (mainnet subdomain)',
  },

  // Zagros Testnet
  ZAGROS: {
    name: 'Zagros Testnet',
    endpoint: 'https://zagros-rpc.pezkuwichain.io',
    wsEndpoint: 'wss://zagros-rpc.pezkuwichain.io',
    assetHubEndpoint: 'wss://zagros-asset-hub.pezkuwichain.io',
    peopleChainEndpoint: 'wss://zagros-people.pezkuwichain.io',
    type: 'testnet',
    description: 'Zagros testnet for development and testing',
  },

  // Testnet alias (maps to Zagros)
  TESTNET: {
    name: 'Zagros Testnet',
    endpoint: 'https://zagros-rpc.pezkuwichain.io',
    wsEndpoint: 'wss://zagros-rpc.pezkuwichain.io',
    assetHubEndpoint: 'wss://zagros-asset-hub.pezkuwichain.io',
    peopleChainEndpoint: 'wss://zagros-people.pezkuwichain.io',
    type: 'testnet',
    description: 'Testnet environment (Zagros)',
  },

  // Local Development
  LOCAL: {
    name: 'Local Development',
    endpoint: 'http://127.0.0.1:9944',
    wsEndpoint: 'ws://127.0.0.1:9944',
    assetHubEndpoint: 'ws://127.0.0.1:40944',
    peopleChainEndpoint: 'ws://127.0.0.1:41944',
    type: 'development',
    description: 'Local development node',
  },

  // Development alias (maps to Zagros for live testing)
  DEVELOPMENT: {
    name: 'Zagros Testnet',
    endpoint: 'https://zagros-rpc.pezkuwichain.io',
    wsEndpoint: 'wss://zagros-rpc.pezkuwichain.io',
    assetHubEndpoint: 'wss://zagros-asset-hub.pezkuwichain.io',
    peopleChainEndpoint: 'wss://zagros-people.pezkuwichain.io',
    type: 'development',
    description: 'Development mode connecting to Zagros testnet',
  },

  // Legacy: Beta (deprecated, maps to Mainnet)
  BETA: {
    name: 'Pezkuwi Mainnet',
    endpoint: 'https://rpc.pezkuwichain.io',
    wsEndpoint: 'wss://rpc.pezkuwichain.io',
    assetHubEndpoint: 'wss://asset-hub-rpc.pezkuwichain.io',
    peopleChainEndpoint: 'wss://people-rpc.pezkuwichain.io',
    type: 'production',
    description: 'Legacy beta config - now maps to mainnet',
  },
};

/**
 * Default network based on environment
 */
export const DEFAULT_NETWORK =
  process.env.NODE_ENV === 'production'
    ? NETWORK_ENDPOINTS.MAINNET
    : NETWORK_ENDPOINTS.ZAGROS;

/**
 * Port Configuration
 * - Relay Chain RPC: Port 9944
 * - Asset Hub RPC: Port 40944
 * - People Chain RPC: Port 41944
 */
export const PORTS = {
  RELAY_CHAIN: 9944,
  ASSET_HUB: 40944,
  PEOPLE_CHAIN: 41944,
};

/**
 * Frontend Deployments
 */
export const FRONTEND_URLS = {
  PRODUCTION: 'https://app.pezkuwichain.io',
  TESTNET: 'https://zagros.pezkuwichain.io',
  EXPLORER: 'https://explorer.pezkuwichain.io',
  EXTENSION: 'https://js.pezkuwichain.io',
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
