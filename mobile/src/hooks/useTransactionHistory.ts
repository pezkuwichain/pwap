import { useState, useEffect, useCallback } from 'react';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import {
  TransactionRecord,
  HistoryFilter,
  fetchTransactionHistory,
} from '../services/TransactionHistoryService';
import { logger } from '../utils/logger';


export function useTransactionHistory() {
  const { api, isApiReady, selectedAccount, currentNetwork } = usePezkuwi();

  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [historyScanProgress, setHistoryScanProgress] = useState<string>('');

  const refreshHistory = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) return;

    setIsLoadingHistory(true);
    setHistoryScanProgress('Loading history...');
    try {
      const txs = await fetchTransactionHistory(api, selectedAccount.address, currentNetwork, {
        blocksToScan: 50,
        onProgress: (scanned, total) => {
          setHistoryScanProgress(`Scanning blocks... ${Math.round((scanned / total) * 100)}%`);
        },
      });
      setTransactions(txs);
    } catch (error) {
      logger.error('[Wallet] Failed to load history:', error);
    } finally {
      setHistoryScanProgress('');
      setIsLoadingHistory(false);
    }
  }, [api, isApiReady, selectedAccount, currentNetwork]);

  // Fetch history when account/network changes
  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  return {
    transactions,
    isLoadingHistory,
    historyFilter,
    setHistoryFilter,
    historyScanProgress,
    refreshHistory,
  };
}
