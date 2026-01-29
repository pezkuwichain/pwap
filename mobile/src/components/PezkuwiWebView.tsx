import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  BackHandler,
  Platform,
  Alert,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

type RootStackParamList = {
  Wallet: undefined;
  WalletSetup: undefined;
};

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

  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { selectedAccount, getKeyPair, api, isApiReady } = usePezkuwi();
  const { user } = useAuth();
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isSessionReady, setIsSessionReady] = useState(false);

  // Get Supabase session token for WebView authentication
  React.useEffect(() => {
    const getSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          setSessionToken(session.access_token);
          setRefreshToken(session.refresh_token || null);
          if (__DEV__) console.log('[WebView] Session token retrieved for SSO');
        }
      } catch (error) {
        if (__DEV__) console.warn('[WebView] Failed to get session:', error);
      } finally {
        setIsSessionReady(true);
      }
    };
    getSession();
  }, [user]);

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

      // Inject auth session for automatic login
      ${sessionToken ? `window.PEZKUWI_SESSION_TOKEN = '${sessionToken}';` : ''}
      ${refreshToken ? `window.PEZKUWI_REFRESH_TOKEN = '${refreshToken}';` : ''}
      ${user ? `window.PEZKUWI_USER_ID = '${user.id}';` : ''}
      ${user?.email ? `window.PEZKUWI_USER_EMAIL = '${user.email}';` : ''}

      // Pre-populate localStorage with session so Supabase client finds it on init
      ${sessionToken && user ? `
      try {
        var supabaseUrl = 'https://sihawipngjtgvfzukfew.supabase.co';
        var storageKey = 'sb-' + supabaseUrl.replace('https://', '').split('.')[0] + '-auth-token';
        var sessionData = {
          access_token: '${sessionToken}',
          refresh_token: '${refreshToken || ''}',
          token_type: 'bearer',
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          user: {
            id: '${user.id}',
            email: '${user.email || ''}',
            aud: 'authenticated',
            role: 'authenticated'
          }
        };
        localStorage.setItem(storageKey, JSON.stringify(sessionData));
        console.log('[Mobile] Pre-populated localStorage with session');
      } catch(e) {
        console.warn('[Mobile] Failed to set localStorage:', e);
      }
      ` : ''}

      // Auto-authenticate with Supabase if session token exists
      if (window.PEZKUWI_SESSION_TOKEN) {
        (function autoAuth(attempts = 0) {
          if (attempts > 50) {
            console.warn('[Mobile] Auto-auth timed out: window.supabase not found');
            return;
          }

          if (window.supabase && window.supabase.auth) {
            window.supabase.auth.setSession({
              access_token: window.PEZKUWI_SESSION_TOKEN,
              refresh_token: window.PEZKUWI_REFRESH_TOKEN || ''
            }).then(function(res) {
              if (res.error) {
                console.warn('[Mobile] Auto-auth error:', res.error);
              } else {
                console.log('[Mobile] Auto-authenticated successfully');
                // Dispatch event to notify app of successful auth
                window.dispatchEvent(new CustomEvent('pezkuwi-session-restored', {
                  detail: { userId: window.PEZKUWI_USER_ID }
                }));
                // Force auth state refresh if the app has an auth store
                if (window.__refreshAuthState) {
                  window.__refreshAuthState();
                }
              }
            }).catch(function(err) {
              console.warn('[Mobile] Auto-auth promise failed:', err);
            });
          } else {
            setTimeout(function() { autoAuth(attempts + 1); }, 100);
          }
        })(0);
      }

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
        // Request transaction signing and submission from native wallet
        signTransaction: function(payload, callback) {
          window.__pendingSignCallback = callback;
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'SIGN_TRANSACTION',
            payload: payload
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
          // Handle transaction signing and submission
          if (!selectedAccount) {
            webViewRef.current?.injectJavaScript(`
              if (window.__pendingSignCallback) {
                window.__pendingSignCallback(null, 'Wallet not connected');
                delete window.__pendingSignCallback;
              }
            `);
            return;
          }

          if (!api || !isApiReady) {
            webViewRef.current?.injectJavaScript(`
              if (window.__pendingSignCallback) {
                window.__pendingSignCallback(null, 'Blockchain not connected');
                delete window.__pendingSignCallback;
              }
            `);
            return;
          }

          try {
            const payload = message.payload as {
              section: string;
              method: string;
              args: unknown[];
            };

            const keyPair = await getKeyPair(selectedAccount.address);
            if (!keyPair) {
              throw new Error('Could not retrieve key pair');
            }

            // Build the transaction using native API
            const { section, method, args } = payload;

            if (__DEV__) {
              console.warn('[WebView] Building transaction:', { section, method, args });
            }

            // Get the transaction method from API
            const txModule = api.tx[section] as Record<string, (...args: unknown[]) => { signAndSend: (...args: unknown[]) => Promise<unknown> }> | undefined;
            if (!txModule) {
              throw new Error(`Unknown section: ${section}`);
            }

            const txMethod = txModule[method];
            if (!txMethod) {
              throw new Error(`Unknown method: ${section}.${method}`);
            }

            // Create the transaction
            const tx = txMethod(...args);

            // Sign and send transaction
            const txHash = await new Promise<string>((resolve, reject) => {
              tx.signAndSend(keyPair, { nonce: -1 }, (result: { status: { isInBlock?: boolean; isFinalized?: boolean; asInBlock?: { toString: () => string }; asFinalized?: { toString: () => string } }; dispatchError?: unknown }) => {
                if (result.status.isInBlock) {
                  const hash = result.status.asInBlock?.toString() || '';
                  if (__DEV__) {
                    console.warn('[WebView] Transaction included in block:', hash);
                  }
                  resolve(hash);
                } else if (result.status.isFinalized) {
                  const hash = result.status.asFinalized?.toString() || '';
                  if (__DEV__) {
                    console.warn('[WebView] Transaction finalized:', hash);
                  }
                }
                if (result.dispatchError) {
                  reject(new Error('Transaction failed'));
                }
              }).catch(reject);
            });

            // Send success back to WebView
            webViewRef.current?.injectJavaScript(`
              if (window.__pendingSignCallback) {
                window.__pendingSignCallback('${txHash}', null);
                delete window.__pendingSignCallback;
              }
            `);
          } catch (signError) {
            const errorMessage = (signError as Error).message.replace(/'/g, "\\'");
            webViewRef.current?.injectJavaScript(`
              if (window.__pendingSignCallback) {
                window.__pendingSignCallback(null, '${errorMessage}');
                delete window.__pendingSignCallback;
              }
            `);
          }
          break;

        case 'CONNECT_WALLET':
          // Handle wallet connection request from WebView
          if (__DEV__) console.warn('WebView requested wallet connection');

          if (selectedAccount) {
            // Already connected, notify WebView
            webViewRef.current?.injectJavaScript(`
              window.PEZKUWI_ADDRESS = '${selectedAccount.address}';
              window.PEZKUWI_ACCOUNT_NAME = '${selectedAccount.meta?.name || 'Mobile Wallet'}';
              window.dispatchEvent(new CustomEvent('pezkuwi-wallet-connected', {
                detail: {
                  address: '${selectedAccount.address}',
                  name: '${selectedAccount.meta?.name || 'Mobile Wallet'}'
                }
              }));
            `);
          } else {
            // No wallet connected, show alert and navigate to wallet setup
            Alert.alert(
              'Wallet Required',
              'Please connect or create a wallet to continue.',
              [
                {
                  text: 'Cancel',
                  style: 'cancel',
                },
                {
                  text: 'Setup Wallet',
                  onPress: () => {
                    navigation.navigate('WalletSetup');
                  },
                },
              ]
            );
          }
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
            console.warn('[WebView]:', message.payload);
          }
          break;

        default:
          if (__DEV__) {
            console.warn('Unknown message type:', message.type);
          }
      }
    } catch (parseError) {
      if (__DEV__) {
        console.error('Failed to parse WebView message:', parseError);
      }
    }
  }, [selectedAccount, getKeyPair, canGoBack, navigation, api, isApiReady]);

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

  // Wait for session to be ready before loading WebView (ensures SSO works)
  if (!isSessionReady) {
    return (
      <View style={styles.container}>
        {title && (
          <View style={styles.header}>
            <View style={{ width: 40 }} />
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={{ width: 40 }} />
          </View>
        )}
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Preparing session...</Text>
        </View>
      </View>
    );
  }

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
