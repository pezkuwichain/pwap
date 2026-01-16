import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  Share,
  Alert,
  Clipboard,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { KurdistanColors } from '../theme/colors';
import {
  getReferralStats,
  getMyReferrals,
  calculateReferralScore,
  type ReferralStats as BlockchainReferralStats,
} from '../../shared/lib/referral';

// Share platform types
type SharePlatform = 'whatsapp' | 'telegram' | 'viber' | 'email' | 'sms' | 'copy' | 'other';

interface ShareOption {
  id: SharePlatform;
  name: string;
  icon: string;
  color: string;
}

interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: string;
  pendingRewards: string;
  referralScore: number;
  whoInvitedMe: string | null;
}

interface Referral {
  id: string;
  address: string;
  joinedDate: string;
  status: 'active' | 'pending';
  earned: string;
}

// Share platform options
const SHARE_OPTIONS: ShareOption[] = [
  { id: 'whatsapp', name: 'WhatsApp', icon: '💬', color: '#25D366' },
  { id: 'telegram', name: 'Telegram', icon: '✈️', color: '#0088CC' },
  { id: 'viber', name: 'Viber', icon: '📱', color: '#665CAC' },
  { id: 'email', name: 'Email', icon: '📧', color: '#EA4335' },
  { id: 'sms', name: 'SMS', icon: '💬', color: '#34B7F1' },
  { id: 'copy', name: 'Copy Link', icon: '📋', color: '#6B7280' },
  { id: 'other', name: 'Other', icon: '📤', color: '#9CA3AF' },
];

