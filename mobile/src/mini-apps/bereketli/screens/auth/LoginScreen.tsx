import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAuthStore} from '../../store/authStore';
import {colors, spacing, typography} from '../../theme';
// Google Sign-In stubbed — auth bridges through pwap's Supabase
const GoogleSignin = { configure: (_opts: unknown) => {}, hasPlayServices: async () => true, signIn: async () => ({ data: { idToken: '' } }) };
const statusCodes = { SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED', IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE' };
import client, {saveTokens} from '../../api/client';

import Svg, {Path} from 'react-native-svg';
import {GOOGLE_WEB_CLIENT_ID as WEB_CLIENT_ID} from '../../config';

export default function LoginScreen({navigation}: any) {
  const {t} = useTranslation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const {login, isLoading, error, clearError} = useAuthStore();

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const handleLogin = async () => {
    if (!identifier.trim() || !password) {
      Alert.alert(t('common.error'), t('auth.loginErrorRequired'));
      return;
    }
    try {
      await login(identifier.trim(), password);
    } catch {
      // Error zustand store'da
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    clearError();
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (!idToken) {
        Alert.alert(t('common.error'), t('auth.googleTokenError'));
        setGoogleLoading(false);
        return;
      }

      // Send to backend
      const {data} = await client.post('/auth/google', {id_token: idToken});
      await saveTokens(data.access_token, data.refresh_token);

      // Update auth store
      useAuthStore.setState({
        user: data.user,
        isLoggedIn: true,
        isLoading: false,
      });
    } catch (err: any) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) {
        // Kullanici iptal etti — sessiz
      } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert(t('common.error'), t('auth.googlePlayError'));
      } else {
        const msg = err.response?.data?.message || err.message || t('auth.googleLoginFailed');
        Alert.alert(t('common.error'), msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Image
            source={{uri: 'https://bereketli.pezkiwi.app/logo.png'}}
            style={styles.logoImage}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('auth.emailOrPhone')}</Text>
          <TextInput
            style={styles.input}
            value={identifier}
            onChangeText={text => {
              clearError();
              setIdentifier(text);
            }}
            placeholder={t('auth.emailPlaceholder')}
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>{t('auth.password')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={text => {
              clearError();
              setPassword(text);
            }}
            placeholder={t('auth.passwordPlaceholder')}
            placeholderTextColor={colors.textLight}
            secureTextEntry
            returnKeyType="go"
            onSubmitEditing={handleLogin}
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={isLoading}>
            <Text style={styles.buttonText}>
              {isLoading ? t('auth.loggingIn') : t('auth.login')}
            </Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('common.or')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google Sign-In */}
          <TouchableOpacity
            style={[styles.googleButton, googleLoading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={googleLoading}>
            {googleLoading ? (
              <ActivityIndicator color={colors.textPrimary} />
            ) : (
              <>
                <Svg width={20} height={20} viewBox="0 0 24 24">
                  <Path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <Path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <Path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <Path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </Svg>
                <Text style={styles.googleText}>{t('auth.googleLogin')}</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.navigate('Register')}>
            <Text style={styles.linkText}>
              {t('auth.noAccount')} <Text style={styles.linkBold}>{t('auth.registerLink')}</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {flexGrow: 1, justifyContent: 'center', padding: spacing.xl},
  header: {alignItems: 'center', marginBottom: spacing.xxxl},
  logoImage: {width: 120, height: 140, marginBottom: spacing.md},
  title: {
    ...typography.h1,
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  form: {width: '100%'},
  label: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.lg,
  },
  input: {
    backgroundColor: colors.backgroundWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {
    ...typography.button,
    color: colors.textWhite,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textLight,
    marginHorizontal: spacing.md,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginLeft: 12,
  },
  linkButton: {alignItems: 'center', marginTop: spacing.xl},
  linkText: {...typography.caption, color: colors.textSecondary},
  linkBold: {color: colors.primary, fontWeight: '600'},
  errorBox: {
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  errorText: {color: colors.error, ...typography.caption},
});
