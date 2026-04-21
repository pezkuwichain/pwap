/**
 * BereketliApp - Entry point for Bereketli mini-app
 *
 * This wraps the Bereketli navigation with its own providers (Zustand stores, i18n)
 * while sharing the parent app's auth context.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { NavigationContainer, NavigationIndependentTree } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { colors } from './theme';

// Bereketli's own auth store
import { useAuthStore } from './store/authStore';
// Bereketli API client
import apiClient from './api/client';

// Bereketli navigation (5 tab navigator)
import MainTabNavigator from './navigation/MainTabNavigator';

const BereketliApp: React.FC = () => {
  const { user } = useAuth();
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setBereketliAuth = useAuthStore(state => state.setAuth);

  // Bridge: Exchange pwap Supabase token for Bereketli token
  useEffect(() => {
    const bridgeAuth = async () => {
      if (!user) {
        setError('Please log in to use Bereketli');
        setIsReady(true);
        return;
      }

      try {
        // Get current Supabase session
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          setError('Session expired. Please log in again.');
          setIsReady(true);
          return;
        }

        const response = await apiClient.post('/auth/exchange', {
          supabase_token: session.access_token,
        });

        if (response.data?.access_token) {
          setBereketliAuth({
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            user: response.data.user,
          });
        }

        setIsReady(true);
      } catch (e) {
        if (__DEV__) console.error('[Bereketli] Auth bridge failed:', e);
        setError('Failed to connect to Bereketli. Please try again.');
        setIsReady(true);
      }
    };

    bridgeAuth();
  }, [user, setBereketliAuth]);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Bereketli...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.error}>
        <Text style={styles.errorIcon}>!</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <NavigationIndependentTree>
      <NavigationContainer>
        <MainTabNavigator />
      </NavigationContainer>
    </NavigationIndependentTree>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#888',
  },
  error: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  errorIcon: {
    fontSize: 48,
    color: '#DC2626',
    marginBottom: 16,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});

export default BereketliApp;
