import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Pressable,
} from 'react-native';
import { usePolkadot } from '../contexts/PolkadotContext';
import { AppColors, KurdistanColors } from '../theme/colors';
import {
  Card,
  Button,
  BottomSheet,
  Badge,
  CardSkeleton,
} from '../components';

interface Proposal {
  index: number;
  proposer: string;
  description: string;
  value: string;
  beneficiary: string;
  bond: string;
  ayes: number;
  nays: number;
  status: 'active' | 'approved' | 'rejected';
  endBlock: number;
}

/**
 * Governance Screen
 * View proposals, vote, participate in governance
 * Inspired by Polkadot governance and modern DAO interfaces
 */
export default function GovernanceScreen() {
  const { api, selectedAccount, isApiReady } = usePolkadot();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [voteSheetVisible, setVoteSheetVisible] = useState(false);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (isApiReady && selectedAccount) {
      fetchProposals();
    }
  }, [isApiReady, selectedAccount]);

  const fetchProposals = async () => {
    try {
      setLoading(true);

      if (!api) return;

      // Fetch democracy proposals
      const proposalEntries = await api.query.democracy?.publicProps();

      if (!proposalEntries || proposalEntries.isEmpty) {
        setProposals([]);
        return;
      }

      const proposalsList: Proposal[] = [];

      // Parse proposals
      const publicProps = proposalEntries.toJSON() as any[];

      for (const [index, proposal, proposer] of publicProps) {
        // Get proposal hash and details
        const proposalHash = proposal;

        // For demo, create sample proposals
        // In production, decode actual proposal data
        proposalsList.push({
          index: index as number,
          proposer: proposer as string,
          description: `Proposal #${index}: Infrastructure Development`,
          value: '10000',
          beneficiary: '5GrwvaEF...',
          bond: '1000',
          ayes: Math.floor(Math.random() * 1000),
          nays: Math.floor(Math.random() * 200),
          status: 'active',
          endBlock: 1000000,
        });
      }

      setProposals(proposalsList);
    } catch (error) {
      console.error('Error fetching proposals:', error);
      Alert.alert('Error', 'Failed to load proposals');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleVote = async (approve: boolean) => {
    if (!selectedProposal) return;

    try {
      setVoting(true);

      if (!api || !selectedAccount) return;

      // Vote on proposal (referendum)
      const tx = approve
        ? api.tx.democracy.vote(selectedProposal.index, { Standard: { vote: { aye: true, conviction: 'None' }, balance: '1000000000000' } })
        : api.tx.democracy.vote(selectedProposal.index, { Standard: { vote: { aye: false, conviction: 'None' }, balance: '1000000000000' } });

      await tx.signAndSend(selectedAccount.address, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert(
            'Success',
            `Vote ${approve ? 'FOR' : 'AGAINST'} recorded successfully!`
          );
          setVoteSheetVisible(false);
          setSelectedProposal(null);
          fetchProposals();
        }
      });
    } catch (error: any) {
      console.error('Voting error:', error);
      Alert.alert('Error', error.message || 'Failed to submit vote');
    } finally {
      setVoting(false);
    }
  };

  if (loading && proposals.length === 0) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </ScrollView>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchProposals();
            }}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Governance</Text>
          <Text style={styles.headerSubtitle}>
            Participate in digital democracy
          </Text>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>{proposals.length}</Text>
            <Text style={styles.statLabel}>Active Proposals</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statValue}>1,234</Text>
            <Text style={styles.statLabel}>Total Voters</Text>
          </Card>
        </View>

        {/* Proposals List */}
        <Text style={styles.sectionTitle}>Active Proposals</Text>
        {proposals.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No active proposals</Text>
            <Text style={styles.emptySubtext}>
              Check back later for new governance proposals
            </Text>
          </Card>
        ) : (
          proposals.map((proposal) => (
            <ProposalCard
              key={proposal.index}
              proposal={proposal}
              onPress={() => {
                setSelectedProposal(proposal);
                setVoteSheetVisible(true);
              }}
            />
          ))
        )}

        {/* Info Card */}
        <Card variant="outlined" style={styles.infoCard}>
          <Text style={styles.infoTitle}>🗳️ How Voting Works</Text>
          <Text style={styles.infoText}>
            Each HEZ token equals one vote. Your vote helps shape the future of Digital Kurdistan. Proposals need majority approval to pass.
          </Text>
        </Card>
      </ScrollView>

      {/* Vote Bottom Sheet */}
      <BottomSheet
        visible={voteSheetVisible}
        onClose={() => setVoteSheetVisible(false)}
        title="Vote on Proposal"
        height={500}
      >
        {selectedProposal && (
          <View>
            <Text style={styles.proposalTitle}>
              {selectedProposal.description}
            </Text>
            <View style={styles.proposalDetails}>
              <DetailRow label="Requested" value={`${selectedProposal.value} HEZ`} />
              <DetailRow label="Beneficiary" value={selectedProposal.beneficiary} />
              <DetailRow label="Current Votes" value={`${selectedProposal.ayes} For / ${selectedProposal.nays} Against`} />
            </View>

            {/* Vote Progress */}
            <View style={styles.voteProgress}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${(selectedProposal.ayes / (selectedProposal.ayes + selectedProposal.nays)) * 100}%`,
                    },
                  ]}
                />
              </View>
              <View style={styles.progressLabels}>
                <Text style={styles.ayesLabel}>{selectedProposal.ayes} For</Text>
                <Text style={styles.naysLabel}>{selectedProposal.nays} Against</Text>
              </View>
            </View>

            {/* Vote Buttons */}
            <View style={styles.voteButtons}>
              <Button
                title="Vote FOR"
                onPress={() => handleVote(true)}
                loading={voting}
                disabled={voting}
                variant="primary"
                fullWidth
              />
              <Button
                title="Vote AGAINST"
                onPress={() => handleVote(false)}
                loading={voting}
                disabled={voting}
                variant="danger"
                fullWidth
              />
            </View>
          </View>
        )}
      </BottomSheet>
    </View>
  );
}

const ProposalCard: React.FC<{
  proposal: Proposal;
  onPress: () => void;
}> = ({ proposal, onPress }) => {
  const totalVotes = proposal.ayes + proposal.nays;
  const approvalRate = totalVotes > 0 ? (proposal.ayes / totalVotes) * 100 : 0;

  return (
    <Card onPress={onPress} style={styles.proposalCard}>
      <View style={styles.proposalHeader}>
        <Badge
          label={`#${proposal.index}`}
          variant="primary"
          size="small"
        />
        <Badge
          label={proposal.status}
          variant={proposal.status === 'active' ? 'info' : 'success'}
          size="small"
        />
      </View>
      <Text style={styles.proposalDescription} numberOfLines={2}>
        {proposal.description}
      </Text>
      <View style={styles.proposalStats}>
        <View style={styles.proposalStat}>
          <Text style={styles.proposalStatLabel}>Requested</Text>
          <Text style={styles.proposalStatValue}>{proposal.value} HEZ</Text>
        </View>
        <View style={styles.proposalStat}>
          <Text style={styles.proposalStatLabel}>Approval</Text>
          <Text
            style={[
              styles.proposalStatValue,
              { color: approvalRate > 50 ? KurdistanColors.kesk : KurdistanColors.sor },
            ]}
          >
            {approvalRate.toFixed(0)}%
          </Text>
        </View>
      </View>
    </Card>
  );
};

const DetailRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue} numberOfLines={1}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: AppColors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: AppColors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 20,
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: KurdistanColors.kesk,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: AppColors.textSecondary,
    textAlign: 'center',
  },
  proposalCard: {
    marginBottom: 12,
  },
  proposalHeader: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  proposalDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 12,
  },
  proposalStats: {
    flexDirection: 'row',
    gap: 24,
  },
  proposalStat: {
    flex: 1,
  },
  proposalStatLabel: {
    fontSize: 12,
    color: AppColors.textSecondary,
    marginBottom: 4,
  },
  proposalStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
  },
  infoCard: {
    marginTop: 16,
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: AppColors.textSecondary,
    lineHeight: 20,
  },
  proposalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: AppColors.text,
    marginBottom: 16,
  },
  proposalDetails: {
    gap: 12,
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: 14,
    color: AppColors.textSecondary,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: AppColors.text,
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  voteProgress: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: AppColors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: KurdistanColors.kesk,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ayesLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  naysLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: KurdistanColors.sor,
  },
  voteButtons: {
    gap: 12,
  },
});
