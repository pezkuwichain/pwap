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
import {colors, spacing, typography, borderRadius} from '../../theme';
import {changePassword} from '../../api/profile';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type RootStackParamList = {
  ChangePassword: undefined;
};

type Props = NativeStackScreenProps<RootStackParamList, 'ChangePassword'>;

export default function ChangePasswordScreen({navigation}: Props) {
  const {t} = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert(t('common.error'), t('changePassword.allFieldsRequired'));
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert(t('common.error'), t('changePassword.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert(t('common.error'), t('changePassword.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      Alert.alert(t('changePassword.successTitle'), t('changePassword.success'), [
        {text: t('common.ok'), onPress: () => navigation.goBack()},
      ]);
    } catch {
      Alert.alert(t('common.error'), t('changePassword.failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'} {t('common.back')}</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{t('changePassword.title')}</Text>
        <Text style={styles.subtitle}>
          {t('changePassword.subtitle')}
        </Text>

        <View style={styles.form}>
          <Text style={styles.label}>Mevcut Sifre</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            placeholder="Mevcut sifreniz"
            placeholderTextColor={colors.textLight}
            secureTextEntry
          />

          <Text style={styles.label}>Yeni Sifre</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="En az 8 karakter"
            placeholderTextColor={colors.textLight}
            secureTextEntry
          />

          <Text style={styles.label}>Yeni Sifre Tekrar</Text>
          <TextInput
            style={styles.input}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Yeni sifrenizi tekrarlayin"
            placeholderTextColor={colors.textLight}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? t('changePassword.changing') : t('changePassword.change')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {flexGrow: 1, padding: spacing.xl},
  backButton: {
    paddingTop: 40,
    paddingBottom: spacing.lg,
  },
  backText: {...typography.body, color: colors.primary},
  title: {...typography.h2, color: colors.textPrimary, marginBottom: spacing.xs},
  subtitle: {...typography.caption, color: colors.textSecondary, marginBottom: spacing.xxl},
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
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    marginTop: spacing.xxl,
  },
  buttonDisabled: {opacity: 0.6},
  buttonText: {...typography.button, color: colors.textWhite},
});
