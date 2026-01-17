import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';

// Types for Polkadot API responses
interface PoolKeyData {
  0?: string[];
  [key: number]: string[] | undefined;
}

interface AssetMetadata {
  symbol?: string;
  decimals?: number;
}

interface AccountInfo {
  data: {
    free: { toString(): string };
  };
}

interface AssetAccount {
  isSome: boolean;
  unwrap(): { balance: { toString(): string } };
}

interface PoolInfo {
  id: string;
  asset1: number;
  asset2: number;
  asset1Symbol: string;
  asset2Symbol: string;
  asset1Decimals: number;
  asset2Decimals: number;
  reserve1: string;
  reserve2: string;
  feeRate?: string;
  volume24h?: string;
  apr7d?: string;
}

const PoolBrowserScreen: React.FC = () => {
  const { api, isApiReady } = usePezkuwi();

  const [pools, setPools] = useState<PoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchPools = async () => {
    if (!api || !isApiReady) return;

    try {
      setLoading(true);

      // Fetch all pools from chain
      const poolsEntries = await api.query.assetConversion.pools.entries();

      const poolsData: PoolInfo[] = [];

      for (const [key, value] of poolsEntries) {
        const poolAccount = value.toString();

        // Parse pool assets from key
        const keyData = key.toHuman() as unknown as PoolKeyData;
        const assets = keyData[0];

        if (!assets || assets.length !== 2) continue;

        const asset1 = parseInt(assets[0]);
        const asset2 = parseInt(assets[1]);

        // Fetch metadata for both assets
        let asset1Symbol = asset1 === 0 ? 'wHEZ' : 'Unknown';
        let asset2Symbol = asset2 === 0 ? 'wHEZ' : 'Unknown';
        let asset1Decimals = 12;
        let asset2Decimals = 12;

        try {
          if (asset1 !== 0) {
            const metadata1 = await api.query.assets.metadata(asset1);
            const meta1 = metadata1.toJSON() as unknown as AssetMetadata;
            asset1Symbol = meta1.symbol || `Asset ${asset1}`;
            asset1Decimals = meta1.decimals || 12;
          }

          if (asset2 !== 0) {
            const metadata2 = await api.query.assets.metadata(asset2);
            const meta2 = metadata2.toJSON() as unknown as AssetMetadata;
            asset2Symbol = meta2.symbol || `Asset ${asset2}`;
            asset2Decimals = meta2.decimals || 12;
          }
        } catch (error) {
          console.error('Failed to fetch asset metadata:', error);
        }

        // Fetch pool reserves
        let reserve1 = '0';
        let reserve2 = '0';

        try {
          if (asset1 === 0) {
            // Native token (wHEZ)
            const balance1 = await api.query.system.account(poolAccount) as unknown as AccountInfo;
            reserve1 = balance1.data.free.toString();
          } else {
            const balance1 = await api.query.assets.account(asset1, poolAccount) as unknown as AssetAccount;
            reserve1 = balance1.isSome ? balance1.unwrap().balance.toString() : '0';
          }

          if (asset2 === 0) {
            const balance2 = await api.query.system.account(poolAccount) as unknown as AccountInfo;
            reserve2 = balance2.data.free.toString();
          } else {
            const balance2 = await api.query.assets.account(asset2, poolAccount) as unknown as AssetAccount;
            reserve2 = balance2.isSome ? balance2.unwrap().balance.toString() : '0';
          }
        } catch (error) {
          console.error('Failed to fetch reserves:', error);
        }

        poolsData.push({
          id: `${asset1}-${asset2}`,
          asset1,
          asset2,
          asset1Symbol,
          asset2Symbol,
          asset1Decimals,
          asset2Decimals,
          reserve1,
          reserve2,
          feeRate: '0.3', // 0.3% default
          volume24h: 'N/A',
          apr7d: 'N/A',
        });
      }

      setPools(poolsData);
    } catch (error) {
      console.error('Failed to load pools:', error);
      Alert.alert('Error', 'Failed to load liquidity pools');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPools();

    // Refresh pools every 10 seconds
    const interval = setInterval(fetchPools, 10000);
    return () => clearInterval(interval);
  }, [api, isApiReady]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPools();
  };

  const filteredPools = pools.filter((pool) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      pool.asset1Symbol.toLowerCase().includes(search) ||
      pool.asset2Symbol.toLowerCase().includes(search) ||
      pool.id.toLowerCase().includes(search)
    );
  });

  const formatBalance = (balance: string, decimals: number): string => {
    return (Number(balance) / Math.pow(10, decimals)).toFixed(2);
  };

  const calculateExchangeRate = (pool: PoolInfo): string => {
    const reserve1Num = Number(pool.reserve1);
    const reserve2Num = Number(pool.reserve2);

    if (reserve1Num === 0) return '0';

    const rate = reserve2Num / reserve1Num;
    return rate.toFixed(4);
  };

  const handleAddLiquidity = (pool: PoolInfo) => {
    Alert.alert('Add Liquidity', `Adding liquidity to ${pool.asset1Symbol}/${pool.asset2Symbol} pool`);
    // TODO: Navigate to AddLiquidityModal
  };

  const handleRemoveLiquidity = (pool: PoolInfo) => {
    Alert.alert('Remove Liquidity', `Removing liquidity from ${pool.asset1Symbol}/${pool.asset2Symbol} pool`);
    // TODO: Navigate to RemoveLiquidityModal
  };

  const handleSwap = (pool: PoolInfo) => {
    Alert.alert('Swap', `Swapping in ${pool.asset1Symbol}/${pool.asset2Symbol} pool`);
    // TODO: Navigate to SwapScreen with pool pre-selected
  };

  if (loading && pools.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Loading liquidity pools...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Liquidity Pools</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search pools by token..."
            placeholderTextColor="#999"
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>

        {/* Pools List */}
        {filteredPools.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>💧</Text>
            <Text style={styles.emptyText}>
              {searchTerm
                ? 'No pools found matching your search'
                : 'No liquidity pools available yet'}
            </Text>
          </View>
        ) : (
          <View style={styles.poolsList}>
            {filteredPools.map((pool) => (
              <View key={pool.id} style={styles.poolCard}>
                {/* Pool Header */}
                <View style={styles.poolHeader}>
                  <View style={styles.poolTitleRow}>
                    <Text style={styles.poolAsset1}>{pool.asset1Symbol}</Text>
                    <Text style={styles.poolSeparator}>/</Text>
                    <Text style={styles.poolAsset2}>{pool.asset2Symbol}</Text>
                  </View>
                  <View style={styles.activeBadge}>
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                </View>

                {/* Reserves */}
                <View style={styles.reservesSection}>
                  <View style={styles.reserveRow}>
                    <Text style={styles.reserveLabel}>Reserve {pool.asset1Symbol}</Text>
                    <Text style={styles.reserveValue}>
                      {formatBalance(pool.reserve1, pool.asset1Decimals)} {pool.asset1Symbol}
                    </Text>
                  </View>
                  <View style={styles.reserveRow}>
                    <Text style={styles.reserveLabel}>Reserve {pool.asset2Symbol}</Text>
                    <Text style={styles.reserveValue}>
                      {formatBalance(pool.reserve2, pool.asset2Decimals)} {pool.asset2Symbol}
                    </Text>
                  </View>
                </View>

                {/* Exchange Rate */}
                <View style={styles.exchangeRateCard}>
                  <Text style={styles.exchangeRateLabel}>Exchange Rate</Text>
                  <Text style={styles.exchangeRateValue}>
                    1 {pool.asset1Symbol} = {calculateExchangeRate(pool)} {pool.asset2Symbol}
                  </Text>
                </View>

                {/* Stats Row */}
                <View style={styles.statsRow}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Fee</Text>
                    <Text style={styles.statValue}>{pool.feeRate}%</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Volume 24h</Text>
                    <Text style={styles.statValue}>{pool.volume24h}</Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>APR</Text>
                    <Text style={[styles.statValue, styles.statValuePositive]}>
                      {pool.apr7d}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.addButton]}
                    onPress={() => handleAddLiquidity(pool)}
                  >
                    <Text style={styles.actionButtonText}>💧 Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => handleRemoveLiquidity(pool)}
                  >
                    <Text style={styles.actionButtonText}>Remove</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.swapButton]}
                    onPress={() => handleSwap(pool)}
                  >
                    <Text style={styles.actionButtonText}>📈 Swap</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 20,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
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
  poolsList: {
    padding: 16,
    gap: 16,
  },
  poolCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  poolHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  poolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  poolAsset1: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  poolSeparator: {
    fontSize: 18,
    color: '#999',
    marginHorizontal: 4,
  },
  poolAsset2: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F59E0B',
  },
  activeBadge: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 143, 67, 0.3)',
  },
  activeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  reservesSection: {
    gap: 8,
    marginBottom: 16,
  },
  reserveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reserveLabel: {
    fontSize: 14,
    color: '#666',
  },
  reserveValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    fontFamily: 'monospace',
  },
  exchangeRateCard: {
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exchangeRateLabel: {
    fontSize: 14,
    color: '#666',
  },
  exchangeRateValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    fontFamily: 'monospace',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statValuePositive: {
    color: KurdistanColors.kesk,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  addButton: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
    borderColor: 'rgba(0, 143, 67, 0.3)',
  },
  removeButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  swapButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
});

export default PoolBrowserScreen;
