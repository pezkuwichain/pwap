import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  BackHandler,
  FlatList,
  Modal,
  Platform,
} from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';
import { safeJsValue } from '../../utils/sanitize';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKMARKS_KEY = '@pezkuwi_dapp_bookmarks';

interface DAppBookmark {
  url: string;
  title: string;
  favicon?: string;
}

const DEFAULT_DAPPS: DAppBookmark[] = [
  { url: 'https://polkadot.js.org/apps/', title: 'Polkadot.js Apps' },
  { url: 'https://pezkuwichain.io', title: 'Pezkuwi Portal' },
  { url: 'https://sub.id/', title: 'SubID' },
];

const DAppBrowserScreen: React.FC = () => {
  const webViewRef = useRef<WebView>(null);
  const { selectedAccount, getKeyPair } = usePezkuwi();

  const [url, setUrl] = useState('');
  const [currentUrl, setCurrentUrl] = useState('');
  const [pageTitle, setPageTitle] = useState('');
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showBrowser, setShowBrowser] = useState(false);
  const [bookmarks, setBookmarks] = useState<DAppBookmark[]>(DEFAULT_DAPPS);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [pendingAuthOrigin, setPendingAuthOrigin] = useState('');

  // Load bookmarks
  React.useEffect(() => {
    AsyncStorage.getItem(BOOKMARKS_KEY).then(data => {
      if (data) {
        try {
          const saved = JSON.parse(data) as DAppBookmark[];
          setBookmarks([...DEFAULT_DAPPS, ...saved]);
        } catch { /* use defaults */ }
      }
    });
  }, []);

  // Web3 injection script - implements Polkadot.js extension API
  const getInjectionScript = () => {
    if (!selectedAccount) return 'true;';

    return `
    (function() {
      if (window.__pezkuwiInjected) return;
      window.__pezkuwiInjected = true;

      var account = {
        address: ${safeJsValue(selectedAccount.address)},
        name: ${safeJsValue(selectedAccount.name || 'Pezkuwi Wallet')},
        type: 'sr25519',
        genesisHash: null,
      };

      // Pending sign requests
      var pendingRequests = {};
      var requestId = 0;

      // Polkadot.js extension interface
      var pezkuwiExtension = {
        name: 'pezkuwi-wallet',
        version: '1.0.0',
        accounts: {
          get: function() {
            return Promise.resolve([account]);
          },
          subscribe: function(cb) {
            cb([account]);
            return function() {};
          }
        },
        signer: {
          signPayload: function(payload) {
            return new Promise(function(resolve, reject) {
              var id = ++requestId;
              pendingRequests[id] = { resolve: resolve, reject: reject };
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SIGN_PAYLOAD',
                id: id,
                payload: payload
              }));
            });
          },
          signRaw: function(raw) {
            return new Promise(function(resolve, reject) {
              var id = ++requestId;
              pendingRequests[id] = { resolve: resolve, reject: reject };
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'SIGN_RAW',
                id: id,
                payload: raw
              }));
            });
          }
        },
        metadata: {
          get: function() { return Promise.resolve([]); },
          provide: function() { return Promise.resolve(true); }
        }
      };

      // Handle responses from native
      window.__handleSignResponse = function(id, result, error) {
        var req = pendingRequests[id];
        if (!req) return;
        delete pendingRequests[id];
        if (error) {
          req.reject(new Error(error));
        } else {
          req.resolve(result);
        }
      };

      // Inject as Polkadot.js extension
      window.injectedWeb3 = window.injectedWeb3 || {};
      window.injectedWeb3['pezkuwi-wallet'] = {
        enable: function(origin) {
          return new Promise(function(resolve, reject) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'AUTH_REQUEST',
              origin: origin
            }));
            window.__pendingAuthResolve = function() {
              resolve(pezkuwiExtension);
            };
            window.__pendingAuthReject = function(reason) {
              reject(new Error(reason || 'User rejected wallet connection'));
            };
            // Timeout: REJECT after 30s if no response (do NOT auto-approve)
            setTimeout(function() {
              if (window.__pendingAuthReject) {
                window.__pendingAuthReject('Authorization request timed out');
                delete window.__pendingAuthResolve;
                delete window.__pendingAuthReject;
              }
            }, 30000);
          });
        },
        version: '1.0.0'
      };

      // Notify dApp that extension is available
      window.dispatchEvent(new Event('web3:extensionsReady'));

      true;
    })();
    `;
  };

  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);

      switch (message.type) {
        case 'AUTH_REQUEST':
          setPendingAuthOrigin(message.origin || currentUrl);
          setShowAuthModal(true);
          break;

        case 'SIGN_PAYLOAD':
          if (!selectedAccount) {
            webViewRef.current?.injectJavaScript(
              `window.__handleSignResponse(${message.id}, null, 'No wallet connected');`
            );
            return;
          }

          Alert.alert(
            'Sign Transaction',
            `${currentUrl} wants to sign a transaction.\n\nFrom: ${selectedAccount.address.slice(0, 12)}...`,
            [
              {
                text: 'Reject',
                style: 'cancel',
                onPress: () => {
                  webViewRef.current?.injectJavaScript(
                    `window.__handleSignResponse(${message.id}, null, 'User rejected');`
                  );
                },
              },
              {
                text: 'Sign',
                onPress: async () => {
                  try {
                    const keyPair = await getKeyPair(selectedAccount.address);
                    if (!keyPair) throw new Error('No keypair');

                    const payload = message.payload;
                    // Sign the raw bytes
                    const signature = keyPair.sign(payload.data || payload.method || '');
                    const hexSig = '0x' + Buffer.from(signature).toString('hex');

                    webViewRef.current?.injectJavaScript(
                      `window.__handleSignResponse(${message.id}, {id: ${message.id}, signature: '${hexSig}'}, null);`
                    );
                  } catch (e) {
                    const errMsg = (e as Error).message.replace(/'/g, "\\'");
                    webViewRef.current?.injectJavaScript(
                      `window.__handleSignResponse(${message.id}, null, '${errMsg}');`
                    );
                  }
                },
              },
            ]
          );
          break;

        case 'SIGN_RAW':
          if (!selectedAccount) {
            webViewRef.current?.injectJavaScript(
              `window.__handleSignResponse(${message.id}, null, 'No wallet connected');`
            );
            return;
          }

          Alert.alert(
            'Sign Message',
            `${currentUrl} wants you to sign a message.`,
            [
              {
                text: 'Reject',
                style: 'cancel',
                onPress: () => {
                  webViewRef.current?.injectJavaScript(
                    `window.__handleSignResponse(${message.id}, null, 'User rejected');`
                  );
                },
              },
              {
                text: 'Sign',
                onPress: async () => {
                  try {
                    const keyPair = await getKeyPair(selectedAccount.address);
                    if (!keyPair) throw new Error('No keypair');

                    const signature = keyPair.sign(message.payload.data || '');
                    const hexSig = '0x' + Buffer.from(signature).toString('hex');

                    webViewRef.current?.injectJavaScript(
                      `window.__handleSignResponse(${message.id}, {id: ${message.id}, signature: '${hexSig}'}, null);`
                    );
                  } catch (e) {
                    const errMsg = (e as Error).message.replace(/'/g, "\\'");
                    webViewRef.current?.injectJavaScript(
                      `window.__handleSignResponse(${message.id}, null, '${errMsg}');`
                    );
                  }
                },
              },
            ]
          );
          break;
      }
    } catch {
      // Non-JSON message, ignore
    }
  }, [selectedAccount, getKeyPair, currentUrl]);

  // Handle Android back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        if (showBrowser) {
          setShowBrowser(false);
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => sub.remove();
    }, [canGoBack, showBrowser])
  );

  const navigateTo = (targetUrl: string) => {
    let finalUrl = targetUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }
    setCurrentUrl(finalUrl);
    setUrl(finalUrl);
    setShowBrowser(true);
  };

  const handleApproveAuth = () => {
    setShowAuthModal(false);
    webViewRef.current?.injectJavaScript(`
      if (window.__pendingAuthResolve) {
        window.__pendingAuthResolve();
        delete window.__pendingAuthResolve;
      }
    `);
  };

  const addBookmark = async () => {
    const existing = bookmarks.find(b => b.url === currentUrl);
    if (existing) {
      Alert.alert('Already saved', 'This dApp is already in your bookmarks');
      return;
    }
    const newBookmark: DAppBookmark = { url: currentUrl, title: pageTitle || currentUrl };
    const customBookmarks = bookmarks.filter(b => !DEFAULT_DAPPS.some(d => d.url === b.url));
    customBookmarks.push(newBookmark);
    await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(customBookmarks));
    setBookmarks([...DEFAULT_DAPPS, ...customBookmarks]);
    Alert.alert('Saved', 'DApp added to bookmarks');
  };

  // DApp browser view
  if (showBrowser) {
    return (
      <View style={styles.container}>
        {/* Browser toolbar */}
        <View style={styles.toolbar}>
          <TouchableOpacity style={styles.navBtn} onPress={() => canGoBack && webViewRef.current?.goBack()} disabled={!canGoBack} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={[styles.navBtnText, !canGoBack && styles.navBtnDisabled]}>{'<'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={() => canGoForward && webViewRef.current?.goForward()} disabled={!canGoForward} accessibilityRole="button" accessibilityLabel="Go forward">
            <Text style={[styles.navBtnText, !canGoForward && styles.navBtnDisabled]}>{'>'}</Text>
          </TouchableOpacity>
          <View style={styles.urlBar}>
            <TextInput
              style={styles.urlInput}
              value={url}
              onChangeText={setUrl}
              onSubmitEditing={() => navigateTo(url)}
              placeholder="Enter URL..."
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              selectTextOnFocus
              accessibilityLabel="URL input"
            />
          </View>
          <TouchableOpacity style={styles.navBtn} onPress={addBookmark} accessibilityRole="button" accessibilityLabel="Add bookmark">
            <Text style={styles.navBtnText}>+</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navBtn} onPress={() => setShowBrowser(false)} accessibilityRole="button" accessibilityLabel="Close browser">
            <Text style={styles.navBtnText}>X</Text>
          </TouchableOpacity>
        </View>

        {/* Connection status */}
        {selectedAccount && (
          <View style={styles.connectedBar}>
            <View style={styles.connectedDot} />
            <Text style={styles.connectedText} numberOfLines={1}>
              {selectedAccount.name} ({selectedAccount.address.slice(0, 8)}...)
            </Text>
          </View>
        )}

        <WebView
          ref={webViewRef}
          source={{ uri: currentUrl }}
          style={styles.webView}
          injectedJavaScriptBeforeContentLoaded={getInjectionScript()}
          onMessage={handleMessage}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onNavigationStateChange={(navState) => {
            setCanGoBack(navState.canGoBack);
            setCanGoForward(navState.canGoForward);
            setUrl(navState.url);
            setPageTitle(navState.title);
          }}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          webviewDebuggingEnabled={__DEV__}
        />

        {isLoading && (
          <View style={styles.loadingBar}>
            <View style={styles.loadingBarInner} />
          </View>
        )}

        {/* Auth Modal */}
        <Modal visible={showAuthModal} transparent animationType="fade">
          <View style={styles.authModalOverlay}>
            <View style={styles.authModalCard}>
              <Text style={styles.authModalTitle}>Connect Wallet</Text>
              <Text style={styles.authModalText}>
                {pendingAuthOrigin} wants to connect to your wallet.
              </Text>
              {selectedAccount && (
                <Text style={styles.authModalAccount}>
                  Account: {selectedAccount.name}{'\n'}
                  {selectedAccount.address.slice(0, 16)}...{selectedAccount.address.slice(-8)}
                </Text>
              )}
              <View style={styles.authModalActions}>
                <TouchableOpacity
                  style={styles.authBtnReject}
                  onPress={() => setShowAuthModal(false)}
                  accessibilityRole="button"
                  accessibilityLabel="Reject wallet connection"
                >
                  <Text style={styles.authBtnRejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.authBtnApprove}
                  onPress={handleApproveAuth}
                  accessibilityRole="button"
                  accessibilityLabel="Approve wallet connection"
                >
                  <Text style={styles.authBtnApproveText}>Connect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // DApp catalog / home
  return (
    <View style={styles.container}>
      {/* Search / URL Bar */}
      <View style={styles.searchHeader}>
        <Text style={styles.searchTitle}>DApp Browser</Text>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search or enter URL..."
            value={url}
            onChangeText={setUrl}
            onSubmitEditing={() => navigateTo(url)}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="go"
            accessibilityLabel="Search or enter URL"
          />
          <TouchableOpacity
            style={styles.searchGoBtn}
            onPress={() => url.trim() && navigateTo(url)}
            accessibilityRole="button"
            accessibilityLabel="Navigate to URL"
          >
            <Text style={styles.searchGoBtnText}>Go</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Wallet Status */}
      {selectedAccount ? (
        <View style={styles.walletStatus}>
          <View style={styles.walletStatusDot} />
          <Text style={styles.walletStatusText}>
            Connected: {selectedAccount.name} ({selectedAccount.address.slice(0, 8)}...)
          </Text>
        </View>
      ) : (
        <View style={[styles.walletStatus, styles.walletStatusDisconnected]}>
          <Text style={styles.walletStatusTextWarn}>No wallet connected - dApps won't work</Text>
        </View>
      )}

      {/* Bookmarked DApps */}
      <Text style={styles.sectionTitle}>DApps</Text>
      <FlatList
        data={bookmarks}
        keyExtractor={(item) => item.url}
        numColumns={2}
        contentContainerStyle={styles.dappGrid}
        columnWrapperStyle={styles.dappRow}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.dappCard}
            onPress={() => navigateTo(item.url)}
            accessibilityRole="button"
            accessibilityLabel={`Open ${item.title}`}
          >
            <View style={styles.dappIconCircle}>
              <Text style={styles.dappIconText}>
                {item.title.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.dappName} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.dappUrl} numberOfLines={1}>
              {item.url.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  // Search header
  searchHeader: { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  searchTitle: { fontSize: 22, fontWeight: '700', color: '#333', marginBottom: 12 },
  searchBar: { flexDirection: 'row', gap: 8 },
  searchInput: {
    flex: 1, backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    fontSize: 15, color: '#333',
  },
  searchGoBtn: {
    backgroundColor: KurdistanColors.kesk, borderRadius: 12, paddingHorizontal: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  searchGoBtnText: { color: '#FFFFFF', fontWeight: '600', fontSize: 15 },
  // Wallet status
  walletStatus: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: 'rgba(0, 143, 67, 0.05)',
  },
  walletStatusDisconnected: { backgroundColor: 'rgba(239, 68, 68, 0.05)' },
  walletStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: KurdistanColors.kesk, marginRight: 8 },
  walletStatusText: { fontSize: 12, color: '#555' },
  walletStatusTextWarn: { fontSize: 12, color: '#DC2626' },
  // DApp grid
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#333', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  dappGrid: { paddingHorizontal: 12, paddingBottom: 20 },
  dappRow: { gap: 12 },
  dappCard: {
    flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2,
  },
  dappIconCircle: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: `${KurdistanColors.kesk}15`,
    justifyContent: 'center', alignItems: 'center', marginBottom: 10,
  },
  dappIconText: { fontSize: 16, fontWeight: '700', color: KurdistanColors.kesk },
  dappName: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 2 },
  dappUrl: { fontSize: 11, color: '#999' },
  // Browser toolbar
  toolbar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
    paddingTop: Platform.OS === 'android' ? 6 : 6,
    gap: 4,
  },
  navBtn: {
    width: 36, height: 36, borderRadius: 8, backgroundColor: '#F5F5F5',
    justifyContent: 'center', alignItems: 'center',
  },
  navBtnText: { fontSize: 18, fontWeight: '600', color: '#333' },
  navBtnDisabled: { color: '#CCC' },
  urlBar: { flex: 1 },
  urlInput: {
    backgroundColor: '#F5F5F5', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8,
    fontSize: 13, color: '#333',
  },
  connectedBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4,
    backgroundColor: 'rgba(0, 143, 67, 0.05)',
  },
  connectedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: KurdistanColors.kesk, marginRight: 6 },
  connectedText: { fontSize: 11, color: '#555' },
  webView: { flex: 1 },
  loadingBar: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
    backgroundColor: '#E5E7EB',
  },
  loadingBarInner: {
    width: '60%', height: '100%', backgroundColor: KurdistanColors.kesk,
  },
  // Auth Modal
  authModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24,
  },
  authModalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  authModalTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginBottom: 12, textAlign: 'center' },
  authModalText: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 16 },
  authModalAccount: {
    fontSize: 13, color: '#555', backgroundColor: '#F5F5F5', padding: 12, borderRadius: 10,
    marginBottom: 20, fontFamily: 'monospace', textAlign: 'center',
  },
  authModalActions: { flexDirection: 'row', gap: 12 },
  authBtnReject: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EEEEEE', alignItems: 'center',
  },
  authBtnRejectText: { fontSize: 16, fontWeight: '600', color: '#666' },
  authBtnApprove: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: KurdistanColors.kesk, alignItems: 'center',
  },
  authBtnApproveText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});

export default DAppBrowserScreen;