const ReferralScreen: React.FC = () => {
  const { selectedAccount, api, connectWallet, isApiReady } = usePezkuwi();
  const isConnected = !!selectedAccount;

  // State for blockchain data
  const [stats, setStats] = useState<ReferralStats>({
    totalReferrals: 0,
    activeReferrals: 0,
    totalEarned: '0.00 HEZ',
    pendingRewards: '0.00 HEZ',
    referralScore: 0,
    whoInvitedMe: null,
  });
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);

  // Generate referral code and link from wallet address
  const referralCode = selectedAccount
    ? `PZK-${selectedAccount.address.slice(0, 8).toUpperCase()}`
    : 'PZK-CONNECT-WALLET';

  // Full referral link for sharing
  const referralLink = selectedAccount
    ? `https://pezkuwi.app/join?ref=${selectedAccount.address}`
    : '';

  // Deep link for app-to-app sharing
  const deepLink = selectedAccount
    ? `pezkuwi://join?ref=${selectedAccount.address}`
    : '';

  // Pre-formatted share message
  const shareMessage = `🌟 Pezkuwi'ye Katıl! / Join Pezkuwi!\n\nDijital Kurdistan vatandaşı ol ve ödüller kazan!\nBecome a Digital Kurdistan citizen and earn rewards!\n\n🔗 ${referralLink}\n\n#Pezkuwi #Kurdistan #Web3`;

  // Fetch referral data from blockchain
  const fetchReferralData = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) {
      setStats({
        totalReferrals: 0,
        activeReferrals: 0,
        totalEarned: '0.00 HEZ',
        pendingRewards: '0.00 HEZ',
        referralScore: 0,
        whoInvitedMe: null,
      });
      setReferrals([]);
      return;
    }

    setLoading(true);

    try {
      const [blockchainStats, myReferralsList] = await Promise.all([
        getReferralStats(api, selectedAccount.address),
        getMyReferrals(api, selectedAccount.address),
      ]);

      // Calculate rewards (placeholder for now - will be from pallet_rewards)
      const scoreValue = blockchainStats.referralScore;
      const earnedAmount = (scoreValue * 0.1).toFixed(2);

      setStats({
        totalReferrals: blockchainStats.referralCount,
        activeReferrals: blockchainStats.referralCount,
        totalEarned: `${earnedAmount} HEZ`,
        pendingRewards: '0.00 HEZ',
        referralScore: blockchainStats.referralScore,
        whoInvitedMe: blockchainStats.whoInvitedMe,
      });

      // Transform blockchain referrals to UI format
      const referralData: Referral[] = myReferralsList.map((address, index) => ({
        id: address,
        address,
        joinedDate: 'KYC Completed',
        status: 'active' as const,
        earned: `+${index < 10 ? 10 : index < 50 ? 5 : index < 100 ? 4 : 0} points`,
      }));

      setReferrals(referralData);
    } catch (error) {
      if (__DEV__) console.error('Error fetching referral data:', error);
      Alert.alert('Error', 'Failed to load referral data from blockchain');
    } finally {
      setLoading(false);
    }
  }, [api, isApiReady, selectedAccount]);

  // Fetch data on mount and when connection changes
  useEffect(() => {
    if (isConnected && api && isApiReady) {
      fetchReferralData();
    }
  }, [isConnected, api, isApiReady, fetchReferralData]);

  const handleConnectWallet = async () => {
    try {
      await connectWallet();
      Alert.alert('Connected', 'Your wallet has been connected to the referral system!');
    } catch (error) {
      if (__DEV__) console.error('Wallet connection error:', error);
      Alert.alert('Error', 'Failed to connect wallet. Please try again.');
    }
  };

  const handleCopyLink = () => {
    Clipboard.setString(referralLink);
    Alert.alert('Kopyalandı! / Copied!', 'Referral linki kopyalandı / Referral link copied to clipboard');
    setShowShareSheet(false);
  };

  const handleShareViaPlatform = async (platform: SharePlatform) => {
    if (!selectedAccount) return;

    const encodedMessage = encodeURIComponent(shareMessage);
    const encodedLink = encodeURIComponent(referralLink);

    let url = '';

    switch (platform) {
      case 'whatsapp':
        url = `whatsapp://send?text=${encodedMessage}`;
        break;
      case 'telegram':
        url = `tg://msg?text=${encodedMessage}`;
        break;
      case 'viber':
        url = `viber://forward?text=${encodedMessage}`;
        break;
      case 'email':
        url = `mailto:?subject=${encodeURIComponent('Pezkuwi\'ye Katıl! / Join Pezkuwi!')}&body=${encodedMessage}`;
        break;
      case 'sms':
        url = Platform.OS === 'ios'
          ? `sms:&body=${encodedMessage}`
          : `sms:?body=${encodedMessage}`;
        break;
      case 'copy':
        handleCopyLink();
        return;
      case 'other':
      default:
        // Use system share sheet
        try {
          await Share.share({
            message: shareMessage,
            title: 'Pezkuwi\'ye Katıl! / Join Pezkuwi!',
          });
        } catch (error) {
          if (__DEV__) console.error('Error sharing:', error);
        }
        setShowShareSheet(false);
        return;
    }

    // Try to open the platform-specific URL
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        // Fallback to system share if app not installed
        Alert.alert(
          'Uygulama Bulunamadı / App Not Found',
          `${SHARE_OPTIONS.find(o => o.id === platform)?.name} yüklü değil. Diğer paylaşım yöntemini deneyin.\n\n${SHARE_OPTIONS.find(o => o.id === platform)?.name} is not installed. Try another sharing method.`,
          [
            { text: 'Tamam / OK' },
            {
              text: 'Diğer / Other',
              onPress: () => handleShareViaPlatform('other')
            },
          ]
        );
      }
    } catch (error) {
      if (__DEV__) console.error('Error opening URL:', error);
      // Fallback to system share
      handleShareViaPlatform('other');
    }

    setShowShareSheet(false);
  };

  const openShareSheet = () => {
    setShowShareSheet(true);
  };

  const openQRModal = () => {
    setShowQRModal(true);
  };

  if (!isConnected) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[KurdistanColors.sor, KurdistanColors.zer]}
          style={styles.connectGradient}
        >
          <View style={styles.connectContainer}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>🤝</Text>
            </View>
            <Text style={styles.connectTitle}>Referral Program</Text>
            <Text style={styles.connectSubtitle}>
              Connect your wallet to access your referral dashboard
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={handleConnectWallet}
              activeOpacity={0.8}
            >
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[KurdistanColors.sor, KurdistanColors.zer]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Referral Program</Text>
        <Text style={styles.headerSubtitle}>Earn rewards by inviting friends</Text>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={KurdistanColors.sor} />
            <Text style={styles.loadingText}>Loading referral data...</Text>
          </View>
        )}

        {/* Referral Code Card */}
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your Referral Code</Text>
          <View style={styles.codeContainer}>
            <Text style={styles.codeText}>{referralCode}</Text>
          </View>
          <View style={styles.codeActions}>
            <TouchableOpacity
              style={[styles.codeButton, styles.qrButton]}
              onPress={openQRModal}
            >
              <Text style={styles.codeButtonIcon}>📱</Text>
              <Text style={styles.codeButtonText}>QR Code</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.codeButton, styles.shareButton]}
              onPress={openShareSheet}
            >
              <Text style={styles.codeButtonIcon}>📤</Text>
              <Text style={[styles.codeButtonText, { color: KurdistanColors.spi }]}>Paylaş / Share</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Who Invited Me */}
        {stats.whoInvitedMe && (
          <View style={styles.invitedByCard}>
            <View style={styles.invitedByHeader}>
              <Text style={styles.invitedByIcon}>🎁</Text>
              <Text style={styles.invitedByTitle}>You Were Invited By</Text>
            </View>
            <Text style={styles.invitedByAddress}>
              {stats.whoInvitedMe.slice(0, 10)}...{stats.whoInvitedMe.slice(-8)}
            </Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalReferrals}</Text>
            <Text style={styles.statLabel}>Total Referrals</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.activeReferrals}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalEarned}</Text>
            <Text style={styles.statLabel}>Total Earned</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.pendingRewards}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
        </View>

        {/* Score Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Score Calculation</Text>
          <Text style={styles.sectionSubtitle}>
            How referrals contribute to your trust score
          </Text>

          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreRange}>1-10 referrals</Text>
              <Text style={[styles.scorePoints, {color: KurdistanColors.kesk}]}>10 points each</Text>
            </View>
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreRange}>11-50 referrals</Text>
              <Text style={[styles.scorePoints, {color: '#3B82F6'}]}>100 + 5 points each</Text>
            </View>
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreRange}>51-100 referrals</Text>
              <Text style={[styles.scorePoints, {color: KurdistanColors.zer}]}>300 + 4 points each</Text>
            </View>
          </View>

          <View style={styles.scoreCard}>
            <View style={styles.scoreRow}>
              <Text style={styles.scoreRange}>101+ referrals</Text>
              <Text style={[styles.scorePoints, {color: KurdistanColors.sor}]}>500 points (max)</Text>
            </View>
          </View>
        </View>

        {/* Leaderboard */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Referrers</Text>
          <Text style={styles.sectionSubtitle}>Community leaderboard</Text>

          <View style={styles.leaderboardCard}>
            <View style={styles.leaderboardRow}>
              <View style={styles.leaderboardRank}>
                <Text style={styles.leaderboardRankText}>🥇</Text>
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardAddress}>5GrwvaEF...KutQY</Text>
                <Text style={styles.leaderboardStats}>156 referrals</Text>
              </View>
              <Text style={styles.leaderboardScore}>500 pts</Text>
            </View>
          </View>

          <View style={styles.leaderboardCard}>
            <View style={styles.leaderboardRow}>
              <View style={styles.leaderboardRank}>
                <Text style={styles.leaderboardRankText}>🥈</Text>
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardAddress}>5FHneW46...94ty</Text>
                <Text style={styles.leaderboardStats}>89 referrals</Text>
              </View>
              <Text style={styles.leaderboardScore}>456 pts</Text>
            </View>
          </View>

          <View style={styles.leaderboardCard}>
            <View style={styles.leaderboardRow}>
              <View style={styles.leaderboardRank}>
                <Text style={styles.leaderboardRankText}>🥉</Text>
              </View>
              <View style={styles.leaderboardInfo}>
                <Text style={styles.leaderboardAddress}>5FLSigC9...hXcS59Y</Text>
                <Text style={styles.leaderboardStats}>67 referrals</Text>
              </View>
              <Text style={styles.leaderboardScore}>385 pts</Text>
            </View>
          </View>

          <View style={styles.leaderboardNote}>
            <Text style={styles.leaderboardNoteIcon}>ℹ️</Text>
            <Text style={styles.leaderboardNoteText}>
              Leaderboard updates every 24 hours. Keep inviting to climb the ranks!
            </Text>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Share Your Code</Text>
              <Text style={styles.stepDescription}>
                Share your unique referral code with friends
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Friend Joins</Text>
              <Text style={styles.stepDescription}>
                They use your code when applying for citizenship
              </Text>
            </View>
          </View>

          <View style={styles.stepCard}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Earn Rewards</Text>
              <Text style={styles.stepDescription}>
                Get HEZ tokens when they become active citizens
              </Text>
            </View>
          </View>
        </View>

        {/* Referrals List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Referrals</Text>
          {referrals.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateIcon}>👥</Text>
              <Text style={styles.emptyStateText}>No referrals yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Start inviting friends to earn rewards!
              </Text>
            </View>
          ) : (
            referrals.map((referral) => (
              <View key={referral.id} style={styles.referralCard}>
                <View style={styles.referralInfo}>
                  <Text style={styles.referralAddress}>
                    {referral.address.substring(0, 8)}...
                    {referral.address.substring(referral.address.length - 6)}
                  </Text>
                  <Text style={styles.referralDate}>{referral.joinedDate}</Text>
                </View>
                <View style={styles.referralStats}>
                  <Text
                    style={[
                      styles.referralStatus,
                      referral.status === 'active'
                        ? styles.statusActive
                        : styles.statusPending,
                    ]}
                  >
                    {referral.status}
                  </Text>
                  <Text style={styles.referralEarned}>{referral.earned}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Share Sheet Modal */}
      <Modal
        visible={showShareSheet}
        transparent
        animationType="slide"
        onRequestClose={() => setShowShareSheet(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowShareSheet(false)}
        >
          <View style={styles.shareSheetContainer}>
            <View style={styles.shareSheetHandle} />
            <Text style={styles.shareSheetTitle}>Paylaş / Share</Text>
            <Text style={styles.shareSheetSubtitle}>
              Arkadaşlarını davet et, ödül kazan!{'\n'}Invite friends, earn rewards!
            </Text>

            {/* Share Link Preview */}
            <View style={styles.linkPreview}>
              <Text style={styles.linkPreviewText} numberOfLines={1}>
                {referralLink}
              </Text>
            </View>

            {/* Platform Grid */}
            <View style={styles.platformGrid}>
              {SHARE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.id}
                  style={styles.platformButton}
                  onPress={() => handleShareViaPlatform(option.id)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.platformIconContainer, { backgroundColor: option.color }]}>
                    <Text style={styles.platformIcon}>{option.icon}</Text>
                  </View>
                  <Text style={styles.platformName}>{option.name}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Cancel Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowShareSheet(false)}
            >
              <Text style={styles.cancelButtonText}>İptal / Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* QR Code Modal */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowQRModal(false)}
        >
          <View style={styles.qrModalContainer}>
            <View style={styles.qrModalHeader}>
              <Text style={styles.qrModalTitle}>Referral QR Kodu</Text>
              <TouchableOpacity onPress={() => setShowQRModal(false)}>
                <Text style={styles.qrCloseButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.qrCodeWrapper}>
              {selectedAccount && (
                <QRCode
                  value={referralLink}
                  size={200}
                  backgroundColor={KurdistanColors.spi}
                  color={KurdistanColors.reş}
                />
              )}
            </View>

            <Text style={styles.qrInstructions}>
              Bu QR kodu arkadaşlarınla paylaş.{'\n'}
              Taratarak Pezkuwi'ye katılabilirler.
            </Text>
            <Text style={styles.qrInstructionsEn}>
              Share this QR code with friends.{'\n'}
              They can scan to join Pezkuwi.
            </Text>

            <View style={styles.qrCodeContainer}>
              <Text style={styles.qrCodeText}>{referralCode}</Text>
            </View>

            <TouchableOpacity
              style={styles.qrShareButton}
              onPress={() => {
                setShowQRModal(false);
                openShareSheet();
              }}
            >
              <Text style={styles.qrShareButtonText}>📤 Linki Paylaş / Share Link</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  connectGradient: {
    flex: 1,
  },
  connectContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: KurdistanColors.spi,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.3)',
    elevation: 8,
  },
  logoText: {
    fontSize: 48,
  },
  connectTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    marginBottom: 12,
  },
  connectSubtitle: {
    fontSize: 16,
    color: KurdistanColors.spi,
    textAlign: 'center',
    opacity: 0.9,
    marginBottom: 40,
  },
  connectButton: {
    backgroundColor: KurdistanColors.spi,
    paddingHorizontal: 40,
    paddingVertical: 16,
    borderRadius: 12,
    boxShadow: '0px 4px 6px rgba(0, 0, 0, 0.3)',
    elevation: 6,
  },
  connectButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.sor,
  },
  header: {
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: KurdistanColors.spi,
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  codeCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  codeLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  codeContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  codeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.sor,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  codeActions: {
    flexDirection: 'row',
    gap: 12,
  },
  codeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#F0F0F0',
  },
  shareButton: {
    backgroundColor: KurdistanColors.sor,
  },
  codeButtonIcon: {
    fontSize: 16,
  },
  codeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.sor,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  scoreCard: {
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scoreRange: {
    fontSize: 14,
    color: '#666',
  },
  scorePoints: {
    fontSize: 14,
    fontWeight: '600',
  },
  leaderboardCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderboardRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  leaderboardRankText: {
    fontSize: 20,
  },
  leaderboardInfo: {
    flex: 1,
  },
  leaderboardAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 2,
    fontFamily: 'monospace',
  },
  leaderboardStats: {
    fontSize: 12,
    color: '#666',
  },
  leaderboardScore: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  leaderboardNote: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    borderRadius: 12,
    padding: 12,
    marginTop: 8,
    gap: 8,
  },
  leaderboardNoteIcon: {
    fontSize: 16,
  },
  leaderboardNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#0C4A6E',
    lineHeight: 18,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  stepNumber: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KurdistanColors.sor,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  stepNumberText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  referralCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.05)',
    elevation: 3,
  },
  referralInfo: {
    flex: 1,
  },
  referralAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  referralDate: {
    fontSize: 12,
    color: '#666',
  },
  referralStats: {
    alignItems: 'flex-end',
  },
  referralStatus: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  statusActive: {
    color: KurdistanColors.kesk,
  },
  statusPending: {
    color: KurdistanColors.zer,
  },
  referralEarned: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.sor,
  },
  loadingOverlay: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  invitedByCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: KurdistanColors.kesk,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  invitedByHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  invitedByIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  invitedByTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  invitedByAddress: {
    fontSize: 14,
    fontFamily: 'monospace',
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },
  qrButton: {
    backgroundColor: '#F0F0F0',
  },
  // Share Sheet Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  shareSheetContainer: {
    backgroundColor: KurdistanColors.spi,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 40,
  },
  shareSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  shareSheetTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    textAlign: 'center',
    marginBottom: 4,
  },
  shareSheetSubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  linkPreview: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 12,
    marginBottom: 20,
  },
  linkPreviewText: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    textAlign: 'center',
  },
  platformGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  platformButton: {
    width: '25%',
    alignItems: 'center',
    marginBottom: 16,
  },
  platformIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  platformIcon: {
    fontSize: 28,
  },
  platformName: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  cancelButton: {
    backgroundColor: '#F0F0F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  // QR Modal Styles
  qrModalContainer: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 24,
    margin: 20,
    padding: 24,
    alignItems: 'center',
    alignSelf: 'center',
    marginTop: 'auto',
    marginBottom: 'auto',
    boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.3)',
    elevation: 10,
  },
  qrModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 20,
  },
  qrModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  qrCloseButton: {
    fontSize: 20,
    color: '#999',
    padding: 4,
  },
  qrCodeWrapper: {
    padding: 20,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: KurdistanColors.sor,
    marginBottom: 16,
  },
  qrInstructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  qrInstructionsEn: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  qrCodeContainer: {
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 20,
  },
  qrCodeText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.sor,
    fontFamily: 'monospace',
  },
  qrShareButton: {
    backgroundColor: KurdistanColors.sor,
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 14,
    width: '100%',
    alignItems: 'center',
  },
  qrShareButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.spi,
  },
});

export default ReferralScreen;
