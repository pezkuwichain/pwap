import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { KurdistanColors } from '../theme/colors';
import { supabaseHelpers } from '../lib/supabase';

interface P2PAd {
  id: string;
  type: 'buy' | 'sell';
  merchant: string;
  rating: number;
  trades: number;
  price: number;
  currency: string;
  amount: string;
  limits: string;
  paymentMethods: string[];
}

// P2P ads stored in Supabase database - fetched from p2p_ads table

const P2PPlatformScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'buy' | 'sell'>('buy');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'bank' | 'online'>('all');
  const [ads, setAds] = useState<P2PAd[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAds = async () => {
    try {
      setLoading(true);

      // Fetch P2P ads from Supabase database
      const data = await supabaseHelpers.getP2PAds(selectedTab);

      // Transform Supabase data to component format
      const transformedAds: P2PAd[] = data.map(ad => ({
        id: ad.id,
        type: ad.type,
        merchant: ad.merchant_name,
        rating: ad.rating,
        trades: ad.trades_count,
        price: ad.price,
        currency: ad.currency,
        amount: ad.amount,
        limits: `${ad.min_limit} - ${ad.max_limit}`,
        paymentMethods: ad.payment_methods,
      }));

      setAds(transformedAds);

    } catch (error) {
      console.error('Failed to load P2P ads:', error);
      // If tables don't exist yet, show empty state instead of error
      setAds([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAds();
    // Refresh ads every 30 seconds
    const interval = setInterval(fetchAds, 30000);
    return () => clearInterval(interval);
  }, [selectedTab]); // Re-fetch when tab changes

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAds();
  };

  const handleTrade = (ad: P2PAd) => {
    Alert.alert(
      'Start Trade',
      `Trade with ${ad.merchant}?\nPrice: $${ad.price} ${ad.currency}\nLimits: ${ad.limits}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Continue', onPress: () => Alert.alert('Trade Modal', 'Trade modal would open here') },
      ]
    );
  };

  const handleCreateAd = () => {
    Alert.alert('Create Ad', 'Create ad modal would open here');
  };

  const filteredAds = ads.filter((ad) => ad.type === selectedTab);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>P2P Trading</Text>
          <Text style={styles.headerSubtitle}>Buy and sell crypto with local currency</Text>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>⏰</Text>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Active Trades</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>✅</Text>
            <Text style={styles.statValue}>0</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📈</Text>
            <Text style={styles.statValue}>$0</Text>
            <Text style={styles.statLabel}>Volume</Text>
          </View>
        </View>

        {/* Create Ad Button */}
        <TouchableOpacity style={styles.createAdButton} onPress={handleCreateAd}>
          <Text style={styles.createAdButtonText}>➕ Post a New Ad</Text>
        </TouchableOpacity>

        {/* Buy/Sell Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'buy' && styles.tabActive]}
            onPress={() => setSelectedTab('buy')}
          >
            <Text style={[styles.tabText, selectedTab === 'buy' && styles.tabTextActive]}>
              Buy HEZ
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'sell' && styles.tabActive]}
            onPress={() => setSelectedTab('sell')}
          >
            <Text style={[styles.tabText, selectedTab === 'sell' && styles.tabTextActive]}>
              Sell HEZ
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filter Chips */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'all' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('all')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'all' && styles.filterChipTextActive]}>
              All Payment
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'bank' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('bank')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'bank' && styles.filterChipTextActive]}>
              Bank Transfer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterChip, selectedFilter === 'online' && styles.filterChipActive]}
            onPress={() => setSelectedFilter('online')}
          >
            <Text style={[styles.filterChipText, selectedFilter === 'online' && styles.filterChipTextActive]}>
              Online Payment
            </Text>
          </TouchableOpacity>
        </View>

        {/* Ads List */}
        <View style={styles.adsList}>
          {filteredAds.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🛒</Text>
              <Text style={styles.emptyText}>No ads available</Text>
              <Text style={styles.emptySubtext}>Be the first to post an ad!</Text>
            </View>
          ) : (
            filteredAds.map((ad) => (
            <View key={ad.id} style={styles.adCard}>
              {/* Merchant Info */}
              <View style={styles.merchantRow}>
                <View style={styles.merchantInfo}>
                  <Text style={styles.merchantName}>{ad.merchant}</Text>
                  <View style={styles.merchantStats}>
                    <Text style={styles.merchantRating}>⭐ {ad.rating}</Text>
                    <Text style={styles.merchantTrades}> | {ad.trades} trades</Text>
                  </View>
                </View>
                <View style={[styles.typeBadge, ad.type === 'buy' ? styles.buyBadge : styles.sellBadge]}>
                  <Text style={styles.typeBadgeText}>{ad.type.toUpperCase()}</Text>
                </View>
              </View>

              {/* Price Info */}
              <View style={styles.priceRow}>
                <View>
                  <Text style={styles.priceLabel}>Price</Text>
                  <Text style={styles.priceValue}>${ad.price.toLocaleString()}</Text>
                </View>
                <View style={styles.priceRightColumn}>
                  <Text style={styles.amountLabel}>Available</Text>
                  <Text style={styles.amountValue}>{ad.amount}</Text>
                </View>
              </View>

              {/* Limits */}
              <View style={styles.limitsRow}>
                <Text style={styles.limitsLabel}>Limits: </Text>
                <Text style={styles.limitsValue}>{ad.limits}</Text>
              </View>

              {/* Payment Methods */}
              <View style={styles.paymentMethodsRow}>
                {ad.paymentMethods.map((method, index) => (
                  <View key={index} style={styles.paymentMethodChip}>
                    <Text style={styles.paymentMethodText}>{method}</Text>
                  </View>
                ))}
              </View>

              {/* Trade Button */}
              <TouchableOpacity
                style={[styles.tradeButton, ad.type === 'buy' ? styles.buyButton : styles.sellButton]}
                onPress={() => handleTrade(ad)}
              >
                <Text style={styles.tradeButtonText}>
                  {ad.type === 'buy' ? 'Buy HEZ' : 'Sell HEZ'}
                </Text>
              </TouchableOpacity>
            </View>
            ))
          )}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteIcon}>ℹ️</Text>
          <Text style={styles.infoNoteText}>
            P2P trading is currently in beta. Always verify merchant ratings and complete trades within the escrow system.
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
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  statIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
  },
  createAdButton: {
    backgroundColor: KurdistanColors.kesk,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  createAdButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tabsContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#E5E5E5',
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: '#FFFFFF',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: KurdistanColors.kesk,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E5E5',
  },
  filterChipActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  adsList: {
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
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  adCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  merchantRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  merchantInfo: {
    flex: 1,
  },
  merchantName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  merchantStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  merchantRating: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
  },
  merchantTrades: {
    fontSize: 12,
    color: '#666',
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  buyBadge: {
    backgroundColor: 'rgba(0, 143, 67, 0.1)',
  },
  sellBadge: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: KurdistanColors.kesk,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  priceLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  priceRightColumn: {
    alignItems: 'flex-end',
  },
  amountLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  amountValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  limitsRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  limitsLabel: {
    fontSize: 13,
    color: '#666',
  },
  limitsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  paymentMethodsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  paymentMethodChip: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  paymentMethodText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#666',
  },
  tradeButton: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  buyButton: {
    backgroundColor: KurdistanColors.kesk,
  },
  sellButton: {
    backgroundColor: '#EF4444',
  },
  tradeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
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
});

export default P2PPlatformScreen;
