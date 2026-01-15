import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Platform } from 'react-native';
import { Keyring } from '@pezkuwi/keyring';
import { KeyringPair } from '@pezkuwi/keyring/types';
import { ApiPromise, WsProvider } from '@pezkuwi/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { cryptoWaitReady, mnemonicGenerate } from '@pezkuwi/util-crypto';
import { ENV } from '../config/environment';

// Secure storage helper - uses SecureStore on native, AsyncStorage on web (with warning)
const secureStorage = {
  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      // WARNING: AsyncStorage is NOT secure for storing seeds on web
      // In production, consider using Web Crypto API or server-side storage
      if (__DEV__) console.warn('[SecureStorage] Using AsyncStorage on web - NOT SECURE for production');
      await AsyncStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      return await AsyncStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      await AsyncStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key);
    }
  },
};

interface Account {
  address: string;
  name: string;
  meta?: {
    name?: string;
  };
}

export type NetworkType = 'pezkuwi' | 'dicle' | 'zagros' | 'bizinikiwi' | 'zombienet';

export interface NetworkConfig {
  name: string;
  displayName: string;
  rpcEndpoint: string;
  ss58Format: number;
  type: 'mainnet' | 'testnet' | 'canary' | 'dev';
}

export const NETWORKS: Record<NetworkType, NetworkConfig> = {
  pezkuwi: {
    name: 'pezkuwi',
    displayName: 'Pezkuwi Mainnet',
    rpcEndpoint: 'wss://rpc-mainnet.pezkuwichain.io:9944',
    ss58Format: 42,
    type: 'mainnet',
  },
  dicle: {
    name: 'dicle',
    displayName: 'Dicle Testnet',
    rpcEndpoint: 'wss://rpc-dicle.pezkuwichain.io:9944',
    ss58Format: 2,
    type: 'testnet',
  },
  zagros: {
    name: 'zagros',
    displayName: 'Zagros Canary',
    rpcEndpoint: 'wss://rpc-zagros.pezkuwichain.io:9944',
    ss58Format: 42,
    type: 'canary',
  },
  bizinikiwi: {
    name: 'bizinikiwi',
    displayName: 'Bizinikiwi Testnet (Beta)',
    rpcEndpoint: ENV.wsEndpoint || 'wss://rpc.pezkuwichain.io:9944',
    ss58Format: 42,
    type: 'testnet',
  },
  zombienet: {
    name: 'zombienet',
    displayName: 'Zombienet Dev (Alice/Bob)',
    rpcEndpoint: 'wss://beta-rpc.pezkuwichain.io:19944',
    ss58Format: 42,
    type: 'dev',
  },
};

interface PezkuwiContextType {
  // Chain state
  api: ApiPromise | null;
  isApiReady: boolean;
  // Keyring state
  isReady: boolean;
  accounts: Account[];
  selectedAccount: Account | null;
  setSelectedAccount: (account: Account | null) => void;
  // Network management
  currentNetwork: NetworkType;
  switchNetwork: (network: NetworkType) => Promise<void>;
  // Wallet operations
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  createWallet: (name: string, mnemonic?: string) => Promise<{ address: string; mnemonic: string }>;
  importWallet: (name: string, mnemonic: string) => Promise<{ address: string }>;
  deleteWallet: (address: string) => Promise<void>;
  getKeyPair: (address: string) => Promise<KeyringPair | null>;
  signMessage: (address: string, message: string) => Promise<string | null>;
  error: string | null;
}

const PezkuwiContext = createContext<PezkuwiContextType | undefined>(undefined);

const WALLET_STORAGE_KEY = '@pezkuwi_wallets';
const SELECTED_ACCOUNT_KEY = '@pezkuwi_selected_account';
const SELECTED_NETWORK_KEY = '@pezkuwi_selected_network';

interface PezkuwiProviderProps {
  children: ReactNode;
}

