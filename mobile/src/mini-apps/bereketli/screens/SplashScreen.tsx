import React, {useEffect, useRef} from 'react';
import {View, Text, Image, StyleSheet, Animated, StatusBar, Dimensions} from 'react-native';
import {useTranslation} from 'react-i18next';
import {colors} from '../theme';

const {width} = Dimensions.get('window');

interface SplashScreenProps {
  onFinish: () => void;
}

export default function SplashScreen({onFinish}: SplashScreenProps) {
  const {t} = useTranslation();
  const logoScale = useRef(new Animated.Value(0.3)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo fade in + scale
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 4,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
      // Title fade in
      Animated.timing(textOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      // Subtitle fade in
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after 2.5s
    const timer = setTimeout(onFinish, 2500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Animated refs are stable, onFinish is captured at mount; splash runs only once
  }, []);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primary} />

      {/* Background pattern circles */}
      <View style={styles.bgCircle1} />
      <View style={styles.bgCircle2} />

      {/* Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [{scale: logoScale}],
            opacity: logoOpacity,
          },
        ]}>
        <Image
          source={{uri: 'https://bereketli.pezkiwi.app/logo.png'}}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Title hidden — logo.png contains "Bereketli" text */}

      {/* Subtitle */}
      <Animated.Text style={[styles.subtitle, {opacity: subtitleOpacity}]}>
        {t('splash.subtitle')}
      </Animated.Text>

      {/* Bottom tagline */}
      <View style={styles.bottomSection}>
        <Text style={styles.tagline}>{t('splash.tagline')}</Text>
        <View style={styles.dots}>
          <View style={[styles.dot, styles.dotActive]} />
          <View style={styles.dot} />
          <View style={styles.dot} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Background decorative circles
  bgCircle1: {
    position: 'absolute',
    top: -width * 0.3,
    right: -width * 0.2,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  bgCircle2: {
    position: 'absolute',
    bottom: -width * 0.2,
    left: -width * 0.3,
    width: width * 0.7,
    height: width * 0.7,
    borderRadius: width * 0.35,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  // Logo
  logoContainer: {
    width: 140,
    height: 170,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  logoImage: {
    width: 130,
    height: 160,
  },

  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
    marginTop: 8,
  },

  // Bottom
  bottomSection: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    fontWeight: '500',
    marginBottom: 16,
  },
  dots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  dotActive: {
    backgroundColor: '#FFFFFF',
    width: 20,
  },
});
