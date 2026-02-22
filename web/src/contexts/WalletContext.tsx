// ========================================
// WalletContext - Pezkuwi.js Wallet Integration
// ========================================
// This context wraps PezkuwiContext and provides wallet functionality
// ⚠️ MIGRATION NOTE: This now uses Pezkuwi.js instead of MetaMask/Ethereum

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePezkuwi } from './PezkuwiContext';
import { WALLET_ERRORS, formatBalance, ASSET_IDS } from '@pezkuwi/lib/wallet';
import type { InjectedAccountWithMeta } from '@pezkuwi/extension-inject/types';
import type { Signer } from '@pezkuwi/api/types';
import { web3FromAddress } from '@pezkuwi/extension-dapp';
import { isMobileApp, signTransactionNative, type TransactionPayload } from '@/lib/mobile-bridge';
import { createWCSigner, isWCConnected } from '@/lib/walletconnect-service';

interface TokenBalances {
  HEZ: string;
  PEZ: string;
  wHEZ: string;
  USDT: string;  // User-facing key for wUSDT (asset ID 1000)
  // LP Tokens (from poolAssets pallet)
  'HEZ-PEZ-LP': string;
  'HEZ-USDT-LP': string;
}

interface WalletContextType {
  isConnected: boolean;
  account: string | null;  // Current selected account address
  accounts: InjectedAccountWithMeta[];
  balance: string;  // Legacy: HEZ balance
  balances: TokenBalances;  // All token balances
  error: string | null;
  signer: Signer | null;  // Pezkuwi.js signer for transactions
  connectWallet: () => Promise<void>;
  disconnect: () => void;
  switchAccount: (account: InjectedAccountWithMeta) => void;
  signTransaction: (tx: unknown) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
  refreshBalances: () => Promise<void>;  // Refresh all token balances
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pezkuwi = usePezkuwi();

  if (import.meta.env.DEV) console.log('🎯 WalletProvider render:', {
    hasApi: !!pezkuwi.api,
    isApiReady: pezkuwi.isApiReady,
    selectedAccount: pezkuwi.selectedAccount?.address,
    accountsCount: pezkuwi.accounts.length
  });

  const [balance, setBalance] = useState<string>('0');
  const [balances, setBalances] = useState<TokenBalances>({
    HEZ: '0',
    PEZ: '0',
    wHEZ: '0',
    USDT: '0',
    'HEZ-PEZ-LP': '0',
    'HEZ-USDT-LP': '0',
  });
  const [error, setError] = useState<string | null>(null);
  const [signer, setSigner] = useState<Signer | null>(null);

