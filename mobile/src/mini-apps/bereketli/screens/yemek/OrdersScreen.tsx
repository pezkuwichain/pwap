import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {NavigationProp} from '@react-navigation/native';
import {useTranslation} from 'react-i18next';
import {colors, spacing, typography, borderRadius} from '../../theme';
import {getOrders} from '../../api/orders';
import {getMealOrders} from '../../api/meals';
import type {Order, MealOrder} from '../../types/models';
import OrderCard from '../../components/OrderCard';

type Tab = 'packages' | 'meals';

const MEAL_STATUS_LABEL_KEYS: Record<MealOrder['status'], string> = {
  pending: 'orders.statusPending',
  accepted: 'orders.statusAccepted',
  rejected: 'orders.statusRejected',
  completed: 'orders.statusCompleted',
  cancelled: 'orders.statusCancelled',
};

const MEAL_STATUS_COLORS: Record<MealOrder['status'], string> = {
  pending: colors.warning,
  accepted: colors.info,
  rejected: colors.error,
  completed: colors.success,
  cancelled: colors.textSecondary,
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month} ${hours}:${mins}`;
}

function MealOrderCard({order, onPress}: {order: MealOrder; onPress: () => void}) {
  const {t} = useTranslation();
  const statusColor = MEAL_STATUS_COLORS[order.status];
  const statusLabel = t(MEAL_STATUS_LABEL_KEYS[order.status]);

  return (
    <TouchableOpacity style={mealStyles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={mealStyles.header}>
        <View style={mealStyles.typeBadge}>
          <Text style={mealStyles.typeBadgeText}>{t('orders.mealOrderBadge')}</Text>
        </View>
        <View style={[mealStyles.statusBadge, {backgroundColor: statusColor}]}>
          <Text style={mealStyles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      <View style={mealStyles.footer}>
        <View>
          <Text style={mealStyles.portions}>{t('orders.portions', {count: order.portions})}</Text>
          <Text style={mealStyles.price}>{order.total_price.toFixed(0)} TL</Text>
        </View>
        <Text style={mealStyles.date}>{formatDate(order.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const mealStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeBadge: {
    backgroundColor: '#FEF3C7',
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#92400E',
  },
  statusBadge: {
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  statusText: {
    ...typography.small,
    color: colors.textWhite,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  portions: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  price: {
    ...typography.price,
    color: colors.primary,
    fontSize: 18,
  },
  date: {
    ...typography.small,
    color: colors.textSecondary,
  },
});

export default function OrdersScreen() {
  const {t} = useTranslation();
  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [mealOrders, setMealOrders] = useState<MealOrder[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('packages');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchOrders = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [pkgData, mealData] = await Promise.all([
        getOrders(),
        getMealOrders().catch(() => [] as MealOrder[]),
      ]);
      setOrders(pkgData);
      setMealOrders(mealData);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchOrders();
    }, []),
  );

  const handleOrderPress = (order: Order) => {
    navigation.navigate('OrderDetail', {orderId: order.id});
  };

  const handleMealOrderPress = (order: MealOrder) => {
    navigation.navigate('MealOrderDetail', {order});
  };

  const handleQrScan = () => {
    navigation.navigate('QrScan' as never);
  };

  const totalCount = orders.length + mealOrders.length;

  if (loading && orders.length === 0 && mealOrders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header with QR button */}
      <View style={[styles.header, {paddingTop: insets.top + 12}]}>
        <View>
          <Text style={styles.headerTitle}>{t('orders.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('orders.orderCount', {count: totalCount})}</Text>
        </View>
        <TouchableOpacity style={styles.qrButton} onPress={handleQrScan} activeOpacity={0.7}>
          <Text style={styles.qrIcon}>📷</Text>
          <Text style={styles.qrLabel}>{t('orders.qrPickup')}</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'packages' && styles.tabActive]}
          onPress={() => setActiveTab('packages')}>
          <Text style={[styles.tabText, activeTab === 'packages' && styles.tabTextActive]}>
            {t('orders.tabPackages')} ({orders.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'meals' && styles.tabActive]}
          onPress={() => setActiveTab('meals')}>
          <Text style={[styles.tabText, activeTab === 'meals' && styles.tabTextActive]}>
            {t('orders.tabMeals')} ({mealOrders.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'packages' ? (
        <FlatList
          data={orders}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <OrderCard
              order={item}
              onPress={() => handleOrderPress(item)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIconText}>📦</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('orders.emptyPackagesTitle')}</Text>
              <Text style={styles.emptyText}>
                {t('orders.emptyPackagesText')}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={mealOrders}
          keyExtractor={item => item.id}
          renderItem={({item}) => (
            <MealOrderCard
              order={item}
              onPress={() => handleMealOrderPress(item)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchOrders(true)}
              colors={[colors.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIconText}>🍲</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('orders.emptyMealsTitle')}</Text>
              <Text style={styles.emptyText}>
                {t('orders.emptyMealsText')}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  header: {
    backgroundColor: colors.primary,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  qrButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  qrIcon: {fontSize: 18},
  qrLabel: {fontSize: 13, fontWeight: '700', color: '#FFFFFF'},
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: colors.primary,
  },
  list: {padding: spacing.lg, paddingBottom: 100},
  empty: {alignItems: 'center', paddingTop: 48, paddingHorizontal: 40},
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyIconText: {fontSize: 36},
  emptyTitle: {
    fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8,
  },
  emptyText: {
    fontSize: 14, color: '#6B7280', textAlign: 'center',
  },
});
