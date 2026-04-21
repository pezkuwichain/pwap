import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import {
  TransactionRecord,
  HistoryFilter,
  filterTransactions,
  groupByDate,
  abbreviateAddress,
} from '../../services/TransactionHistoryService';

interface TransactionHistorySectionProps {
  transactions: TransactionRecord[];
  isLoading: boolean;
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
  scanProgress: string;
}

export const TransactionHistorySection: React.FC<TransactionHistorySectionProps> = ({
  transactions,
  isLoading,
  filter,
  onFilterChange,
  scanProgress,
}) => {
  const filtered = filterTransactions(transactions, filter);
  const grouped = groupByDate(filtered);

  return (
    <View style={styles.activitySection}>
      <View style={styles.activityHeader}>
        <Text style={styles.activityTitle}>Activity</Text>
        {isLoading && (
          <View style={styles.activityLoading}>
            <ActivityIndicator size="small" color={KurdistanColors.kesk} />
            <Text style={styles.activityLoadingText}>{scanProgress || 'Loading...'}</Text>
          </View>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.historyFilters}>
        {(['all', 'transfers', 'staking', 'swaps'] as HistoryFilter[]).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => onFilterChange(f)}
          >
            <Text style={[styles.filterTabText, filter === f && styles.filterTabTextActive]}>
              {f === 'all' ? 'All' : f === 'transfers' ? 'Transfers' : f === 'staking' ? 'Staking' : 'Swaps'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Transaction List */}
      {filtered.length === 0 && !isLoading ? (
        <View style={styles.emptyHistory}>
          <Text style={styles.emptyHistoryIcon}>
            {filter === 'all' ? '📋' : filter === 'transfers' ? '↔️' : filter === 'staking' ? '🔐' : '💱'}
          </Text>
          <Text style={styles.emptyHistoryText}>
            {filter === 'all' ? 'No transactions yet' : `No ${filter} found`}
          </Text>
        </View>
      ) : (
        grouped.map((group) => (
          <View key={group.date}>
            <Text style={styles.historyDateLabel}>{group.dateLabel}</Text>
            {group.transactions.map((tx) => {
              const isIncoming = tx.type === 'transfer_in';
              const isStaking = tx.type === 'staking';
              const isSwap = tx.type === 'swap';
              const icon = isIncoming ? '↓' : isStaking ? '🔐' : isSwap ? '💱' : '↑';
              const iconBg = isIncoming ? '#DCFCE7' : isStaking ? '#FEF3C7' : isSwap ? '#E0E7FF' : '#FEE2E2';
              const iconColor = isIncoming ? '#16A34A' : isStaking ? '#D97706' : isSwap ? '#4F46E5' : '#DC2626';
              const amountPrefix = isIncoming ? '+' : isStaking && tx.method === 'Rewarded' ? '+' : '-';
              const amountColor = amountPrefix === '+' ? '#16A34A' : '#DC2626';
              const label = isStaking
                ? tx.method === 'Rewarded' ? 'Staking Reward' : tx.method === 'Bonded' ? 'Staked' : 'Unstaked'
                : isSwap
                ? 'Swap'
                : isIncoming
                ? `From ${abbreviateAddress(tx.from)}`
                : `To ${abbreviateAddress(tx.to)}`;

              return (
                <View key={tx.id} style={styles.txItem}>
                  <View style={[styles.txIcon, { backgroundColor: iconBg }]}>
                    <Text style={[styles.txIconText, { color: iconColor }]}>{icon}</Text>
                  </View>
                  <View style={styles.txInfo}>
                    <Text style={styles.txMethod}>
                      {isIncoming ? 'Received' : isStaking ? tx.method : isSwap ? 'Swap' : 'Sent'}
                    </Text>
                    <Text style={styles.txAddress} numberOfLines={1}>{label}</Text>
                  </View>
                  <View style={styles.txAmount}>
                    <Text style={[styles.txAmountText, { color: amountColor }]}>
                      {amountPrefix}{tx.amount} {tx.token}
                    </Text>
                    <Text style={styles.txTime}>
                      {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  activitySection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  activityTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  activityLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  activityLoadingText: {
    fontSize: 12,
    color: '#888',
  },
  historyFilters: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
  },
  filterTabActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  filterTabTextActive: {
    color: '#FFFFFF',
  },
  emptyHistory: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyHistoryIcon: {
    fontSize: 40,
    marginBottom: 8,
  },
  emptyHistoryText: {
    fontSize: 14,
    color: '#999',
  },
  historyDateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#888',
    marginBottom: 8,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.05)',
    elevation: 1,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  txIconText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  txInfo: {
    flex: 1,
  },
  txMethod: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  txAddress: {
    fontSize: 12,
    color: '#999',
  },
  txAmount: {
    alignItems: 'flex-end',
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  txTime: {
    fontSize: 11,
    color: '#BBB',
  },
});

export default TransactionHistorySection;
