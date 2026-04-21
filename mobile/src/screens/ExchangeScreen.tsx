import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  BackHandler,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';

const EXCHANGE_URL = 'https://exchange.pezkuwichain.io';

/**
 * Pezkuwi Exchange (Borsa) — gerçek dünya CEX
 * OKX kalitesinde spot trading, USDT/BTC/ETH/SOL/DOT/HEZ/PEZ
 *
 * Kendi JWT auth sistemine sahip; Supabase SSO enjeksiyonu gerekmez.
 * Borsanın kendi login sayfasına yönlendirir.
 */
const ExchangeScreen: React.FC = () => {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading]   = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const { user } = useAuth();

  // Android geri tuşu — WebView geçmişinde geri git
  useFocusEffect(
    useCallback(() => {
      const onBack = () => {
        if (canGoBack && webViewRef.current) {
          webViewRef.current.goBack();
          return true;
        }
        return false;
      };
      const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
      return () => sub.remove();
    }, [canGoBack])
  );

  // Mobil cihaz ve opsiyonel kullanıcı bilgisi enjekte et
  const injectedJS = `
    (function() {
      window.PEZKUWI_MOBILE   = true;
      window.PEZKUWI_PLATFORM = '${Platform.OS}';
      ${user?.id    ? `window.PEZKUWI_USER_ID    = '${user.id}';`    : ''}
      ${user?.email ? `window.PEZKUWI_USER_EMAIL = '${user.email}';` : ''}
      true;
    })();
  `;

  const handleReload = () => {
    setError(null);
    setLoading(true);
    webViewRef.current?.reload();
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <Header canGoBack={false} onGoBack={() => {}} onReload={handleReload} />
        <View style={styles.errorBox}>
          <Text style={styles.errorIcon}>⚡</Text>
          <Text style={styles.errorTitle}>Bağlantı kurulamadı</Text>
          <Text style={styles.errorMsg}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={handleReload}>
            <Text style={styles.retryText}>Yeniden Dene</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Header
        canGoBack={canGoBack}
        onGoBack={() => webViewRef.current?.goBack()}
        onReload={handleReload}
      />

      <WebView
        ref={webViewRef}
        source={{ uri: EXCHANGE_URL }}
        style={styles.webView}
        injectedJavaScript={injectedJS}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onError={(e) => {
          setError(e.nativeEvent.description || 'Sayfa yüklenemedi');
          setLoading(false);
        }}
        onHttpError={(e) => {
          if (e.nativeEvent.statusCode >= 500) {
            setError(`Sunucu hatası: ${e.nativeEvent.statusCode}`);
          }
        }}
        onNavigationStateChange={(s) => setCanGoBack(s.canGoBack)}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        cacheEnabled
        allowsBackForwardNavigationGestures
        allowsInlineMediaPlayback
        showsHorizontalScrollIndicator={false}
        webviewDebuggingEnabled={__DEV__}
      />

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#F0A500" />
          <Text style={styles.loadingText}>Borsa yükleniyor...</Text>
        </View>
      )}
    </SafeAreaView>
  );
};

// ─── Header bileşeni ─────────────────────────────────────────

function Header({
  canGoBack,
  onGoBack,
  onReload,
}: {
  canGoBack: boolean;
  onGoBack: () => void;
  onReload: () => void;
}) {
  return (
    <View style={styles.header}>
      {canGoBack ? (
        <TouchableOpacity style={styles.headerBtn} onPress={onGoBack}>
          <Text style={styles.headerBtnText}>‹</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.headerBtn} />
      )}

      {/* Logo + başlık */}
      <View style={styles.headerCenter}>
        <View style={styles.headerLogoBox}>
          <Text style={styles.headerLogoText}>₿</Text>
        </View>
        <View>
          <Text style={styles.headerTitle}>Pezkuwi Exchange</Text>
          <Text style={styles.headerSub}>Borsa · Spot Trading</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.headerBtn} onPress={onReload}>
        <Text style={styles.headerBtnText}>↻</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Stiller ─────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0B1120',
    borderBottomWidth: 1,
    borderBottomColor: '#1A2035',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnText: {
    fontSize: 24,
    color: '#F0A500',
    fontWeight: '600',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F0A500',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLogoText: {
    fontSize: 16,
    color: '#0B1120',
    fontWeight: '900',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  headerSub: {
    fontSize: 10,
    color: '#8B9BB4',
    letterSpacing: 0.2,
  },
  webView: {
    flex: 1,
    backgroundColor: '#0B1120',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#0B1120',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#8B9BB4',
    fontSize: 14,
  },
  errorBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  errorIcon: {
    fontSize: 48,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorMsg: {
    fontSize: 13,
    color: '#8B9BB4',
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: 8,
    backgroundColor: '#F0A500',
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    color: '#0B1120',
    fontWeight: '700',
    fontSize: 15,
  },
});

export default ExchangeScreen;
