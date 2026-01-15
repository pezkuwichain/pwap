import { useState, useEffect, useCallback } from 'react';
import {
  isMobileApp,
  getPlatform,
  getNativeWalletAddress,
  getNativeAccountName,
  isNativeWalletConnected,
  requestNativeWalletConnection,
  signTransactionNative,
  navigateBackNative,
  type MobileBridgeState,
} from '@/lib/mobile-bridge';

/**
 * React hook for mobile bridge integration
 *
 * Provides reactive state and methods for interacting with the native mobile app.
 * Automatically updates when the native bridge becomes ready.
 */
export function useMobileBridge() {
  const [state, setState] = useState<MobileBridgeState>({
    isMobile: false,
    platform: 'web',
    walletAddress: null,
    accountName: null,
    isWalletConnected: false,
  });

  // Update state from native bridge
  const updateState = useCallback(() => {
    setState({
      isMobile: isMobileApp(),
      platform: getPlatform(),
      walletAddress: getNativeWalletAddress(),
      accountName: getNativeAccountName(),
      isWalletConnected: isNativeWalletConnected(),
    });
  }, []);

  useEffect(() => {
    // Initial state
    updateState();

    // Listen for native bridge ready event
    const handleNativeReady = (event: CustomEvent) => {
      if (import.meta.env.DEV) {
        console.log('[MobileBridge] Native bridge ready:', event.detail);
      }
      updateState();
    };

    // Listen for wallet changes from native
    const handleWalletChange = () => {
      updateState();
    };

    window.addEventListener('pezkuwi-native-ready', handleNativeReady as EventListener);
    window.addEventListener('walletChanged', handleWalletChange);

    // Check periodically in case bridge loads after initial render
    const checkInterval = setInterval(() => {
      if (isMobileApp() && !state.isMobile) {
        updateState();
      }
    }, 500);

    // Clear interval after 5 seconds (bridge should be ready by then)
    const clearTimer = setTimeout(() => {
      clearInterval(checkInterval);
    }, 5000);

    return () => {
      window.removeEventListener('pezkuwi-native-ready', handleNativeReady as EventListener);
      window.removeEventListener('walletChanged', handleWalletChange);
      clearInterval(checkInterval);
      clearTimeout(clearTimer);
    };
  }, [updateState, state.isMobile]);

  // Connect wallet via native app
  const connectWallet = useCallback(() => {
    if (state.isMobile) {
      requestNativeWalletConnection();
    }
  }, [state.isMobile]);

  // Sign transaction via native app
  const signTransaction = useCallback(async (extrinsicHex: string): Promise<string> => {
    if (!state.isMobile) {
      throw new Error('Not running in mobile app');
    }
    return signTransactionNative(extrinsicHex);
  }, [state.isMobile]);

  // Navigate back in native app
  const goBack = useCallback(() => {
    if (state.isMobile) {
      navigateBackNative();
    }
  }, [state.isMobile]);

  return {
    ...state,
    connectWallet,
    signTransaction,
    goBack,
    updateState,
  };
}

export default useMobileBridge;
