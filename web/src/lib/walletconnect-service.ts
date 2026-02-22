/**
 * WalletConnect v2 Service for Pezkuwi dApp
 *
 * Handles WalletConnect v2 session management and provides a Signer adapter
 * compatible with @pezkuwi/api's Signer interface.
 *
 * Flow A: Mobile browser -> QR code -> pezWallet scans -> session established
 * Flow B: pezWallet DApps browser -> injected provider (handled by extension-dapp, not here)
 */

import SignClient from '@walletconnect/sign-client';
import type { SessionTypes, SignClientTypes } from '@walletconnect/types';

const PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || '';
const WC_SESSION_KEY = 'wc_session_topic';

// WalletConnect Polkadot namespace methods
const POLKADOT_METHODS = ['polkadot_signTransaction', 'polkadot_signMessage'];
const POLKADOT_EVENTS = ['chainChanged', 'accountsChanged'];

let signClient: SignClient | null = null;
let currentSession: SessionTypes.Struct | null = null;
let requestId = 0;

/**
 * Initialize the WalletConnect SignClient
 */
export async function initWalletConnect(): Promise<SignClient> {
  if (signClient) return signClient;

  signClient = await SignClient.init({
    projectId: PROJECT_ID,
    metadata: {
      name: 'PezkuwiChain',
      description: 'Pezkuwi Web Application',
      url: 'https://app.pezkuwichain.io',
      icons: ['https://app.pezkuwichain.io/logo.png'],
    },
  });

  // Listen for session events
  signClient.on('session_delete', () => {
    currentSession = null;
    localStorage.removeItem(WC_SESSION_KEY);
    window.dispatchEvent(new Event('walletconnect_disconnected'));
  });

  signClient.on('session_expire', () => {
    currentSession = null;
    localStorage.removeItem(WC_SESSION_KEY);
    window.dispatchEvent(new Event('walletconnect_disconnected'));
  });

  signClient.on('session_update', ({ params }) => {
    if (currentSession) {
      currentSession = { ...currentSession, namespaces: params.namespaces };
    }
  });

  return signClient;
}

/**
 * Build the polkadot: chain ID from genesis hash
 * Format: polkadot:<first_32_bytes_hex_without_0x>
 */
export function buildChainId(genesisHash: string): string {
  const hash = genesisHash.startsWith('0x') ? genesisHash.slice(2) : genesisHash;
  // WalletConnect uses first 32 bytes (64 hex chars) of genesis hash
  return `polkadot:${hash.slice(0, 64)}`;
}

/**
 * Start a WalletConnect pairing session
 * Returns the URI for QR code display
 */
export async function connectWithQR(genesisHash: string): Promise<{
  uri: string;
  approval: () => Promise<SessionTypes.Struct>;
}> {
  const client = await initWalletConnect();
  const chainId = buildChainId(genesisHash);

  const { uri, approval } = await client.connect({
    requiredNamespaces: {
      polkadot: {
        methods: POLKADOT_METHODS,
        chains: [chainId],
        events: POLKADOT_EVENTS,
      },
    },
  });

  if (!uri) {
    throw new Error('Failed to generate WalletConnect pairing URI');
  }

  return {
    uri,
    approval: async () => {
      const session = await approval();
      currentSession = session;
      localStorage.setItem(WC_SESSION_KEY, session.topic);
      return session;
    },
  };
}

/**
 * Get accounts from the current WalletConnect session
 * Returns array of SS58 addresses
 */
export function getSessionAccounts(): string[] {
  if (!currentSession) return [];

  const polkadotNamespace = currentSession.namespaces['polkadot'];
  if (!polkadotNamespace?.accounts) return [];

  // Account format: polkadot:<chain_id>:<ss58_address>
  return polkadotNamespace.accounts.map((account) => {
    const parts = account.split(':');
    return parts[parts.length - 1]; // Last part is the SS58 address
  });
}

/**
 * Get the peer wallet name from current session
 */
export function getSessionPeerName(): string | null {
  if (!currentSession) return null;
  return currentSession.peer.metadata.name || null;
}

/**
 * Get the peer wallet icon from current session
 */
export function getSessionPeerIcon(): string | null {
  if (!currentSession) return null;
  return currentSession.peer.metadata.icons?.[0] || null;
}

/**
 * Create a Signer adapter compatible with @pezkuwi/api's Signer interface
 * Routes signPayload and signRaw through WalletConnect
 */
export function createWCSigner(genesisHash: string, address: string) {
  const chainId = buildChainId(genesisHash);
  const wcAccount = `polkadot:${chainId.split(':')[1]}:${address}`;

  return {
    signPayload: async (payload: {
      address: string;
      blockHash: string;
      blockNumber: string;
      era: string;
      genesisHash: string;
      method: string;
      nonce: string;
      specVersion: string;
      tip: string;
      transactionVersion: string;
      signedExtensions: string[];
      version: number;
    }) => {
      if (!signClient || !currentSession) {
        throw new Error('WalletConnect session not active');
      }

      const id = ++requestId;

      const result = await signClient.request<{ signature: string }>({
        topic: currentSession.topic,
        chainId,
        request: {
          method: 'polkadot_signTransaction',
          params: {
            address: wcAccount,
            transactionPayload: payload,
          },
        },
      });

      return {
        id,
        signature: result.signature as `0x${string}`,
      };
    },

    signRaw: async (raw: {
      address: string;
      data: string;
      type: 'bytes' | 'payload';
    }) => {
      if (!signClient || !currentSession) {
        throw new Error('WalletConnect session not active');
      }

      const id = ++requestId;

      const result = await signClient.request<{ signature: string }>({
        topic: currentSession.topic,
        chainId,
        request: {
          method: 'polkadot_signMessage',
          params: {
            address: wcAccount,
            message: raw.data,
          },
        },
      });

      return {
        id,
        signature: result.signature as `0x${string}`,
      };
    },
  };
}

/**
 * Restore a previous WalletConnect session from localStorage
 */
export async function restoreSession(): Promise<SessionTypes.Struct | null> {
  const client = await initWalletConnect();
  const savedTopic = localStorage.getItem(WC_SESSION_KEY);

  if (!savedTopic) return null;

  // Check if the session still exists
  const sessions = client.session.getAll();
  const session = sessions.find((s) => s.topic === savedTopic);

  if (session) {
    // Check if session is not expired
    const now = Math.floor(Date.now() / 1000);
    if (session.expiry > now) {
      currentSession = session;
      return session;
    }
  }

  // Session expired or not found
  localStorage.removeItem(WC_SESSION_KEY);
  return null;
}

/**
 * Disconnect the current WalletConnect session
 */
export async function disconnectWC(): Promise<void> {
  if (!signClient || !currentSession) return;

  try {
    await signClient.disconnect({
      topic: currentSession.topic,
      reason: {
        code: 6000,
        message: 'User disconnected',
      },
    });
  } catch {
    // Ignore disconnect errors
  }

  currentSession = null;
  localStorage.removeItem(WC_SESSION_KEY);
}

/**
 * Check if there's an active WalletConnect session
 */
export function isWCConnected(): boolean {
  return currentSession !== null;
}

/**
 * Get the current session
 */
export function getCurrentSession(): SessionTypes.Struct | null {
  return currentSession;
}

/**
 * Listen for WalletConnect session proposals (for debugging)
 */
export function onSessionEvent(
  event: SignClientTypes.Event,
  callback: (data: unknown) => void
): void {
  if (!signClient) return;
  signClient.on(event, callback);
}
