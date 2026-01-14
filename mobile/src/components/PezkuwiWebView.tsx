import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';

// Base URL for the web app
const WEB_BASE_URL = 'https://pezkuwichain.io';

export interface PezkuwiWebViewProps {
  // The path to load (e.g., '/p2p', '/forum', '/elections')
  path: string;
  // Optional title for the header
  title?: string;
  // Callback when navigation state changes
  onNavigationStateChange?: (canGoBack: boolean) => void;
}

interface WebViewMessage {
  type: string;
  payload?: unknown;
}

const PezkuwiWebView: React.FC<PezkuwiWebViewProps> = ({
  path,
  title,
  onNavigationStateChange,
}) => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  const { selectedAccount, getKeyPair } = usePezkuwi();

  // JavaScript to inject into the WebView
  // This creates a bridge between the web app and native app
  const injectedJavaScript = `
    (function() {
      // Mark this as mobile app
      window.PEZKUWI_MOBILE = true;
      window.PEZKUWI_PLATFORM = '${Platform.OS}';

      // Inject wallet address if connected
      ${selectedAccount ? `window.PEZKUWI_ADDRESS = '${selectedAccount.address}';` : ''}
      ${selectedAccount ? `window.PEZKUWI_ACCOUNT_NAME = '${selectedAccount.meta?.name || 'Mobile Wallet'}';` : ''}

      // Override console.log to send to React Native (for debugging)
      const originalConsoleLog = console.log;
      console.log = function(...args) {
        originalConsoleLog.apply(console, args);
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'CONSOLE_LOG',
          payload: args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ')
        }));
      };

      // Create native bridge for wallet operations
      window.PezkuwiNativeBridge = {
        // Request transaction signing from native wallet
        signTransaction: function(extrinsicHex, callback) {
          window.__pendingSignCallback = callback;
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'SIGN_TRANSACTION',
            payload: { extrinsicHex }
          }));
        },

        // Request wallet connection
        connectWallet: function() {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'CONNECT_WALLET'
          }));
        },

        // Navigate back in native app
        goBack: function() {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'GO_BACK'
          }));
        },

        // Check if wallet is connected
        isWalletConnected: function() {
          return !!window.PEZKUWI_ADDRESS;
        },

        // Get connected address
        getAddress: function() {
          return window.PEZKUWI_ADDRESS || null;
        }
      };

      // Notify web app that native bridge is ready
      window.dispatchEvent(new CustomEvent('pezkuwi-native-ready', {
        detail: {
          address: window.PEZKUWI_ADDRESS,
          platform: window.PEZKUWI_PLATFORM
        }
      }));

      true; // Required for injectedJavaScript
    })();
  `;

  // Handle messages from WebView
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const message: WebViewMessage = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'SIGN_TRANSACTION':
          // Handle transaction signing
          if (!selectedAccount) {
            // Send error back to WebView
            webViewRef.current?.injectJavaScript(`
              if (window.__pendingSignCallback) {
                window.__pendingSignCallback(null, 'Wallet not connected');
                delete window.__pendingSignCallback;
              }
            `);
            return;
          }

          try {
            const { extrinsicHex } = message.payload as { extrinsicHex: string };
            const keyPair = await getKeyPair(selectedAccount.address);

            if (!keyPair) {
              throw new Error('Could not retrieve key pair');
            }

            // Sign the transaction
            const signature = keyPair.sign(extrinsicHex);
            const signatureHex = Buffer.from(signature).toString('hex');

            // Send signature back to WebView
            webViewRef.current?.injectJavaScript(`
              if (window.__pendingSignCallback) {
                window.__pendingSignCallback('${signatureHex}', null);
                delete window.__pendingSignCallback;
              }
            `);
          } catch (signError) {
            webViewRef.current?.injectJavaScript(`
              if (window.__pendingSignCallback) {
                window.__pendingSignCallback(null, '${(signError as Error).message}');
                delete window.__pendingSignCallback;
              }
            `);
          }
          break;

        case 'CONNECT_WALLET':
          // Trigger native wallet connection
          // This would open a modal or navigate to wallet screen
          if (__DEV__) console.log('WebView requested wallet connection');
          break;

        case 'GO_BACK':
          // Handle back navigation from web
          if (canGoBack && webViewRef.current) {
            webViewRef.current.goBack();
          }
          break;

        case 'CONSOLE_LOG':
          // Forward console logs from WebView (debug only)
          if (__DEV__) {
            console.log('[WebView]:', message.payload);
          }
          break;

        default:
          if (__DEV__) {
            console.log('Unknown message type:', message.type);
          }
      }
    } catch (parseError) {
      if (__DEV__) {
        console.error('Failed to parse WebView message:', parseError);
      }
    }
  }, [selectedAccount, getKeyPair, canGoBack]);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true; // Prevent default behavior
        }
        return false; // Allow default behavior
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [canGoBack])
  );

  // Reload the WebView
  const handleReload = () => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  };

  // Go back in WebView history
  const handleGoBack = () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack();
    }
  };

  // Build the full URL
  const fullUrl = `${WEB_BASE_URL}${path}`;

  // Error view
  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorTitle}>Connection Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleReload}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Optional header with back button */}
      {title && (
        <View style={styles.header}>
          {canGoBack && (
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
              <Text style={styles.backButtonText}>{'<'}</Text>
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity style={styles.reloadButton} onPress={handleReload}>
            <Text style={styles.reloadButtonText}>Reload</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* WebView */}
      <WebView
        ref={webViewRef}
        source={{ uri: fullUrl }}
        style={styles.webView}
        injectedJavaScript={injectedJavaScript}
        onMessage={handleMessage}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          setError(nativeEvent.description || 'Failed to load page');
          setLoading(false);
        }}
        onHttpError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          if (nativeEvent.statusCode >= 400) {
            setError(`HTTP Error: ${nativeEvent.statusCode}`);
          }
        }}
        onNavigationStateChange={(navState) => {
          setCanGoBack(navState.canGoBack);
          onNavigationStateChange?.(navState.canGoBack);
        }}
        // Security settings
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        // Performance settings
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        // UI settings
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={true}
        bounces={true}
        pullToRefreshEnabled={true}
        // Behavior settings
        allowsBackForwardNavigationGestures={true}
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Debugging (dev only)
        webviewDebuggingEnabled={__DEV__}
      />

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },
  reloadButton: {
    padding: 8,
  },
  reloadButtonText: {
    fontSize: 14,
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },
  webView: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  errorIcon: {
    fontSize: 48,
    color: KurdistanColors.sor,
    marginBottom: 16,
    fontWeight: '700',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default PezkuwiWebView;
