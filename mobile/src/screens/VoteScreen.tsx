import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { fetchUserTikis } from '../../shared/lib/tiki';
import { PezkuwiWebView } from '../components';

/**
 * Vote Screen
 *
 * Requires Welati (citizen) tiki to access voting features.
 * Uses WebView to load the voting interface from the web app.
 */
const VoteScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api, isApiReady, selectedAccount } = usePezkuwi();

  const [hasWelatiTiki, setHasWelatiTiki] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      if (!api || !isApiReady || !selectedAccount) {
        setCheckingAccess(false);
        setHasWelatiTiki(false);
        return;
      }

      try {
        const tikis = await fetchUserTikis(api, selectedAccount.address);
        const hasWelati = tikis.includes('Welati');
        setHasWelatiTiki(hasWelati);
      } catch (error) {
        if (__DEV__) console.error('[Vote] Error checking tiki:', error);
        setHasWelatiTiki(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [api, isApiReady, selectedAccount]);

  // Loading state
  if (checkingAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={[KurdistanColors.kesk, '#006633']} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.spi} />
          <Text style={styles.loadingText}>Checking access...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Access denied - no welati tiki
  if (!hasWelatiTiki) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[KurdistanColors.kesk, KurdistanColors.zer, KurdistanColors.sor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.accessDeniedContainer}
        >
          <View style={styles.accessDeniedContent}>
            <Text style={styles.accessDeniedIcon}>🗳️</Text>
            <Text style={styles.accessDeniedTitle}>Citizenship Required</Text>
            <Text style={styles.accessDeniedSubtitle}>
              Pêdivî ye ku hûn welatî bin da ku bikarin deng bidin
            </Text>
            <Text style={styles.accessDeniedText}>
              You must be a citizen to participate in voting.
              Please complete your citizenship application first.
            </Text>

            <TouchableOpacity
              style={styles.becomeCitizenButton}
              onPress={() => navigation.navigate('BeCitizen' as never)}
            >
              <Text style={styles.becomeCitizenButtonText}>Become a Citizen</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Go Back</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Access granted - show WebView
  return (
    <SafeAreaView style={styles.container}>
      <PezkuwiWebView
        path="/vote"
        title="Dengdan / Vote"
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: KurdistanColors.spi,
    marginTop: 16,
    fontSize: 16,
  },
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedContent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 32,
    margin: 24,
    alignItems: 'center',
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.2)',
    elevation: 10,
  },
  accessDeniedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  accessDeniedSubtitle: {
    fontSize: 14,
    color: KurdistanColors.kesk,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  becomeCitizenButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  becomeCitizenButtonText: {
    color: KurdistanColors.spi,
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 12,
  },
  backButtonText: {
    color: KurdistanColors.kesk,
    fontSize: 16,
  },
});

export default VoteScreen;
