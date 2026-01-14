import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initializeI18n } from './src/i18n';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { LanguageProvider } from './src/contexts/LanguageContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { PezkuwiProvider } from './src/contexts/PezkuwiContext';
import { BiometricAuthProvider } from './src/contexts/BiometricAuthContext';
import { ThemeProvider } from './src/contexts/ThemeContext';
import AppNavigator from './src/navigation/AppNavigator';
import { KurdistanColors } from './src/theme/colors';

export default function App() {
  const [isI18nInitialized, setIsI18nInitialized] = useState(false);

  useEffect(() => {
    // Initialize i18n on app start
    const initApp = async () => {
      try {
        console.log('🚀 App starting...');
        console.log('🔧 Initializing i18n...');
        await initializeI18n();
        console.log('✅ i18n initialized');
        setIsI18nInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize i18n:', error);
        // Fallback: Still show app but with default language
        setIsI18nInitialized(true);
      }
    };

    initApp();
  }, []);

  if (!isI18nInitialized) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={KurdistanColors.kesk} />
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <PezkuwiProvider>
            <LanguageProvider>
              <BiometricAuthProvider>
                <StatusBar style="auto" />
                <AppNavigator />
              </BiometricAuthProvider>
            </LanguageProvider>
          </PezkuwiProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
  },
});

