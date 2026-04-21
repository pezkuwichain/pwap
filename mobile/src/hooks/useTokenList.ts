import { useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { fetchAllTokens, TokenInfo, KNOWN_TOKENS, TOKEN_LOGOS } from '../services/TokenService';
import { logger } from '../utils/logger';


const HIDDEN_TOKENS_KEY = '@pezkuwi_hidden_tokens';

export function useTokenList() {
  const { api, isApiReady, selectedAccount } = usePezkuwi();

  // Initialize with known tokens so list is never empty
  const [allTokens, setAllTokens] = useState<TokenInfo[]>(() =>
    KNOWN_TOKENS.map(kt => ({
      assetId: kt.assetId,
      symbol: kt.symbol,
      name: kt.name,
      decimals: kt.decimals,
      balance: '0.00',
      balanceRaw: 0n,
      usdValue: '$0.00',
      priceUsd: 0,
      change24h: 0,
      logo: TOKEN_LOGOS[kt.symbol] || null,
      isNative: kt.isNative,
      isFrozen: false,
    }))
  );
  const [isLoadingTokens, setIsLoadingTokens] = useState(false);
  const [hiddenTokens, setHiddenTokens] = useState<string[]>([]);

  // Load hidden tokens from AsyncStorage
  useEffect(() => {
    const loadHiddenTokens = async () => {
      try {
        const stored = await AsyncStorage.getItem(HIDDEN_TOKENS_KEY);
        if (stored) {
          setHiddenTokens(JSON.parse(stored));
        }
      } catch (e) {
        logger.warn('[Wallet] Failed to load hidden tokens:', e);
      }
    };
    loadHiddenTokens();
  }, []);

  // Save hidden tokens when they change
  useEffect(() => {
    const saveHiddenTokens = async () => {
      try {
        await AsyncStorage.setItem(HIDDEN_TOKENS_KEY, JSON.stringify(hiddenTokens));
      } catch (e) {
        logger.warn('[Wallet] Failed to save hidden tokens:', e);
      }
    };
    // Only save if array has been modified (skip initial empty)
    if (hiddenTokens.length > 0) {
      saveHiddenTokens();
    }
  }, [hiddenTokens]);

  // Fetch all tokens from blockchain (Nova Wallet style)
  useEffect(() => {
    if (!api || !isApiReady || !selectedAccount) return;

    const loadAllTokens = async () => {
      setIsLoadingTokens(true);
      try {
        const tokens = await fetchAllTokens(api, selectedAccount.address);
        setAllTokens(tokens);
        logger.warn('[Wallet] Loaded', tokens.length, 'tokens from blockchain');
      } catch (error) {
        logger.error('[Wallet] Failed to load tokens:', error);
      } finally {
        setIsLoadingTokens(false);
      }
    };

    loadAllTokens();

    // Refresh every 30 seconds for price updates
    const interval = setInterval(loadAllTokens, 30000);

    return () => clearInterval(interval);
  }, [api, isApiReady, selectedAccount]);

  const toggleTokenVisibility = (symbol: string) => {
    setHiddenTokens(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };

  return {
    allTokens,
    isLoadingTokens,
    hiddenTokens,
    toggleTokenVisibility,
  };
}
