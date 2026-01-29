import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  StatusBar,
  Alert,
  Switch,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { Clipboard } from 'react-native';
import { useNavigation, NavigationProp } from '@react-navigation/native';
import type { AlertButton } from 'react-native';
import { RootStackParamList } from '../navigation/AppNavigator';
import { KurdistanColors } from '../theme/colors';

// Profile type for Supabase
interface UserProfile {
  id?: string;
  full_name: string;
  username: string;
  bio?: string;
  notifications_push: boolean;
  notifications_email: boolean;
  updated_at?: string;
}
import { useTheme } from '../contexts/ThemeContext';
import { useBiometricAuth } from '../contexts/BiometricAuthContext';
import { useAuth } from '../contexts/AuthContext';
import { usePezkuwi, NETWORKS } from '../contexts/PezkuwiContext';
import { supabase } from '../lib/supabase';

// Cross-platform alert helper
const showAlert = (title: string, message: string, buttons?: AlertButton[]) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      // For confirm dialogs
      const result = window.confirm(`${title}\n\n${message}`);
      if (result && buttons[1]?.onPress) {
        buttons[1].onPress();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

// Font size options
type FontSize = 'small' | 'medium' | 'large';
const FONT_SIZE_OPTIONS: { value: FontSize; label: string; description: string }[] = [
  { value: 'small', label: 'Small', description: '87.5% - Compact text' },
  { value: 'medium', label: 'Medium', description: '100% - Default size' },
  { value: 'large', label: 'Large', description: '112.5% - Easier to read' },
];

// Auto-lock timer options (in minutes)
const AUTO_LOCK_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: '1 minute' },
  { value: 5, label: '5 minutes' },
  { value: 15, label: '15 minutes' },
  { value: 30, label: '30 minutes' },
  { value: 60, label: '1 hour' },
];

// --- COMPONENTS (Internal for simplicity) ---

const SectionHeader = ({ title }: { title: string }) => {
  const { colors, fontScale } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: colors.textSecondary, fontSize: 12 * fontScale }]}>{title}</Text>
    </View>
  );
};

const SettingItem = ({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  textColor,
  testID
}: {
  icon: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  showArrow?: boolean;
  textColor?: string;
  testID?: string;
}) => {
  const { colors, fontScale } = useTheme();
  return (
    <TouchableOpacity
      style={[styles.settingItem, { borderBottomColor: colors.border }]}
      onPress={onPress}
      testID={testID}
    >
      <View style={[styles.settingIcon, { backgroundColor: colors.background }]}>
        <Text style={styles.settingIconText}>{icon}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: textColor || colors.text, fontSize: 16 * fontScale }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary, fontSize: 13 * fontScale }]}>{subtitle}</Text>}
      </View>
      {showArrow && <Text style={[styles.arrow, { color: colors.textSecondary }]}>→</Text>}
    </TouchableOpacity>
  );
};

const SettingToggle = ({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  loading = false,
  testID
}: {
  icon: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  loading?: boolean;
  testID?: string;
}) => {
  const { colors, fontScale } = useTheme();
  return (
    <View style={[styles.settingItem, { borderBottomColor: colors.border }]} testID={testID}>
      <View style={[styles.settingIcon, { backgroundColor: colors.background }]}>
        <Text style={styles.settingIconText}>{icon}</Text>
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: colors.text, fontSize: 16 * fontScale }]}>{title}</Text>
        {subtitle && <Text style={[styles.settingSubtitle, { color: colors.textSecondary, fontSize: 13 * fontScale }]}>{subtitle}</Text>}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={KurdistanColors.kesk} />
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{ false: '#E0E0E0', true: KurdistanColors.kesk }}
          thumbColor={value ? KurdistanColors.spi : '#f4f3f4'}
          testID={testID ? `${testID}-switch` : undefined}
        />
      )}
    </View>
  );
};

// --- MAIN SCREEN ---

