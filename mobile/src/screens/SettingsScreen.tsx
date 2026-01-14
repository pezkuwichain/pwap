import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Alert,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import TermsOfServiceModal from '../components/TermsOfServiceModal';
import PrivacyPolicyModal from '../components/PrivacyPolicyModal';
import EmailNotificationsModal from '../components/EmailNotificationsModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import FontSizeModal from '../components/FontSizeModal';
import { useTheme } from '../contexts/ThemeContext';
import { useBiometricAuth } from '../contexts/BiometricAuthContext';
import { useAuth } from '../contexts/AuthContext';

const SettingsScreen: React.FC = () => {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { isDarkMode, toggleDarkMode, colors, fontSize, setFontSize } = useTheme();
  const { isBiometricAvailable, isBiometricEnabled, enableBiometric, disableBiometric, biometricType } = useBiometricAuth();
  const { changePassword } = useAuth();

  // Settings state
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Modal state
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showEmailPrefs, setShowEmailPrefs] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showFontSize, setShowFontSize] = useState(false);

  // Create styles with current theme colors
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  React.useEffect(() => {
    console.log('[Settings] Screen mounted');
    console.log('[Settings] isDarkMode:', isDarkMode);
    console.log('[Settings] fontSize:', fontSize);
    console.log('[Settings] isBiometricEnabled:', isBiometricEnabled);
    console.log('[Settings] styles:', styles ? 'DEFINED' : 'UNDEFINED');
  }, []);

  const handleBiometryToggle = async (value: boolean) => {
    if (value) {
      // Check if biometric is available
      if (!isBiometricAvailable) {
        Alert.alert(
          t('biometricAuth'),
          'Biometric authentication is not available on this device. Please enroll fingerprint or face ID in your device settings.'
        );
        return;
      }

      // Try to enable biometric directly
      const success = await enableBiometric();
      if (success) {
        Alert.alert(t('settingsScreen.biometricAlerts.successTitle'), t('settingsScreen.biometricAlerts.enabled'));
      } else {
        Alert.alert('Error', 'Failed to enable biometric authentication. Please try again.');
      }
    } else {
      await disableBiometric();
      Alert.alert(t('settingsScreen.biometricAlerts.successTitle'), t('settingsScreen.biometricAlerts.disabled'));
    }
  };

  const SettingItem = ({
    icon,
    title,
    subtitle,
    onPress,
    showArrow = true,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    onPress: () => void;
    showArrow?: boolean;
  }) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={() => {
        console.log(`[Settings] Button pressed: ${title}`);
        onPress();
      }}
    >
      <View style={styles.settingIcon}>
        <Text style={styles.settingIconText}>{icon}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {showArrow && <Text style={styles.arrow}>→</Text>}
    </TouchableOpacity>
  );

  const SettingToggle = ({
    icon,
    title,
    subtitle,
    value,
    onToggle,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    value: boolean;
    onToggle: (value: boolean) => void;
  }) => (
    <View style={styles.settingItem}>
      <View style={styles.settingIcon}>
        <Text style={styles.settingIconText}>{icon}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#E0E0E0', true: KurdistanColors.kesk }}
        thumbColor={value ? KurdistanColors.spi : '#f4f3f4'}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings')}</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>APPEARANCE</Text>

          <SettingToggle
            icon="🌙"
            title={t('darkMode')}
            subtitle={isDarkMode ? t('settingsScreen.subtitles.darkThemeEnabled') : t('settingsScreen.subtitles.lightThemeEnabled')}
            value={isDarkMode}
            onToggle={async () => {
              await toggleDarkMode();
            }}
          />

          <SettingItem
            icon="📏"
            title="Font Size"
            subtitle={`Current: ${fontSize.charAt(0).toUpperCase() + fontSize.slice(1)}`}
            onPress={() => setShowFontSize(true)}
          />
        </View>

        {/* Security Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('security').toUpperCase()}</Text>

          <SettingToggle
            icon="🔐"
            title={t('biometricAuth')}
            subtitle={isBiometricEnabled ? `Enabled (${biometricType})` : t('settingsScreen.subtitles.biometric')}
            value={isBiometricEnabled}
            onToggle={handleBiometryToggle}
          />

          <SettingItem
            icon="🔑"
            title={t('changePassword')}
            subtitle={t('settingsScreen.subtitles.changePassword')}
            onPress={() => setShowChangePassword(true)}
          />
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('notifications').toUpperCase()}</Text>

          <SettingToggle
            icon="🔔"
            title={t('pushNotifications')}
            subtitle={t('settingsScreen.subtitles.notifications')}
            value={notificationsEnabled}
            onToggle={setNotificationsEnabled}
          />

          <SettingItem
            icon="📧"
            title="Email Notifications"
            subtitle="Configure email notification preferences"
            onPress={() => setShowEmailPrefs(true)}
          />
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('about').toUpperCase()}</Text>

          <SettingItem
            icon="ℹ️"
            title={t('about')}
            subtitle={t('appName')}
            onPress={() => Alert.alert(
              t('about'),
              t('appName') + '\n\n' + t('version') + ': 1.0.0',
              [{ text: t('common.confirm') }]
            )}
          />

          <SettingItem
            icon="📄"
            title={t('terms')}
            onPress={() => setShowTerms(true)}
          />

          <SettingItem
            icon="🔒"
            title={t('privacy')}
            onPress={() => setShowPrivacy(true)}
          />

          <SettingItem
            icon="📮"
            title={t('help')}
            subtitle="support@pezkuwichain.io"
            onPress={() => Alert.alert(t('help'), 'support@pezkuwichain.io')}
          />
        </View>

        <View style={styles.versionContainer}>
          <Text style={styles.versionText}>{t('appName')}</Text>
          <Text style={styles.versionNumber}>{t('version')} 1.0.0</Text>
          <Text style={styles.copyright}>© 2026 Digital Kurdistan</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      <TermsOfServiceModal
        visible={showTerms}
        onClose={() => setShowTerms(false)}
      />

      <PrivacyPolicyModal
        visible={showPrivacy}
        onClose={() => setShowPrivacy(false)}
      />

      <EmailNotificationsModal
        visible={showEmailPrefs}
        onClose={() => setShowEmailPrefs(false)}
      />

      <ChangePasswordModal
        visible={showChangePassword}
        onClose={() => setShowChangePassword(false)}
      />

      <FontSizeModal
        visible={showFontSize}
        onClose={() => setShowFontSize(false)}
      />
    </SafeAreaView>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: KurdistanColors.kesk,
    fontWeight: 'bold',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    width: 40,
  },
  section: {
    marginTop: 24,
    backgroundColor: colors.surface,
    borderRadius: 12,
    marginHorizontal: 16,
    padding: 16,
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIconText: {
    fontSize: 20,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  arrow: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  versionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  versionNumber: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  copyright: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default SettingsScreen;
