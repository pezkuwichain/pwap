import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { usePezkuwi } from '../../contexts/PezkuwiContext';
import { KurdistanColors } from '../../theme/colors';
import { logger } from '../../utils/logger';

// Conviction multiplier for voting lock period
const CONVICTION_OPTIONS = [
  { label: '0.1x  No lock', value: 0 },
  { label: '1x  1 era lock', value: 1 },
  { label: '2x  2 era lock', value: 2 },
  { label: '3x  4 era lock', value: 3 },
  { label: '4x  8 era lock', value: 4 },
  { label: '5x  16 era lock', value: 5 },
  { label: '6x  32 era lock', value: 6 },
];

interface Referendum {
  index: number;
  status: 'ongoing' | 'approved' | 'rejected' | 'cancelled' | 'timedOut';
  track: number;
  trackName: string;
  proposal: string;
  ayes: string;
  nays: string;
  support: string;
  submissionDeposit: string;
  decisionDeposit: string;
  deciding: { since: number; confirming: number | null } | null;
  enactment: string;
}

type ReferendumFilter = 'ongoing' | 'all' | 'past';

const GovernanceScreen: React.FC = () => {
  const { api, isApiReady, selectedAccount, getKeyPair } = usePezkuwi();

  const [referenda, setReferenda] = useState<Referendum[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ReferendumFilter>('ongoing');
  const [processing, setProcessing] = useState(false);

  // Vote modal state
  const [voteModalVisible, setVoteModalVisible] = useState(false);
  const [selectedRef, setSelectedRef] = useState<Referendum | null>(null);
  const [voteAmount, setVoteAmount] = useState('');
  const [voteConviction, setVoteConviction] = useState(1);
  const [voteDirection, setVoteDirection] = useState<'aye' | 'nay'>('aye');

  // Track names for OpenGov
  const trackNames: Record<number, string> = {
    0: 'Root',
    1: 'Whitelisted Caller',
    10: 'Staking Admin',
    11: 'Treasurer',
    12: 'Lease Admin',
    13: 'Fellowship Admin',
    14: 'General Admin',
    15: 'Auction Admin',
    20: 'Referendum Canceller',
    21: 'Referendum Killer',
    30: 'Small Tipper',
    31: 'Big Tipper',
    32: 'Small Spender',
    33: 'Medium Spender',
    34: 'Big Spender',
  };

  const fetchReferenda = useCallback(async () => {
    if (!api || !isApiReady) return;

    try {
      if (!refreshing) setLoading(true);

      const entries = await api.query.referenda.referendumInfoFor.entries();
      const refs: Referendum[] = [];

      for (const [key, value] of entries) {
        const index = (key.args[0] as unknown as { toNumber(): number }).toNumber();
        const info = value.toJSON() as unknown as Record<string, unknown>;

        if (!info) continue;

        let ref: Referendum | null = null;

        if (info.ongoing) {
          const ongoing = info.ongoing as Record<string, unknown>;
          const tally = ongoing.tally as { ayes?: string | number; nays?: string | number; support?: string | number } | undefined;
          const track = Number(ongoing.track || 0);
          const deciding = ongoing.deciding as { since?: number; confirming?: number | null } | null;

          ref = {
            index,
            status: 'ongoing',
            track,
            trackName: trackNames[track] || `Track ${track}`,
            proposal: JSON.stringify(ongoing.proposal || {}).slice(0, 80),
            ayes: String(tally?.ayes || '0'),
            nays: String(tally?.nays || '0'),
            support: String(tally?.support || '0'),
            submissionDeposit: String((ongoing.submissionDeposit as Record<string, unknown>)?.amount || '0'),
            decisionDeposit: ongoing.decisionDeposit
              ? String((ongoing.decisionDeposit as Record<string, unknown>)?.amount || '0')
              : '0',
            deciding: deciding ? { since: deciding.since || 0, confirming: deciding.confirming || null } : null,
            enactment: JSON.stringify(ongoing.enactment || {}),
          };
        } else if (info.approved) {
          ref = {
            index, status: 'approved', track: 0, trackName: '', proposal: '',
            ayes: '0', nays: '0', support: '0',
            submissionDeposit: '0', decisionDeposit: '0', deciding: null, enactment: '',
          };
        } else if (info.rejected) {
          ref = {
            index, status: 'rejected', track: 0, trackName: '', proposal: '',
            ayes: '0', nays: '0', support: '0',
            submissionDeposit: '0', decisionDeposit: '0', deciding: null, enactment: '',
          };
        } else if (info.cancelled) {
          ref = {
            index, status: 'cancelled', track: 0, trackName: '', proposal: '',
            ayes: '0', nays: '0', support: '0',
            submissionDeposit: '0', decisionDeposit: '0', deciding: null, enactment: '',
          };
        }

        if (ref) refs.push(ref);
      }

      refs.sort((a, b) => b.index - a.index);
      setReferenda(refs);
    } catch (error) {
      logger.error('[Governance] Error fetching referenda:', error);
      // Fallback: try democracy pallet (Gov v1)
      try {
        if (api.query.democracy?.referendumInfoOf) {
          const entries = await api.query.democracy.referendumInfoOf.entries();
          const refs: Referendum[] = [];
          for (const [key, value] of entries) {
            const index = (key.args[0] as unknown as { toNumber(): number }).toNumber();
            const info = value.toJSON() as unknown as { ongoing?: { tally?: { ayes?: string; nays?: string } } };
            if (info?.ongoing) {
              refs.push({
                index, status: 'ongoing', track: 0, trackName: 'Democracy', proposal: '',
                ayes: String(info.ongoing.tally?.ayes || '0'),
                nays: String(info.ongoing.tally?.nays || '0'),
                support: '0', submissionDeposit: '0', decisionDeposit: '0', deciding: null, enactment: '',
              });
            }
          }
          refs.sort((a, b) => b.index - a.index);
          setReferenda(refs);
        }
      } catch {
        // Neither referenda nor democracy pallet available
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [api, isApiReady, refreshing]);

  useEffect(() => {
    if (isApiReady) {
      fetchReferenda();
    }
  }, [isApiReady, fetchReferenda]);

  const handleVote = async () => {
    if (!selectedRef || !voteAmount || parseFloat(voteAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!api || !selectedAccount) return;

    try {
      setProcessing(true);
      const keyPair = await getKeyPair(selectedAccount.address);
      if (!keyPair) {
        Alert.alert('Error', 'Could not retrieve keypair');
        return;
      }

      const amountPlanck = BigInt(Math.floor(parseFloat(voteAmount) * 1e12));

      let tx;
      if (api.tx.convictionVoting?.vote) {
        tx = api.tx.convictionVoting.vote(selectedRef.index, {
          Standard: {
            vote: { aye: voteDirection === 'aye', conviction: voteConviction },
            balance: amountPlanck,
          },
        });
      } else if (api.tx.democracy?.vote) {
        tx = api.tx.democracy.vote(selectedRef.index, {
          Standard: {
            vote: { aye: voteDirection === 'aye', conviction: voteConviction },
            balance: amountPlanck,
          },
        });
      } else {
        Alert.alert('Error', 'Voting pallet not available on this chain');
        return;
      }

      await tx.signAndSend(keyPair, ({ status }) => {
        if (status.isInBlock) {
          Alert.alert(
            'Success',
            `Voted ${voteDirection.toUpperCase()} on Referendum #${selectedRef.index} with ${voteAmount} HEZ (${CONVICTION_OPTIONS[voteConviction].label})`
          );
          setVoteModalVisible(false);
          setVoteAmount('');
          fetchReferenda();
        }
      });
    } catch (error: unknown) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to vote');
    } finally {
      setProcessing(false);
    }
  };

  const filteredRefs = referenda.filter(r => {
    if (filter === 'ongoing') return r.status === 'ongoing';
    if (filter === 'past') return r.status !== 'ongoing';
    return true;
  });

  const formatAmount = (raw: string): string => {
    const num = Number(raw) / 1e12;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(2);
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Loading referenda...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Filter Tabs */}
      <View style={styles.filterBar}>
        {(['ongoing', 'all', 'past'] as ReferendumFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
            accessibilityRole="button"
            accessibilityLabel={`Filter ${f === 'ongoing' ? 'active' : f === 'all' ? 'all' : 'past'} referenda`}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'ongoing' ? 'Active' : f === 'all' ? 'All' : 'Past'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            fetchReferenda();
          }} />
        }
      >
        {filteredRefs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🗳️</Text>
            <Text style={styles.emptyText}>No referenda found</Text>
          </View>
        ) : (
          filteredRefs.map((ref) => {
            const totalVotes = Number(ref.ayes) + Number(ref.nays);
            const ayePct = totalVotes > 0 ? (Number(ref.ayes) / totalVotes) * 100 : 50;

            return (
              <TouchableOpacity
                key={ref.index}
                style={styles.refCard}
                onPress={() => {
                  if (ref.status === 'ongoing' && selectedAccount) {
                    setSelectedRef(ref);
                    setVoteModalVisible(true);
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Referendum number ${ref.index}, status ${ref.status}${ref.status === 'ongoing' ? ', tap to vote' : ''}`}
              >
                <View style={styles.refHeader}>
                  <Text style={styles.refIndex}>#{ref.index}</Text>
                  <View style={[
                    styles.refStatusBadge,
                    ref.status === 'ongoing' ? styles.refStatusOngoing :
                    ref.status === 'approved' ? styles.refStatusApproved :
                    styles.refStatusRejected
                  ]}>
                    <Text style={styles.refStatusText}>
                      {ref.status === 'ongoing' ? 'Active' :
                       ref.status === 'approved' ? 'Approved' :
                       ref.status === 'rejected' ? 'Rejected' : 'Cancelled'}
                    </Text>
                  </View>
                </View>

                {ref.trackName ? (
                  <Text style={styles.refTrack}>{ref.trackName}</Text>
                ) : null}

                {/* Vote Bar */}
                {ref.status === 'ongoing' && (
                  <View style={styles.voteBarContainer}>
                    <View style={styles.voteLabels}>
                      <Text style={styles.voteAyeLabel}>Aye {formatAmount(ref.ayes)}</Text>
                      <Text style={styles.voteNayLabel}>Nay {formatAmount(ref.nays)}</Text>
                    </View>
                    <View style={styles.voteBar}>
                      <View style={[styles.voteBarAye, { flex: ayePct }]} />
                      <View style={[styles.voteBarNay, { flex: 100 - ayePct }]} />
                    </View>
                    <Text style={styles.voteSupportText}>
                      Support: {formatAmount(ref.support)} HEZ
                    </Text>
                  </View>
                )}

                {ref.deciding && (
                  <Text style={styles.refDeciding}>
                    Deciding since era {ref.deciding.since}
                    {ref.deciding.confirming ? ` (confirming at ${ref.deciding.confirming})` : ''}
                  </Text>
                )}

                {ref.status === 'ongoing' && selectedAccount && (
                  <View style={styles.votePrompt}>
                    <Text style={styles.votePromptText}>Tap to vote</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Vote Modal */}
      <Modal visible={voteModalVisible} transparent animationType="slide" onRequestClose={() => setVoteModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Vote on Referendum #{selectedRef?.index}</Text>

            {/* Aye / Nay Toggle */}
            <View style={styles.voteToggle}>
              <TouchableOpacity
                style={[styles.voteToggleBtn, voteDirection === 'aye' && styles.voteToggleAye]}
                onPress={() => setVoteDirection('aye')}
                accessibilityRole="button"
                accessibilityLabel="Vote aye, in favor"
              >
                <Text style={[styles.voteToggleText, voteDirection === 'aye' && styles.voteToggleTextActive]}>
                  Aye
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.voteToggleBtn, voteDirection === 'nay' && styles.voteToggleNay]}
                onPress={() => setVoteDirection('nay')}
                accessibilityRole="button"
                accessibilityLabel="Vote nay, against"
              >
                <Text style={[styles.voteToggleText, voteDirection === 'nay' && styles.voteToggleTextActive]}>
                  Nay
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <Text style={styles.inputLabel}>Amount (HEZ)</Text>
            <TextInput
              style={styles.inputField}
              placeholder="0.00"
              keyboardType="numeric"
              value={voteAmount}
              onChangeText={setVoteAmount}
              accessibilityLabel="Vote amount in HEZ"
            />

            {/* Conviction */}
            <Text style={styles.inputLabel}>Conviction (lock multiplier)</Text>
            <ScrollView style={styles.convictionList} nestedScrollEnabled>
              {CONVICTION_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.convictionOption, voteConviction === opt.value && styles.convictionOptionActive]}
                  onPress={() => setVoteConviction(opt.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Conviction ${opt.label}`}
                >
                  <Text style={[
                    styles.convictionOptionText,
                    voteConviction === opt.value && styles.convictionOptionTextActive
                  ]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.btnCancel}
                onPress={() => setVoteModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel vote"
              >
                <Text style={styles.btnCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btnVote, processing && styles.btnDisabled]}
                onPress={handleVote}
                disabled={processing}
                accessibilityRole="button"
                accessibilityLabel={`Submit vote ${voteDirection}`}
              >
                <Text style={styles.btnVoteText}>
                  {processing ? 'Voting...' : `Vote ${voteDirection.toUpperCase()}`}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { padding: 16, paddingBottom: 32 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#888', fontSize: 15 },
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8, gap: 8 },
  filterTab: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20, backgroundColor: '#EEEEEE' },
  filterTabActive: { backgroundColor: KurdistanColors.kesk },
  filterTabText: { fontSize: 14, fontWeight: '600', color: '#666' },
  filterTabTextActive: { color: '#FFFFFF' },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: '#999' },
  refCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  refHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  refIndex: { fontSize: 18, fontWeight: '700', color: '#333' },
  refStatusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  refStatusOngoing: { backgroundColor: 'rgba(0, 143, 67, 0.1)' },
  refStatusApproved: { backgroundColor: 'rgba(59, 130, 246, 0.1)' },
  refStatusRejected: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  refStatusText: { fontSize: 12, fontWeight: '600', color: '#555' },
  refTrack: { fontSize: 13, color: '#888', marginBottom: 10 },
  voteBarContainer: { marginTop: 4 },
  voteLabels: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  voteAyeLabel: { fontSize: 12, fontWeight: '600', color: '#16A34A' },
  voteNayLabel: { fontSize: 12, fontWeight: '600', color: '#DC2626' },
  voteBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  voteBarAye: { backgroundColor: '#16A34A' },
  voteBarNay: { backgroundColor: '#DC2626' },
  voteSupportText: { fontSize: 11, color: '#999', marginTop: 4 },
  refDeciding: { fontSize: 11, color: '#888', marginTop: 6, fontStyle: 'italic' },
  votePrompt: { marginTop: 10, alignItems: 'center' },
  votePromptText: { fontSize: 13, color: KurdistanColors.kesk, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: '#333', textAlign: 'center', marginBottom: 20 },
  voteToggle: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  voteToggleBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F5F5F5',
    alignItems: 'center', borderWidth: 2, borderColor: 'transparent',
  },
  voteToggleAye: { backgroundColor: 'rgba(22, 163, 74, 0.1)', borderColor: '#16A34A' },
  voteToggleNay: { backgroundColor: 'rgba(220, 38, 38, 0.1)', borderColor: '#DC2626' },
  voteToggleText: { fontSize: 16, fontWeight: '700', color: '#999' },
  voteToggleTextActive: { color: '#333' },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6 },
  inputField: { backgroundColor: '#F5F5F5', borderRadius: 12, padding: 14, fontSize: 16, marginBottom: 16 },
  convictionList: { maxHeight: 200, marginBottom: 20 },
  convictionOption: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, backgroundColor: '#F5F5F5', marginBottom: 6 },
  convictionOptionActive: { backgroundColor: `${KurdistanColors.kesk}15`, borderWidth: 1, borderColor: KurdistanColors.kesk },
  convictionOptionText: { fontSize: 13, color: '#666' },
  convictionOptionTextActive: { color: KurdistanColors.kesk, fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12 },
  btnCancel: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#EEEEEE', alignItems: 'center' },
  btnCancelText: { fontSize: 16, fontWeight: '600', color: '#666' },
  btnVote: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: KurdistanColors.kesk, alignItems: 'center' },
  btnVoteText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  btnDisabled: { backgroundColor: '#9CA3AF' },
});

export default GovernanceScreen;
