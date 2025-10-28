// ========================================
// WalletContext - Polkadot.js Wallet Integration
// ========================================
// This context wraps PolkadotContext and provides wallet functionality
// ⚠️ MIGRATION NOTE: This now uses Polkadot.js instead of MetaMask/Ethereum

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { usePolkadot } from './PolkadotContext';
import { WALLET_ERRORS, formatBalance, ASSET_IDS } from '@/lib/wallet';
import type { InjectedAccountWithMeta } from '@polkadot/extension-inject/types';

interface WalletContextType {
  isConnected: boolean;
  account: string | null;  // Current selected account address
  accounts: InjectedAccountWithMeta[];
  balance: string;
  error: string | null;
  connectWallet: () => Promise<void>;
  disconnect: () => void;
  switchAccount: (account: InjectedAccountWithMeta) => void;
  signTransaction: (tx: any) => Promise<string>;
  signMessage: (message: string) => Promise<string>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const polkadot = usePolkadot();
  const [balance, setBalance] = useState<string>('0');
  const [error, setError] = useState<string | null>(null);

  // Fetch balance when account changes
  const updateBalance = useCallback(async (address: string) => {
    if (!polkadot.api || !polkadot.isApiReady) {
      console.warn('API not ready, cannot fetch balance');
      return;
    }

    try {
      // Query native token balance (PEZ)
      const { data: balance } = await polkadot.api.query.system.account(address);
      const formattedBalance = formatBalance(balance.free.toString());
      setBalance(formattedBalance);
    } catch (err) {
      console.error('Failed to fetch balance:', err);
      setError('Failed to fetch balance');
    }
  }, [polkadot.api, polkadot.isApiReady]);

  // Connect wallet (Polkadot.js extension)
  const connectWallet = useCallback(async () => {
    try {
      setError(null);
      await polkadot.connectWallet();
    } catch (err: any) {
      console.error('Wallet connection failed:', err);
      setError(err.message || WALLET_ERRORS.CONNECTION_FAILED);
    }
  }, [polkadot]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    polkadot.disconnectWallet();
    setBalance('0');
    setError(null);
  }, [polkadot]);

  // Switch account
  const switchAccount = useCallback((account: InjectedAccountWithMeta) => {
    polkadot.setSelectedAccount(account);
  }, [polkadot]);

  // Sign and submit transaction
  const signTransaction = useCallback(async (tx: any): Promise<string> => {
    if (!polkadot.api || !polkadot.selectedAccount) {
      throw new Error(WALLET_ERRORS.API_NOT_READY);
    }

    try {
      const { web3FromAddress } = await import('@polkadot/extension-dapp');
      const injector = await web3FromAddress(polkadot.selectedAccount.address);

      // Sign and send transaction
      const hash = await tx.signAndSend(
        polkadot.selectedAccount.address,
        { signer: injector.signer }
      );

      return hash.toHex();
    } catch (error: any) {
      console.error('Transaction failed:', error);
      throw new Error(error.message || WALLET_ERRORS.TRANSACTION_FAILED);
    }
  }, [polkadot.api, polkadot.selectedAccount]);

  // Sign message
  const signMessage = useCallback(async (message: string): Promise<string> => {
    if (!polkadot.selectedAccount) {
      throw new Error('No account selected');
    }

    try {
      const { web3FromAddress } = await import('@polkadot/extension-dapp');
      const injector = await web3FromAddress(polkadot.selectedAccount.address);

      if (!injector.signer.signRaw) {
        throw new Error('Wallet does not support message signing');
      }

      const { signature } = await injector.signer.signRaw({
        address: polkadot.selectedAccount.address,
        data: message,
        type: 'bytes'
      });

      return signature;
    } catch (error: any) {
      console.error('Message signing failed:', error);
      throw new Error(error.message || 'Failed to sign message');
    }
  }, [polkadot.selectedAccount]);

  // Update balance when selected account changes
  useEffect(() => {
    if (polkadot.selectedAccount && polkadot.isApiReady) {
      updateBalance(polkadot.selectedAccount.address);
    }
  }, [polkadot.selectedAccount, polkadot.isApiReady, updateBalance]);

  // Sync error state with PolkadotContext
  useEffect(() => {
    if (polkadot.error) {
      setError(polkadot.error);
    }
  }, [polkadot.error]);

  const value: WalletContextType = {
    isConnected: polkadot.accounts.length > 0,
    account: polkadot.selectedAccount?.address || null,
    accounts: polkadot.accounts,
    balance,
    error: error || polkadot.error,
    connectWallet,
    disconnect,
    switchAccount,
    signTransaction,
    signMessage,
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