  // Fetch all token balances when account changes
  // Uses relay chain API for native HEZ, Asset Hub API for PEZ/wHEZ/wUSDT
  const updateBalance = useCallback(async (address: string) => {
    if (!pezkuwi.api || !pezkuwi.isApiReady) {
      if (import.meta.env.DEV) console.warn('API not ready, cannot fetch balance');
      return;
    }

    try {
      if (import.meta.env.DEV) console.log('💰 Fetching all token balances for:', address);

      // Fetch HEZ (native token) from relay chain
      const { data: nativeBalance } = await pezkuwi.api.query.system.account(address);
      const hezBalance = formatBalance(nativeBalance.free.toString());
      setBalance(hezBalance); // Legacy support

      // For assets (PEZ, wHEZ, wUSDT), use Asset Hub API since they're on Asset Hub
      // Fall back to relay chain API if Asset Hub not ready (some chains have assets on relay)
      const assetApi = pezkuwi.assetHubApi && pezkuwi.isAssetHubReady
        ? pezkuwi.assetHubApi
        : pezkuwi.api;

      if (import.meta.env.DEV) {
        console.log('📊 Using API for assets:', pezkuwi.assetHubApi && pezkuwi.isAssetHubReady ? 'Asset Hub' : 'Relay Chain');
      }

      // Fetch PEZ (Asset ID: 1) from Asset Hub
      let pezBalance = '0';
      try {
        const pezData = await assetApi.query.assets.account(ASSET_IDS.PEZ, address);
        if (import.meta.env.DEV) console.log('📊 Raw PEZ data:', pezData.toHuman());

        if (pezData.isSome) {
          const assetData = pezData.unwrap();
          const pezAmount = assetData.balance.toString();
          pezBalance = formatBalance(pezAmount);
          if (import.meta.env.DEV) console.log('✅ PEZ balance found:', pezBalance);
        } else {
          if (import.meta.env.DEV) console.warn('⚠️ PEZ asset not found for this account');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('❌ Failed to fetch PEZ balance:', err);
      }

      // Fetch wHEZ (Asset ID: 2) from Asset Hub
      let whezBalance = '0';
      try {
        const whezData = await assetApi.query.assets.account(ASSET_IDS.WHEZ, address);
        if (import.meta.env.DEV) console.log('📊 Raw wHEZ data:', whezData.toHuman());

        if (whezData.isSome) {
          const assetData = whezData.unwrap();
          const whezAmount = assetData.balance.toString();
          whezBalance = formatBalance(whezAmount);
          if (import.meta.env.DEV) console.log('✅ wHEZ balance found:', whezBalance);
        } else {
          if (import.meta.env.DEV) console.warn('⚠️ wHEZ asset not found for this account');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('❌ Failed to fetch wHEZ balance:', err);
      }

      // Fetch wUSDT (Asset ID: 1000) from Asset Hub - IMPORTANT: wUSDT has 6 decimals, not 12!
      let wusdtBalance = '0';
      try {
        const wusdtData = await assetApi.query.assets.account(ASSET_IDS.WUSDT, address);
        if (import.meta.env.DEV) console.log('📊 Raw wUSDT data:', wusdtData.toHuman());

        if (wusdtData.isSome) {
          const assetData = wusdtData.unwrap();
          const wusdtAmount = assetData.balance.toString();
          wusdtBalance = formatBalance(wusdtAmount, 6); // wUSDT uses 6 decimals!
          if (import.meta.env.DEV) console.log('✅ wUSDT balance found:', wusdtBalance);
        } else {
          if (import.meta.env.DEV) console.warn('⚠️ wUSDT asset not found for this account');
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('❌ Failed to fetch wUSDT balance:', err);
      }

      // Fetch LP Token balances from poolAssets pallet
      let hezPezLpBalance = '0';
      let hezUsdtLpBalance = '0';
      try {
        // HEZ-PEZ LP Token (ID: 0)
        const hezPezLp = await assetApi.query.poolAssets.account(0, address);
        if (hezPezLp.isSome) {
          hezPezLpBalance = formatBalance(hezPezLp.unwrap().balance.toString());
          if (import.meta.env.DEV) console.log('✅ HEZ-PEZ LP balance:', hezPezLpBalance);
        }

        // HEZ-USDT LP Token (ID: 1)
        const hezUsdtLp = await assetApi.query.poolAssets.account(1, address);
        if (hezUsdtLp.isSome) {
          hezUsdtLpBalance = formatBalance(hezUsdtLp.unwrap().balance.toString());
          if (import.meta.env.DEV) console.log('✅ HEZ-USDT LP balance:', hezUsdtLpBalance);
        }
      } catch (err) {
        if (import.meta.env.DEV) console.error('❌ Failed to fetch LP balances:', err);
      }

      setBalances({
        HEZ: hezBalance,
        PEZ: pezBalance,
        wHEZ: whezBalance,
        USDT: wusdtBalance,
        'HEZ-PEZ-LP': hezPezLpBalance,
        'HEZ-USDT-LP': hezUsdtLpBalance,
      });

      if (import.meta.env.DEV) console.log('✅ Balances updated:', {
        HEZ: hezBalance,
        PEZ: pezBalance,
        wHEZ: whezBalance,
        USDT: wusdtBalance,
        'HEZ-PEZ-LP': hezPezLpBalance,
        'HEZ-USDT-LP': hezUsdtLpBalance,
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error('Failed to fetch balances:', err);
      setError('Failed to fetch balances');
    }
  }, [pezkuwi.api, pezkuwi.isApiReady, pezkuwi.assetHubApi, pezkuwi.isAssetHubReady]);

  // Connect wallet (Pezkuwi.js extension)
  const connectWallet = useCallback(async () => {
    try {
      setError(null);
      await pezkuwi.connectWallet();
    } catch (err) {
      if (import.meta.env.DEV) console.error('Wallet connection failed:', err);
      const errorMessage = err instanceof Error ? err.message : WALLET_ERRORS.CONNECTION_FAILED;
      setError(errorMessage);
    }
  }, [pezkuwi]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    pezkuwi.disconnectWallet();
    setBalance('0');
    setError(null);
  }, [pezkuwi]);

  // Switch account
  const switchAccount = useCallback((account: InjectedAccountWithMeta) => {
    pezkuwi.setSelectedAccount(account);
  }, [pezkuwi]);

  // Sign and submit transaction
  const signTransaction = useCallback(async (tx: unknown): Promise<string> => {
    if (!pezkuwi.api || !pezkuwi.selectedAccount) {
      throw new Error(WALLET_ERRORS.API_NOT_READY);
    }

    try {
      // Check if running in mobile app - use native bridge for signing
      if (isMobileApp()) {
        if (import.meta.env.DEV) console.log('[Mobile] Using native bridge for transaction signing');

        // Extract transaction details from the tx object
        const txAny = tx as {
          method: {
            section: string;
            method: string;
            args: unknown[];
            toHuman?: () => { args?: Record<string, unknown> };
          };
        };

        // Get section, method and args from the transaction
        const section = txAny.method.section;
        const method = txAny.method.method;

        // Extract args - convert to array format
        const argsHuman = txAny.method.toHuman?.()?.args || {};
        const args = Object.values(argsHuman);

        if (import.meta.env.DEV) {
          console.log('[Mobile] Transaction details:', { section, method, args });
        }

        const payload: TransactionPayload = { section, method, args };

        // Sign and send via native bridge
        const blockHash = await signTransactionNative(payload);

        if (import.meta.env.DEV) {
          console.log('[Mobile] Transaction submitted, block hash:', blockHash);
        }

        return blockHash;
      }

      // WalletConnect: Use WC signer
      if (pezkuwi.walletSource === 'walletconnect' && isWCConnected() && pezkuwi.api) {
        if (import.meta.env.DEV) console.log('[WC] Using WalletConnect for transaction signing');

        const genesisHash = pezkuwi.api.genesisHash.toHex();
        const wcSigner = createWCSigner(genesisHash, pezkuwi.selectedAccount.address);

        const hash = await (tx as { signAndSend: (address: string, options: { signer: unknown }) => Promise<{ toHex: () => string }> }).signAndSend(
          pezkuwi.selectedAccount.address,
          { signer: wcSigner }
        );

        return hash.toHex();
      }

      // Desktop / pezWallet DApps browser: Use extension signer
      const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
      const injector = await web3FromAddress(pezkuwi.selectedAccount.address);

      const hash = await (tx as { signAndSend: (address: string, options: { signer: unknown }) => Promise<{ toHex: () => string }> }).signAndSend(
        pezkuwi.selectedAccount.address,
        { signer: injector.signer }
      );

      return hash.toHex();
    } catch (error) {
      if (import.meta.env.DEV) console.error('Transaction failed:', error);
      throw new Error(error instanceof Error ? error.message : WALLET_ERRORS.TRANSACTION_FAILED);
    }
  }, [pezkuwi.api, pezkuwi.selectedAccount, pezkuwi.walletSource]);

  // Sign message
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!pezkuwi.selectedAccount) {
      throw new Error('No account selected');
    }

    try {
      // WalletConnect signing
      if (pezkuwi.walletSource === 'walletconnect' && isWCConnected() && pezkuwi.api) {
        if (import.meta.env.DEV) console.log('[WC] Using WalletConnect for message signing');

        const genesisHash = pezkuwi.api.genesisHash.toHex();
        const wcSigner = createWCSigner(genesisHash, pezkuwi.selectedAccount.address);

        const { signature } = await wcSigner.signRaw({
          address: pezkuwi.selectedAccount.address,
          data: message,
          type: 'bytes',
        });

        return signature;
      }

      // Extension signing
      const { web3FromAddress } = await import('@pezkuwi/extension-dapp');
      const injector = await web3FromAddress(pezkuwi.selectedAccount.address);

      if (!injector.signer.signRaw) {
        throw new Error('Wallet does not support message signing');
      }

      const { signature } = await injector.signer.signRaw({
        address: pezkuwi.selectedAccount.address,
        data: message,
        type: 'bytes'
      });

      return signature;
    } catch (error) {
      if (import.meta.env.DEV) console.error('Message signing failed:', error);
      throw new Error(error instanceof Error ? error.message : 'Failed to sign message');
    }
  }, [pezkuwi.selectedAccount, pezkuwi.walletSource, pezkuwi.api]);

  // Get signer from extension or WalletConnect when account changes
  useEffect(() => {
    const getSigner = async () => {
      if (!pezkuwi.selectedAccount) {
        setSigner(null);
        return;
      }

      try {
        if (pezkuwi.walletSource === 'walletconnect' && isWCConnected() && pezkuwi.api) {
          const genesisHash = pezkuwi.api.genesisHash.toHex();
          const wcSigner = createWCSigner(genesisHash, pezkuwi.selectedAccount.address);
          setSigner(wcSigner as unknown as Signer);
          if (import.meta.env.DEV) console.log('✅ WC Signer obtained for', pezkuwi.selectedAccount.address);
        } else {
          const injector = await web3FromAddress(pezkuwi.selectedAccount.address);
          setSigner(injector.signer);
          if (import.meta.env.DEV) console.log('✅ Extension Signer obtained for', pezkuwi.selectedAccount.address);
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error('Failed to get signer:', error);
        setSigner(null);
      }
    };

    getSigner();
  }, [pezkuwi.selectedAccount, pezkuwi.walletSource, pezkuwi.api]);

  // Update balance when selected account changes or Asset Hub becomes ready
  useEffect(() => {
    if (import.meta.env.DEV) console.log('🔄 WalletContext useEffect triggered!', {
      hasAccount: !!pezkuwi.selectedAccount,
      isApiReady: pezkuwi.isApiReady,
      isAssetHubReady: pezkuwi.isAssetHubReady,
      address: pezkuwi.selectedAccount?.address
    });

    if (pezkuwi.selectedAccount && pezkuwi.isApiReady) {
      updateBalance(pezkuwi.selectedAccount.address);
    }
  }, [pezkuwi.selectedAccount, pezkuwi.isApiReady, pezkuwi.isAssetHubReady, updateBalance]);

  // Sync error state with PezkuwiContext
  useEffect(() => {
    if (pezkuwi.error) {
      setError(pezkuwi.error);
    }
  }, [pezkuwi.error]);

  // Refresh balances for current account
  const refreshBalances = useCallback(async () => {
    if (pezkuwi.selectedAccount) {
      await updateBalance(pezkuwi.selectedAccount.address);
    }
  }, [pezkuwi.selectedAccount, updateBalance]);

  const value: WalletContextType = {
    isConnected: pezkuwi.accounts.length > 0,
    account: pezkuwi.selectedAccount?.address || null,
    accounts: pezkuwi.accounts,
    balance,
    balances,
    error: error || pezkuwi.error,
    signer,
    connectWallet,
    disconnect,
    switchAccount,
    signTransaction,
    signMessage,
    refreshBalances,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
};