import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
  AlertButton,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { KurdistanColors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import AvatarPickerModal from '../components/AvatarPickerModal';

// Cross-platform alert helper
const showAlert = (title: string, message: string, buttons?: AlertButton[]) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
      const result = window.confirm(`${title}\n\n${message}`);
      if (result && buttons[1]?.onPress) {
        buttons[1].onPress();
      } else if (!result && buttons[0]?.onPress) {
        buttons[0].onPress();
      }
    } else {
      window.alert(`${title}\n\n${message}`);
      if (buttons?.[0]?.onPress) buttons[0].onPress();
    }
  } else {
    Alert.alert(title, message, buttons);
  }
};

// Avatar pool matching AvatarPickerModal
const AVATAR_POOL = [
  { id: 'avatar1', emoji: '👨🏻' },
  { id: 'avatar2', emoji: '👨🏼' },
  { id: 'avatar3', emoji: '👨🏽' },
  { id: 'avatar4', emoji: '👨🏾' },
  { id: 'avatar5', emoji: '👩🏻' },
  { id: 'avatar6', emoji: '👩🏼' },
  { id: 'avatar7', emoji: '👩🏽' },
  { id: 'avatar8', emoji: '👩🏾' },
  { id: 'avatar9', emoji: '🧔🏻' },
  { id: 'avatar10', emoji: '🧔🏼' },
  { id: 'avatar11', emoji: '🧔🏽' },
  { id: 'avatar12', emoji: '🧔🏾' },
  { id: 'avatar13', emoji: '👳🏻‍♂️' },
  { id: 'avatar14', emoji: '👳🏼‍♂️' },
  { id: 'avatar15', emoji: '👳🏽‍♂️' },
  { id: 'avatar16', emoji: '🧕🏻' },
  { id: 'avatar17', emoji: '🧕🏼' },
  { id: 'avatar18', emoji: '🧕🏽' },
  { id: 'avatar19', emoji: '👴🏻' },
  { id: 'avatar20', emoji: '👴🏼' },
  { id: 'avatar21', emoji: '👵🏻' },
  { id: 'avatar22', emoji: '👵🏼' },
  { id: 'avatar23', emoji: '👦🏻' },
  { id: 'avatar24', emoji: '👦🏼' },
  { id: 'avatar25', emoji: '👧🏻' },
  { id: 'avatar26', emoji: '👧🏼' },
];

const getEmojiFromAvatarId = (avatarId: string): string => {
  const avatar = AVATAR_POOL.find(a => a.id === avatarId);
  return avatar ? avatar.emoji : '👤';
};

const EditProfileScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { isDarkMode: _isDarkMode, colors, fontScale } = useTheme();

  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [originalName, setOriginalName] = useState('');
  const [originalAvatar, setOriginalAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setFullName(data?.full_name || '');
      setAvatarUrl(data?.avatar_url || null);
      setOriginalName(data?.full_name || '');
      setOriginalAvatar(data?.avatar_url || null);
    } catch (error) {
      if (__DEV__) console.error('Error fetching profile:', error);
      showAlert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = () => {
    return fullName !== originalName || avatarUrl !== originalAvatar;
  };

  const handleSave = async () => {
    if (!user) return;

    if (!hasChanges()) {
      navigation.goBack();
      return;
    }

    setSaving(true);
    try {
      const updates: { full_name?: string | null; avatar_url?: string | null } = {};

      if (fullName !== originalName) {
        updates.full_name = fullName.trim() || null;
      }
      if (avatarUrl !== originalAvatar) {
        updates.avatar_url = avatarUrl;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);

      if (error) throw error;

      showAlert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (error) {
      if (__DEV__) console.error('Error saving profile:', error);
      showAlert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (hasChanges()) {
      showAlert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to go back?',
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.goBack() }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  const handleAvatarSelected = (newAvatarUrl: string) => {
    setAvatarUrl(newAvatarUrl);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="edit-profile-loading">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, fontSize: 14 * fontScale }]}>
            Loading profile...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="edit-profile-screen">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoid}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: colors.border }]} testID="edit-profile-header">
          <TouchableOpacity onPress={handleCancel} testID="edit-profile-cancel-button">
            <Text style={[styles.headerButton, { color: colors.textSecondary, fontSize: 16 * fontScale }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text, fontSize: 18 * fontScale }]}>
            Edit Profile
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving || !hasChanges()}
            testID="edit-profile-save-button"
          >
            {saving ? (
              <ActivityIndicator size="small" color={KurdistanColors.kesk} />
            ) : (
              <Text style={[
                styles.headerButton,
                styles.saveButton,
                { fontSize: 16 * fontScale },
                !hasChanges() && styles.saveButtonDisabled
              ]}>
                Save
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          testID="edit-profile-scroll"
        >
          {/* Avatar Section */}
          <View style={styles.avatarSection} testID="edit-profile-avatar-section">
            <TouchableOpacity
              onPress={() => setAvatarModalVisible(true)}
              style={styles.avatarButton}
              testID="edit-profile-avatar-button"
            >
              <View style={[styles.avatarCircle, { backgroundColor: colors.surface }]}>
                {avatarUrl ? (
                  <Text style={styles.avatarEmoji}>{getEmojiFromAvatarId(avatarUrl)}</Text>
                ) : (
                  <Text style={[styles.avatarInitial, { color: colors.textSecondary }]}>
                    {fullName?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                )}
              </View>
              <View style={styles.editAvatarBadge}>
                <Text style={styles.editAvatarIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={[styles.changePhotoText, { color: KurdistanColors.kesk, fontSize: 14 * fontScale }]}>
              Change Avatar
            </Text>
          </View>

          {/* Form Section */}
          <View style={styles.formSection}>
            {/* Display Name */}
            <View style={styles.inputGroup} testID="edit-profile-name-group">
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: 14 * fontScale }]}>
                Display Name
              </Text>
              <TextInput
                style={[styles.textInput, {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                  fontSize: 16 * fontScale
                }]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your display name"
                placeholderTextColor={colors.textSecondary}
                autoCapitalize="words"
                autoCorrect={false}
                testID="edit-profile-name-input"
              />
              <Text style={[styles.inputHint, { color: colors.textSecondary, fontSize: 12 * fontScale }]}>
                This is how other users will see you
              </Text>
            </View>

            {/* Email (Read-only) */}
            <View style={styles.inputGroup} testID="edit-profile-email-group">
              <Text style={[styles.inputLabel, { color: colors.textSecondary, fontSize: 14 * fontScale }]}>
                Email
              </Text>
              <View style={[styles.readOnlyField, { backgroundColor: colors.background, borderColor: colors.border }]}>
                <Text style={[styles.readOnlyText, { color: colors.textSecondary, fontSize: 16 * fontScale }]}>
                  {user?.email || 'N/A'}
                </Text>
                <Text style={styles.lockIcon}>🔒</Text>
              </View>
              <Text style={[styles.inputHint, { color: colors.textSecondary, fontSize: 12 * fontScale }]}>
                Email cannot be changed
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        visible={avatarModalVisible}
        onClose={() => setAvatarModalVisible(false)}
        currentAvatar={avatarUrl || undefined}
        onAvatarSelected={handleAvatarSelected}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  saveButton: {
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarButton: {
    position: 'relative',
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  avatarEmoji: {
    fontSize: 70,
  },
  avatarInitial: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  editAvatarBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: '#FFFFFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  editAvatarIcon: {
    fontSize: 18,
  },
  changePhotoText: {
    marginTop: 12,
    fontWeight: '500',
  },
  formSection: {
    gap: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
  },
  inputHint: {
    fontSize: 12,
    marginLeft: 4,
  },
  readOnlyField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  readOnlyText: {
    fontSize: 16,
    flex: 1,
  },
  lockIcon: {
    fontSize: 16,
    marginLeft: 8,
  },
});

export default EditProfileScreen;
