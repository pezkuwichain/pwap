import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import {
  fetchUserTikiNFTs,
  getCitizenNFTDetails,
  getTikiDisplayName,
  getTikiEmoji,
  ROLE_CATEGORIES,
  type TikiNFTDetails,
} from '../../shared/lib/tiki';

/**
 * Identity Screen
 *
 * Shows user's digital identity:
 * - Citizens: Welati NFT card + other role NFTs
 * - Visitors: Digital Kurdistan State Visa Card + any NFTs they have
 */
const IdentityScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api, isApiReady, selectedAccount } = usePezkuwi();

  // Choice state
  const [userChoice, setUserChoice] = useState<'citizen' | 'visitor' | null>(null);

  // Loading & data state
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [citizenNFT, setCitizenNFT] = useState<TikiNFTDetails | null>(null);
  const [otherNFTs, setOtherNFTs] = useState<TikiNFTDetails[]>([]);
  const [citizenCheckDone, setCitizenCheckDone] = useState(false);
  const [isActuallyCitizen, setIsActuallyCitizen] = useState(false);

  const fetchNFTData = useCallback(async () => {
    if (!api || !isApiReady || !selectedAccount) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Fetch citizen NFT
      const citizenDetails = await getCitizenNFTDetails(api, selectedAccount.address);
      setCitizenNFT(citizenDetails);
      setIsActuallyCitizen(!!citizenDetails);

      // Fetch all tiki NFTs
      const allTikis = await fetchUserTikiNFTs(api, selectedAccount.address);

      // Filter out Welati from other NFTs (it's shown separately)
      const others = allTikis.filter(nft => nft.tikiRole !== 'Welati');
      setOtherNFTs(others);

      setCitizenCheckDone(true);

    } catch (error) {
      if (__DEV__) console.error('[Identity] Error fetching NFTs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, isApiReady, selectedAccount]);

  // Fetch data when user makes a choice
  useEffect(() => {
    if (userChoice && selectedAccount) {
      fetchNFTData();
    }
  }, [userChoice, selectedAccount, fetchNFTData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNFTData();
  };

  // Get category for a tiki
  const getTikiCategory = (tiki: string): string => {
    for (const [category, roles] of Object.entries(ROLE_CATEGORIES)) {
      if (roles.includes(tiki)) {
        return category;
      }
    }
    return 'Other';
  };

  // Format address
  const formatAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
  };

  // Generate visa number from address
  const generateVisaNumber = (address: string) => {
    const hash = address.slice(2, 10).toUpperCase();
    return `VIS-${hash}-KRD`;
  };

  // No wallet connected
  if (!selectedAccount) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[KurdistanColors.kesk, KurdistanColors.zer, KurdistanColors.sor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.noWalletContainer}
        >
          <View style={styles.noWalletContent}>
            <Text style={styles.noWalletIcon}>🔗</Text>
            <Text style={styles.noWalletTitle}>Wallet Required</Text>
            <Text style={styles.noWalletText}>
              Please connect your wallet to view your digital identity.
            </Text>
            <TouchableOpacity
              style={styles.connectButton}
              onPress={() => navigation.navigate('Wallet' as never)}
            >
              <Text style={styles.connectButtonText}>Connect Wallet</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.backButtonText}>← Go Back</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Choice screen - Ask if citizen or visitor
  if (!userChoice) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[KurdistanColors.kesk, KurdistanColors.zer, KurdistanColors.sor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.choiceContainer}
        >
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.choiceBackButton}>
            <Text style={styles.choiceBackText}>← Back</Text>
          </TouchableOpacity>

          <View style={styles.choiceContent}>
            <Text style={styles.choiceIcon}>🆔</Text>
            <Text style={styles.choiceTitle}>Nasnameya Dîjîtal</Text>
            <Text style={styles.choiceSubtitle}>Digital Identity</Text>

            <Text style={styles.choiceQuestion}>Hûn welatî ne?</Text>
            <Text style={styles.choiceQuestionEn}>Are you a citizen?</Text>

            <View style={styles.choiceCards}>
              <TouchableOpacity
                style={styles.choiceCard}
                onPress={() => setUserChoice('citizen')}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceCardIcon, { backgroundColor: KurdistanColors.kesk }]}>
                  <Text style={styles.choiceCardEmoji}>👤</Text>
                </View>
                <Text style={styles.choiceCardTitle}>Ez welatî me</Text>
                <Text style={styles.choiceCardSubtitle}>I am a citizen</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.choiceCard}
                onPress={() => setUserChoice('visitor')}
                activeOpacity={0.8}
              >
                <View style={[styles.choiceCardIcon, { backgroundColor: KurdistanColors.zer }]}>
                  <Text style={styles.choiceCardEmoji}>🌍</Text>
                </View>
                <Text style={styles.choiceCardTitle}>Ez ne welatî me</Text>
                <Text style={styles.choiceCardSubtitle}>Not a citizen</Text>
              </TouchableOpacity>
            </View>
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Main content after choice
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[KurdistanColors.kesk, '#006633']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => setUserChoice(null)} style={styles.headerBackButton}>
          <Text style={styles.headerBackText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>🆔</Text>
          <Text style={styles.headerTitle}>Nasnameya Dîjîtal</Text>
          <Text style={styles.headerSubtitle}>Digital Identity</Text>
        </View>

        {/* Kurdistan Sun decoration */}
        <View style={styles.sunDecoration}>
          <View style={styles.sunCenter} />
          {[...Array(21)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.sunRay,
                { transform: [{ rotate: `${i * (360 / 21)}deg` }] }
              ]}
            />
          ))}
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={KurdistanColors.kesk} />
            <Text style={styles.loadingText}>Loading your identity...</Text>
          </View>
        ) : (
          <>
            {/* Wallet Address Card */}
            <View style={styles.walletCard}>
              <Text style={styles.walletLabel}>Connected Wallet</Text>
              <Text style={styles.walletAddress}>{formatAddress(selectedAccount.address)}</Text>
            </View>

            {/* CITIZEN PATH */}
            {userChoice === 'citizen' && (
              <>
                {citizenCheckDone && !isActuallyCitizen ? (
                  // User selected citizen but doesn't have Welati
                  <View style={styles.notCitizenAlert}>
                    <Text style={styles.notCitizenIcon}>⚠️</Text>
                    <Text style={styles.notCitizenTitle}>Citizenship Not Found</Text>
                    <Text style={styles.notCitizenText}>
                      We couldn't find a Welati (citizen) NFT for this wallet.
                      Please apply for citizenship to get your digital identity.
                    </Text>
                    <TouchableOpacity
                      style={styles.applyButton}
                      onPress={() => navigation.navigate('BeCitizen' as never)}
                    >
                      <Text style={styles.applyButtonText}>Apply for Citizenship</Text>
                    </TouchableOpacity>
                  </View>
                ) : citizenNFT ? (
                  // Citizen NFT Card
                  <View style={styles.citizenCard}>
                    <LinearGradient
                      colors={[KurdistanColors.kesk, KurdistanColors.zer]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.citizenCardGradient}
                    >
                      <View style={styles.citizenCardInner}>
                        <View style={styles.nftBadge}>
                          <Text style={styles.nftBadgeText}>NFT</Text>
                        </View>

                        <View style={styles.citizenIconContainer}>
                          <Text style={styles.citizenIcon}>👤</Text>
                        </View>

                        <Text style={styles.citizenTitle}>WELATI</Text>
                        <Text style={styles.citizenSubtitle}>Citizen of Digital Kurdistan</Text>

                        <View style={styles.citizenDetails}>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Collection ID</Text>
                            <Text style={styles.detailValue}>#{citizenNFT.collectionId}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Item ID</Text>
                            <Text style={styles.detailValue}>#{citizenNFT.itemId}</Text>
                          </View>
                          <View style={styles.detailRow}>
                            <Text style={styles.detailLabel}>Score Bonus</Text>
                            <Text style={styles.detailValue}>+{citizenNFT.tikiScore}</Text>
                          </View>
                        </View>

                        <View style={styles.verifiedBadge}>
                          <Text style={styles.verifiedText}>✓ Verified Citizen</Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </View>
                ) : null}
              </>
            )}

            {/* VISITOR PATH - Digital Kurdistan State Visa Card */}
            {userChoice === 'visitor' && (
              <View style={styles.visaCard}>
                <LinearGradient
                  colors={['#1a237e', '#283593', '#3949ab']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.visaCardGradient}
                >
                  <View style={styles.visaCardInner}>
                    {/* Top Banner */}
                    <View style={styles.visaTopBanner}>
                      <Text style={styles.visaCountryName}>KOMARA DÎJÎTAL A KURDISTANÊ</Text>
                      <Text style={styles.visaCountryNameEn}>DIGITAL REPUBLIC OF KURDISTAN</Text>
                    </View>

                    {/* Visa Type */}
                    <View style={styles.visaTypeBadge}>
                      <Text style={styles.visaTypeText}>STATE VISA</Text>
                    </View>

                    {/* Kurdistan Flag Colors Bar */}
                    <View style={styles.visaFlagBar}>
                      <View style={[styles.visaFlagStripe, { backgroundColor: KurdistanColors.sor }]} />
                      <View style={[styles.visaFlagStripe, { backgroundColor: KurdistanColors.spi }]} />
                      <View style={[styles.visaFlagStripe, { backgroundColor: KurdistanColors.kesk }]} />
                    </View>

                    {/* Photo placeholder with globe */}
                    <View style={styles.visaPhotoContainer}>
                      <Text style={styles.visaPhotoEmoji}>🌍</Text>
                    </View>

                    {/* Visa Details */}
                    <View style={styles.visaDetails}>
                      <View style={styles.visaDetailRow}>
                        <Text style={styles.visaDetailLabel}>VISA NUMBER</Text>
                        <Text style={styles.visaDetailValue}>
                          {generateVisaNumber(selectedAccount.address)}
                        </Text>
                      </View>
                      <View style={styles.visaDetailRow}>
                        <Text style={styles.visaDetailLabel}>STATUS</Text>
                        <Text style={styles.visaDetailValue}>VISITOR</Text>
                      </View>
                      <View style={styles.visaDetailRow}>
                        <Text style={styles.visaDetailLabel}>WALLET</Text>
                        <Text style={[styles.visaDetailValue, { fontSize: 11 }]}>
                          {formatAddress(selectedAccount.address)}
                        </Text>
                      </View>
                      <View style={styles.visaDetailRow}>
                        <Text style={styles.visaDetailLabel}>ACCESS LEVEL</Text>
                        <Text style={styles.visaDetailValue}>LIMITED</Text>
                      </View>
                    </View>

                    {/* Sun emblem */}
                    <View style={styles.visaSunEmblem}>
                      <Text style={styles.visaSunText}>☀️</Text>
                    </View>

                    {/* Bottom info */}
                    <View style={styles.visaBottom}>
                      <Text style={styles.visaBottomText}>
                        This visa grants limited access to Digital Kurdistan services.
                      </Text>
                      <Text style={styles.visaBottomText}>
                        Apply for citizenship for full access.
                      </Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Become Citizen CTA */}
                <TouchableOpacity
                  style={styles.upgradeButton}
                  onPress={() => navigation.navigate('BeCitizen' as never)}
                >
                  <Text style={styles.upgradeButtonText}>Upgrade to Citizenship</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Other Tikis Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tikiyên Din / Other NFTs</Text>
              <Text style={styles.sectionCount}>{otherNFTs.length} NFT</Text>
            </View>

            {otherNFTs.length === 0 ? (
              <View style={styles.noOtherNFTs}>
                <Text style={styles.noOtherText}>
                  {userChoice === 'citizen'
                    ? 'No other role NFTs yet. Participate in governance, get elected, or earn roles to receive more tikis.'
                    : 'No NFTs found. As a visitor, you can still explore the ecosystem. Consider applying for citizenship to unlock more features.'}
                </Text>
              </View>
            ) : (
              <View style={styles.nftGrid}>
                {otherNFTs.map((nft, index) => (
                  <View key={`${nft.tikiRole}-${index}`} style={styles.nftCard}>
                    <View style={[styles.nftCardHeader, { backgroundColor: nft.tikiColor }]}>
                      <Text style={styles.nftCardEmoji}>{nft.tikiEmoji}</Text>
                    </View>
                    <View style={styles.nftCardBody}>
                      <Text style={styles.nftCardRole}>{nft.tikiRole}</Text>
                      <Text style={styles.nftCardName}>{nft.tikiDisplayName}</Text>
                      <View style={styles.nftCardCategory}>
                        <Text style={styles.nftCardCategoryText}>
                          {getTikiCategory(nft.tikiRole)}
                        </Text>
                      </View>
                      <Text style={styles.nftCardScore}>+{nft.tikiScore} pts</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            {/* Total Score - only show if has NFTs */}
            {(citizenNFT || otherNFTs.length > 0) && (
              <View style={styles.totalScoreCard}>
                <Text style={styles.totalScoreLabel}>Total Tiki Score</Text>
                <Text style={styles.totalScoreValue}>
                  {(citizenNFT?.tikiScore || 0) + otherNFTs.reduce((sum, nft) => sum + nft.tikiScore, 0)}
                </Text>
                <Text style={styles.totalScoreSubtext}>
                  {(citizenNFT ? 1 : 0) + otherNFTs.length} NFT{(citizenNFT ? 1 : 0) + otherNFTs.length !== 1 ? 's' : ''} total
                </Text>
              </View>
            )}

            {/* Info Section */}
            <View style={styles.infoSection}>
              <Text style={styles.infoTitle}>About Digital Identity</Text>
              <Text style={styles.infoText}>
                {userChoice === 'citizen' ? (
                  <>
                    Your Welati NFT is your digital citizenship in the Digital Republic of Kurdistan.
                    It grants you voting rights, access to governance, and participation in the ecosystem.
                    {'\n\n'}
                    Additional role NFTs (Tikis) represent your achievements and positions within the republic.
                  </>
                ) : (
                  <>
                    As a visitor, you have limited access to Digital Kurdistan services.
                    Your State Visa allows basic exploration of the ecosystem.
                    {'\n\n'}
                    To unlock full benefits including voting rights, governance participation,
                    and exclusive services, consider applying for citizenship.
                  </>
                )}
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  // No Wallet
  noWalletContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noWalletContent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 32,
    margin: 24,
    alignItems: 'center',
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.2)',
    elevation: 10,
  },
  noWalletIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  noWalletTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  noWalletText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  connectButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  connectButtonText: {
    color: KurdistanColors.spi,
    fontSize: 16,
    fontWeight: 'bold',
  },
  backButton: {
    padding: 12,
  },
  backButtonText: {
    color: KurdistanColors.kesk,
    fontSize: 16,
  },

  // Choice Screen
  choiceContainer: {
    flex: 1,
  },
  choiceBackButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    padding: 8,
  },
  choiceBackText: {
    fontSize: 16,
    color: KurdistanColors.spi,
    fontWeight: '600',
  },
  choiceContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  choiceIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  choiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    marginBottom: 4,
  },
  choiceSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 40,
  },
  choiceQuestion: {
    fontSize: 22,
    fontWeight: '600',
    color: KurdistanColors.spi,
    marginBottom: 4,
  },
  choiceQuestionEn: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 32,
  },
  choiceCards: {
    flexDirection: 'row',
    gap: 16,
  },
  choiceCard: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: 150,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
    elevation: 6,
  },
  choiceCardIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  choiceCardEmoji: {
    fontSize: 32,
  },
  choiceCardTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    textAlign: 'center',
    marginBottom: 4,
  },
  choiceCardSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },

  // Header
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  headerBackButton: {
    position: 'absolute',
    top: 20,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  headerBackText: {
    fontSize: 24,
    color: KurdistanColors.spi,
  },
  headerContent: {
    alignItems: 'center',
    marginTop: 10,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },

  // Sun decoration
  sunDecoration: {
    position: 'absolute',
    right: -30,
    top: -30,
    width: 120,
    height: 120,
    opacity: 0.2,
  },
  sunCenter: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KurdistanColors.zer,
    left: 40,
    top: 40,
  },
  sunRay: {
    position: 'absolute',
    width: 3,
    height: 60,
    backgroundColor: KurdistanColors.zer,
    left: 58,
    top: 0,
    transformOrigin: 'center bottom',
  },

  // Content
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },

  // Loading
  loadingContainer: {
    padding: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    color: '#666',
  },

  // Wallet Card
  walletCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  walletLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 16,
    fontFamily: 'monospace',
    color: KurdistanColors.reş,
    fontWeight: '600',
  },

  // Not Citizen Alert
  notCitizenAlert: {
    backgroundColor: '#FFF3E0',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  notCitizenIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  notCitizenTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E65100',
    marginBottom: 8,
  },
  notCitizenText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  applyButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  applyButtonText: {
    color: KurdistanColors.spi,
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Citizen Card
  citizenCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    boxShadow: '0px 8px 24px rgba(0, 128, 0, 0.2)',
    elevation: 8,
  },
  citizenCardGradient: {
    padding: 3,
  },
  citizenCardInner: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 17,
    padding: 24,
    alignItems: 'center',
  },
  nftBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  nftBadgeText: {
    color: KurdistanColors.spi,
    fontSize: 10,
    fontWeight: 'bold',
  },
  citizenIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: `${KurdistanColors.kesk}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: KurdistanColors.kesk,
  },
  citizenIcon: {
    fontSize: 40,
  },
  citizenTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
    letterSpacing: 4,
    marginBottom: 4,
  },
  citizenSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  citizenDetails: {
    width: '100%',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  verifiedBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  verifiedText: {
    color: KurdistanColors.kesk,
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Visa Card
  visaCard: {
    marginBottom: 24,
  },
  visaCardGradient: {
    borderRadius: 20,
    padding: 2,
  },
  visaCardInner: {
    backgroundColor: '#1a237e',
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
  },
  visaTopBanner: {
    alignItems: 'center',
    marginBottom: 16,
  },
  visaCountryName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: KurdistanColors.zer,
    letterSpacing: 1,
  },
  visaCountryNameEn: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
    letterSpacing: 0.5,
  },
  visaTypeBadge: {
    backgroundColor: KurdistanColors.sor,
    paddingHorizontal: 20,
    paddingVertical: 6,
    borderRadius: 4,
    marginBottom: 16,
  },
  visaTypeText: {
    color: KurdistanColors.spi,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 2,
  },
  visaFlagBar: {
    flexDirection: 'row',
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 20,
  },
  visaFlagStripe: {
    flex: 1,
  },
  visaPhotoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  visaPhotoEmoji: {
    fontSize: 40,
  },
  visaDetails: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  visaDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  visaDetailLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  visaDetailValue: {
    fontSize: 12,
    color: KurdistanColors.spi,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  visaSunEmblem: {
    marginBottom: 16,
  },
  visaSunText: {
    fontSize: 32,
  },
  visaBottom: {
    alignItems: 'center',
  },
  visaBottomText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
  upgradeButton: {
    backgroundColor: KurdistanColors.kesk,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  upgradeButtonText: {
    color: KurdistanColors.spi,
    fontWeight: 'bold',
    fontSize: 16,
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  sectionCount: {
    fontSize: 14,
    color: '#666',
  },

  // No Other NFTs
  noOtherNFTs: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  noOtherText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },

  // NFT Grid
  nftGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  nftCard: {
    width: '48%',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  nftCardHeader: {
    padding: 16,
    alignItems: 'center',
  },
  nftCardEmoji: {
    fontSize: 36,
  },
  nftCardBody: {
    padding: 12,
    alignItems: 'center',
  },
  nftCardRole: {
    fontSize: 12,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
    marginBottom: 2,
  },
  nftCardName: {
    fontSize: 13,
    color: KurdistanColors.reş,
    textAlign: 'center',
    marginBottom: 8,
  },
  nftCardCategory: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 8,
  },
  nftCardCategoryText: {
    fontSize: 10,
    color: '#666',
  },
  nftCardScore: {
    fontSize: 14,
    fontWeight: 'bold',
    color: KurdistanColors.zer,
  },

  // Total Score
  totalScoreCard: {
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  totalScoreLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  totalScoreValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  totalScoreSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Info Section
  infoSection: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 22,
  },
});

export default IdentityScreen;
