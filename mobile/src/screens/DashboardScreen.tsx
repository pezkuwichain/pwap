import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Image,
  Alert,
  Dimensions,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import type { NavigationProp } from '@react-navigation/native';
import type { BottomTabParamList } from '../navigation/BottomTabNavigator';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { KurdistanColors } from '../theme/colors';
import { useAuth } from '../contexts/AuthContext';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { supabase } from '../lib/supabase';
import AvatarPickerModal from '../components/AvatarPickerModal';
import { NotificationCenterModal } from '../components/NotificationCenterModal';
import { fetchUserTikis, getPrimaryRole, getTikiDisplayName, getTikiEmoji, getTikiColor } from '../../shared/lib/tiki';
import { getAllScores, type UserScores } from '../../shared/lib/scores';
import { getKycStatus } from '../../shared/lib/kyc';

// Existing Quick Action Images (Reused)
import qaEducation from '../../../shared/images/quick-actions/qa_education.png';
import qaExchange from '../../../shared/images/quick-actions/qa_exchange.png';
import qaForum from '../../../shared/images/quick-actions/qa_forum.jpg';
import qaGovernance from '../../../shared/images/quick-actions/qa_governance.jpg';
import qaTrading from '../../../shared/images/quick-actions/qa_trading.jpg';
import qaB2B from '../../../shared/images/quick-actions/qa_b2b.png';
import qaBank from '../../../shared/images/quick-actions/qa_bank.png';
import qaGames from '../../../shared/images/quick-actions/qa_games.png';
import qaKurdMedia from '../../../shared/images/quick-actions/qa_kurdmedia.jpg';
import qaUniversity from '../../../shared/images/quick-actions/qa_university.png';
import avatarPlaceholder from '../../../shared/images/app-image.png'; // Fallback avatar

const { width } = Dimensions.get('window');

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

interface DashboardScreenProps {}

