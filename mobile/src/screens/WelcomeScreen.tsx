import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KurdistanColors } from '../theme/colors';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import TermsOfServiceModal from '../components/TermsOfServiceModal';

interface WelcomeScreenProps {
  onContinue?: () => void;
}

const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onContinue }) => {
  const [agreed, setAgreed] = useState(false);
  const [privacyModalVisible, setPrivacyModalVisible] = useState(false);
  const [termsModalVisible, setTermsModalVisible] = useState(false);

  const handleContinue = async () => {
    if (!agreed) return;

    try {
      await AsyncStorage.setItem('@pezkuwi/privacy_consent_accepted', 'true');
      onContinue && onContinue();
    } catch (error) {
      if (__DEV__) console.error('Error saving privacy consent:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient
        colors={[KurdistanColors.kesk, KurdistanColors.zer, KurdistanColors.sor]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo and Title */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('../../assets/kurdistan-map.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Pezkuwi Super App</Text>
            <Text style={styles.subtitle}>The First Digital Nation</Text>
          </View>

          {/* Introduction */}
          <View style={styles.introSection}>
            <Text style={styles.introText}>
              Welcome to Pezkuwi, where blockchain technology transcends financial applications to address fundamental human challenges — statelessness, governance, and social justice.
            </Text>

            <Text style={styles.introText}>
              Pezkuwi is a pioneering experiment in digital statehood, merging technology with sociology, economy with politics. Starting with the Kurdish digital nation, we are building the world's first territory-independent nation governed by algorithmic sovereignty and social trust rather than borders and bureaucracy.
            </Text>

            <Text style={styles.introText}>
              Our meritocratic TNPoS consensus and modular digital nation infrastructure represent a new paradigm for Web3 — proving that decentralization is not just a technical promise, but a pathway to true self-governance.
            </Text>

            <View style={styles.featuresList}>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>•</Text>
                <Text style={styles.featureText}>Digital Citizenship & Identity</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>•</Text>
                <Text style={styles.featureText}>Decentralized Governance</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>•</Text>
                <Text style={styles.featureText}>Non-Custodial Wallet</Text>
              </View>
              <View style={styles.featureItem}>
                <Text style={styles.featureBullet}>•</Text>
                <Text style={styles.featureText}>Community-Driven Economy</Text>
              </View>
            </View>
          </View>

          {/* Privacy Consent Checkbox */}
          <View style={styles.consentContainer}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setAgreed(!agreed)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
                {agreed && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.consentText}>
                I agree to the{' '}
                <Text
                  style={styles.consentLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    setPrivacyModalVisible(true);
                  }}
                >
                  Privacy Policy
                </Text>
                {' '}and{' '}
                <Text
                  style={styles.consentLink}
                  onPress={(e) => {
                    e.stopPropagation();
                    setTermsModalVisible(true);
                  }}
                >
                  Terms of Service
                </Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, !agreed && styles.continueButtonDisabled]}
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!agreed}
          >
            <Text style={styles.continueButtonText}>Get Started</Text>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.footerLink} onPress={() => setPrivacyModalVisible(true)}>
              <Text style={styles.footerLinkText}>Privacy Policy</Text>
            </TouchableOpacity>
            <Text style={styles.footerDivider}>•</Text>
            <TouchableOpacity style={styles.footerLink} onPress={() => setTermsModalVisible(true)}>
              <Text style={styles.footerLinkText}>Terms of Service</Text>
            </TouchableOpacity>
            <Text style={styles.footerText}>
              Pezkuwi Blockchain • Est. 2024 • {new Date().getFullYear()}
            </Text>
            <Text style={styles.footerSubtext}>
              Building the future of decentralized governance since the launch of PezkuwiChain testnet
            </Text>
          </View>
        </ScrollView>

        {/* Privacy Policy Modal */}
        <PrivacyPolicyModal
          visible={privacyModalVisible}
          onClose={() => setPrivacyModalVisible(false)}
        />

        {/* Terms of Service Modal */}
        <TermsOfServiceModal
          visible={termsModalVisible}
          onClose={() => setTermsModalVisible(false)}
        />
      </LinearGradient>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: KurdistanColors.kesk,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: KurdistanColors.spi,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    elevation: 8,
    padding: 10,
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: KurdistanColors.spi,
    textAlign: 'center',
    opacity: 0.9,
  },
  introSection: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  introText: {
    fontSize: 15,
    lineHeight: 24,
    color: KurdistanColors.spi,
    textAlign: 'center',
    marginBottom: 16,
  },
  featuresList: {
    marginTop: 12,
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  featureBullet: {
    fontSize: 20,
    color: KurdistanColors.zer,
    marginRight: 12,
    fontWeight: 'bold',
  },
  featureText: {
    fontSize: 15,
    color: KurdistanColors.spi,
    fontWeight: '500',
  },
  consentContainer: {
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: KurdistanColors.spi,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxChecked: {
    backgroundColor: KurdistanColors.spi,
  },
  checkmark: {
    color: KurdistanColors.kesk,
    fontSize: 16,
    fontWeight: 'bold',
  },
  consentText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: KurdistanColors.spi,
  },
  consentLink: {
    fontWeight: 'bold',
    textDecorationLine: 'underline',
  },
  continueButton: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    elevation: 6,
  },
  continueButtonDisabled: {
    opacity: 0.4,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
    gap: 8,
  },
  footerLink: {
    paddingVertical: 4,
  },
  footerLinkText: {
    fontSize: 13,
    color: KurdistanColors.spi,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  footerDivider: {
    fontSize: 12,
    color: KurdistanColors.spi,
    opacity: 0.5,
    marginHorizontal: 8,
  },
  footerText: {
    fontSize: 12,
    color: KurdistanColors.spi,
    opacity: 0.7,
    textAlign: 'center',
    marginTop: 8,
  },
  footerSubtext: {
    fontSize: 11,
    color: KurdistanColors.spi,
    opacity: 0.6,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingHorizontal: 20,
  },
});

export default WelcomeScreen;
