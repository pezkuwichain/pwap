import { useState, useEffect } from 'react';
import { ApiPromise, WsProvider } from '@pezkuwi/api';

// RPC endpoint - uses environment variable or falls back to mainnet
const RPC_ENDPOINT = import.meta.env.VITE_WS_ENDPOINT || 'wss://rpc.pezkuwichain.io:9944';
const FALLBACK_ENDPOINTS = [
  RPC_ENDPOINT,
  import.meta.env.VITE_WS_ENDPOINT_FALLBACK_1,
  import.meta.env.VITE_WS_ENDPOINT_FALLBACK_2,
].filter(Boolean) as string[];

interface UsePezkuwiApiReturn {
  api: ApiPromise | null;
  isReady: boolean;
  isConnecting: boolean;
  error: string | null;
  reconnect: () => Promise<void>;
}

// Singleton API instance to avoid multiple connections
let globalApi: ApiPromise | null = null;
let connectionPromise: Promise<ApiPromise> | null = null;

async function createApiConnection(): Promise<ApiPromise> {
  // Return existing connection promise if one is in progress
  if (connectionPromise) {
    return connectionPromise;
  }

  // Return existing API if already connected
  if (globalApi && globalApi.isConnected) {
    return globalApi;
  }

  // Create new connection
  connectionPromise = (async () => {
    for (const endpoint of FALLBACK_ENDPOINTS) {
      try {
        if (import.meta.env.DEV) {
          console.log('[PezkuwiApi] Connecting to:', endpoint);
        }

        const provider = new WsProvider(endpoint);
        const api = await ApiPromise.create({ provider });
        await api.isReady;

        globalApi = api;

        if (import.meta.env.DEV) {
          const [chain, nodeName, nodeVersion] = await Promise.all([
            api.rpc.system.chain(),
            api.rpc.system.name(),
            api.rpc.system.version(),
          ]);
          console.log(`[PezkuwiApi] Connected to ${chain} (${nodeName} v${nodeVersion})`);
        }

        return api;
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn(`[PezkuwiApi] Failed to connect to ${endpoint}:`, err);
        }
        continue;
      }
    }

    throw new Error('Failed to connect to any endpoint');
  })();

  try {
    return await connectionPromise;
  } finally {
    connectionPromise = null;
  }
}

export function usePezkuwiApi(): UsePezkuwiApiReturn {
  const [api, setApi] = useState<ApiPromise | null>(globalApi);
  const [isReady, setIsReady] = useState(globalApi?.isConnected || false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = async () => {
    if (isConnecting) return;

    setIsConnecting(true);
    setError(null);

    try {
      const apiInstance = await createApiConnection();
      setApi(apiInstance);
      setIsReady(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
      setIsReady(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const reconnect = async () => {
    // Disconnect existing connection
    if (globalApi) {
      await globalApi.disconnect();
      globalApi = null;
    }
    await connect();
  };

  useEffect(() => {
    // If we already have a global API, use it
    if (globalApi && globalApi.isConnected) {
      setApi(globalApi);
      setIsReady(true);
      return;
    }

    // Otherwise, establish connection
    connect();

    // Cleanup on unmount - don't disconnect global API, just clean up local state
    return () => {
      // Note: We don't disconnect globalApi here to maintain connection across components
    };
  }, []);

  // Handle disconnection events
  useEffect(() => {
    if (!api) return;

    const handleDisconnected = () => {
      if (import.meta.env.DEV) {
        console.log('[PezkuwiApi] Disconnected, attempting to reconnect...');
      }
      setIsReady(false);
      reconnect();
    };

    api.on('disconnected', handleDisconnected);

    return () => {
      api.off('disconnected', handleDisconnected);
    };
  }, [api]);

  return {
    api,
    isReady,
    isConnecting,
    error,
    reconnect,
  };
}

// Export helper to get the global API instance (for non-hook usage)
export function getApiInstance(): ApiPromise | null {
  return globalApi;
}
