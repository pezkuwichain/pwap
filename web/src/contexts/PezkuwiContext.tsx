// Suppress noisy Polkadot.js API warnings in production
// Must be at the very top before any imports that might trigger warnings
if (typeof window !== 'undefined' && !import.meta.env.DEV) {
  const originalWarn = console.warn;
  const suppressedPatterns = [
    'RPC methods not decorated',
    'Unknown signed extensions',
    'API/INIT:',
    'REGISTRY:',
    'StorageWeightReclaim',
  ];

  console.warn = (...args: unknown[]) => {
    const msg = String(args[0] || '');
    if (suppressedPatterns.some(pattern => msg.includes(pattern))) {
      return; // Suppress these specific warnings
    }
    originalWarn.apply(console, args);
  };
}

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ApiPromise, WsProvider } from '@pezkuwi/api';
import { web3Accounts, web3Enable } from '@pezkuwi/extension-dapp';
import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import { DEFAULT_ENDPOINT } from '../../../shared/blockchain/pezkuwi';
import { getCurrentNetworkConfig } from '../../../shared/blockchain/endpoints';
import { isMobileApp, getNativeWalletAddress, getNativeAccountName } from '@/lib/mobile-bridge';
import {
  initWalletConnect,
  connectWithQR,
  getSessionAccounts,
  getSessionPeerName,
  restoreSession,
  disconnectWC,
} from '@/lib/walletconnect-service';

// Get network config from shared endpoints
const networkConfig = getCurrentNetworkConfig();

// Teyrchain endpoints (from environment or shared config)
const ASSET_HUB_ENDPOINT = import.meta.env.VITE_ASSET_HUB_ENDPOINT || networkConfig.assetHubEndpoint || 'wss://asset-hub-rpc.pezkuwichain.io';
const PEOPLE_CHAIN_ENDPOINT = import.meta.env.VITE_PEOPLE_CHAIN_ENDPOINT || networkConfig.peopleChainEndpoint || 'wss://people-rpc.pezkuwichain.io';

export type WalletSource = 'extension' | 'native' | 'walletconnect' | null;

interface PezkuwiContextType {
  api: ApiPromise | null;
  assetHubApi: ApiPromise | null;
  peopleApi: ApiPromise | null;
  isApiReady: boolean;
  isAssetHubReady: boolean;
  isPeopleReady: boolean;
  isConnected: boolean;
  accounts: InjectedAccountWithMeta[];
  selectedAccount: InjectedAccountWithMeta | null;
  setSelectedAccount: (account: InjectedAccountWithMeta | null) => void;
  connectWallet: () => Promise<void>;
  connectWalletConnect: () => Promise<string>;
  disconnectWallet: () => void;
  walletSource: WalletSource;
  wcPeerName: string | null;
  error: string | null;
  sudoKey: string | null;
}

const PezkuwiContext = createContext<PezkuwiContextType | undefined>(undefined);

interface PezkuwiProviderProps {
  children: ReactNode;
  endpoint?: string;
}

