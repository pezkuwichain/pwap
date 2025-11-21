import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { Card, Button, Badge } from '../components';
import { KurdistanColors, AppColors } from '../theme/colors';
import { usePolkadot } from '../contexts/PolkadotContext';

// Import from shared library
import {
  getActiveOffers,
  getUserReputation,
  type P2PFiatOffer,
  type P2PReputation,
} from '../../../shared/lib/p2p-fiat';

interface OfferWithReputation extends P2PFiatOffer {
  seller_reputation?: P2PReputation;
  payment_method_name?: string;
}

type TabType = 'buy' | 'sell' | 'my-offers';

const P2PScreen: React.FC = () => {
  const { t } = useTranslation();
  const { selectedAccount } = usePolkadot();

  const [activeTab, setActiveTab] = useState<TabType>('buy');
  const [offers, setOffers] = useState<OfferWithReputation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateOffer, setShowCreateOffer] = useState(false);

  useEffect(() => {
    fetchOffers();
  }, [activeTab, selectedAccount]);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      let offersData: P2PFiatOffer[] = [];

      if (activeTab === 'buy') {
        // Buy = looking for sell offers
        offersData = await getActiveOffers();
      } else if (activeTab === 'my-offers' && selectedAccount) {
        // TODO: Implement getUserOffers from shared library
        offersData = [];
      }

      // Enrich with reputation (simplified for now)
      const enrichedOffers: OfferWithReputation[] = offersData.map((offer) => ({
        ...offer,
      }));

      setOffers(enrichedOffers);
    } catch (error) {
      console.error('Fetch offers error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOffers();
  };

  const getTrustLevelColor = (
    level: 'new' | 'basic' | 'intermediate' | 'advanced' | 'verified'
  ) => {
    const colors = {
      new: '#999',
      basic: KurdistanColors.zer,
      intermediate: '#2196F3',
      advanced: KurdistanColors.kesk,
      verified: '#9C27B0',
    };
    return colors[level];
  };

  const getTrustLevelLabel = (
    level: 'new' | 'basic' | 'intermediate' | 'advanced' | 'verified'
  ) => {
    const labels = {
      new: 'New',
      basic: 'Basic',
      intermediate: 'Intermediate',
      advanced: 'Advanced',
      verified: 'Verified',
    };
    return labels[level];
  };

  const renderOfferCard = ({ item }: { item: OfferWithReputation }) => (
    <Card style={styles.offerCard}>
      {/* Seller Info */}
      <View style={styles.sellerRow}>
        <View style={styles.sellerInfo}>
          <View style={styles.sellerAvatar}>
            <Text style={styles.sellerAvatarText}>
              {item.seller_wallet.slice(0, 2).toUpperCase()}
            </Text>
          </View>
          <View style={styles.sellerDetails}>
            <Text style={styles.sellerName}>
              {item.seller_wallet.slice(0, 6)}...{item.seller_wallet.slice(-4)}
            </Text>
            {item.seller_reputation && (
              <View style={styles.reputationRow}>
                <Badge
                  text={getTrustLevelLabel(item.seller_reputation.trust_level)}
                  variant="success"
                  style={{
                    backgroundColor: getTrustLevelColor(
                      item.seller_reputation.trust_level
                    ),
                  }}
                />
                <Text style={styles.tradesCount}>
                  {item.seller_reputation.completed_trades} trades
                </Text>
              </View>
            )}
          </View>
        </View>

        {item.seller_reputation?.verified_merchant && (
          <View style={styles.verifiedBadge}>
            <Text style={styles.verifiedIcon}>✓</Text>
          </View>
        )}
      </View>

      {/* Offer Details */}
      <View style={styles.offerDetails}>
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Amount</Text>
          <Text style={styles.detailValue}>
            {item.amount_crypto} {item.token}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Price</Text>
          <Text style={styles.detailValue}>
            {item.price_per_unit.toFixed(2)} {item.fiat_currency}/{item.token}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Total</Text>
          <Text style={[styles.detailValue, styles.totalValue]}>
            {item.fiat_amount.toFixed(2)} {item.fiat_currency}
          </Text>
        </View>

        {item.payment_method_name && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Payment</Text>
            <Badge text={item.payment_method_name} variant="outline" />
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Limits</Text>
          <Text style={styles.detailValue}>
            {item.min_order_amount || 0} - {item.max_order_amount || item.fiat_amount}{' '}
            {item.fiat_currency}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Time Limit</Text>
          <Text style={styles.detailValue}>{item.time_limit_minutes} min</Text>
        </View>
      </View>

      {/* Action Button */}
      <Button
        variant="primary"
        onPress={() => {
          // TODO: Open trade modal
          console.log('Trade with offer:', item.id);
        }}
        style={styles.tradeButton}
      >
        Buy {item.token}
      </Button>
    </Card>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}>📭</Text>
      <Text style={styles.emptyTitle}>No Offers Available</Text>
      <Text style={styles.emptyText}>
        {activeTab === 'my-offers'
          ? 'You haven\'t created any offers yet'
          : 'No active offers at the moment'}
      </Text>
      {activeTab === 'my-offers' && (
        <Button
          variant="primary"
          onPress={() => setShowCreateOffer(true)}
          style={styles.createButton}
        >
          Create Your First Offer
        </Button>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>P2P Trading</Text>
          <Text style={styles.subtitle}>Buy and sell crypto with local currency</Text>
        </View>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => setShowCreateOffer(true)}
        >
          <Text style={styles.createButtonText}>+ Post Ad</Text>
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'buy' && styles.activeTab]}
          onPress={() => setActiveTab('buy')}
        >
          <Text style={[styles.tabText, activeTab === 'buy' && styles.activeTabText]}>
            Buy
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'sell' && styles.activeTab]}
          onPress={() => setActiveTab('sell')}
        >
          <Text
            style={[styles.tabText, activeTab === 'sell' && styles.activeTabText]}
          >
            Sell
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'my-offers' && styles.activeTab]}
          onPress={() => setActiveTab('my-offers')}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === 'my-offers' && styles.activeTabText,
            ]}
          >
            My Offers
          </Text>
        </TouchableOpacity>
      </View>

      {/* Offer List */}
      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={KurdistanColors.kesk} />
          <Text style={styles.loadingText}>Loading offers...</Text>
        </View>
      ) : (
        <FlatList
          data={offers}
          renderItem={renderOfferCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={KurdistanColors.kesk}
            />
          }
        />
      )}

      {/* TODO: Create Offer Modal */}
      {/* TODO: Trade Modal */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  createButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: KurdistanColors.kesk,
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: KurdistanColors.kesk,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  offerCard: {
    padding: 16,
    marginBottom: 16,
  },
  sellerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  sellerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sellerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sellerAvatarText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  sellerDetails: {
    marginLeft: 12,
  },
  sellerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  reputationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tradesCount: {
    fontSize: 12,
    color: '#666',
  },
  verifiedBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedIcon: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  offerDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#666',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  totalValue: {
    fontSize: 16,
    color: KurdistanColors.kesk,
  },
  tradeButton: {
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default P2PScreen;
