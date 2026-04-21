import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, NavigationProp, ParamListBase } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { KurdistanColors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import AvatarPickerModal from '../../components/AvatarPickerModal';
import { logger } from '../../utils/logger';

// Alert button type for cross-platform compatibility
interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

// Cross-platform alert helper
const showAlert = (title: string, message: string, buttons?: AlertButton[]) => {
  if (Platform.OS === 'web') {
    if (buttons && buttons.length > 1) {
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

// Helper function to get emoji from avatar ID
const getEmojiFromAvatarId = (avatarId: string): string => {
  const avatar = AVATAR_POOL.find(a => a.id === avatarId);
  return avatar ? avatar.emoji : '👤'; // Default to person emoji if not found
};

interface ProfileData {
  full_name: string | null;
  avatar_url: string | null;
  wallet_address: string | null;
  created_at: string;
  referral_code: string | null;
  referral_count: number;
}

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp<ParamListBase>>();
  const { user, signOut } = useAuth();
  const { isDarkMode, colors, fontScale } = useTheme();
  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);

  // Refresh profile data when screen is focused (e.g., after EditProfile)
  useFocusEffect(
    useCallback(() => {
      fetchProfileData();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])
  );

  const fetchProfileData = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error} = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfileData(data);
    } catch (error) {
      logger.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    showAlert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  const handleAvatarSelected = (avatarUrl: string) => {
    setProfileData(prev => prev ? { ...prev, avatar_url: avatarUrl } : null);
  };

  const handleEditProfile = () => {
    navigation.navigate('EditProfile');
  };

  const ProfileCard = ({ icon, title, value, onPress, testID }: { icon: string; title: string; value: string; onPress?: () => void; testID?: string }) => (
    <TouchableOpacity
      style={[styles.profileCard, { backgroundColor: colors.surface }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
      testID={testID}
    >
      <Text style={styles.cardIcon}>{icon}</Text>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { fontSize: 12 * fontScale }]}>{title}</Text>
        <Text style={[styles.cardValue, { color: colors.text, fontSize: 16 * fontScale }]} numberOfLines={1}>{value}</Text>
      </View>
      {onPress && <Text style={styles.cardArrow}>→</Text>}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="profile-loading-container">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} testID="profile-loading-indicator" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} testID="profile-screen">
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      <ScrollView showsVerticalScrollIndicator={false} testID="profile-scroll-view" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProfileData().finally(() => setRefreshing(false)); }} />}>
        {/* Header with Gradient */}
        <LinearGradient
          colors={[KurdistanColors.kesk, '#008f43']}
          style={styles.header}
          testID="profile-header-gradient"
        >
          <View style={styles.avatarContainer}>
            <TouchableOpacity onPress={() => setAvatarModalVisible(true)} style={styles.avatarWrapper} testID="profile-avatar-button">
              {profileData?.avatar_url ? (
                // Check if avatar_url is a URL (starts with http) or an emoji ID
                profileData.avatar_url.startsWith('http') ? (
                  <Image source={{ uri: profileData.avatar_url }} style={styles.avatar} testID="profile-avatar-image" />
                ) : (
                  // It's an emoji ID, render as emoji text
                  <View style={styles.avatarPlaceholder} testID="profile-avatar-emoji-container">
                    <Text style={styles.avatarEmojiLarge} testID="profile-avatar-emoji">
                      {getEmojiFromAvatarId(profileData.avatar_url)}
                    </Text>
                  </View>
                )
              ) : (
                <View style={styles.avatarPlaceholder} testID="profile-avatar-placeholder">
                  <Text style={styles.avatarText} testID="profile-avatar-initial">
                    {profileData?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || '?'}
                  </Text>
                </View>
              )}
              <View style={styles.editAvatarButton}>
                <Text style={styles.editAvatarIcon}>📷</Text>
              </View>
            </TouchableOpacity>
            <Text style={[styles.name, { fontSize: 24 * fontScale }]} testID="profile-name">
              {profileData?.full_name || user?.email?.split('@')[0] || 'User'}
            </Text>
            <Text style={[styles.email, { fontSize: 14 * fontScale }]} testID="profile-email">{user?.email}</Text>
          </View>
        </LinearGradient>

        {/* Profile Info Cards */}
        <View style={styles.cardsContainer} testID="profile-cards-container">
          <ProfileCard
            icon="📧"
            title="Email"
            value={user?.email || 'N/A'}
            testID="profile-card-email"
          />

          <ProfileCard
            icon="📅"
            title="Member Since"
            value={profileData?.created_at ? new Date(profileData.created_at).toLocaleDateString() : 'N/A'}
            testID="profile-card-member-since"
          />

          <ProfileCard
            icon="👥"
            title="Referrals"
            value={`${profileData?.referral_count || 0} people`}
            onPress={() => navigation.navigate('Referral')}
            testID="profile-card-referrals"
          />

          {profileData?.referral_code && (
            <ProfileCard
              icon="🎁"
              title="Your Referral Code"
              value={profileData.referral_code}
              testID="profile-card-referral-code"
            />
          )}

          {profileData?.wallet_address && (
            <ProfileCard
              icon="👛"
              title="Wallet Address"
              value={`${profileData.wallet_address.slice(0, 10)}...${profileData.wallet_address.slice(-8)}`}
              testID="profile-card-wallet"
            />
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer} testID="profile-actions-container">
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface }]}
            onPress={handleEditProfile}
            testID="profile-edit-button"
          >
            <Text style={styles.actionIcon}>✏️</Text>
            <Text style={[styles.actionText, { color: colors.text, fontSize: 16 * fontScale }]}>Edit Profile</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: colors.surface }]}
            onPress={() => showAlert(
              'About Pezkuwi',
              'Pezkuwi is a decentralized blockchain platform for Digital Kurdistan.\n\nVersion: 1.0.0\n\n© 2026 Digital Kurdistan',
              [{ text: 'OK' }]
            )}
            testID="profile-about-button"
          >
            <Text style={styles.actionIcon}>ℹ️</Text>
            <Text style={[styles.actionText, { color: colors.text, fontSize: 16 * fontScale }]}>About Pezkuwi</Text>
            <Text style={styles.actionArrow}>→</Text>
          </TouchableOpacity>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
          testID="profile-logout-button"
        >
          <Text style={[styles.logoutButtonText, { fontSize: 16 * fontScale }]}>Logout</Text>
        </TouchableOpacity>

        <View style={styles.footer} testID="profile-footer">
          <Text style={[styles.footerText, { color: colors.textSecondary, fontSize: 12 * fontScale }]}>
            Pezkuwi Blockchain • {new Date().getFullYear()}
          </Text>
          <Text style={[styles.footerVersion, { fontSize: 10 * fontScale }]}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        visible={avatarModalVisible}
        onClose={() => setAvatarModalVisible(false)}
        currentAvatar={profileData?.avatar_url || undefined}
        onAvatarSelected={handleAvatarSelected}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 30,
    alignItems: 'center',
  },
  avatarContainer: {
    alignItems: 'center',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 16,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#FFFFFF',
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  avatarEmojiLarge: {
    fontSize: 60,
  },
  editAvatarButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.2)',
    elevation: 4,
  },
  editAvatarIcon: {
    fontSize: 16,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  cardsContainer: {
    padding: 16,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  cardIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  cardValue: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  cardArrow: {
    fontSize: 20,
    color: '#999',
    marginLeft: 8,
  },
  actionsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: KurdistanColors.reş,
  },
  actionArrow: {
    fontSize: 20,
    color: '#999',
  },
  logoutButton: {
    backgroundColor: KurdistanColors.sor,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    boxShadow: '0px 4px 6px rgba(255, 0, 0, 0.3)',
    elevation: 6,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  footerText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  footerVersion: {
    fontSize: 10,
    color: '#CCC',
  },
});

export default ProfileScreen;
