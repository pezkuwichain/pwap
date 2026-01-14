import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KurdistanColors } from '../theme/colors';
import { useTheme } from '../contexts/ThemeContext';

const EMAIL_PREFS_KEY = '@pezkuwi/email_notifications';

interface EmailPreferences {
  transactions: boolean;
  governance: boolean;
  security: boolean;
  marketing: boolean;
}

interface EmailNotificationsModalProps {
  visible: boolean;
  onClose: () => void;
}

const EmailNotificationsModal: React.FC<EmailNotificationsModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors } = useTheme();
  const [preferences, setPreferences] = useState<EmailPreferences>({
    transactions: true,
    governance: true,
    security: true,
    marketing: false,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [visible]);

  const loadPreferences = async () => {
    try {
      const saved = await AsyncStorage.getItem(EMAIL_PREFS_KEY);
      if (saved) {
        setPreferences(JSON.parse(saved));
      }
    } catch (error) {
      console.error('Failed to load email preferences:', error);
    }
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await AsyncStorage.setItem(EMAIL_PREFS_KEY, JSON.stringify(preferences));
      console.log('[EmailPrefs] Preferences saved:', preferences);
      setTimeout(() => {
        setSaving(false);
        onClose();
      }, 500);
    } catch (error) {
      console.error('Failed to save email preferences:', error);
      setSaving(false);
    }
  };

  const updatePreference = (key: keyof EmailPreferences, value: boolean) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
  };

  const styles = createStyles(colors);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Email Notifications</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.description}>
              Choose which email notifications you want to receive. All emails are sent
              securely and you can unsubscribe at any time.
            </Text>

            {/* Transaction Updates */}
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceIcon}>
                <Text style={styles.preferenceIconText}>💸</Text>
              </View>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Transaction Updates</Text>
                <Text style={styles.preferenceSubtitle}>
                  Get notified when you send or receive tokens
                </Text>
              </View>
              <Switch
                value={preferences.transactions}
                onValueChange={(value) => updatePreference('transactions', value)}
                trackColor={{ false: colors.border, true: KurdistanColors.kesk }}
                thumbColor={preferences.transactions ? KurdistanColors.spi : '#f4f3f4'}
              />
            </View>

            {/* Governance Alerts */}
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceIcon}>
                <Text style={styles.preferenceIconText}>🗳️</Text>
              </View>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Governance Alerts</Text>
                <Text style={styles.preferenceSubtitle}>
                  Voting deadlines, proposal updates, election reminders
                </Text>
              </View>
              <Switch
                value={preferences.governance}
                onValueChange={(value) => updatePreference('governance', value)}
                trackColor={{ false: colors.border, true: KurdistanColors.kesk }}
                thumbColor={preferences.governance ? KurdistanColors.spi : '#f4f3f4'}
              />
            </View>

            {/* Security Alerts */}
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceIcon}>
                <Text style={styles.preferenceIconText}>🔒</Text>
              </View>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Security Alerts</Text>
                <Text style={styles.preferenceSubtitle}>
                  Login attempts, password changes, suspicious activity
                </Text>
              </View>
              <Switch
                value={preferences.security}
                onValueChange={(value) => updatePreference('security', value)}
                trackColor={{ false: colors.border, true: KurdistanColors.kesk }}
                thumbColor={preferences.security ? KurdistanColors.spi : '#f4f3f4'}
              />
            </View>

            {/* Marketing Emails */}
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceIcon}>
                <Text style={styles.preferenceIconText}>📢</Text>
              </View>
              <View style={styles.preferenceContent}>
                <Text style={styles.preferenceTitle}>Marketing & Updates</Text>
                <Text style={styles.preferenceSubtitle}>
                  Product updates, feature announcements, newsletters
                </Text>
              </View>
              <Switch
                value={preferences.marketing}
                onValueChange={(value) => updatePreference('marketing', value)}
                trackColor={{ false: colors.border, true: KurdistanColors.kesk }}
                thumbColor={preferences.marketing ? KurdistanColors.spi : '#f4f3f4'}
              />
            </View>

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={savePreferences}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Saving...' : 'Save Preferences'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '90%',
    maxHeight: '80%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  preferenceIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  preferenceIconText: {
    fontSize: 22,
  },
  preferenceContent: {
    flex: 1,
    marginRight: 12,
  },
  preferenceTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  preferenceSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.spi,
  },
});

export default EmailNotificationsModal;
