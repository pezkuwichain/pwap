import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {useAuthStore} from '../../store/authStore';
import {colors, spacing, typography} from '../../theme';

export default function RegisterScreen({navigation}: any) {
  const {t} = useTranslation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const {register, isLoading, error, clearError} = useAuthStore();

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert(t('common.error'), t('auth.registerErrorRequired'));
      return;
    }
    if (password.length < 8) {
      Alert.alert(t('common.error'), t('auth.registerErrorPasswordMin'));
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('auth.registerErrorPasswordMatch'));
      return;
    }

    try {
      await register(name.trim(), email.trim(), password, phone.trim() || undefined, referralCode.trim() || undefined);
    } catch {
      // Error store'da
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.title}>{t('auth.registerTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.registerSubtitle')}</Text>
        </View>

        <View style={styles.form}>
          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Text style={styles.label}>{t('auth.fullName')}</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={txt => { clearError(); setName(txt); }}
            placeholder={t('auth.fullNamePlaceholder')}
            placeholderTextColor={colors.textLight}
          />

          <Text style={styles.label}>{t('auth.email')}</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={txt => { clearError(); setEmail(txt); }}
            placeholder={t('auth.emailOnlyPlaceholder')}
            placeholderTextColor={colors.textLight}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <Text style={styles.label}>{t('auth.phoneOptional')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('auth.phonePlaceholder')}
            placeholderTextColor={colors.textLight}
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={txt => { clearError(); setPassword(txt); }}
            placeholder={t('auth.passwordMinPlaceholder')}
            placeholderTextColor={colors.textLight}
            secureTextEntry
          />

          <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder={t('auth.confirmPasswordPlaceholder')}
            placeholderTextColor={colors.textLight}
            secureTextEntry
          />

          <Text style={styles.label}>{t('auth.referralCodeOptional')}</Text>
          <TextInput
            style={styles.input}
            value={referralCode}
            onChangeText={setReferralCode}
            placeholder={t('auth.referralCodePlaceholder')}
            placeholderTextColor={colors.textLight}
            autoCapitalize="characters"
          />

          <TouchableOpacity
            style={[styles.button, isLoading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={isLoading}>
            <Text style={styles.buttonText}>
              {isLoading ? t('auth.registering') : t('auth.register')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>
              {t('auth.haveAccount')} <Text style={styles.linkBold}>{t('auth.loginLink')}</Text>
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
  header: {alignItems: 'center', marginBottom: spacing.xxl},
  title: {...typography.h1, color: colors.primary},
  subtitle: {...typography.caption, color: colors.textSecondary, marginTop: spacing.xs},
  form: {width: '100%'},
  label: {
    ...typography.captionBold,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
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
  buttonText: {...typography.button, color: colors.textWhite},
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
