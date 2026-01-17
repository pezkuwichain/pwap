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
  Alert,
  FlatList,
  Modal,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { fetchUserTikis } from '../../shared/lib/tiki';
import {
  getActiveElections,
  getElectionCandidates,
  getElectionResults,
  hasVoted,
  getCurrentBlock,
  blocksToTime,
  type ElectionInfo,
  type CandidateInfo,
  type ElectionResult,
} from '../../shared/lib/welati';

type TabType = 'history' | 'active' | 'candidate';

// Presidential election constants (from pezpallet-welati)
const PRESIDENTIAL_REQUIREMENTS = {
  minTrustScore: 600,
  minEndorsements: 1000,
  depositAmount: '100 PEZ',
  requiredTiki: 'Welati',
};

const PresidentScreen: React.FC = () => {
  const navigation = useNavigation();
  const { api, isApiReady, selectedAccount, getKeyPair } = usePezkuwi();

  // Access control state
  const [hasWelatiTiki, setHasWelatiTiki] = useState<boolean | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('active');

  // Election data
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentBlock, setCurrentBlock] = useState(0);

  // Elections
  const [activeElections, setActiveElections] = useState<ElectionInfo[]>([]);
  const [pastElections, setPastElections] = useState<ElectionResult[]>([]);
  const [candidates, setCandidates] = useState<CandidateInfo[]>([]);
  const [selectedElection, setSelectedElection] = useState<ElectionInfo | null>(null);
  const [userHasVoted, setUserHasVoted] = useState(false);

  // Candidate eligibility
  const [eligibilityStatus, setEligibilityStatus] = useState<{
    eligible: boolean;
    trustScore: number;
    reasons: string[];
  } | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  // Voting modal
  const [showVoteModal, setShowVoteModal] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateInfo | null>(null);
  const [submittingVote, setSubmittingVote] = useState(false);

  // Check welati tiki access
  useEffect(() => {
    const checkAccess = async () => {
      if (!api || !isApiReady || !selectedAccount) {
        setCheckingAccess(false);
        setHasWelatiTiki(false);
        return;
      }

      try {
        const tikis = await fetchUserTikis(api, selectedAccount.address);
        const hasWelati = tikis.includes('Welati');
        setHasWelatiTiki(hasWelati);
      } catch (error) {
        if (__DEV__) console.error('[President] Error checking tiki:', error);
        setHasWelatiTiki(false);
      } finally {
        setCheckingAccess(false);
      }
    };

    checkAccess();
  }, [api, isApiReady, selectedAccount]);

  // Fetch election data
  const fetchElectionData = useCallback(async () => {
    if (!api || !isApiReady) return;

    try {
      setLoading(true);

      // Get current block
      const block = await getCurrentBlock(api);
      setCurrentBlock(block);

      // Get all elections
      const elections = await getActiveElections(api);

      // Filter presidential elections
      const presidentialElections = elections.filter(e => e.electionType === 'Presidential');

      // Separate active and completed
      const active = presidentialElections.filter(e => e.status !== 'Completed');
      const completed = presidentialElections.filter(e => e.status === 'Completed');

      setActiveElections(active);

      // Get results for completed elections
      const results: ElectionResult[] = [];
      for (const election of completed) {
        const result = await getElectionResults(api, election.electionId);
        if (result) {
          results.push(result);
        }
      }
      setPastElections(results);

      // If there's an active election, get candidates
      if (active.length > 0) {
        const firstActive = active[0];
        setSelectedElection(firstActive);
        const electionCandidates = await getElectionCandidates(api, firstActive.electionId);
        setCandidates(electionCandidates);

        // Check if user has voted
        if (selectedAccount) {
          const voted = await hasVoted(api, firstActive.electionId, selectedAccount.address);
          setUserHasVoted(voted);
        }
      }

    } catch (error) {
      if (__DEV__) console.error('[President] Error fetching elections:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, isApiReady, selectedAccount]);

  useEffect(() => {
    if (hasWelatiTiki) {
      fetchElectionData();
    }
  }, [hasWelatiTiki, fetchElectionData]);

  // Check candidate eligibility
  const checkCandidateEligibility = async () => {
    if (!api || !isApiReady || !selectedAccount) return;

    setCheckingEligibility(true);

    try {
      // Check trust score
      const trustScoreRaw = await api.query.trust?.trustScores?.(selectedAccount.address);
      const trustScore = trustScoreRaw ? Number(trustScoreRaw.toString()) : 0;

      const reasons: string[] = [];
      let eligible = true;

      // Check trust score requirement
      if (trustScore < PRESIDENTIAL_REQUIREMENTS.minTrustScore) {
        eligible = false;
        reasons.push(`Trust score must be at least ${PRESIDENTIAL_REQUIREMENTS.minTrustScore} (yours: ${trustScore})`);
      }

      // Check if already a candidate in active election
      if (selectedElection) {
        const isCandidate = candidates.some(c => c.account === selectedAccount.address);
        if (isCandidate) {
          eligible = false;
          reasons.push('You are already a candidate in this election');
        }
      }

      // Check if there's an active election in candidacy period
      if (!selectedElection || selectedElection.status !== 'CandidacyPeriod') {
        eligible = false;
        reasons.push('No election is currently accepting candidates');
      }

      if (eligible) {
        reasons.push('You meet all requirements to become a candidate!');
      }

      setEligibilityStatus({ eligible, trustScore, reasons });

    } catch (error) {
      if (__DEV__) console.error('[President] Error checking eligibility:', error);
      Alert.alert('Error', 'Failed to check eligibility');
    } finally {
      setCheckingEligibility(false);
    }
  };

  // Submit vote
  const handleVote = async () => {
    if (!api || !selectedAccount || !selectedElection || !selectedCandidate) return;

    setSubmittingVote(true);

    try {
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) {
        Alert.alert('Error', 'Could not retrieve key pair for signing');
        return;
      }

      // Create vote transaction
      const tx = api.tx.welati.castVote(
        selectedElection.electionId,
        [selectedCandidate.account],
        null // No district for presidential
      );

      // Sign and send
      await tx.signAndSend(keyPair, { nonce: -1 }, ({ status, events }) => {
        if (status.isInBlock || status.isFinalized) {
          // Check for success
          const success = events.some(({ event }) =>
            api.events.system.ExtrinsicSuccess.is(event)
          );

          if (success) {
            Alert.alert(
              'Vote Submitted!',
              'Your vote has been recorded on the blockchain.',
              [{ text: 'OK', onPress: () => {
                setShowVoteModal(false);
                setSelectedCandidate(null);
                setUserHasVoted(true);
                fetchElectionData();
              }}]
            );
          } else {
            Alert.alert('Error', 'Vote transaction failed');
          }
          setSubmittingVote(false);
        }
      });

    } catch (error: any) {
      if (__DEV__) console.error('[President] Vote error:', error);
      Alert.alert('Error', error.message || 'Failed to submit vote');
      setSubmittingVote(false);
    }
  };

  // Register as candidate
  const handleRegisterCandidate = async () => {
    if (!api || !selectedAccount || !selectedElection) return;

    Alert.alert(
      'Register as Candidate',
      `To register as a presidential candidate, you need:\n\n` +
      `• Trust Score: ${PRESIDENTIAL_REQUIREMENTS.minTrustScore}+\n` +
      `• Endorsements: ${PRESIDENTIAL_REQUIREMENTS.minEndorsements}+\n` +
      `• Deposit: ${PRESIDENTIAL_REQUIREMENTS.depositAmount}\n\n` +
      `This will open the registration form.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Continue',
          onPress: () => {
            // TODO: Implement candidate registration form
            Alert.alert('Coming Soon', 'Candidate registration will be available soon.');
          }
        }
      ]
    );
  };

  // Format time remaining
  const formatTimeRemaining = (endBlock: number) => {
    const remaining = endBlock - currentBlock;
    if (remaining <= 0) return 'Ended';
    const time = blocksToTime(remaining);
    if (time.days > 0) return `${time.days}d ${time.hours}h`;
    if (time.hours > 0) return `${time.hours}h ${time.minutes}m`;
    return `${time.minutes}m`;
  };

  // Format address
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Render access denied screen
  if (checkingAccess) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient colors={[KurdistanColors.kesk, '#006633']} style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.spi} />
          <Text style={styles.loadingText}>Checking access...</Text>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  if (!hasWelatiTiki) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <LinearGradient
          colors={[KurdistanColors.kesk, KurdistanColors.zer, KurdistanColors.sor]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.accessDeniedContainer}
        >
          <View style={styles.accessDeniedContent}>
            <Text style={styles.accessDeniedIcon}>🏛️</Text>
            <Text style={styles.accessDeniedTitle}>Citizenship Required</Text>
            <Text style={styles.accessDeniedSubtitle}>
              Pêdivî ye ku hûn welatî bin da ku bikarin beşdarî hilbijartinê bibin
            </Text>
            <Text style={styles.accessDeniedText}>
              You must be a citizen to participate in presidential elections.
              Please complete your citizenship application first.
            </Text>

            <TouchableOpacity
              style={styles.becomeCitizenButton}
              onPress={() => navigation.navigate('BeCitizen' as never)}
            >
              <Text style={styles.becomeCitizenButtonText}>Become a Citizen</Text>
            </TouchableOpacity>

          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Main content
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <LinearGradient
        colors={[KurdistanColors.kesk, '#006633']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerIcon}>👑</Text>
          <Text style={styles.headerTitle}>Serokî / President</Text>
          <Text style={styles.headerSubtitle}>Hilbijartina Serokê Komarê</Text>
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

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.tabActive]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
            Dîrok
          </Text>
          <Text style={[styles.tabSubtext, activeTab === 'history' && styles.tabSubtextActive]}>
            History
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'active' && styles.tabActive]}
          onPress={() => setActiveTab('active')}
        >
          <Text style={[styles.tabText, activeTab === 'active' && styles.tabTextActive]}>
            Hilbijartin
          </Text>
          <Text style={[styles.tabSubtext, activeTab === 'active' && styles.tabSubtextActive]}>
            Elections
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'candidate' && styles.tabActive]}
          onPress={() => setActiveTab('candidate')}
        >
          <Text style={[styles.tabText, activeTab === 'candidate' && styles.tabTextActive]}>
            Berendam
          </Text>
          <Text style={[styles.tabSubtext, activeTab === 'candidate' && styles.tabSubtextActive]}>
            Candidate
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchElectionData();
          }} />
        }
      >
        {loading ? (
          <View style={styles.loadingSection}>
            <ActivityIndicator size="large" color={KurdistanColors.kesk} />
            <Text style={styles.loadingSectionText}>Loading elections...</Text>
          </View>
        ) : (
          <>
            {/* History Tab */}
            {activeTab === 'history' && (
              <View style={styles.tabContent}>
                <Text style={styles.sectionTitle}>Past Presidential Elections</Text>

                {pastElections.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>📜</Text>
                    <Text style={styles.emptyStateText}>No past elections yet</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Presidential election history will appear here
                    </Text>
                  </View>
                ) : (
                  pastElections.map((result, index) => (
                    <View key={result.electionId} style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyTitle}>Election #{result.electionId}</Text>
                        <View style={styles.historyBadge}>
                          <Text style={styles.historyBadgeText}>Completed</Text>
                        </View>
                      </View>

                      <View style={styles.historyWinner}>
                        <Text style={styles.historyWinnerLabel}>Winner (Serok)</Text>
                        <Text style={styles.historyWinnerAddress}>
                          👑 {result.winners[0] ? formatAddress(result.winners[0]) : 'N/A'}
                        </Text>
                      </View>

                      <View style={styles.historyStats}>
                        <View style={styles.historyStat}>
                          <Text style={styles.historyStatValue}>{result.totalVotes}</Text>
                          <Text style={styles.historyStatLabel}>Total Votes</Text>
                        </View>
                        <View style={styles.historyStat}>
                          <Text style={styles.historyStatValue}>{result.turnoutPercentage}%</Text>
                          <Text style={styles.historyStatLabel}>Turnout</Text>
                        </View>
                        <View style={styles.historyStat}>
                          <Text style={styles.historyStatValue}>
                            {result.runoffRequired ? 'Yes' : 'No'}
                          </Text>
                          <Text style={styles.historyStatLabel}>Runoff</Text>
                        </View>
                      </View>
                    </View>
                  ))
                )}
              </View>
            )}

            {/* Active Elections Tab */}
            {activeTab === 'active' && (
              <View style={styles.tabContent}>
                {activeElections.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateIcon}>🗳️</Text>
                    <Text style={styles.emptyStateText}>No active elections</Text>
                    <Text style={styles.emptyStateSubtext}>
                      Presidential elections will appear here when initiated
                    </Text>
                  </View>
                ) : (
                  <>
                    {/* Election Info Card */}
                    {selectedElection && (
                      <View style={styles.electionCard}>
                        <LinearGradient
                          colors={[KurdistanColors.kesk, '#008844']}
                          style={styles.electionCardHeader}
                        >
                          <Text style={styles.electionCardTitle}>
                            Presidential Election #{selectedElection.electionId}
                          </Text>
                          <View style={styles.electionStatusBadge}>
                            <Text style={styles.electionStatusText}>
                              {selectedElection.status === 'VotingPeriod' ? '🗳️ Voting Open' :
                               selectedElection.status === 'CandidacyPeriod' ? '📝 Registration Open' :
                               selectedElection.status === 'CampaignPeriod' ? '📢 Campaign Period' :
                               'Completed'}
                            </Text>
                          </View>
                        </LinearGradient>

                        <View style={styles.electionCardBody}>
                          <View style={styles.electionStats}>
                            <View style={styles.electionStat}>
                              <Text style={styles.electionStatValue}>
                                {selectedElection.totalCandidates}
                              </Text>
                              <Text style={styles.electionStatLabel}>Candidates</Text>
                            </View>
                            <View style={styles.electionStat}>
                              <Text style={styles.electionStatValue}>
                                {selectedElection.totalVotes}
                              </Text>
                              <Text style={styles.electionStatLabel}>Votes Cast</Text>
                            </View>
                            <View style={styles.electionStat}>
                              <Text style={styles.electionStatValue}>
                                {formatTimeRemaining(selectedElection.votingEndBlock)}
                              </Text>
                              <Text style={styles.electionStatLabel}>Time Left</Text>
                            </View>
                          </View>

                          {userHasVoted && (
                            <View style={styles.votedBadge}>
                              <Text style={styles.votedBadgeText}>✓ You have voted</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}

                    {/* Candidates List */}
                    <Text style={styles.sectionTitle}>Candidates</Text>

                    {candidates.length === 0 ? (
                      <View style={styles.noCandidates}>
                        <Text style={styles.noCandidatesText}>
                          No candidates registered yet
                        </Text>
                      </View>
                    ) : (
                      candidates.map((candidate, index) => (
                        <TouchableOpacity
                          key={candidate.account}
                          style={[
                            styles.candidateCard,
                            index === 0 && styles.candidateCardLeader
                          ]}
                          onPress={() => {
                            if (!userHasVoted && selectedElection?.status === 'VotingPeriod') {
                              setSelectedCandidate(candidate);
                              setShowVoteModal(true);
                            }
                          }}
                          disabled={userHasVoted || selectedElection?.status !== 'VotingPeriod'}
                        >
                          <View style={styles.candidateRank}>
                            <Text style={styles.candidateRankText}>
                              {index === 0 ? '👑' : `#${index + 1}`}
                            </Text>
                          </View>

                          <View style={styles.candidateInfo}>
                            <Text style={styles.candidateAddress}>
                              {formatAddress(candidate.account)}
                            </Text>
                            <Text style={styles.candidateEndorsements}>
                              {candidate.endorsersCount} endorsements
                            </Text>
                          </View>

                          <View style={styles.candidateVotes}>
                            <Text style={styles.candidateVoteCount}>{candidate.voteCount}</Text>
                            <Text style={styles.candidateVoteLabel}>votes</Text>
                          </View>

                          {!userHasVoted && selectedElection?.status === 'VotingPeriod' && (
                            <View style={styles.voteButton}>
                              <Text style={styles.voteButtonText}>Vote</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))
                    )}
                  </>
                )}
              </View>
            )}

            {/* Become Candidate Tab */}
            {activeTab === 'candidate' && (
              <View style={styles.tabContent}>
                <View style={styles.candidateInfoCard}>
                  <Text style={styles.candidateInfoTitle}>Become a Presidential Candidate</Text>
                  <Text style={styles.candidateInfoSubtitle}>
                    Bibin berendamê serokîtiyê
                  </Text>

                  <View style={styles.requirementsList}>
                    <Text style={styles.requirementsTitle}>Requirements:</Text>

                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementIcon}>✓</Text>
                      <Text style={styles.requirementText}>
                        Welati Tiki (Citizenship)
                      </Text>
                      <Text style={styles.requirementStatus}>✅</Text>
                    </View>

                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementIcon}>📊</Text>
                      <Text style={styles.requirementText}>
                        Trust Score: {PRESIDENTIAL_REQUIREMENTS.minTrustScore}+
                      </Text>
                      <Text style={styles.requirementStatus}>
                        {eligibilityStatus ?
                          (eligibilityStatus.trustScore >= PRESIDENTIAL_REQUIREMENTS.minTrustScore ? '✅' : '❌')
                          : '❓'}
                      </Text>
                    </View>

                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementIcon}>👥</Text>
                      <Text style={styles.requirementText}>
                        {PRESIDENTIAL_REQUIREMENTS.minEndorsements}+ Endorsements
                      </Text>
                      <Text style={styles.requirementStatus}>❓</Text>
                    </View>

                    <View style={styles.requirementItem}>
                      <Text style={styles.requirementIcon}>💰</Text>
                      <Text style={styles.requirementText}>
                        Deposit: {PRESIDENTIAL_REQUIREMENTS.depositAmount}
                      </Text>
                      <Text style={styles.requirementStatus}>❓</Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    style={styles.checkEligibilityButton}
                    onPress={checkCandidateEligibility}
                    disabled={checkingEligibility}
                  >
                    {checkingEligibility ? (
                      <ActivityIndicator color={KurdistanColors.spi} />
                    ) : (
                      <Text style={styles.checkEligibilityText}>Check My Eligibility</Text>
                    )}
                  </TouchableOpacity>

                  {eligibilityStatus && (
                    <View style={[
                      styles.eligibilityResult,
                      eligibilityStatus.eligible ? styles.eligibilityResultSuccess : styles.eligibilityResultFail
                    ]}>
                      <Text style={styles.eligibilityResultTitle}>
                        {eligibilityStatus.eligible ? '✅ You are eligible!' : '❌ Not eligible yet'}
                      </Text>
                      {eligibilityStatus.reasons.map((reason, i) => (
                        <Text key={i} style={styles.eligibilityResultReason}>• {reason}</Text>
                      ))}

                      {eligibilityStatus.eligible && selectedElection?.status === 'CandidacyPeriod' && (
                        <TouchableOpacity
                          style={styles.registerButton}
                          onPress={handleRegisterCandidate}
                        >
                          <Text style={styles.registerButtonText}>Register as Candidate</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Vote Confirmation Modal */}
      <Modal
        visible={showVoteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowVoteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Confirm Your Vote</Text>
            <Text style={styles.modalSubtitle}>
              Dengê xwe piştrast bikin
            </Text>

            {selectedCandidate && (
              <View style={styles.modalCandidate}>
                <Text style={styles.modalCandidateLabel}>Voting for:</Text>
                <Text style={styles.modalCandidateAddress}>
                  {formatAddress(selectedCandidate.account)}
                </Text>
              </View>
            )}

            <Text style={styles.modalWarning}>
              ⚠️ Your vote cannot be changed after submission.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => {
                  setShowVoteModal(false);
                  setSelectedCandidate(null);
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={handleVote}
                disabled={submittingVote}
              >
                {submittingVote ? (
                  <ActivityIndicator color={KurdistanColors.spi} />
                ) : (
                  <Text style={styles.modalConfirmText}>Confirm Vote</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: KurdistanColors.spi,
    marginTop: 16,
    fontSize: 16,
  },

  // Access Denied
  accessDeniedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  accessDeniedContent: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 24,
    padding: 32,
    margin: 24,
    alignItems: 'center',
    boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.2)',
    elevation: 10,
  },
  accessDeniedIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  accessDeniedTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  accessDeniedSubtitle: {
    fontSize: 14,
    color: KurdistanColors.kesk,
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  accessDeniedText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  becomeCitizenButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  becomeCitizenButtonText: {
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

  // Tabs
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: KurdistanColors.spi,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: `${KurdistanColors.kesk}15`,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: KurdistanColors.kesk,
  },
  tabSubtext: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  tabSubtextActive: {
    color: KurdistanColors.kesk,
  },

  // Content
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
  },

  // Loading section
  loadingSection: {
    padding: 60,
    alignItems: 'center',
  },
  loadingSectionText: {
    marginTop: 12,
    color: '#666',
  },

  // Section title
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 16,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },

  // History card
  historyCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.08)',
    elevation: 3,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  historyBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyBadgeText: {
    color: KurdistanColors.kesk,
    fontSize: 12,
    fontWeight: '600',
  },
  historyWinner: {
    backgroundColor: `${KurdistanColors.zer}20`,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  historyWinnerLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  historyWinnerAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  historyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  historyStat: {
    alignItems: 'center',
  },
  historyStatValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  historyStatLabel: {
    fontSize: 12,
    color: '#666',
  },

  // Election card
  electionCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.1)',
    elevation: 5,
  },
  electionCardHeader: {
    padding: 20,
    alignItems: 'center',
  },
  electionCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    marginBottom: 8,
  },
  electionStatusBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
  },
  electionStatusText: {
    color: KurdistanColors.spi,
    fontSize: 14,
    fontWeight: '600',
  },
  electionCardBody: {
    backgroundColor: KurdistanColors.spi,
    padding: 20,
  },
  electionStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  electionStat: {
    alignItems: 'center',
  },
  electionStatValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  electionStatLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  votedBadge: {
    backgroundColor: '#E8F5E9',
    padding: 12,
    borderRadius: 12,
    marginTop: 16,
    alignItems: 'center',
  },
  votedBadgeText: {
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },

  // Candidates
  noCandidates: {
    padding: 24,
    alignItems: 'center',
  },
  noCandidatesText: {
    color: '#999',
    fontSize: 14,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  candidateCardLeader: {
    borderWidth: 2,
    borderColor: KurdistanColors.zer,
  },
  candidateRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  candidateRankText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateAddress: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
    fontFamily: 'monospace',
  },
  candidateEndorsements: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  candidateVotes: {
    alignItems: 'center',
    marginRight: 12,
  },
  candidateVoteCount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  candidateVoteLabel: {
    fontSize: 10,
    color: '#666',
  },
  voteButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  voteButtonText: {
    color: KurdistanColors.spi,
    fontWeight: 'bold',
    fontSize: 14,
  },

  // Candidate info card
  candidateInfoCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 24,
    boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.08)',
    elevation: 4,
  },
  candidateInfoTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 4,
  },
  candidateInfoSubtitle: {
    fontSize: 14,
    color: KurdistanColors.kesk,
    marginBottom: 24,
    fontStyle: 'italic',
  },
  requirementsList: {
    marginBottom: 24,
  },
  requirementsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 16,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  requirementIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  requirementText: {
    flex: 1,
    fontSize: 14,
    color: KurdistanColors.reş,
  },
  requirementStatus: {
    fontSize: 20,
  },
  checkEligibilityButton: {
    backgroundColor: KurdistanColors.kesk,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkEligibilityText: {
    color: KurdistanColors.spi,
    fontSize: 16,
    fontWeight: 'bold',
  },
  eligibilityResult: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
  },
  eligibilityResultSuccess: {
    backgroundColor: '#E8F5E9',
  },
  eligibilityResultFail: {
    backgroundColor: '#FFEBEE',
  },
  eligibilityResultTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  eligibilityResultReason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  registerButton: {
    backgroundColor: KurdistanColors.zer,
    padding: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 16,
  },
  registerButtonText: {
    color: KurdistanColors.reş,
    fontSize: 16,
    fontWeight: 'bold',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: KurdistanColors.spi,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    color: KurdistanColors.kesk,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalCandidate: {
    backgroundColor: '#F5F5F5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalCandidateLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  modalCandidateAddress: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    fontFamily: 'monospace',
  },
  modalWarning: {
    fontSize: 14,
    color: KurdistanColors.sor,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  modalConfirmButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
});

export default PresidentScreen;
