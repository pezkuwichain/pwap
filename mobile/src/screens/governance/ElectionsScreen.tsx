import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';

interface ElectionInfo {
  id: string;
  type: 'presidential' | 'parliamentary' | 'speaker' | 'constitutional_court';
  status: 'active' | 'completed' | 'scheduled';
  endBlock: number;
  candidates: number;
  totalVotes: number;
}

interface Candidate {
  address: string;
  name: string;
  votes: number;
  platform: string;
}

// Mock data removed - using dynamicCommissionCollective pallet for elections

const ElectionsScreen: React.FC = () => {
  const { api, isApiReady, error: connectionError } = usePezkuwi();

  const [elections, setElections] = useState<ElectionInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'presidential' | 'parliamentary' | 'speaker' | 'constitutional_court'>('all');

  const fetchElections = async () => {
    if (!api || !isApiReady) return;

    try {
      setLoading(true);

      // Fetch commission proposals (acting as elections)
      if (api.query.dynamicCommissionCollective?.proposals) {
        const proposalHashes = await api.query.dynamicCommissionCollective.proposals() as any;

        const electionsData: ElectionInfo[] = [];

        for (const hash of (proposalHashes || [])) {
          const voting = await api.query.dynamicCommissionCollective.voting(hash) as any;
          if (voting.isSome) {
            const voteData = voting.unwrap();
            electionsData.push({
              id: hash.toString(),
              type: 'parliamentary' as const,
              status: 'active' as const,
              endBlock: voteData.end?.toNumber() || 0,
              candidates: voteData.threshold?.toNumber() || 0,
              totalVotes: (voteData.ayes?.length || 0) + (voteData.nays?.length || 0),
            });
          }
        }

        setElections(electionsData);
      }
    } catch (error) {
      console.error('Failed to load elections:', error);
      Alert.alert('Error', 'Failed to load elections data from blockchain');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchElections();
    const interval = setInterval(fetchElections, 30000);
    return () => clearInterval(interval);
  }, [api, isApiReady]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchElections();
  };

  const handleElectionPress = (election: ElectionInfo) => {
    Alert.alert(
      getElectionTypeLabel(election.type),
      `Candidates: ${election.candidates}\nTotal Votes: ${election.totalVotes}\nStatus: ${election.status}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View Details', onPress: () => Alert.alert('Election Details', 'ElectionDetailsScreen would open here') },
      ]
    );
  };

  const handleRegisterAsCandidate = () => {
    Alert.alert('Register as Candidate', 'Candidate registration form would open here');
  };

  const getElectionTypeLabel = (type: string): string => {
    const labels: Record<string, string> = {
      presidential: '👑 Presidential Election',
      parliamentary: '🏛️ Parliamentary Election',
      speaker: '🎤 Speaker Election',
      constitutional_court: '⚖️ Constitutional Court',
    };
    return labels[type] || type;
  };

  const getElectionIcon = (type: string): string => {
    const icons: Record<string, string> = {
      presidential: '👑',
      parliamentary: '🏛️',
      speaker: '🎤',
      constitutional_court: '⚖️',
    };
    return icons[type] || '🗳️';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return KurdistanColors.kesk;
      case 'completed':
        return '#999';
      case 'scheduled':
        return '#F59E0B';
      default:
        return '#666';
    }
  };

  const filteredElections = selectedType === 'all'
    ? elections
    : elections.filter(e => e.type === selectedType);

  // Show error state
  if (connectionError && !api) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorTitle}>Connection Failed</Text>
          <Text style={styles.errorMessage}>{connectionError}</Text>
          <Text style={styles.errorHint}>
            • Check your internet connection{'\n'}
            • Connection will retry automatically
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchElections}>
            <Text style={styles.retryButtonText}>Retry Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading state
  if (!isApiReady || (loading && elections.length === 0)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Connecting to blockchain...</Text>
          <Text style={styles.loadingHint}>Please wait</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Elections</Text>
          <Text style={styles.headerSubtitle}>Democratic governance for Kurdistan</Text>
        </View>

        {/* Register Button */}
        <TouchableOpacity style={styles.registerButton} onPress={handleRegisterAsCandidate}>
          <Text style={styles.registerButtonText}>➕ Register as Candidate</Text>
        </TouchableOpacity>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'all' && styles.filterTabActive]}
              onPress={() => setSelectedType('all')}
            >
              <Text style={[styles.filterTabText, selectedType === 'all' && styles.filterTabTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'presidential' && styles.filterTabActive]}
              onPress={() => setSelectedType('presidential')}
            >
              <Text style={[styles.filterTabText, selectedType === 'presidential' && styles.filterTabTextActive]}>
                👑 Presidential
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'parliamentary' && styles.filterTabActive]}
              onPress={() => setSelectedType('parliamentary')}
            >
              <Text style={[styles.filterTabText, selectedType === 'parliamentary' && styles.filterTabTextActive]}>
                🏛️ Parliamentary
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterTab, selectedType === 'speaker' && styles.filterTabActive]}
              onPress={() => setSelectedType('speaker')}
            >
              <Text style={[styles.filterTabText, selectedType === 'speaker' && styles.filterTabTextActive]}>
                🎤 Speaker
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* Elections List */}
        <View style={styles.electionsList}>
          {filteredElections.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🗳️</Text>
              <Text style={styles.emptyText}>No elections available</Text>
            </View>
          ) : (
            filteredElections.map((election) => (
              <TouchableOpacity
                key={election.id}
                style={styles.electionCard}
                onPress={() => handleElectionPress(election)}
              >
                {/* Election Header */}
                <View style={styles.electionHeader}>
                  <View style={styles.electionTitleRow}>
                    <Text style={styles.electionIcon}>{getElectionIcon(election.type)}</Text>
                    <Text style={styles.electionTitle}>{getElectionTypeLabel(election.type)}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(election.status)}15` }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(election.status) }]}>
                      {election.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Election Stats */}
                <View style={styles.electionStats}>
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>👥</Text>
                    <Text style={styles.statLabel}>Candidates</Text>
                    <Text style={styles.statValue}>{election.candidates}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>🗳️</Text>
                    <Text style={styles.statLabel}>Total Votes</Text>
                    <Text style={styles.statValue}>{election.totalVotes.toLocaleString()}</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statIcon}>⏰</Text>
                    <Text style={styles.statLabel}>End Block</Text>
                    <Text style={styles.statValue}>{election.endBlock.toLocaleString()}</Text>
                  </View>
                </View>

                {/* Vote Button */}
                {election.status === 'active' && (
                  <TouchableOpacity style={styles.voteButton}>
                    <Text style={styles.voteButtonText}>View Candidates & Vote</Text>
                  </TouchableOpacity>
                )}

                {election.status === 'completed' && (
                  <TouchableOpacity style={styles.resultsButton}>
                    <Text style={styles.resultsButtonText}>View Results</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteIcon}>ℹ️</Text>
          <Text style={styles.infoNoteText}>
            Only citizens with verified citizenship status can vote in elections. Your vote is anonymous and recorded on-chain.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  registerButton: {
    backgroundColor: KurdistanColors.kesk,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  registerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  filterTabs: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E5E5',
    marginRight: 8,
  },
  filterTabActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  electionsList: {
    paddingHorizontal: 16,
    gap: 16,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  electionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  electionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  electionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  electionIcon: {
    fontSize: 24,
    marginRight: 8,
  },
  electionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  electionStats: {
    flexDirection: 'row',
    marginBottom: 16,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#E5E5E5',
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
  },
  voteButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  voteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultsButton: {
    backgroundColor: '#E5E5E5',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  resultsButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoNoteIcon: {
    fontSize: 20,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#0C4A6E',
    lineHeight: 18,
  },
  // Error & Loading States
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  errorHint: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  loadingText: {
    fontSize: 16,
    color: '#333',
    marginTop: 16,
  },
  loadingHint: {
    fontSize: 12,
    color: '#999',
    marginTop: 8,
  },
});

export default ElectionsScreen;