const DashboardScreen: React.FC<DashboardScreenProps> = () => {
  const navigation = useNavigation<NavigationProp<BottomTabParamList & RootStackParamList>>();
  const { user } = useAuth();
  const { api, isApiReady, selectedAccount } = usePezkuwi();
  const [profileData, setProfileData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);

  // Blockchain state
  const [tikis, setTikis] = useState<string[]>([]);
  const [scores, setScores] = useState<UserScores>({
    trustScore: 0,
    referralScore: 0,
    stakingScore: 0,
    tikiScore: 0,
    totalScore: 0
  });
  const [kycStatus, setKycStatus] = useState<string>('NotStarted');
  const [loadingScores, setLoadingScores] = useState(false);

  // Fetch profile data from Supabase
  const fetchProfile = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        if (__DEV__) console.warn('Profile fetch error:', error);
        return;
      }

      setProfileData(data);
    } catch (error) {
      if (__DEV__) console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch blockchain data (tikis, scores, KYC)
  const fetchBlockchainData = useCallback(async () => {
    if (!selectedAccount || !api || !isApiReady) return;

    setLoadingScores(true);
    try {
      // Fetch tikis
      const userTikis = await fetchUserTikis(api, selectedAccount.address);
      setTikis(userTikis);

      // Fetch all scores
      const allScores = await getAllScores(api, selectedAccount.address);
      setScores(allScores);

      // Fetch KYC status
      const status = await getKycStatus(api, selectedAccount.address);
      setKycStatus(status);

      if (__DEV__) console.log('[Dashboard] Blockchain data fetched:', { tikis: userTikis, scores: allScores, kycStatus: status });
    } catch (error) {
      if (__DEV__) console.error('[Dashboard] Error fetching blockchain data:', error);
    } finally {
      setLoadingScores(false);
    }
  }, [selectedAccount, api, isApiReady]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    if (selectedAccount && api && isApiReady) {
      fetchBlockchainData();
    }
  }, [fetchBlockchainData]);

  // Check if user is a visitor (default when no blockchain wallet or no tikis)
  const isVisitor = !selectedAccount || tikis.length === 0;
  const primaryRole = tikis.length > 0 ? getPrimaryRole(tikis) : 'Visitor';

  const showComingSoon = (featureName: string) => {
    Alert.alert(
      'Coming Soon',
      `${featureName} will be available soon!`,
      [{ text: 'OK' }]
    );
  };

  const showAwaitingGovernment = () => {
    Alert.alert(
      'Li benda damezrandinê / Awaiting Establishment',
      'Duaye helbejartina hukumeta Komara Dijitaliya Kurdistanê yên beta damezrandin.\n\nAwaiting the beta elections and establishment of the Digital Kurdistan Republic government.',
      [{ text: 'Temam / OK' }]
    );
  };

  const showUnderMaintenance = () => {
    Alert.alert(
      'Di bin çêkirinê de ye / Under Maintenance',
      'Ev taybetmendî niha di bin çêkirinê de ye. Ji kerema xwe paşê vegerin.\n\nThis feature is currently under maintenance. Please check back later.',
      [{ text: 'Temam / OK' }]
    );
  };

  const showAwaitingSerokElection = () => {
    Alert.alert(
      'Li benda hilbijartinên çalak / Awaiting Active Elections',
      'Duaye hilbijartinên Serokî yên çalak bibin.\n\nAwaiting active Presidential elections to be initiated.',
      [{ text: 'Temam / OK' }]
    );
  };

  const showAwaitingMinistryOfEducation = () => {
    Alert.alert(
      'Li benda Wezareta Perwerdê / Awaiting Ministry of Education',
      'Duaye damezrandina Wezareta Perwerdê yên aktîv bibin.\n\nAwaiting the establishment of an active Ministry of Education.',
      [{ text: 'Temam / OK' }]
    );
  };

  const handleAvatarClick = () => {
    setAvatarModalVisible(true);
  };

  const handleAvatarSelected = (avatarUrl: string) => {
    // Refresh profile data to show new avatar
    setProfileData((prev: any) => ({
      ...prev,
      avatar_url: avatarUrl,
    }));
  };

  const renderAppIcon = (title: string, icon: any, onPress: () => void, isEmoji = false, comingSoon = false) => (
    <TouchableOpacity 
      style={styles.appIconContainer} 
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.appIconBox, comingSoon && styles.appIconDisabled]}>
        {isEmoji ? (
          <Text style={styles.emojiIcon}>{icon}</Text>
        ) : (
          <Image source={icon} style={styles.imageIcon} resizeMode="cover" />
        )}
        {comingSoon && (
          <View style={styles.lockBadge}>
            <Text style={styles.lockText}>🔒</Text>
          </View>
        )}
      </View>
      <Text style={styles.appIconTitle} numberOfLines={1}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={KurdistanColors.kesk} />
      
      {/* HEADER SECTION */}
      <LinearGradient
        colors={[KurdistanColors.kesk, '#008f43']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={handleAvatarClick}>
              {profileData?.avatar_url ? (
                // Check if avatar_url is a URL (starts with http) or an emoji ID
                profileData.avatar_url.startsWith('http') ? (
                  <Image
                    source={{ uri: profileData.avatar_url }}
                    style={styles.avatar}
                  />
                ) : (
                  // It's an emoji ID, render as emoji text
                  <View style={styles.avatar}>
                    <Text style={styles.avatarEmoji}>
                      {getEmojiFromAvatarId(profileData.avatar_url)}
                    </Text>
                  </View>
                )
              ) : (
                <Image
                  source={avatarPlaceholder}
                  style={styles.avatar}
                />
              )}
              {/* Online Status Indicator */}
              <View style={styles.statusIndicator} />
            </TouchableOpacity>

            {/* Tiki Badge next to avatar - shows primary role */}
            <View style={styles.tikiAvatarBadge}>
              <Text style={styles.tikiAvatarText}>
                {getTikiEmoji(primaryRole)} {getTikiDisplayName(primaryRole)}
              </Text>
            </View>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>
              Rojbaş, {profileData?.full_name || user?.email?.split('@')[0] || 'Heval'}
            </Text>
            <View style={styles.tikiContainer}>
              {tikis.map((tiki, index) => (
                <View key={index} style={styles.tikiBadge}>
                  <Text style={styles.tikiText}>✓ {tiki}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.iconButton} onPress={() => setNotificationModalVisible(true)}>
              <Text style={styles.headerIcon}>🔔</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconButton} onPress={() => navigation.navigate('Settings')}>
              <Text style={styles.headerIcon}>⚙️</Text>
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        style={styles.scrollView}
      >
        {/* SCORE CARDS SECTION */}
        <View style={styles.scoreCardsContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.scoreCardsContent}
          >
            {/* Member Since Card */}
            <View style={[styles.scoreCard, { borderLeftColor: KurdistanColors.kesk }]}>
              <Text style={styles.scoreCardIcon}>📅</Text>
              <Text style={styles.scoreCardLabel}>Member Since</Text>
              <Text style={styles.scoreCardValue}>
                {profileData?.created_at
                  ? new Date(profileData.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                  : user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    : 'N/A'
                }
              </Text>
            </View>

            {/* Role Card */}
            <View style={[styles.scoreCard, { borderLeftColor: '#FF9800' }]}>
              <Text style={styles.scoreCardIcon}>{getTikiEmoji(primaryRole)}</Text>
              <Text style={styles.scoreCardLabel}>Role</Text>
              <Text style={styles.scoreCardValue}>{getTikiDisplayName(primaryRole)}</Text>
              <Text style={styles.scoreCardSubtext}>
                {selectedAccount ? `${tikis.length} ${tikis.length === 1 ? 'role' : 'roles'}` : 'Connect wallet'}
              </Text>
            </View>

            {/* Total Score Card */}
            <View style={[styles.scoreCard, { borderLeftColor: '#9C27B0' }]}>
              <Text style={styles.scoreCardIcon}>🏆</Text>
              <Text style={styles.scoreCardLabel}>Total Score</Text>
              {loadingScores ? (
                <ActivityIndicator size="small" color="#9C27B0" />
              ) : (
                <>
                  <Text style={[styles.scoreCardValue, { color: '#9C27B0' }]}>
                    {scores.totalScore}
                  </Text>
                  <Text style={styles.scoreCardSubtext}>All score types</Text>
                </>
              )}
            </View>

            {/* Trust Score Card */}
            <View style={[styles.scoreCard, { borderLeftColor: '#9C27B0' }]}>
              <Text style={styles.scoreCardIcon}>🛡️</Text>
              <Text style={styles.scoreCardLabel}>Trust Score</Text>
              {loadingScores ? (
                <ActivityIndicator size="small" color="#9C27B0" />
              ) : (
                <>
                  <Text style={[styles.scoreCardValue, { color: '#9C27B0' }]}>
                    {scores.trustScore}
                  </Text>
                  <Text style={styles.scoreCardSubtext}>pezpallet_trust</Text>
                </>
              )}
            </View>

            {/* Referral Score Card */}
            <View style={[styles.scoreCard, { borderLeftColor: '#00BCD4' }]}>
              <Text style={styles.scoreCardIcon}>👥</Text>
              <Text style={styles.scoreCardLabel}>Referral Score</Text>
              {loadingScores ? (
                <ActivityIndicator size="small" color="#00BCD4" />
              ) : (
                <>
                  <Text style={[styles.scoreCardValue, { color: '#00BCD4' }]}>
                    {scores.referralScore}
                  </Text>
                  <Text style={styles.scoreCardSubtext}>Referrals</Text>
                </>
              )}
            </View>

            {/* Staking Score Card */}
            <View style={[styles.scoreCard, { borderLeftColor: '#4CAF50' }]}>
              <Text style={styles.scoreCardIcon}>📈</Text>
              <Text style={styles.scoreCardLabel}>Staking Score</Text>
              {loadingScores ? (
                <ActivityIndicator size="small" color="#4CAF50" />
              ) : (
                <>
                  <Text style={[styles.scoreCardValue, { color: '#4CAF50' }]}>
                    {scores.stakingScore}
                  </Text>
                  <Text style={styles.scoreCardSubtext}>pezpallet_staking</Text>
                </>
              )}
            </View>

            {/* Tiki Score Card */}
            <View style={[styles.scoreCard, { borderLeftColor: '#E91E63' }]}>
              <Text style={styles.scoreCardIcon}>⭐</Text>
              <Text style={styles.scoreCardLabel}>Tiki Score</Text>
              {loadingScores ? (
                <ActivityIndicator size="small" color="#E91E63" />
              ) : (
                <>
                  <Text style={[styles.scoreCardValue, { color: '#E91E63' }]}>
                    {scores.tikiScore}
                  </Text>
                  <Text style={styles.scoreCardSubtext}>
                    {tikis.length} {tikis.length === 1 ? 'role' : 'roles'}
                  </Text>
                </>
              )}
            </View>

            {/* KYC Status Card */}
            <View style={[styles.scoreCard, { borderLeftColor: kycStatus === 'Approved' ? '#4CAF50' : '#FFC107' }]}>
              <Text style={styles.scoreCardIcon}>
                {kycStatus === 'Approved' ? '✅' : kycStatus === 'Pending' ? '⏳' : '📝'}
              </Text>
              <Text style={styles.scoreCardLabel}>KYC Status</Text>
              <Text style={[styles.scoreCardValue, {
                color: kycStatus === 'Approved' ? '#4CAF50' : kycStatus === 'Pending' ? '#FFC107' : '#999',
                fontSize: 14
              }]}>
                {kycStatus}
              </Text>
              {kycStatus === 'NotStarted' && (
                <TouchableOpacity
                  style={styles.kycButton}
                  onPress={() => navigation.navigate('BeCitizen')}
                >
                  <Text style={styles.kycButtonText}>Apply</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        </View>

        {/* 1. FINANCE SECTION */}
        <View style={styles.sectionContainer}>
          <View style={[styles.sectionHeader, { borderLeftColor: KurdistanColors.kesk }]}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>FINANCE 💰</Text>
              {/* Connect Wallet Button */}
              {!selectedAccount && (
                <TouchableOpacity
                  style={styles.connectWalletBadge}
                  onPress={() => navigation.navigate('Wallet')}
                >
                  <Text style={styles.connectWalletIcon}>👛</Text>
                  <Text style={styles.connectWalletText}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('Apps')}>
              <Text style={styles.seeAllText}>Hemû / All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.appsGrid}>
            {/* Wallet - Navigate to WalletScreen */}
            {renderAppIcon('Wallet', '👛', () => navigation.navigate('Wallet'), true)}

            {renderAppIcon('Bank', qaBank, () => navigation.navigate('Bank'), false, true)}
            {renderAppIcon('Exchange', qaExchange, () => navigation.navigate('Swap'), false)}
            {renderAppIcon('P2P', qaTrading, () => navigation.navigate('P2P'), false)}
            {renderAppIcon('B2B', qaB2B, () => navigation.navigate('B2B'), false, true)}
            {renderAppIcon('Bac/Zekat', '📊', () => navigation.navigate('TaxZekat'), true)}
            {renderAppIcon('Launchpad', '🚀', () => navigation.navigate('Launchpad'), true, true)}
          </View>
        </View>

        {/* 2. GOVERNANCE SECTION */}
        <View style={styles.sectionContainer}>
          <View style={[styles.sectionHeader, { borderLeftColor: KurdistanColors.sor }]}>
            <Text style={styles.sectionTitle}>GOVERNANCE 🏛️</Text>
          </View>
          <View style={styles.appsGrid}>
            {renderAppIcon('President', '👑', () => navigation.navigate('President'), true)}
            {renderAppIcon('Assembly', qaGovernance, () => navigation.navigate('Assembly'), false, true)}
            {renderAppIcon('Vote', '🗳️', () => navigation.navigate('Vote'), true)}
            {renderAppIcon('Validators', '🛡️', () => navigation.navigate('Validators'), true)}
            {renderAppIcon('Justice', '⚖️', () => navigation.navigate('Justice'), true, true)}
            {renderAppIcon('Proposals', '📜', () => navigation.navigate('Proposals'), true)}
            {renderAppIcon('Polls', '📊', () => navigation.navigate('Polls'), true, true)}
            {renderAppIcon('Identity', '🆔', () => navigation.navigate('Identity'), true)}
          </View>
        </View>

        {/* 3. SOCIAL SECTION */}
        <View style={styles.sectionContainer}>
          <View style={[styles.sectionHeader, { borderLeftColor: '#2196F3' }]}>
            <Text style={styles.sectionTitle}>SOCIAL 💬</Text>
          </View>
          <View style={styles.appsGrid}>
            {renderAppIcon('whatsKURD', '💬', () => navigation.navigate('WhatsKURD'), true, true)}
            {renderAppIcon('Forum', qaForum, () => navigation.navigate('Forum'), false)}
            {renderAppIcon('KurdMedia', qaKurdMedia, () => navigation.navigate('KurdMedia'), false)}
            {renderAppIcon('Events', '🎭', () => navigation.navigate('Events'), true, true)}
            {renderAppIcon('Help', '🤝', () => navigation.navigate('Help'), true, true)}
            {renderAppIcon('Music', '🎵', () => navigation.navigate('Music'), true, true)}
            {renderAppIcon('VPN', '🛡️', () => navigation.navigate('VPN'), true, true)}
            {renderAppIcon('Referral', '👥', () => navigation.navigate('Referral'), true)}
          </View>
        </View>

        {/* 4. EDUCATION SECTION */}
        <View style={styles.sectionContainer}>
          <View style={[styles.sectionHeader, { borderLeftColor: KurdistanColors.zer }]}>
            <Text style={styles.sectionTitle}>EDUCATION 📚</Text>
          </View>
          <View style={styles.appsGrid}>
            {renderAppIcon('University', qaUniversity, () => navigation.navigate('University'), false, true)}
            {renderAppIcon('Perwerde', qaEducation, () => navigation.navigate('Perwerde'), false)}
            {renderAppIcon('Certificates', '🏆', () => navigation.navigate('Certificates'), true, true)}
            {renderAppIcon('Research', '🔬', () => navigation.navigate('Research'), true, true)}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Avatar Picker Modal */}
      <AvatarPickerModal
        visible={avatarModalVisible}
        onClose={() => setAvatarModalVisible(false)}
        currentAvatar={profileData?.avatar_url}
        onAvatarSelected={handleAvatarSelected}
      />

      {/* Notification Center Modal */}
      <NotificationCenterModal
        visible={notificationModalVisible}
        onClose={() => setNotificationModalVisible(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingTop: Platform.OS === 'android' ? 40 : 20,
    paddingBottom: 25,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.2)',
    elevation: 8,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: KurdistanColors.spi,
    backgroundColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarEmoji: {
    fontSize: 32,
  },
  tikiAvatarBadge: {
    marginLeft: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
  },
  tikiAvatarText: {
    fontSize: 11,
    color: KurdistanColors.spi,
    fontWeight: '700',
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#4CAF50', // Online green
    borderWidth: 2,
    borderColor: KurdistanColors.kesk,
  },
  headerInfo: {
    flex: 1,
    marginLeft: 16,
  },
  greeting: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    marginBottom: 4,
  },
  tikiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  tikiBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 4,
  },
  tikiText: {
    fontSize: 11,
    color: KurdistanColors.spi,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerIcon: {
    fontSize: 18,
  },
  sectionContainer: {
    backgroundColor: KurdistanColors.spi,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    borderLeftWidth: 4,
    paddingLeft: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: KurdistanColors.reş,
    letterSpacing: 0.5,
  },
  connectWalletBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  connectWalletIcon: {
    fontSize: 14,
  },
  connectWalletText: {
    fontSize: 11,
    fontWeight: '600',
    color: KurdistanColors.spi,
  },
  seeAllText: {
    fontSize: 12,
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },
  appsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  appIconContainer: {
    width: '25%', // 4 icons per row
    alignItems: 'center',
    marginBottom: 16,
  },
  appIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
    boxShadow: '0px 1px 2px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  appIconDisabled: {
    opacity: 0.5,
    backgroundColor: '#F0F0F0',
  },
  imageIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
  },
  emojiIcon: {
    fontSize: 28,
  },
  appIconTitle: {
    fontSize: 11,
    color: '#333',
    textAlign: 'center',
    fontWeight: '500',
    maxWidth: '90%',
  },
  lockBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: 'transparent',
  },
  lockText: {
    fontSize: 12,
  },
  // Score Cards Styles
  scoreCardsContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  scoreCardsContent: {
    paddingHorizontal: 16,
  },
  scoreCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginRight: 12,
    minWidth: 140,
    borderLeftWidth: 4,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  scoreCardIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  scoreCardLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  scoreCardValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 4,
  },
  scoreCardSubtext: {
    fontSize: 10,
    color: '#999',
  },
  kycButton: {
    marginTop: 8,
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  kycButtonText: {
    color: KurdistanColors.spi,
    fontSize: 11,
    fontWeight: '700',
  },
});

export default DashboardScreen;