export const PezkuwiProvider: React.FC<PezkuwiProviderProps> = ({ children }) => {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<Account | null>(null);
  const [currentNetwork, setCurrentNetwork] = useState<NetworkType>('bizinikiwi');
  const [error, setError] = useState<string | null>(null);
  const [keyring, setKeyring] = useState<Keyring | null>(null);

  // Load saved network on mount
  useEffect(() => {
    const loadNetwork = async () => {
      try {
        const savedNetwork = await AsyncStorage.getItem(SELECTED_NETWORK_KEY);
        if (savedNetwork && savedNetwork in NETWORKS) {
          setCurrentNetwork(savedNetwork as NetworkType);
        }
      } catch (err) {
        if (__DEV__) console.error('[Pezkuwi] Failed to load network:', err);
      }
    };

    loadNetwork();
  }, []);

  // Initialize blockchain connection
  useEffect(() => {
    let retryTimeout: NodeJS.Timeout;
    let isSubscribed = true;

    const initApi = async () => {
      try {
        console.log('🔗 [Pezkuwi] Starting API initialization...');
        setIsApiReady(false);
        setError(null); // Clear previous errors

        const networkConfig = NETWORKS[currentNetwork];
        console.log(`🌐 [Pezkuwi] Connecting to ${networkConfig.displayName} at ${networkConfig.rpcEndpoint}`);

        const provider = new WsProvider(networkConfig.rpcEndpoint);
        console.log('📡 [Pezkuwi] WsProvider created, creating API...');
        const newApi = await ApiPromise.create({ provider });

        // Set SS58 format for address encoding/decoding
        newApi.registry.setChainProperties(
          newApi.registry.createType('ChainProperties', {
            ss58Format: networkConfig.ss58Format,
          })
        );
        console.log(`✅ [Pezkuwi] API created with SS58 format: ${networkConfig.ss58Format}`);

        if (isSubscribed) {
          setApi(newApi);
          setIsApiReady(true);
          setError(null); // Clear any previous errors
          console.log('✅ [Pezkuwi] Connected to', networkConfig.displayName);
        }
      } catch (err) {
        console.error('❌ [Pezkuwi] Failed to connect to blockchain:', err);
        console.error('❌ [Pezkuwi] Error details:', JSON.stringify(err, null, 2));

        if (isSubscribed) {
          setError('Failed to connect to blockchain. Check your internet connection.');
          setIsApiReady(false); // ✅ FIX: Don't set ready on error
          setApi(null); // ✅ FIX: Clear API on error

          // Retry connection after 5 seconds
          console.log('🔄 [Pezkuwi] Will retry connection in 5 seconds...');
          retryTimeout = setTimeout(() => {
            if (isSubscribed) {
              console.log('🔄 [Pezkuwi] Retrying blockchain connection...');
              initApi();
            }
          }, 5000);
        }
      }
    };

    initApi();

    // Cleanup on network change or unmount
    return () => {
      isSubscribed = false;
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (api) {
        api.disconnect();
      }
    };
  }, [currentNetwork]);

  // Initialize crypto and keyring
  useEffect(() => {
    const initCrypto = async () => {
      try {
        console.log('🔐 [Pezkuwi] Starting crypto initialization...');
        console.log('⏳ [Pezkuwi] Waiting for crypto libraries...');

        await cryptoWaitReady();
        console.log('✅ [Pezkuwi] Crypto wait ready completed');

        const networkConfig = NETWORKS[currentNetwork];
        console.log(`🌐 [Pezkuwi] Creating keyring for ${networkConfig.displayName}`);

        const kr = new Keyring({ type: 'sr25519', ss58Format: networkConfig.ss58Format });
        setKeyring(kr);
        setIsReady(true);
        console.log('✅ [Pezkuwi] Crypto libraries initialized successfully');
      } catch (err) {
        console.error('❌ [Pezkuwi] Failed to initialize crypto:', err);
        console.error('❌ [Pezkuwi] Error details:', JSON.stringify(err, null, 2));
        setError('Failed to initialize crypto libraries');
        // Still set ready to allow app to work without crypto
        setIsReady(true);
      }
    };

    initCrypto();
  }, [currentNetwork]);

  // Load stored accounts on mount
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        const stored = await AsyncStorage.getItem(WALLET_STORAGE_KEY);
        if (stored) {
          const wallets = JSON.parse(stored);
          setAccounts(wallets);

          // Load selected account
          const selectedAddr = await AsyncStorage.getItem(SELECTED_ACCOUNT_KEY);
          if (selectedAddr) {
            const account = wallets.find((w: Account) => w.address === selectedAddr);
            if (account) {
              setSelectedAccount(account);
            }
          }
        }
      } catch (err) {
        if (__DEV__) console.error('[Pezkuwi] Failed to load accounts:', err);
      }
    };

    loadAccounts();
  }, []);

  // Create a new wallet
  const createWallet = async (
    name: string,
    mnemonic?: string
  ): Promise<{ address: string; mnemonic: string }> => {
    if (!keyring) {
      throw new Error('Keyring not initialized');
    }

    try {
      // Generate or use provided mnemonic
      const mnemonicPhrase = mnemonic || mnemonicGenerate(12);

      // Create account from mnemonic
      const pair = keyring.addFromMnemonic(mnemonicPhrase, { name });

      const newAccount: Account = {
        address: pair.address,
        name,
        meta: { name },
      };

      // Store account (address only, not the seed!)
      const updatedAccounts = [...accounts, newAccount];
      setAccounts(updatedAccounts);
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(updatedAccounts));

      // SECURITY: Store encrypted seed in secure storage (hardware-backed on native)
      const seedKey = `pezkuwi_seed_${pair.address}`;
      await secureStorage.setItem(seedKey, mnemonicPhrase);

      if (__DEV__) console.log('[Pezkuwi] Wallet created:', pair.address);

      return {
        address: pair.address,
        mnemonic: mnemonicPhrase,
      };
    } catch (err: any) {
      if (__DEV__) {
        console.error('[Pezkuwi] Failed to create wallet:', err);
        console.error('[Pezkuwi] Error message:', err?.message);
        console.error('[Pezkuwi] Error stack:', err?.stack);
      }
      throw new Error(err?.message || 'Failed to create wallet');
    }
  };

  // Import existing wallet from mnemonic or dev URI (like //Alice)
  const importWallet = async (
    name: string,
    seedOrUri: string
  ): Promise<{ address: string }> => {
    if (!keyring) {
      throw new Error('Keyring not initialized');
    }

    try {
      const trimmedInput = seedOrUri.trim();
      const isDevUri = trimmedInput.startsWith('//');

      // Create account from URI or mnemonic
      const pair = isDevUri
        ? keyring.addFromUri(trimmedInput, { name })
        : keyring.addFromMnemonic(trimmedInput, { name });

      // Check if account already exists
      if (accounts.some(a => a.address === pair.address)) {
        throw new Error('Wallet already exists');
      }

      const newAccount: Account = {
        address: pair.address,
        name,
        meta: { name },
      };

      // Store account
      const updatedAccounts = [...accounts, newAccount];
      setAccounts(updatedAccounts);
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(updatedAccounts));

      // Store seed/URI securely
      const seedKey = `pezkuwi_seed_${pair.address}`;
      await secureStorage.setItem(seedKey, trimmedInput);

      if (__DEV__) console.log('[Pezkuwi] Wallet imported:', pair.address, isDevUri ? '(dev URI)' : '(mnemonic)');

      return { address: pair.address };
    } catch (err: any) {
      if (__DEV__) {
        console.error('[Pezkuwi] Failed to import wallet:', err);
        console.error('[Pezkuwi] Error message:', err?.message);
      }
      throw new Error(err?.message || 'Failed to import wallet');
    }
  };

  // Delete a wallet
  const deleteWallet = async (address: string): Promise<void> => {
    try {
      // Remove from accounts list
      const updatedAccounts = accounts.filter(a => a.address !== address);
      setAccounts(updatedAccounts);
      await AsyncStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(updatedAccounts));

      // Remove seed from secure storage
      const seedKey = `pezkuwi_seed_${address}`;
      await secureStorage.removeItem(seedKey);

      // If deleted account was selected, select another one
      if (selectedAccount?.address === address) {
        if (updatedAccounts.length > 0) {
          setSelectedAccount(updatedAccounts[0]);
          await AsyncStorage.setItem(SELECTED_ACCOUNT_KEY, updatedAccounts[0].address);
        } else {
          setSelectedAccount(null);
          await AsyncStorage.removeItem(SELECTED_ACCOUNT_KEY);
        }
      }

      if (__DEV__) console.log('[Pezkuwi] Wallet deleted:', address);
    } catch (err: any) {
      if (__DEV__) console.error('[Pezkuwi] Failed to delete wallet:', err);
      throw new Error(err?.message || 'Failed to delete wallet');
    }
  };

  // Get keypair for signing transactions
  const getKeyPair = async (address: string): Promise<KeyringPair | null> => {
    if (!keyring) {
      throw new Error('Keyring not initialized');
    }

    try {
      // SECURITY: Load seed/URI from secure storage (encrypted on native)
      const seedKey = `pezkuwi_seed_${address}`;
      const seedOrUri = await secureStorage.getItem(seedKey);

      if (!seedOrUri) {
        if (__DEV__) console.error('[Pezkuwi] No seed found for address:', address);
        return null;
      }

      // Recreate keypair from URI or mnemonic
      const isDevUri = seedOrUri.startsWith('//');
      const pair = isDevUri
        ? keyring.addFromUri(seedOrUri)
        : keyring.addFromMnemonic(seedOrUri);

      return pair;
    } catch (err) {
      if (__DEV__) console.error('[Pezkuwi] Failed to get keypair:', err);
      return null;
    }
  };

  // Sign a message with the keypair
  const signMessage = async (address: string, message: string): Promise<string | null> => {
    try {
      const pair = await getKeyPair(address);
      if (!pair) {
        return null;
      }

      // Sign the message
      const signature = pair.sign(message);
      // Convert to hex string
      const signatureHex = Buffer.from(signature).toString('hex');
      return signatureHex;
    } catch (err) {
      if (__DEV__) console.error('[Pezkuwi] Failed to sign message:', err);
      return null;
    }
  };

  // Connect wallet (load existing accounts)
  const connectWallet = async () => {
    try {
      setError(null);

      if (accounts.length === 0) {
        setError('No wallets found. Please create a wallet first.');
        return;
      }

      // Auto-select first account if none selected
      if (!selectedAccount && accounts.length > 0) {
        setSelectedAccount(accounts[0]);
        await AsyncStorage.setItem(SELECTED_ACCOUNT_KEY, accounts[0].address);
      }

      if (__DEV__) console.log(`[Pezkuwi] Connected with ${accounts.length} account(s)`);
    } catch (err) {
      if (__DEV__) console.error('[Pezkuwi] Wallet connection failed:', err);
      setError('Failed to connect wallet');
    }
  };

  // Disconnect wallet
  const disconnectWallet = () => {
    setSelectedAccount(null);
    AsyncStorage.removeItem(SELECTED_ACCOUNT_KEY);
    if (__DEV__) console.log('[Pezkuwi] Wallet disconnected');
  };

  // Switch network
  const switchNetwork = async (network: NetworkType) => {
    try {
      if (network === currentNetwork) {
        return;
      }

      if (__DEV__) console.log('[Pezkuwi] Switching to network:', NETWORKS[network].displayName);

      // Save network preference
      await AsyncStorage.setItem(SELECTED_NETWORK_KEY, network);

      // Update state (will trigger useEffect to reconnect)
      setCurrentNetwork(network);
      setIsApiReady(false);

      if (__DEV__) console.log('[Pezkuwi] Network switched successfully');
    } catch (err) {
      if (__DEV__) console.error('[Pezkuwi] Failed to switch network:', err);
      setError('Failed to switch network');
    }
  };

  // Update selected account storage when it changes
  useEffect(() => {
    if (selectedAccount) {
      AsyncStorage.setItem(SELECTED_ACCOUNT_KEY, selectedAccount.address);
    }
  }, [selectedAccount]);

  const value: PezkuwiContextType = {
    api,
    isApiReady,
    isReady,
    accounts,
    selectedAccount,
    setSelectedAccount,
    currentNetwork,
    switchNetwork,
    connectWallet,
    disconnectWallet,
    createWallet,
    importWallet,
    deleteWallet,
    getKeyPair,
    signMessage,
    error,
  };

  return <PezkuwiContext.Provider value={value}>{children}</PezkuwiContext.Provider>;
};

// Hook to use Pezkuwi context
export const usePezkuwi = (): PezkuwiContextType => {
  const context = useContext(PezkuwiContext);
  if (!context) {
    throw new Error('usePezkuwi must be used within PezkuwiProvider');
  }
  return context;
};