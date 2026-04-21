import { useState, useEffect, useCallback } from 'react';
import { decodeAddress } from '@pezkuwi/util-crypto';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { logger } from '../utils/logger';


export interface WalletBalances {
  [key: string]: string;
  HEZ: string;
  PEZ: string;
  USDT: string;
}

export function useWalletBalances() {
  const { api, isApiReady, selectedAccount } = usePezkuwi();

  const [balances, setBalances] = useState<WalletBalances>({
    HEZ: '0.00',
    PEZ: '0.00',
    USDT: '0.00',
  });
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);

  const fetchBalances = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) return;

    setIsLoadingBalances(true);
    try {
      // Decode address to raw bytes to avoid SS58 encoding issues
      let accountId: Uint8Array | string;
      try {
        accountId = decodeAddress(selectedAccount.address);
      } catch (_e) {
        logger.warn('[Wallet] Failed to decode address, using raw:', _e);
        accountId = selectedAccount.address;
      }

      const accountInfo = await api.query.system.account(accountId);
      const accountData = accountInfo.toJSON() as { data?: { free?: string | number } } | null;
      const freeBalance = accountData?.data?.free ?? 0;
      const hezBalance = (Number(freeBalance) / 1e12).toFixed(2);

      let pezBalance = '0.00';
      try {
        if (api.query.assets?.account) {
          const pezAsset = await api.query.assets.account(1, accountId);
          const pezData = pezAsset.toJSON() as { balance?: string | number } | null;
          if (pezData?.balance) pezBalance = (Number(pezData.balance) / 1e12).toFixed(2);
        }
      } catch (_e) {
        logger.warn('[Wallet] PEZ balance fetch failed:', _e);
      }

      let usdtBalance = '0.00';
      try {
        if (api.query.assets?.account) {
          // Check ID 1000 first (as per constants), fallback to 2 just in case
          let usdtAsset = await api.query.assets.account(1000, accountId);
          let usdtData = usdtAsset.toJSON() as { balance?: string | number } | null;
          if (!usdtData?.balance) {
            usdtAsset = await api.query.assets.account(2, accountId);
            usdtData = usdtAsset.toJSON() as { balance?: string | number } | null;
          }

          if (usdtData?.balance) {
            // USDT uses 6 decimals usually
            usdtBalance = (Number(usdtData.balance) / 1e6).toFixed(2);
          }
        }
      } catch (_e) {
        logger.warn('[Wallet] USDT balance fetch failed:', _e);
      }

      setBalances({ HEZ: hezBalance, PEZ: pezBalance, USDT: usdtBalance });
    } catch (error) {
      logger.error('Fetch balances error:', error);
    } finally {
      setIsLoadingBalances(false);
    }
  }, [api, isApiReady, selectedAccount]);

  // Real-time balance subscription
  useEffect(() => {
    if (!api || !isApiReady || !selectedAccount) return;

    let unsubscribe: (() => void) | null = null;

    const subscribeToBalance = async () => {
      try {
        let accountId: Uint8Array;
        try {
          accountId = decodeAddress(selectedAccount.address);
        } catch {
          return;
        }

        // Subscribe to balance changes
        unsubscribe = await api.query.system.account(accountId, (accountInfo: { data: { free: { toString(): string } } }) => {
          const hezBalance = (Number(accountInfo.data.free.toString()) / 1e12).toFixed(2);
          setBalances(prev => ({ ...prev, HEZ: hezBalance }));
          logger.warn('[Wallet] Balance updated via subscription:', hezBalance, 'HEZ');
        }) as unknown as () => void;
      } catch (e) {
        logger.warn('[Wallet] Subscription failed, falling back to polling:', e);
        // Fallback to polling if subscription fails
        fetchBalances();
      }
    };

    subscribeToBalance();

    // Initial fetch for other tokens (PEZ, USDT)
    fetchBalances();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, isApiReady, selectedAccount]);

  return {
    balances,
    isLoadingBalances,
    refreshBalances: fetchBalances,
  };
}
