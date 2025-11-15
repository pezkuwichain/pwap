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

  // Development Testnet
  TESTNET: {
    name: 'Pezkuwi Testnet',
    endpoint: 'https://testnet.pezkuwichain.io',
    wsEndpoint: 'wss://testnet.pezkuwichain.io',
    type: 'development',
    description: 'Development testnet for feature testing',
  },
};

/**
 * Default network based on environment
 */
export const DEFAULT_NETWORK =
  process.env.NODE_ENV === 'production'
    ? NETWORK_ENDPOINTS.BETA  // Currently using Beta for production
    : NETWORK_ENDPOINTS.TESTNET;

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
