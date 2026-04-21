import { Core } from '@walletconnect/core';
import { Web3Wallet, IWeb3Wallet, Web3WalletTypes } from '@walletconnect/web3wallet';
import { buildApprovedNamespaces, getSdkError } from '@walletconnect/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const PROJECT_ID = process.env.EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID;

if (!PROJECT_ID && __DEV__) {
  logger.warn('[WalletConnect] EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID not set. WalletConnect will be unavailable.');
}
const STORAGE_KEY = '@pezkuwi_wc_sessions';

// Pezkuwi chain info for WalletConnect
const PEZKUWI_CHAIN_ID = 'polkadot:pezkuwi'; // Custom chain namespace

let web3wallet: IWeb3Wallet | null = null;

export interface WCSession {
  topic: string;
  peerName: string;
  peerUrl: string;
  peerIcon?: string;
  chainId: string;
  connected: boolean;
}

export interface WCSignRequest {
  id: number;
  topic: string;
  method: string;
  params: unknown;
  peerName: string;
}

type EventCallback = {
  onSessionProposal?: (proposal: Web3WalletTypes.SessionProposal) => void;
  onSessionRequest?: (request: WCSignRequest) => void;
  onSessionDelete?: (topic: string) => void;
};

let eventCallbacks: EventCallback = {};

/**
 * Initialize WalletConnect Web3Wallet
 */
export async function initWalletConnect(): Promise<IWeb3Wallet> {
  if (web3wallet) return web3wallet;

  if (!PROJECT_ID) {
    throw new Error('EXPO_PUBLIC_WALLETCONNECT_PROJECT_ID not set');
  }

  const core = new Core({ projectId: PROJECT_ID });

  web3wallet = await Web3Wallet.init({
    core: core as unknown as ConstructorParameters<typeof Web3Wallet>[0] extends { core: infer C } ? C : never,
    metadata: {
      name: 'Pezkuwi Wallet',
      description: 'Pezkuwi blockchain wallet',
      url: 'https://pezkuwichain.io',
      icons: ['https://pezkuwichain.io/favicon.ico'],
    },
  });

  // Listen for session proposals
  web3wallet.on('session_proposal', (proposal) => {
    eventCallbacks.onSessionProposal?.(proposal);
  });

  // Listen for session requests (sign, send)
  web3wallet.on('session_request', (event) => {
    const session = web3wallet?.engine.signClient.session.get(event.topic);
    eventCallbacks.onSessionRequest?.({
      id: event.id,
      topic: event.topic,
      method: event.params.request.method,
      params: event.params.request.params,
      peerName: session?.peer.metadata.name || 'Unknown DApp',
    });
  });

  // Listen for session deletions
  web3wallet.on('session_delete', (event) => {
    eventCallbacks.onSessionDelete?.(event.topic);
  });

  return web3wallet;
}

/**
 * Register event callbacks
 */
export function setEventCallbacks(callbacks: EventCallback) {
  eventCallbacks = callbacks;
}

/**
 * Pair with a dApp using WalletConnect URI (from QR code)
 */
export async function pair(uri: string): Promise<void> {
  const wallet = await initWalletConnect();
  await wallet.pair({ uri });
}

/**
 * Approve a session proposal
 */
export async function approveSession(
  proposal: Web3WalletTypes.SessionProposal,
  accountAddress: string
): Promise<void> {
  const wallet = await initWalletConnect();

  const namespaces = buildApprovedNamespaces({
    proposal: proposal.params,
    supportedNamespaces: {
      polkadot: {
        chains: [PEZKUWI_CHAIN_ID],
        methods: ['polkadot_signTransaction', 'polkadot_signMessage'],
        events: ['chainChanged', 'accountsChanged'],
        accounts: [`${PEZKUWI_CHAIN_ID}:${accountAddress}`],
      },
    },
  });

  await wallet.approveSession({
    id: proposal.id,
    namespaces,
  });
}

/**
 * Reject a session proposal
 */
export async function rejectSession(proposalId: number): Promise<void> {
  const wallet = await initWalletConnect();
  await wallet.rejectSession({
    id: proposalId,
    reason: getSdkError('USER_REJECTED'),
  });
}

/**
 * Respond to a sign request
 */
export async function respondToRequest(
  topic: string,
  requestId: number,
  result: string
): Promise<void> {
  const wallet = await initWalletConnect();
  await wallet.respondSessionRequest({
    topic,
    response: { id: requestId, jsonrpc: '2.0', result },
  });
}

/**
 * Reject a sign request
 */
export async function rejectRequest(topic: string, requestId: number): Promise<void> {
  const wallet = await initWalletConnect();
  await wallet.respondSessionRequest({
    topic,
    response: {
      id: requestId,
      jsonrpc: '2.0',
      error: getSdkError('USER_REJECTED'),
    },
  });
}

/**
 * Disconnect a session
 */
export async function disconnectSession(topic: string): Promise<void> {
  const wallet = await initWalletConnect();
  await wallet.disconnectSession({
    topic,
    reason: getSdkError('USER_DISCONNECTED'),
  });
}

/**
 * Get all active sessions
 */
export async function getActiveSessions(): Promise<WCSession[]> {
  const wallet = await initWalletConnect();
  const sessions = wallet.getActiveSessions();

  return Object.values(sessions).map((session) => ({
    topic: session.topic,
    peerName: session.peer.metadata.name,
    peerUrl: session.peer.metadata.url,
    peerIcon: session.peer.metadata.icons?.[0],
    chainId: PEZKUWI_CHAIN_ID,
    connected: true,
  }));
}

/**
 * Save sessions to local storage (for persistence)
 */
export async function saveSessions(): Promise<void> {
  const sessions = await getActiveSessions();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}
