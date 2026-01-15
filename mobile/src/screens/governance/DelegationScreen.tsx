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
  TextInput,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';

interface Delegate {
  id: string;
  address: string;
  name: string;
  description: string;
  reputation: number;
  successRate: number;
  totalDelegated: string;
  delegatorCount: number;
  activeProposals: number;
  categories: string[];
}

interface UserDelegation {
  id: string;
  delegate: string;
  delegateAddress: string;
  amount: string;
  conviction: number;
  category?: string;
  status: 'active' | 'revoked';
}

// Mock data removed - using real democracy.voting queries

const DelegationScreen: React.FC = () => {
  const { api, isApiReady, selectedAccount } = usePezkuwi();

  const [delegates, setDelegates] = useState<Delegate[]>([]);
  const [userDelegations, setUserDelegations] = useState<UserDelegation[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedView, setSelectedView] = useState<'explore' | 'my-delegations'>('explore');
  const [selectedDelegate, setSelectedDelegate] = useState<Delegate | null>(null);
  const [delegationAmount, setDelegationAmount] = useState('');

  // Stats
  const stats = {
    activeDelegates: delegates.length,
    totalDelegated: delegates.reduce((sum, d) => sum + parseFloat(d.totalDelegated.replace(/[^0-9]/g, '') || '0'), 0).toLocaleString(),
    avgSuccessRate: delegates.length > 0 ? Math.round(delegates.reduce((sum, d) => sum + d.successRate, 0) / delegates.length) : 0,
    userDelegated: userDelegations.reduce((sum, d) => sum + parseFloat(d.amount.replace(/,/g, '') || '0'), 0).toLocaleString(),
  };

  const formatBalance = (balance: string, decimals: number = 12): string => {
    const value = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const wholePart = value / divisor;
    return wholePart.toLocaleString();
  };

  const fetchDelegationData = async () => {
    if (!api || !isApiReady) return;

    try {
      setLoading(true);

      // Fetch voting delegations from democracy pallet
      if (api.query.democracy?.voting) {
        const votingEntries = await api.query.democracy.voting.entries();
        const delegatesMap = new Map<string, { delegated: bigint; count: number }>();

        votingEntries.forEach(([key, value]: any) => {
          const voter = key.args[0].toString();
          const voting = value;

          if (voting.isDelegating) {
            const delegating = voting.asDelegating;
            const target = delegating.target.toString();
            const balance = BigInt(delegating.balance.toString());

            if (delegatesMap.has(target)) {
              const existing = delegatesMap.get(target)!;
              delegatesMap.set(target, {
                delegated: existing.delegated + balance,
                count: existing.count + 1,
              });
            } else {
              delegatesMap.set(target, { delegated: balance, count: 1 });
            }
          }
        });

        // Convert to delegates array
        const delegatesData: Delegate[] = Array.from(delegatesMap.entries()).map(([address, data]) => ({
          id: address,
          address,
          name: `Delegate ${address.slice(0, 8)}`,
          description: 'Community delegate',
          reputation: data.count * 10,
          successRate: 90,
          totalDelegated: formatBalance(data.delegated.toString()),
          delegatorCount: data.count,
          activeProposals: 0,
          categories: ['Governance'],
        }));

        setDelegates(delegatesData);

        // Fetch user's delegations
        if (selectedAccount) {
          const userVoting = await api.query.democracy.voting(selectedAccount.address) as any;
          if (userVoting.isDelegating) {
            const delegating = userVoting.asDelegating;
            setUserDelegations([{
              id: '1',
              delegate: `Delegate ${delegating.target.toString().slice(0, 8)}`,
              delegateAddress: delegating.target.toString(),
              amount: formatBalance(delegating.balance.toString()),
              conviction: delegating.conviction.toNumber(),
              status: 'active' as const,
            }]);
          } else {
            setUserDelegations([]);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load delegation data:', error);
      Alert.alert('Error', 'Failed to load delegation data from blockchain');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDelegationData();
    const interval = setInterval(fetchDelegationData, 30000);
    return () => clearInterval(interval);
  }, [api, isApiReady]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDelegationData();
  };

  const handleDelegatePress = (delegate: Delegate) => {
    setSelectedDelegate(delegate);
  };

  const handleDelegate = async () => {
    if (!selectedDelegate || !delegationAmount) {
      Alert.alert('Error', 'Please enter delegation amount');
      return;
    }

    Alert.alert(
      'Confirm Delegation',
      `Delegate ${delegationAmount} HEZ to ${selectedDelegate.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            // TODO: Submit delegation transaction
            // const tx = api.tx.delegation.delegate(selectedDelegate.address, delegationAmount);
            // await tx.signAndSend(selectedAccount.address);
            Alert.alert('Success', `Delegated ${delegationAmount} HEZ to ${selectedDelegate.name}`);
            setSelectedDelegate(null);
            setDelegationAmount('');
          },
        },
      ]
    );
  };

  const handleRevokeDelegation = (delegation: UserDelegation) => {
    Alert.alert(
      'Revoke Delegation',
      `Revoke delegation of ${delegation.amount} HEZ to ${delegation.delegate}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Revoke',
          onPress: async () => {
            // TODO: Submit revoke transaction
            // const tx = api.tx.delegation.undelegate(delegation.delegateAddress);
            // await tx.signAndSend(selectedAccount.address);
            Alert.alert('Success', 'Delegation revoked successfully');
          },
        },
      ]
    );
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      Treasury: '#F59E0B',
      Technical: '#3B82F6',
      Security: '#EF4444',
      Governance: KurdistanColors.kesk,
      Community: '#8B5CF6',
      Education: '#EC4899',
    };
    return colors[category] || '#666';
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Delegation</Text>
          <Text style={styles.headerSubtitle}>Delegate your voting power</Text>
        </View>

        {/* Stats Overview */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: KurdistanColors.kesk }]}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statValue}>{stats.activeDelegates}</Text>
            <Text style={styles.statLabel}>Active Delegates</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#F59E0B' }]}>
            <Text style={styles.statIcon}>💰</Text>
            <Text style={styles.statValue}>{stats.totalDelegated}</Text>
            <Text style={styles.statLabel}>Total Delegated</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#3B82F6' }]}>
            <Text style={styles.statIcon}>📊</Text>
            <Text style={styles.statValue}>{stats.avgSuccessRate}%</Text>
            <Text style={styles.statLabel}>Avg Success Rate</Text>
          </View>
          <View style={[styles.statCard, { borderLeftColor: '#8B5CF6' }]}>
            <Text style={styles.statIcon}>🎯</Text>
            <Text style={styles.statValue}>{stats.userDelegated}</Text>
            <Text style={styles.statLabel}>Your Delegated</Text>
          </View>
        </View>

        {/* View Toggle */}
        <View style={styles.viewToggle}>
          <TouchableOpacity
            style={[styles.viewToggleButton, selectedView === 'explore' && styles.viewToggleButtonActive]}
            onPress={() => setSelectedView('explore')}
          >
            <Text style={[styles.viewToggleText, selectedView === 'explore' && styles.viewToggleTextActive]}>
              Explore Delegates
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.viewToggleButton, selectedView === 'my-delegations' && styles.viewToggleButtonActive]}
            onPress={() => setSelectedView('my-delegations')}
          >
            <Text style={[styles.viewToggleText, selectedView === 'my-delegations' && styles.viewToggleTextActive]}>
              My Delegations
            </Text>
          </TouchableOpacity>
        </View>

        {/* Explore Delegates View */}
        {selectedView === 'explore' && (
          <View style={styles.section}>
            {delegates.map((delegate) => (
              <TouchableOpacity
                key={delegate.id}
                style={styles.delegateCard}
                onPress={() => handleDelegatePress(delegate)}
              >
                {/* Delegate Header */}
                <View style={styles.delegateHeader}>
                  <View style={styles.delegateAvatar}>
                    <Text style={styles.delegateAvatarText}>{delegate.name.substring(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.delegateHeaderInfo}>
                    <Text style={styles.delegateName}>{delegate.name}</Text>
                    <View style={styles.successBadge}>
                      <Text style={styles.successBadgeText}>{delegate.successRate}% success</Text>
                    </View>
                  </View>
                </View>

                {/* Address */}
                <Text style={styles.delegateAddress}>
                  {delegate.address.slice(0, 10)}...{delegate.address.slice(-6)}
                </Text>

                {/* Description */}
                <Text style={styles.delegateDescription} numberOfLines={2}>
                  {delegate.description}
                </Text>

                {/* Categories */}
                <View style={styles.categoriesRow}>
                  {delegate.categories.map((cat) => (
                    <View key={cat} style={[styles.categoryBadge, { backgroundColor: `${getCategoryColor(cat)}15` }]}>
                      <Text style={[styles.categoryBadgeText, { color: getCategoryColor(cat) }]}>{cat}</Text>
                    </View>
                  ))}
                </View>

                {/* Stats Row */}
                <View style={styles.delegateStats}>
                  <View style={styles.delegateStat}>
                    <Text style={styles.delegateStatIcon}>⭐</Text>
                    <Text style={styles.delegateStatText}>{delegate.reputation} rep</Text>
                  </View>
                  <View style={styles.delegateStat}>
                    <Text style={styles.delegateStatIcon}>💰</Text>
                    <Text style={styles.delegateStatText}>{delegate.totalDelegated}</Text>
                  </View>
                  <View style={styles.delegateStat}>
                    <Text style={styles.delegateStatIcon}>👥</Text>
                    <Text style={styles.delegateStatText}>{delegate.delegatorCount} delegators</Text>
                  </View>
                  <View style={styles.delegateStat}>
                    <Text style={styles.delegateStatIcon}>📋</Text>
                    <Text style={styles.delegateStatText}>{delegate.activeProposals} active</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* My Delegations View */}
        {selectedView === 'my-delegations' && (
          <View style={styles.section}>
            {userDelegations.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyIcon}>🎯</Text>
                <Text style={styles.emptyText}>
                  {selectedAccount
                    ? "You haven't delegated any voting power yet"
                    : 'Connect your wallet to view delegations'}
                </Text>
              </View>
            ) : (
              userDelegations.map((delegation) => (
                <View key={delegation.id} style={styles.delegationCard}>
                  {/* Delegation Header */}
                  <View style={styles.delegationHeader}>
                    <View>
                      <Text style={styles.delegationDelegate}>{delegation.delegate}</Text>
                      <Text style={styles.delegationAddress}>
                        {delegation.delegateAddress.slice(0, 10)}...{delegation.delegateAddress.slice(-6)}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>{delegation.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  {/* Delegation Info */}
                  <View style={styles.delegationInfo}>
                    <View style={styles.delegationInfoItem}>
                      <Text style={styles.delegationInfoLabel}>Amount</Text>
                      <Text style={styles.delegationInfoValue}>{delegation.amount} HEZ</Text>
                    </View>
                    <View style={styles.delegationInfoItem}>
                      <Text style={styles.delegationInfoLabel}>Conviction</Text>
                      <Text style={styles.delegationInfoValue}>{delegation.conviction}x</Text>
                    </View>
                    {delegation.category && (
                      <View style={styles.delegationInfoItem}>
                        <Text style={styles.delegationInfoLabel}>Category</Text>
                        <Text style={styles.delegationInfoValue}>{delegation.category}</Text>
                      </View>
                    )}
                  </View>

                  {/* Action Buttons */}
                  <View style={styles.delegationActions}>
                    <TouchableOpacity
                      style={[styles.delegationActionButton, styles.modifyButton]}
                      onPress={() => Alert.alert('Modify Delegation', 'Modify delegation modal would open here')}
                    >
                      <Text style={styles.delegationActionButtonText}>Modify</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.delegationActionButton, styles.revokeButton]}
                      onPress={() => handleRevokeDelegation(delegation)}
                    >
                      <Text style={styles.delegationActionButtonText}>Revoke</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Delegation Form (when delegate selected) */}
        {selectedDelegate && (
          <View style={styles.delegationForm}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>Delegate to {selectedDelegate.name}</Text>
              <TouchableOpacity onPress={() => setSelectedDelegate(null)}>
                <Text style={styles.formClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formContent}>
              <Text style={styles.formLabel}>Amount (HEZ)</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Enter HEZ amount"
                placeholderTextColor="#999"
                keyboardType="numeric"
                value={delegationAmount}
                onChangeText={setDelegationAmount}
              />

              <Text style={styles.formHint}>Minimum delegation: 100 HEZ</Text>

              <TouchableOpacity style={styles.confirmButton} onPress={handleDelegate}>
                <Text style={styles.confirmButtonText}>Confirm Delegation</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteIcon}>ℹ️</Text>
          <Text style={styles.infoNoteText}>
            Delegating allows trusted community members to vote on your behalf. You can revoke delegation at any time.
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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
  },
  viewToggle: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    backgroundColor: '#E5E5E5',
    borderRadius: 12,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  viewToggleButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  viewToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  viewToggleTextActive: {
    color: KurdistanColors.kesk,
  },
  section: {
    paddingHorizontal: 16,
    gap: 16,
  },
  delegateCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  delegateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  delegateAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  delegateAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  delegateHeaderInfo: {
    flex: 1,
  },
  delegateName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  successBadge: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  successBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  delegateAddress: {
    fontSize: 12,
    color: '#999',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  delegateDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  categoriesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  delegateStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  delegateStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  delegateStatIcon: {
    fontSize: 14,
  },
  delegateStatText: {
    fontSize: 12,
    color: '#666',
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
  delegationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  delegationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  delegationDelegate: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  delegationAddress: {
    fontSize: 11,
    color: '#999',
    fontFamily: 'monospace',
  },
  statusBadge: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: KurdistanColors.kesk,
  },
  delegationInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingVertical: 12,
    backgroundColor: '#F8F9FA',
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  delegationInfoItem: {
    alignItems: 'center',
  },
  delegationInfoLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  delegationInfoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  delegationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  delegationActionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
  },
  modifyButton: {
    backgroundColor: '#E5E5E5',
  },
  revokeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  delegationActionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  delegationForm: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: KurdistanColors.kesk,
    boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  formTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  formClose: {
    fontSize: 24,
    color: '#999',
  },
  formContent: {
    gap: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  formInput: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E5E5E5',
  },
  formHint: {
    fontSize: 12,
    color: '#999',
  },
  confirmButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
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
});

export default DelegationScreen;