const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const { isDarkMode, toggleDarkMode, colors, fontSize, setFontSize } = useTheme();
  const { isBiometricEnabled, enableBiometric, disableBiometric, biometricType, autoLockTimer, setAutoLockTimer } = useBiometricAuth();
  const { signOut, user } = useAuth();
  const { currentNetwork, switchNetwork, selectedAccount } = usePezkuwi();

  // Profile State (Supabase)
  const [profile, setProfile] = useState<UserProfile>({
    full_name: '',
    username: '',
    notifications_push: false,
    notifications_email: true,
  });
  const [_loadingProfile, setLoadingProfile] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Modals
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [showProfileEdit, setShowProfileEdit] = useState(false);
  const [showFontSizeModal, setShowFontSizeModal] = useState(false);
  const [showAutoLockModal, setShowAutoLockModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [backupMnemonic, setBackupMnemonic] = useState('');
  const [editName, setEditName] = useState('');
  const [editBio, setEditBio] = useState('');

  // 1. Fetch Profile from Supabase
  const fetchProfile = useCallback(async () => {
    if (!user) return;
    setLoadingProfile(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setEditName(data.full_name || '');
        setEditBio(data.bio || '');
      }
    } catch (_err) {
      if (__DEV__) console.warn('Error fetching profile:', _err);
    } finally {
      setLoadingProfile(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // 2. Update Settings in Supabase
  const updateSetting = async (key: string, value: boolean) => {
    if (!user) return;
    setSavingSettings(true);

    // Optimistic update
    setProfile((prev) => ({ ...prev, [key]: value }));

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (error) throw error;
    } catch (err) {
      console.error('Failed to update setting:', err);
      // Revert on error
      setProfile((prev) => ({ ...prev, [key]: !value }));
      showAlert('Error', 'Failed to save setting. Please check your connection.');
    } finally {
      setSavingSettings(false);
    }
  };

  // 3. Save Profile Info
  const saveProfileInfo = async () => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          full_name: editName,
          bio: editBio,
          updated_at: new Date().toISOString() 
        })
        .eq('id', user.id);

      if (error) throw error;

      setProfile((prev) => ({ ...prev, full_name: editName, bio: editBio }));
      setShowProfileEdit(false);
      showAlert('Success', 'Profile updated successfully');
    } catch {
      showAlert('Error', 'Failed to update profile');
    }
  };

  // 4. Biometric Handler
  const handleBiometryToggle = async (value: boolean) => {
    // Biometric not available on web
    if (Platform.OS === 'web') {
      showAlert(
        'Not Available',
        'Biometric authentication is only available on mobile devices.'
      );
      return;
    }

    if (value) {
      const success = await enableBiometric();
      if (success) {
        showAlert('Success', 'Biometric authentication enabled');
      }
    } else {
      await disableBiometric();
    }
  };

  // 5. Network Switcher
  const handleNetworkChange = async (network: 'pezkuwi' | 'dicle' | 'zagros' | 'bizinikiwi' | 'zombienet') => {
    await switchNetwork(network);
    setShowNetworkModal(false);

    showAlert(
      'Network Changed',
      `Switched to ${NETWORKS[network].displayName}. The app will reconnect automatically.`,
      [{ text: 'OK' }]
    );
  };

  // 6. Font Size Handler
  const handleFontSizeChange = async (size: FontSize) => {
    await setFontSize(size);
    setShowFontSizeModal(false);
  };

  // 7. Auto-Lock Timer Handler
  const handleAutoLockChange = async (minutes: number) => {
    await setAutoLockTimer(minutes);
    setShowAutoLockModal(false);
  };

  // Get display text for current font size
  const getFontSizeLabel = () => {
    const option = FONT_SIZE_OPTIONS.find(opt => opt.value === fontSize);
    return option ? option.label : 'Medium';
  };

  // Get display text for current auto-lock timer
  const getAutoLockLabel = () => {
    const option = AUTO_LOCK_OPTIONS.find(opt => opt.value === autoLockTimer);
    return option ? option.label : '5 minutes';
  };

  // 8. Wallet Backup Handler - with security confirmation
  const handleWalletBackup = async () => {
    if (!selectedAccount) {
      showAlert('No Wallet', 'Please create or import a wallet first.');
      return;
    }

    // Security warning before showing recovery phrase
    showAlert(
      '⚠️ Security Warning',
      'Your recovery phrase is the only way to restore your wallet. NEVER share it with anyone.\n\n• Anyone with this phrase can steal your funds\n• Pezkuwi will NEVER ask for your phrase\n• Write it down and store it safely\n\nDo you want to continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'I Understand',
          style: 'destructive',
          onPress: async () => {
            // If biometric is enabled, require authentication
            if (isBiometricEnabled && Platform.OS !== 'web') {
              try {
                const result = await LocalAuthentication.authenticateAsync({
                  promptMessage: 'Authenticate to view recovery phrase',
                  cancelLabel: 'Cancel',
                  disableDeviceFallback: false,
                });

                if (!result.success) {
                  showAlert('Authentication Failed', 'Could not verify your identity.');
                  return;
                }
              } catch (error) {
                console.error('Biometric auth error:', error);
                showAlert('Error', 'Authentication failed.');
                return;
              }
            }

            // Retrieve mnemonic from secure storage
            try {
              const seedKey = `pezkuwi_seed_${selectedAccount.address}`;
              let storedMnemonic: string | null = null;

              if (Platform.OS === 'web') {
                storedMnemonic = await AsyncStorage.getItem(seedKey);
              } else {
                storedMnemonic = await SecureStore.getItemAsync(seedKey);
              }

              if (storedMnemonic) {
                setBackupMnemonic(storedMnemonic);
                setShowBackupModal(true);
              } else {
                showAlert('No Backup', 'Recovery phrase not found. It may have been imported from another device.');
              }
            } catch (error) {
              console.error('Error retrieving mnemonic:', error);
              showAlert('Error', 'Failed to retrieve recovery phrase.');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]} testID="settings-screen">
      <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />

      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* ACCOUNT SECTION */}
        <SectionHeader title="ACCOUNT" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingItem
            icon="👤"
            title="Edit Profile"
            subtitle={profile.full_name || user?.email || 'Set your name'}
            onPress={() => setShowProfileEdit(true)}
            testID="edit-profile-button"
          />
          <SettingItem
            icon="👛"
            title="My Wallet"
            subtitle={selectedAccount ? `View balance & transactions` : 'Set up your wallet'}
            onPress={() => selectedAccount ? navigation.navigate('Wallet') : navigation.navigate('WalletSetup')}
            testID="wallet-management-button"
          />
        </View>

        {/* APP SETTINGS */}
        <SectionHeader title="APP SETTINGS" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingToggle
            icon="🌙"
            title="Dark Mode"
            subtitle={isDarkMode ? "Dark theme enabled" : "Light theme enabled"}
            value={isDarkMode}
            onToggle={toggleDarkMode}
            testID="dark-mode"
          />

          <SettingItem
            icon="🔤"
            title="Font Size"
            subtitle={getFontSizeLabel()}
            onPress={() => setShowFontSizeModal(true)}
            testID="font-size-button"
          />

          <SettingToggle
            icon="🔔"
            title="Push Notifications"
            subtitle="Receive alerts about transactions"
            value={profile.notifications_push}
            onToggle={(val) => updateSetting('notifications_push', val)}
            loading={savingSettings}
            testID="push-notifications"
          />

          <SettingToggle
            icon="📧"
            title="Email Updates"
            subtitle="Receive newsletters & reports"
            value={profile.notifications_email}
            onToggle={(val) => updateSetting('notifications_email', val)}
            loading={savingSettings}
            testID="email-updates"
          />
        </View>

        {/* NETWORK & SECURITY */}
        <SectionHeader title="NETWORK & SECURITY" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingItem
            icon="📡"
            title="Network Node"
            subtitle={NETWORKS[currentNetwork]?.displayName || 'Unknown'}
            onPress={() => setShowNetworkModal(true)}
            testID="network-node-button"
          />

          <SettingToggle
            icon="🔐"
            title="Biometric Security"
            subtitle={isBiometricEnabled ? `Enabled (${biometricType})` : "FaceID / Fingerprint"}
            value={isBiometricEnabled}
            onToggle={handleBiometryToggle}
            testID="biometric-security"
          />

          <SettingItem
            icon="⏱️"
            title="Auto-Lock Timer"
            subtitle={getAutoLockLabel()}
            onPress={() => setShowAutoLockModal(true)}
            testID="auto-lock-button"
          />

          <SettingItem
            icon="🔑"
            title="Backup Recovery Phrase"
            subtitle={selectedAccount ? "View your wallet's recovery phrase" : "No wallet connected"}
            onPress={handleWalletBackup}
            testID="backup-recovery-button"
          />
        </View>

        {/* SUPPORT */}
        <SectionHeader title="SUPPORT" />
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <SettingItem
            icon="📄"
            title="Terms of Service"
            onPress={() => setShowTermsModal(true)}
            testID="terms-of-service-button"
          />
          <SettingItem
            icon="🔒"
            title="Privacy Policy"
            onPress={() => setShowPrivacyModal(true)}
            testID="privacy-policy-button"
          />
          <SettingItem
            icon="❓"
            title="Help Center"
            onPress={() => Linking.openURL('mailto:support@pezkuwichain.io')}
            testID="help-center-button"
          />
        </View>

        {/* DEVELOPER OPTIONS (only in DEV) */}
        {__DEV__ && (
          <>
            <SectionHeader title="DEVELOPER" />
            <View style={[styles.section, { backgroundColor: colors.surface }]}>
              <SettingItem
                icon="🔄"
                title="Reset Onboarding"
                subtitle="Show Welcome & Verify screens again"
                textColor="#FF9500"
                showArrow={false}
                onPress={() => {
                  showAlert(
                    'Reset Onboarding',
                    'This will reset onboarding state. Restart the app to see the Welcome screen.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await AsyncStorage.multiRemove([
                              '@pezkuwi/privacy_consent_accepted',
                              '@pezkuwi_human_verified'
                            ]);
                            showAlert('Success', 'Onboarding reset. Restart the app to see changes.');
                          } catch {
                            showAlert('Error', 'Failed to reset onboarding');
                          }
                        }
                      }
                    ]
                  );
                }}
                testID="reset-onboarding-button"
              />
              <SettingItem
                icon="🗑️"
                title="Reset Wallet"
                subtitle="Clear all wallet data"
                textColor="#FF9500"
                showArrow={false}
                onPress={() => {
                  showAlert(
                    'Reset Wallet',
                    'This will delete all wallet data including saved accounts and keys. Are you sure?',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Reset',
                        style: 'destructive',
                        onPress: async () => {
                          try {
                            await AsyncStorage.multiRemove([
                              '@pezkuwi_wallets',
                              '@pezkuwi_selected_account',
                              '@pezkuwi_selected_network'
                            ]);
                            showAlert('Success', 'Wallet data cleared. Restart the app to see changes.');
                          } catch {
                            showAlert('Error', 'Failed to clear wallet data');
                          }
                        }
                      }
                    ]
                  );
                }}
                testID="reset-wallet-button"
              />
            </View>
          </>
        )}

        {/* LOGOUT */}
        <View style={[styles.section, { backgroundColor: colors.surface, marginTop: 20 }]}>
          <SettingItem
            icon="🚪"
            title="Sign Out"
            textColor="#FF3B30"
            showArrow={false}
            onPress={() => {
              showAlert(
                'Sign Out',
                'Are you sure you want to sign out?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Sign Out', style: 'destructive', onPress: signOut }
                ]
              );
            }}
            testID="sign-out-button"
          />
        </View>

        <View style={styles.footer}>
          <Text style={[styles.versionText, { color: colors.textSecondary }]}>Pezkuwi Super App v1.0.0</Text>
          <Text style={[styles.copyright, { color: colors.textSecondary }]}>© 2026 Digital Kurdistan</Text>
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* NETWORK MODAL */}
      <Modal visible={showNetworkModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Network</Text>

            <TouchableOpacity
              style={[styles.networkOption, currentNetwork === 'pezkuwi' && styles.selectedNetwork]}
              onPress={() => handleNetworkChange('pezkuwi')}
              testID="network-option-mainnet"
            >
              <Text style={styles.networkName}>{NETWORKS.pezkuwi.displayName}</Text>
              <Text style={styles.networkUrl}>{NETWORKS.pezkuwi.rpcEndpoint}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.networkOption, currentNetwork === 'bizinikiwi' && styles.selectedNetwork]}
              onPress={() => handleNetworkChange('bizinikiwi')}
              testID="network-option-testnet"
            >
              <Text style={styles.networkName}>{NETWORKS.bizinikiwi.displayName}</Text>
              <Text style={styles.networkUrl}>{NETWORKS.bizinikiwi.rpcEndpoint}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.networkOption, currentNetwork === 'zombienet' && styles.selectedNetwork]}
              onPress={() => handleNetworkChange('zombienet')}
              testID="network-option-zombienet"
            >
              <Text style={styles.networkName}>{NETWORKS.zombienet.displayName}</Text>
              <Text style={styles.networkUrl}>{NETWORKS.zombienet.rpcEndpoint}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowNetworkModal(false)}
              testID="network-modal-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* PROFILE EDIT MODAL */}
      <Modal visible={showProfileEdit} animationType="slide">
        <SafeAreaView style={[styles.fullModal, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.surface }]}>
            <TouchableOpacity onPress={() => setShowProfileEdit(false)}>
              <Text style={{ fontSize: 16, color: colors.text }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Edit Profile</Text>
            <TouchableOpacity onPress={saveProfileInfo}>
              <Text style={{ fontSize: 16, color: KurdistanColors.kesk, fontWeight: 'bold' }}>Save</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 20 }}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Full Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="Enter your name"
              placeholderTextColor="#999"
            />

            <Text style={[styles.label, { color: colors.textSecondary, marginTop: 20 }]}>Bio</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, height: 100 }]}
              value={editBio}
              onChangeText={setEditBio}
              placeholder="Tell us about yourself"
              placeholderTextColor="#999"
              multiline
            />
          </View>
        </SafeAreaView>
      </Modal>

      {/* FONT SIZE MODAL */}
      <Modal visible={showFontSizeModal} transparent animationType="fade" testID="font-size-modal">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Select Font Size</Text>

            {FONT_SIZE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.networkOption, fontSize === option.value && styles.selectedNetwork]}
                onPress={() => handleFontSizeChange(option.value)}
                testID={`font-size-option-${option.value}`}
              >
                <Text style={styles.networkName}>{option.label}</Text>
                <Text style={styles.networkUrl}>{option.description}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowFontSizeModal(false)}
              testID="font-size-modal-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* AUTO-LOCK TIMER MODAL */}
      <Modal visible={showAutoLockModal} transparent animationType="fade" testID="auto-lock-modal">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Auto-Lock Timer</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Lock app after inactivity
            </Text>

            {AUTO_LOCK_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[styles.networkOption, autoLockTimer === option.value && styles.selectedNetwork]}
                onPress={() => handleAutoLockChange(option.value)}
                testID={`auto-lock-option-${option.value}`}
              >
                <Text style={styles.networkName}>{option.label}</Text>
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowAutoLockModal(false)}
              testID="auto-lock-modal-cancel"
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* WALLET BACKUP MODAL */}
      <Modal visible={showBackupModal} transparent animationType="fade" testID="backup-modal">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>🔐 Recovery Phrase</Text>
            <Text style={[styles.warningText, { color: '#EF4444' }]}>
              ⚠️ NEVER share this with anyone! Write it down and store safely.
            </Text>

            <View style={styles.mnemonicContainer}>
              <Text style={[styles.mnemonicText, { color: colors.text }]}>{backupMnemonic}</Text>
            </View>

            <View style={styles.backupActions}>
              <TouchableOpacity
                style={styles.copyButton}
                onPress={() => {
                  Clipboard.setString(backupMnemonic);
                  showAlert('Copied', 'Recovery phrase copied to clipboard');
                }}
              >
                <Text style={styles.copyButtonText}>📋 Copy</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.confirmButton, { backgroundColor: KurdistanColors.kesk }]}
              onPress={() => {
                setShowBackupModal(false);
                setBackupMnemonic('');
              }}
            >
              <Text style={styles.confirmButtonText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* TERMS OF SERVICE MODAL */}
      <Modal visible={showTermsModal} animationType="slide" testID="terms-modal">
        <SafeAreaView style={[styles.fullModal, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={{ width: 60 }} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Terms of Service</Text>
            <TouchableOpacity onPress={() => setShowTermsModal(false)}>
              <Text style={{ fontSize: 16, color: KurdistanColors.kesk, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <Text style={[styles.legalTitle, { color: colors.text }]}>Pezkuwi Terms of Service</Text>
            <Text style={[styles.legalDate, { color: colors.textSecondary }]}>Effective Date: {new Date().getFullYear()}</Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>1. Acceptance of Terms</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              By accessing or using the Pezkuwi application (&quot;App&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the App.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>2. Description of Service</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              Pezkuwi is a decentralized application that provides access to the Digital Kurdistan blockchain network. The App enables users to:{'\n'}
              • Create and manage blockchain wallets{'\n'}
              • Send and receive PEZ and HEZ tokens{'\n'}
              • Participate in governance and voting{'\n'}
              • Access decentralized services within the ecosystem
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>3. User Responsibilities</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              You are solely responsible for:{'\n'}
              • Maintaining the security of your wallet and recovery phrase{'\n'}
              • All activities conducted through your account{'\n'}
              • Ensuring compliance with local laws and regulations{'\n'}
              • Any transactions you authorize on the blockchain
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>4. Wallet Security</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              Your wallet is secured by a recovery phrase (seed phrase). This phrase is the ONLY way to restore access to your wallet. Pezkuwi does not store your recovery phrase and cannot recover it if lost. You must:{'\n'}
              • Never share your recovery phrase with anyone{'\n'}
              • Store your recovery phrase securely offline{'\n'}
              • Understand that lost phrases cannot be recovered
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>5. Disclaimer of Warranties</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              The App is provided &quot;as is&quot; without warranties of any kind. We do not guarantee uninterrupted access, error-free operation, or specific outcomes from using the App.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>6. Limitation of Liability</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              Pezkuwi and its affiliates shall not be liable for any direct, indirect, incidental, consequential, or punitive damages arising from your use of the App, including but not limited to loss of funds or data.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>7. Modifications</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              We reserve the right to modify these Terms at any time. Continued use of the App after changes constitutes acceptance of the modified Terms.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>8. Contact</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              For questions about these Terms, contact us at:{'\n'}
              support@pezkuwichain.io
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* PRIVACY POLICY MODAL */}
      <Modal visible={showPrivacyModal} animationType="slide" testID="privacy-modal">
        <SafeAreaView style={[styles.fullModal, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <View style={{ width: 60 }} />
            <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Policy</Text>
            <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
              <Text style={{ fontSize: 16, color: KurdistanColors.kesk, fontWeight: '600' }}>Done</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 20 }}>
            <Text style={[styles.legalTitle, { color: colors.text }]}>Pezkuwi Privacy Policy</Text>
            <Text style={[styles.legalDate, { color: colors.textSecondary }]}>Effective Date: {new Date().getFullYear()}</Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>1. Introduction</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              Pezkuwi (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, and safeguard your information when you use our application.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>2. Information We Collect</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              <Text style={{ fontWeight: '600' }}>Account Information:</Text> Email address (if provided for authentication), username, and profile information you choose to provide.{'\n\n'}
              <Text style={{ fontWeight: '600' }}>Blockchain Data:</Text> Your public wallet address and transaction history (which is publicly visible on the blockchain).{'\n\n'}
              <Text style={{ fontWeight: '600' }}>Device Information:</Text> Device type, operating system, and app version for troubleshooting and improvement purposes.{'\n\n'}
              <Text style={{ fontWeight: '600' }}>We DO NOT collect:</Text> Your recovery phrase, private keys, or biometric data (stored only on your device).
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>3. How We Use Information</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              We use collected information to:{'\n'}
              • Provide and maintain our services{'\n'}
              • Process your transactions on the blockchain{'\n'}
              • Send important notifications about your account{'\n'}
              • Improve our application and user experience{'\n'}
              • Comply with legal obligations
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>4. Data Storage and Security</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              • Your recovery phrase and private keys are stored ONLY on your device using secure storage mechanisms{'\n'}
              • We employ industry-standard security measures to protect your data{'\n'}
              • Blockchain transactions are permanently recorded on the public ledger
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>5. Data Sharing</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              We do not sell your personal information. We may share data with:{'\n'}
              • Service providers who assist in operating our services{'\n'}
              • Legal authorities when required by law{'\n'}
              • Blockchain networks for transaction processing (public data)
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>6. Your Rights</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              You have the right to:{'\n'}
              • Access your personal data{'\n'}
              • Request correction of inaccurate data{'\n'}
              • Request deletion of your account{'\n'}
              • Opt-out of non-essential communications{'\n\n'}
              Note: Blockchain data cannot be deleted due to its immutable nature.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>7. Children&apos;s Privacy</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              Our services are not intended for users under 18 years of age. We do not knowingly collect information from children.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>8. Updates to Policy</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              We may update this Privacy Policy periodically. We will notify you of significant changes through the App or via email.
            </Text>

            <Text style={[styles.legalSectionTitle, { color: colors.text }]}>9. Contact Us</Text>
            <Text style={[styles.legalText, { color: colors.textSecondary }]}>
              For privacy-related inquiries:{'\n'}
              Email: privacy@pezkuwichain.io{'\n'}
              Support: support@pezkuwichain.io
            </Text>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  },
  sectionHeader: {
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  section: {
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  settingIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingIconText: {
    fontSize: 18,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  arrow: {
    fontSize: 18,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
  },
  versionText: {
    fontSize: 13,
    fontWeight: '600',
  },
  copyright: {
    fontSize: 11,
    marginTop: 4,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: -12,
    marginBottom: 16,
  },
  networkOption: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#eee',
  },
  selectedNetwork: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: '#e8f5e9',
  },
  networkName: {
    fontWeight: 'bold',
    fontSize: 16,
    color: '#333',
  },
  networkUrl: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  cancelButton: {
    marginTop: 10,
    padding: 16,
    alignItems: 'center',
  },
  cancelText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 16,
  },
  fullModal: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  // Backup Modal Styles
  warningText: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 16,
    fontWeight: '600',
  },
  mnemonicContainer: {
    backgroundColor: '#FEF9E7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F5D76E',
  },
  mnemonicText: {
    fontSize: 14,
    lineHeight: 24,
    textAlign: 'center',
  },
  backupActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 16,
  },
  copyButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  copyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Legal Modal Styles
  legalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  legalDate: {
    fontSize: 13,
    marginBottom: 24,
  },
  legalSectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  legalText: {
    fontSize: 14,
    lineHeight: 22,
  },
});

export default SettingsScreen;