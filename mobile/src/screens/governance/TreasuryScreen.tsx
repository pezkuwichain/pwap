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

interface TreasuryProposal {
  id: string;
  title: string;
  beneficiary: string;
  amount: string;
  status: 'pending' | 'approved' | 'rejected';
  proposer: string;
  bond: string;
}

// Mock data removed - using real blockchain queries

const TreasuryScreen: React.FC = () => {
  const { api, isApiReady, error: connectionError } = usePezkuwi();

  const [treasuryBalance, setTreasuryBalance] = useState('0');
  const [proposals, setProposals] = useState<TreasuryProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const formatBalance = (balance: string, decimals: number = 12): string => {
    const value = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const wholePart = value / divisor;
    return wholePart.toLocaleString();
  };

  const fetchTreasuryData = async () => {
    if (!api || !isApiReady) return;

    try {
      setLoading(true);

      // Fetch treasury balance
      if (api.query.treasury?.treasury) {
        const treasuryAccount = await api.query.treasury.treasury();
        if (treasuryAccount) {
          setTreasuryBalance(formatBalance(treasuryAccount.toString()));
        }
      }

      // Fetch treasury proposals
      if (api.query.treasury?.proposals) {
        const proposalsData = await api.query.treasury.proposals.entries();
        const parsedProposals: TreasuryProposal[] = proposalsData.map(([key, value]: [{ args: [{ toNumber(): number }] }, { unwrap(): { beneficiary: { toString(): string }; value: { toString(): string }; proposer: { toString(): string }; bond: { toString(): string } } }]) => {
          const proposalIndex = key.args[0].toNumber();
          const proposal = value.unwrap();

          return {
            id: `${proposalIndex}`,
            title: `Treasury Proposal #${proposalIndex}`,
            beneficiary: proposal.beneficiary.toString(),
            amount: formatBalance(proposal.value.toString()),
            status: 'pending' as const,
            proposer: proposal.proposer.toString(),
            bond: formatBalance(proposal.bond.toString()),
          };
        });
        setProposals(parsedProposals);
      }
    } catch (_error) {
      if (__DEV__) console.error('Failed to load treasury data:', _error);
      Alert.alert('Error', 'Failed to load treasury data from blockchain');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTreasuryData();
    const interval = setInterval(fetchTreasuryData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, isApiReady]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTreasuryData();
  };

  const handleProposalPress = (proposal: TreasuryProposal) => {
    Alert.alert(
      proposal.title,
      `Amount: ${proposal.amount}\nBeneficiary: ${proposal.beneficiary.slice(0, 10)}...\nBond: ${proposal.bond}\nStatus: ${proposal.status}`,
      [
        { text: 'OK' },
      ]
    );
  };

  const handleCreateProposal = () => {
    Alert.alert('Create Spending Proposal', 'Spending proposal form would open here');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'approved':
        return KurdistanColors.kesk;
      case 'rejected':
        return '#EF4444';
      default:
        return '#666';
    }
  };

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
          <TouchableOpacity style={styles.retryButton} onPress={fetchTreasuryData}>
            <Text style={styles.retryButtonText}>Retry Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Show loading state
  if (!isApiReady || (loading && proposals.length === 0)) {
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
        testID="treasury-scroll-view"
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Treasury</Text>
          <Text style={styles.headerSubtitle}>Community fund management</Text>
        </View>

        {/* Treasury Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>💰 Total Treasury Balance</Text>
          <Text style={styles.balanceValue}>{treasuryBalance} HEZ</Text>
          <Text style={styles.balanceSubtext}>
            Funds allocated through democratic governance
          </Text>
        </View>

        {/* Create Proposal Button */}
        <TouchableOpacity style={styles.createButton} onPress={handleCreateProposal}>
          <Text style={styles.createButtonText}>➕ Propose Spending</Text>
        </TouchableOpacity>

        {/* Spending Proposals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spending Proposals</Text>

          {proposals.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No spending proposals</Text>
            </View>
          ) : (
            proposals.map((proposal) => (
              <TouchableOpacity
                key={proposal.id}
                style={styles.proposalCard}
                onPress={() => handleProposalPress(proposal)}
              >
                {/* Proposal Header */}
                <View style={styles.proposalHeader}>
                  <Text style={styles.proposalTitle}>{proposal.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(proposal.status)}15` }]}>
                    <Text style={[styles.statusBadgeText, { color: getStatusColor(proposal.status) }]}>
                      {proposal.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* Amount */}
                <View style={styles.amountRow}>
                  <Text style={styles.amountLabel}>Requested Amount:</Text>
                  <Text style={styles.amountValue}>{proposal.amount}</Text>
                </View>

                {/* Beneficiary */}
                <Text style={styles.beneficiary}>
                  Beneficiary: {proposal.beneficiary.slice(0, 10)}...{proposal.beneficiary.slice(-6)}
                </Text>

                {/* Proposer & Bond */}
                <View style={styles.metadataRow}>
                  <Text style={styles.metadataItem}>
                    👤 {proposal.proposer.slice(0, 8)}...
                  </Text>
                  <Text style={styles.metadataItem}>
                    📦 Bond: {proposal.bond}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteIcon}>ℹ️</Text>
          <Text style={styles.infoNoteText}>
            Spending proposals require council approval. A bond is required when creating a proposal and will be returned if approved.
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
  balanceCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  balanceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
    marginBottom: 8,
  },
  balanceSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  createButton: {
    backgroundColor: KurdistanColors.kesk,
    marginHorizontal: 16,
    marginBottom: 24,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  section: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
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
  proposalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  proposalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
  },
  amountLabel: {
    fontSize: 14,
    color: '#666',
  },
  amountValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  beneficiary: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginBottom: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  metadataItem: {
    fontSize: 12,
    color: '#999',
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#FEF3C7',
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
    color: '#92400E',
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

export default TreasuryScreen;