export const PezkuwiProvider: React.FC<PezkuwiProviderProps> = ({
  children,
  endpoint = DEFAULT_ENDPOINT // Beta testnet RPC from shared config
}) => {
  const [api, setApi] = useState<ApiPromise | null>(null);
  const [assetHubApi, setAssetHubApi] = useState<ApiPromise | null>(null);
  const [peopleApi, setPeopleApi] = useState<ApiPromise | null>(null);
  const [isApiReady, setIsApiReady] = useState(false);
  const [isAssetHubReady, setIsAssetHubReady] = useState(false);
  const [isPeopleReady, setIsPeopleReady] = useState(false);
  const [accounts, setAccounts] = useState<InjectedAccountWithMeta[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<InjectedAccountWithMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sudoKey, setSudoKey] = useState<string | null>(null);
  const [walletSource, setWalletSource] = useState<WalletSource>(null);
  const [wcPeerName, setWcPeerName] = useState<string | null>(null);

  // Wrapper to trigger events when wallet changes
  const handleSetSelectedAccount = (account: InjectedAccountWithMeta | null) => {
    setSelectedAccount(account);
    if (account) {
      localStorage.setItem('selectedWallet', account.address);
      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.log('💾 Wallet saved:', account.address);
      }
      window.dispatchEvent(new Event('walletChanged'));
    } else {
      localStorage.removeItem('selectedWallet');
      window.dispatchEvent(new Event('walletChanged'));
    }
  };

  // Initialize Pezkuwi API with fallback endpoints
  useEffect(() => {
    // Hardcoded production fallbacks ensure app works even if env vars are missing
    const PRODUCTION_FALLBACKS = [
      'wss://rpc.pezkuwichain.io',
      'wss://mainnet.pezkuwichain.io',
    ];

    const FALLBACK_ENDPOINTS = [
      endpoint,
      import.meta.env.VITE_WS_ENDPOINT_FALLBACK_1,
      import.meta.env.VITE_WS_ENDPOINT_FALLBACK_2,
      ...PRODUCTION_FALLBACKS,
    ].filter((ep, index, arr) => ep && arr.indexOf(ep) === index); // Remove duplicates and empty

    const initApi = async () => {
      let lastError: unknown = null;

      for (const currentEndpoint of FALLBACK_ENDPOINTS) {
        try {
          if (import.meta.env.DEV) {
            if (import.meta.env.DEV) console.log('🔗 Connecting to Pezkuwi node:', currentEndpoint);
          }

          const provider = new WsProvider(currentEndpoint);
          // PezkuwiChain custom signed extensions
          const apiInstance = await ApiPromise.create({
            provider,
            signedExtensions: {
              AuthorizeCall: {
                extrinsic: {},
                payload: {},
              },
              StorageWeightReclaim: {
                extrinsic: {},
                payload: {},
              },
            },
          });

          await apiInstance.isReady;

          setApi(apiInstance);
          setIsApiReady(true);
          setError(null);

          if (import.meta.env.DEV) {
            if (import.meta.env.DEV) console.log('✅ Connected to Pezkuwi node');

            // Get chain info
            const [chain, nodeName, nodeVersion] = await Promise.all([
              apiInstance.rpc.system.chain(),
              apiInstance.rpc.system.name(),
              apiInstance.rpc.system.version(),
            ]);

            if (import.meta.env.DEV) console.log(`📡 Chain: ${chain}`);
            if (import.meta.env.DEV) console.log(`🖥️  Node: ${nodeName} v${nodeVersion}`);

            // Debug: Check Junction type definition
            try {
              const junctionType = apiInstance.createType('XcmV3Junction');
              const junctionObj = junctionType as unknown as { defKeys?: string[] };
              console.log('🔍 XCM Junction type keys:', junctionObj.defKeys || Object.keys(junctionType.toJSON() || {}));
              // Expose api for console debugging
              (window as unknown as { __PEZKUWI_API__: typeof apiInstance }).__PEZKUWI_API__ = apiInstance;
              console.log('💡 API exposed as window.__PEZKUWI_API__ for debugging');
            } catch (e) {
              console.log('⚠️ Could not check Junction type:', e);
            }
          }

          // Fetch sudo key from blockchain
          try {
            const sudoAccount = await apiInstance.query.sudo.key();
            const sudoAddress = sudoAccount.toString();
            setSudoKey(sudoAddress);
            if (import.meta.env.DEV) console.log(`🔑 Sudo key: ${sudoAddress}`);
          } catch (err) {
            if (import.meta.env.DEV) console.warn('⚠️ Failed to fetch sudo key (sudo pallet may not be available):', err);
          }

          return;
        } catch (err) {
          lastError = err;
          if (import.meta.env.DEV) {
            if (import.meta.env.DEV) console.warn(`⚠️ Failed to connect to ${currentEndpoint}, trying next...`);
          }
          continue;
        }
      }

      if (import.meta.env.DEV) {
        if (import.meta.env.DEV) console.error('❌ Failed to connect to all endpoints:', lastError);
      }
      setError('Failed to connect to blockchain network. Please try again later.');
      setIsApiReady(false);
    };

    // Initialize Asset Hub API for PEZ token
    const initAssetHubApi = async () => {
      try {
        if (import.meta.env.DEV) {
          console.log('🔗 Connecting to Asset Hub:', ASSET_HUB_ENDPOINT);
        }

        const provider = new WsProvider(ASSET_HUB_ENDPOINT);
        const assetHubApiInstance = await ApiPromise.create({
          provider,
          signedExtensions: {
            AuthorizeCall: {
              extrinsic: {},
              payload: {},
            },
            StorageWeightReclaim: {
              extrinsic: {},
              payload: {},
            },
          },
        });

        await assetHubApiInstance.isReady;

        setAssetHubApi(assetHubApiInstance);
        setIsAssetHubReady(true);

        if (import.meta.env.DEV) {
          console.log('✅ Connected to Asset Hub for PEZ token');
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('❌ Failed to connect to Asset Hub:', err);
        }
        // Don't set error - PEZ features just won't work
      }
    };

    // Initialize People Chain API for identity/citizenship
    const initPeopleApi = async () => {
      try {
        if (import.meta.env.DEV) {
          console.log('🔗 Connecting to People Chain:', PEOPLE_CHAIN_ENDPOINT);
        }

        const provider = new WsProvider(PEOPLE_CHAIN_ENDPOINT);
        const peopleApiInstance = await ApiPromise.create({
          provider,
          signedExtensions: {
            AuthorizeCall: {
              extrinsic: {},
              payload: {},
            },
            StorageWeightReclaim: {
              extrinsic: {},
              payload: {},
            },
          },
        });

        await peopleApiInstance.isReady;

        setPeopleApi(peopleApiInstance);
        setIsPeopleReady(true);

        if (import.meta.env.DEV) {
          console.log('✅ Connected to People Chain for identity');
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('❌ Failed to connect to People Chain:', err);
        }
        // Don't set error - Identity features just won't work
      }
    };

    initApi();
    initAssetHubApi();
    initPeopleApi();

    return () => {
      if (api) {
        api.disconnect();
      }
      if (assetHubApi) {
        assetHubApi.disconnect();
      }
      if (peopleApi) {
        peopleApi.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endpoint]);

  // Auto-restore wallet on page load (or setup mobile wallet)
  useEffect(() => {
    const restoreWallet = async () => {
      // Check if running in mobile app
      if (isMobileApp()) {
        const nativeAddress = getNativeWalletAddress();
        const nativeAccountName = getNativeAccountName();

        if (nativeAddress) {
          // Create a virtual account for the mobile wallet
          const mobileAccount: InjectedAccountWithMeta = {
            address: nativeAddress,
            meta: {
              name: nativeAccountName || 'Mobile Wallet',
              source: 'pezkuwi-mobile',
            },
            type: 'sr25519',
          };

          setAccounts([mobileAccount]);
          handleSetSelectedAccount(mobileAccount);

          if (import.meta.env.DEV) {
            console.log('[Mobile] Native wallet connected:', nativeAddress.slice(0, 8) + '...');
          }
          return;
        }
      }

      // Try to restore WalletConnect session only if one was previously saved
      const savedWcTopic = localStorage.getItem('wc_session_topic');
      if (savedWcTopic) try {
        const wcSession = await restoreSession();
        if (wcSession) {
          const wcAddresses = getSessionAccounts();
          if (wcAddresses.length > 0) {
            const peerName = getSessionPeerName();
            const wcAccounts: InjectedAccountWithMeta[] = wcAddresses.map((addr) => ({
              address: addr,
              meta: {
                name: peerName || 'WalletConnect',
                source: 'walletconnect',
              },
              type: 'sr25519' as const,
            }));

            setAccounts(wcAccounts);
            handleSetSelectedAccount(wcAccounts[0]);
            setWalletSource('walletconnect');
            setWcPeerName(peerName);
            if (import.meta.env.DEV) {
              console.log('✅ WalletConnect session restored:', wcAddresses[0].slice(0, 8) + '...');
            }
            return;
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('Failed to restore WC session:', err);
        }
      }

      // Desktop: Try to restore from localStorage (extension)
      const savedAddress = localStorage.getItem('selectedWallet');
      if (!savedAddress) return;

      try {
        // Enable extension (works for both desktop extension and pezWallet DApps browser)
        const extensions = await web3Enable('PezkuwiChain');
        if (extensions.length === 0) return;

        // Get accounts
        const allAccounts = await web3Accounts();
        if (allAccounts.length === 0) return;

        // Find saved account
        const savedAccount = allAccounts.find(acc => acc.address === savedAddress);
        if (savedAccount) {
          setAccounts(allAccounts);
          handleSetSelectedAccount(savedAccount);
          setWalletSource('extension');
          if (import.meta.env.DEV) {
            console.log('✅ Wallet restored:', savedAddress.slice(0, 8) + '...');
          }
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.error('Failed to restore wallet:', err);
        }
      }
    };

    restoreWallet();

    // Listen for native bridge ready event (mobile)
    const handleNativeReady = () => {
      if (import.meta.env.DEV) {
        console.log('[Mobile] Native bridge ready, restoring wallet');
      }
      restoreWallet();
    };

    window.addEventListener('pezkuwi-native-ready', handleNativeReady);

    return () => {
      window.removeEventListener('pezkuwi-native-ready', handleNativeReady);
    };
  }, []);

  // Connect wallet (Pezkuwi.js extension or native mobile)
  const connectWallet = async () => {
    try {
      setError(null);

      // Check if running in mobile app (native WebView bridge)
      if (isMobileApp()) {
        const nativeAddress = getNativeWalletAddress();
        const nativeAccountName = getNativeAccountName();

        if (nativeAddress) {
          const mobileAccount: InjectedAccountWithMeta = {
            address: nativeAddress,
            meta: {
              name: nativeAccountName || 'Mobile Wallet',
              source: 'pezkuwi-mobile',
            },
            type: 'sr25519',
          };

          setAccounts([mobileAccount]);
          handleSetSelectedAccount(mobileAccount);
          setWalletSource('native');

          if (import.meta.env.DEV) {
            console.log('[Mobile] Native wallet connected:', nativeAddress.slice(0, 8) + '...');
          }
          return;
        } else {
          setError('Please connect your wallet in the app');
          return;
        }
      }

      // Desktop / pezWallet DApps browser: Try extension (injected provider)
      const hasExtension = !!(window as unknown as { injectedWeb3?: Record<string, unknown> }).injectedWeb3;

      const extensions = await web3Enable('PezkuwiChain');

      if (extensions.length === 0) {
        if (hasExtension) {
          setError('Please authorize the connection in your Pezkuwi Wallet extension');
        } else {
          setError('Pezkuwi Wallet extension not found. Please install from Chrome Web Store.');
          window.open('https://chromewebstore.google.com/search/pezkuwi%7B.js%7D%20extension?hl=en-GB&utm_source=ext_sidebar', '_blank');
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.log('✅ Pezkuwi.js extension enabled');
      }

      const allAccounts = await web3Accounts();

      if (allAccounts.length === 0) {
        setError('No accounts found. Please create an account in Pezkuwi.js extension');
        return;
      }

      setAccounts(allAccounts);

      const savedAddress = localStorage.getItem('selectedWallet');
      const accountToSelect = savedAddress
        ? allAccounts.find(acc => acc.address === savedAddress) || allAccounts[0]
        : allAccounts[0];

      handleSetSelectedAccount(accountToSelect);
      setWalletSource('extension');

      if (import.meta.env.DEV) {
        console.log(`✅ Found ${allAccounts.length} account(s)`);
      }

    } catch (err) {
      if (import.meta.env.DEV) {
        console.error('❌ Wallet connection failed:', err);
      }
      setError('Failed to connect wallet');
    }
  };

  // Connect via WalletConnect v2 - returns pairing URI for QR code
  const connectWalletConnect = async (): Promise<string> => {
    if (!api || !isApiReady) {
      throw new Error('API not ready. Please wait for blockchain connection.');
    }

    setError(null);
    const genesisHash = api.genesisHash.toHex();

    // Always include Asset Hub and People Chain in WC session so cross-chain TX signing works
    // Hardcoded because APIs may not be connected yet when WC session is established
    const additionalHashes: string[] = [
      '0xe7c15092dcbe3f320260ddbbc685bfceed9125a3b3d8436db2766201dec3b949', // Asset Hub
      '0x69a8d025ab7b63363935d7d9397e0f652826c94271c1bc55c4fdfe72cccf1cfa', // People Chain
    ];

    try {
      await initWalletConnect();
      const { uri, approval } = await connectWithQR(genesisHash, additionalHashes);

      // Start approval listener in background
      approval().then((session) => {
        const wcAddresses = getSessionAccounts();
        if (wcAddresses.length > 0) {
          const peerName = getSessionPeerName();
          const wcAccounts: InjectedAccountWithMeta[] = wcAddresses.map((addr) => ({
            address: addr,
            meta: {
              name: peerName || 'WalletConnect',
              source: 'walletconnect',
            },
            type: 'sr25519' as const,
          }));

          setAccounts(wcAccounts);
          handleSetSelectedAccount(wcAccounts[0]);
          setWalletSource('walletconnect');
          setWcPeerName(peerName);
          window.dispatchEvent(new Event('walletconnect_connected'));

          if (import.meta.env.DEV) {
            console.log('✅ WalletConnect session established:', session.topic);
          }
        }
      }).catch((err) => {
        if (import.meta.env.DEV) console.error('WalletConnect approval failed:', err);
        setError('WalletConnect connection was rejected');
      });

      return uri;
    } catch (err) {
      if (import.meta.env.DEV) console.error('WalletConnect connection failed:', err);
      setError('Failed to start WalletConnect');
      throw err;
    }
  };

  // Disconnect wallet (extension, native, or WalletConnect)
  const disconnectWallet = async () => {
    if (walletSource === 'walletconnect') {
      await disconnectWC();
      setWcPeerName(null);
    }
    setAccounts([]);
    handleSetSelectedAccount(null);
    setWalletSource(null);
    if (import.meta.env.DEV) {
      console.log('🔌 Wallet disconnected');
    }
  };

  // Listen for remote WalletConnect disconnects (wallet side)
  useEffect(() => {
    const handleWcDisconnect = () => {
      if (walletSource === 'walletconnect') {
        setAccounts([]);
        handleSetSelectedAccount(null);
        setWalletSource(null);
        setWcPeerName(null);
        if (import.meta.env.DEV) {
          console.log('🔌 WalletConnect session ended remotely');
        }
      }
    };

    window.addEventListener('walletconnect_disconnected', handleWcDisconnect);
    return () => window.removeEventListener('walletconnect_disconnected', handleWcDisconnect);
  }, [walletSource]);

  const value: PezkuwiContextType = {
    api,
    assetHubApi,
    peopleApi,
    isApiReady,
    isAssetHubReady,
    isPeopleReady,
    isConnected: isApiReady,
    accounts,
    selectedAccount,
    setSelectedAccount: handleSetSelectedAccount,
    connectWallet,
    connectWalletConnect,
    disconnectWallet,
    walletSource,
    wcPeerName,
    error,
    sudoKey,
  };

  return (
    <PezkuwiContext.Provider value={value}>
      {children}
    </PezkuwiContext.Provider>
  );
};

// Hook to use Pezkuwi context
export const usePezkuwi = (): PezkuwiContextType => {
  const context = useContext(PezkuwiContext);
  if (!context) {
    throw new Error('usePezkuwi must be used within PezkuwiProvider');
  }
  return context;
};
