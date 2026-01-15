import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { KurdistanColors } from '../theme/colors';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HUMAN_VERIFIED_KEY = '@pezkuwi_human_verified';

interface VerifyHumanScreenProps {
  onVerified: () => void;
}

const VerifyHumanScreen: React.FC<VerifyHumanScreenProps> = ({ onVerified }) => {
  const [isChecked, setIsChecked] = useState(false);
  const [scaleValue] = useState(new Animated.Value(1));

  const handleVerify = async () => {
    if (!isChecked) return;

    // Save verification status
    try {
      await AsyncStorage.setItem(HUMAN_VERIFIED_KEY, 'true');
    } catch (error) {
      console.error('Failed to save verification:', error);
    }

    // Animate and navigate
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 1.1,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => onVerified(), 200);
    });
  };

  const toggleCheck = () => {
    setIsChecked(!isChecked);
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
        <View style={styles.content}>
          {/* Security Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🛡️</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Security Verification</Text>
          <Text style={styles.subtitle}>
            Please confirm you are human to continue
          </Text>

          {/* Verification Box */}
          <TouchableOpacity
            style={styles.verificationBox}
            onPress={toggleCheck}
            activeOpacity={0.8}
          >
            <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
              {isChecked && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={styles.verificationText}>
              I'm not a robot
            </Text>
          </TouchableOpacity>

          {/* Info Text */}
          <Text style={styles.infoText}>
            This helps protect the Pezkuwi network from automated attacks
          </Text>

          {/* Continue Button */}
          <TouchableOpacity
            style={[styles.continueButton, !isChecked && styles.continueButtonDisabled]}
            onPress={handleVerify}
            disabled={!isChecked}
            activeOpacity={0.8}
          >
            <Animated.View style={{ transform: [{ scale: scaleValue }] }}>
              <Text
                style={[
                  styles.continueButtonText,
                  !isChecked && styles.continueButtonTextDisabled,
                ]}
              >
                Continue
              </Text>
            </Animated.View>
          </TouchableOpacity>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Secure & Private
            </Text>
          </View>
        </View>
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
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: KurdistanColors.spi,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    boxShadow: '0 4px 8px rgba(0, 0, 0, 0.3)',
    elevation: 8,
  },
  iconText: {
    fontSize: 50,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: KurdistanColors.spi,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 40,
  },
  verificationBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
    elevation: 4,
    width: '100%',
    maxWidth: 400,
  },
  checkbox: {
    width: 32,
    height: 32,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: KurdistanColors.kesk,
    marginRight: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: KurdistanColors.kesk,
    borderColor: KurdistanColors.kesk,
  },
  checkmark: {
    fontSize: 20,
    color: KurdistanColors.spi,
    fontWeight: 'bold',
  },
  verificationText: {
    fontSize: 18,
    color: KurdistanColors.reş,
    fontWeight: '500',
  },
  infoText: {
    fontSize: 13,
    color: KurdistanColors.spi,
    textAlign: 'center',
    opacity: 0.8,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
  continueButton: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
    elevation: 6,
  },
  continueButtonDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    boxShadow: 'none',
    elevation: 0,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  continueButtonTextDisabled: {
    color: 'rgba(0, 0, 0, 0.3)',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: KurdistanColors.spi,
    opacity: 0.8,
  },
});

export default VerifyHumanScreen;

// Export helper to check verification status
export const checkHumanVerification = async (): Promise<boolean> => {
  try {
    const verified = await AsyncStorage.getItem(HUMAN_VERIFIED_KEY);
    return verified === 'true';
  } catch (error) {
    console.error('Failed to check verification:', error);
    return false;
  }
};
