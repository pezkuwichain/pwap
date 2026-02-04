import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ApiPromise, WsProvider } from '@pezkuwi/api';
import { web3Accounts, web3Enable } from '@pezkuwi/extension-dapp';
import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import { DEFAULT_ENDPOINT } from '../../../shared/blockchain/pezkuwi';
import { isMobileApp, getNativeWalletAddress, getNativeAccountName } from '@/lib/mobile-bridge';

// Parachain endpoints
const ASSET_HUB_ENDPOINT = 'wss://asset-hub-rpc.pezkuwichain.io';
const PEOPLE_CHAIN_ENDPOINT = 'wss://people-rpc.pezkuwichain.io';

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
  disconnectWallet: () => void;
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
    const FALLBACK_ENDPOINTS = [
      endpoint,
      import.meta.env.VITE_WS_ENDPOINT_FALLBACK_1,
      import.meta.env.VITE_WS_ENDPOINT_FALLBACK_2,
    ].filter(Boolean);

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

      // Desktop: Try to restore from localStorage
      const savedAddress = localStorage.getItem('selectedWallet');
      if (!savedAddress) return;

      try {
        // Enable extension
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
        } else {
          // Request wallet connection from native app
          setError('Please connect your wallet in the app');
          return;
        }
      }

      // Desktop: Check if extension is installed first
      const hasExtension = !!(window as unknown as { injectedWeb3?: Record<string, unknown> }).injectedWeb3;

      // Enable extension
      const extensions = await web3Enable('PezkuwiChain');

      if (extensions.length === 0) {
        if (hasExtension) {
          // Extension is installed but user didn't authorize - don't redirect
          setError('Please authorize the connection in your Pezkuwi Wallet extension');
        } else {
          // Extension not installed - show install link
          setError('Pezkuwi Wallet extension not found. Please install from Chrome Web Store.');
          window.open('https://chrome.google.com/webstore/detail/pezkuwi-wallet/fbnboicjjeebjhgnapneaeccpgjcdibn', '_blank');
        }
        return;
      }

      if (import.meta.env.DEV) {
        console.log('✅ Pezkuwi.js extension enabled');
      }

      // Get accounts
      const allAccounts = await web3Accounts();

      if (allAccounts.length === 0) {
        setError('No accounts found. Please create an account in Pezkuwi.js extension');
        return;
      }

      setAccounts(allAccounts);

      // Try to restore previously selected account, otherwise use first
      const savedAddress = localStorage.getItem('selectedWallet');
      const accountToSelect = savedAddress
        ? allAccounts.find(acc => acc.address === savedAddress) || allAccounts[0]
        : allAccounts[0];

      // Use wrapper to trigger events
      handleSetSelectedAccount(accountToSelect);

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

  // Disconnect wallet
  const disconnectWallet = () => {
    setAccounts([]);
    handleSetSelectedAccount(null);
    if (import.meta.env.DEV) {
      if (import.meta.env.DEV) console.log('🔌 Wallet disconnected');
    }
  };

  const value: PezkuwiContextType = {
    api,
    assetHubApi,
    peopleApi,
    isApiReady,
    isAssetHubReady,
    isPeopleReady,
    isConnected: isApiReady, // Alias for backward compatibility
    accounts,
    selectedAccount,
    setSelectedAccount: handleSetSelectedAccount,
    connectWallet,
    disconnectWallet,
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
