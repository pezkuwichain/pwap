import React, {useEffect, useState, useCallback} from 'react';
import {useFocusEffect} from '@react-navigation/native';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  StatusBar,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../../theme';
import {useLocationStore} from '../../store/locationStore';
import client from '../../api/client';
// TODO: Replace with expo-notifications in Faz 4
const messaging = Object.assign(
  () => ({ requestPermission: async () => 1, getToken: async () => '' }),
  { AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2, NOT_DETERMINED: -1, DENIED: 0 } }
);
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import OfflineBanner from '../../components/OfflineBanner';
import AnnouncementBanner from '../../components/AnnouncementBanner';
import * as packagesApi from '../../api/packages';
import type {PackageNearby, StoreType} from '../../types/models';
import PackageCard from '../../components/PackageCard';
import FilterModal from '../../components/FilterModal';
import type {FilterState, FilterSection} from '../../components/FilterModal';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import type {YemekStackParamList} from '../../navigation/MainTabNavigator';

const BASE_URL = 'https://bereketli.pezkiwi.app';

const CATEGORIES: {key: StoreType | 'all'; labelKey: string; image: string | null; icon: string; color: string}[] = [
  {key: 'all', labelKey: 'packages.categoryAll', image: `${BASE_URL}/bereketli_paket.png`, icon: '🍽️', color: '#2D6A4F'},
  {key: 'bakery', labelKey: 'packages.categoryBakery', image: `${BASE_URL}/package-bakery.png`, icon: '🍞', color: '#E8A838'},
  {key: 'restaurant', labelKey: 'packages.categoryRestaurant', image: `${BASE_URL}/package-restaurant.png`, icon: '🍲', color: '#EF4444'},
  {key: 'pastry', labelKey: 'packages.categoryPastry', image: `${BASE_URL}/package-pastry.png`, icon: '🍰', color: '#EC4899'},
  {key: 'market', labelKey: 'packages.categoryMarket', image: `${BASE_URL}/package-market.png`, icon: '🛒', color: '#10B981'},
];

type Props = NativeStackScreenProps<YemekStackParamList, 'YemekMap'>;

function CategoryImage({uri, icon}: {uri: string | null; icon: string}) {
  const [failed, setFailed] = React.useState(false);
  if (!uri || failed) {
    return <Text style={catImgStyles.icon}>{icon}</Text>;
  }
  return (
    <Image
      source={{uri}}
      style={catImgStyles.image}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

const catImgStyles = StyleSheet.create({
  image: {width: 52, height: 52, borderRadius: 26},
  icon: {fontSize: 24},
});

export default function YemekMapScreen({navigation}: Props) {
  const {t} = useTranslation();
  const {latitude, longitude, address, updateLocation} = useLocationStore();
  const [packages, setPackages] = useState<PackageNearby[]>([]);
  const [category, setCategory] = useState<StoreType | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterSection, setFilterSection] = useState<FilterSection | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<FilterState | null>(null);
  const [radius, setRadius] = useState(0); // Default: Tümü (show all)
  const [notifEnabled, setNotifEnabled] = useState(false);

  // Check if notification permission was already granted
  useEffect(() => {
    AsyncStorage.getItem('@bereketli_notif_enabled').then(val => {
      if (val === 'true') setNotifEnabled(true);
    }).catch(() => {});
  }, []);
  const insets = useSafeAreaInsets();

  const handleNotificationToggle = async () => {
    try {
      // 1. Request notification permission from Android
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        Alert.alert(t('packages.notificationPermission'), t('packages.notificationPermissionMsg'));
        return;
      }

      // 2. Get real FCM token
      const fcmToken = await messaging().getToken();

      // 3. Register token with backend (backend expects {token: string})
      await client.post('/notifications/register', {
        token: fcmToken,
      });

      setNotifEnabled(true);
      await AsyncStorage.setItem('@bereketli_notif_enabled', 'true');
      Alert.alert(t('packages.notificationsEnabled'), t('packages.notificationsEnabledMsg'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || t('packages.notificationRegisterFailed');
      Alert.alert(t('common.error'), msg);
    }
  };

  const fetchPackages = useCallback(async () => {
    setLoading(true);
    try {
      let data: PackageNearby[];
      if (radius === 0) {
        // "Tümü" — show all packages regardless of location
        data = await packagesApi.getAllPackages(category === 'all' ? undefined : category);
      } else if (latitude && longitude) {
        // Real location + real radius
        data = await packagesApi.getNearbyPackages(
          latitude,
          longitude,
          radius,
          category === 'all' ? undefined : category,
        );
      } else {
        // No location — can only show "Tümü"
        data = [];
      }
      setPackages(data);
    } catch {
      setPackages([]);
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, category, radius]);

  // Prefetch category images on mount for faster loading
  useEffect(() => {
    CATEGORIES.forEach(cat => {
      if (cat.image) {
        Image.prefetch(cat.image).catch(() => {});
      }
    });
    updateLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateLocation is a stable zustand store action
  }, []);

  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  const handlePackagePress = (item: PackageNearby) => {
    navigation.navigate('PackageDetail', {
      packageId: item.id,
      storeName: item.store_name,
      storeAddress: item.store_address,
    });
  };

  const openFilterModal = (section?: FilterSection) => {
    setFilterSection(section);
    setFilterVisible(true);
  };

  const handleFilterApply = (filter: FilterState) => {
    setActiveFilter(filter);
  };

  // Apply client-side filtering
  let filteredPackages = [...packages];

  if (activeFilter) {
    // Delivery filter
    if (activeFilter.hasDelivery) {
      filteredPackages = filteredPackages.filter(p => p.delivery_available === true);
    }
    // Discount filter
    if (activeFilter.discounted) {
      filteredPackages = filteredPackages.filter(p => p.price < p.original_value);
    }
    // Last few remaining
    if (activeFilter.lastFew) {
      filteredPackages = filteredPackages.filter(p => p.remaining <= 3);
    }
    // Price range
    if (activeFilter.priceRange[1] < 500) {
      filteredPackages = filteredPackages.filter(
        p => p.price >= activeFilter!.priceRange[0] && p.price <= activeFilter!.priceRange[1],
      );
    }
    // Sort
    if (activeFilter.sort === 'price') {
      filteredPackages = [...filteredPackages].sort((a, b) => a.price - b.price);
    } else if (activeFilter.sort === 'distance') {
      filteredPackages = [...filteredPackages].sort((a, b) => (a.distance_m || 99999) - (b.distance_m || 99999));
    } else if (activeFilter.sort === 'rating') {
      filteredPackages = [...filteredPackages].sort((a, b) => b.store_rating - a.store_rating);
    }
  }

  const activeFilterCount = activeFilter
    ? [
        activeFilter.sort !== 'recommended',
        activeFilter.hasDelivery,
        activeFilter.lastFew,
        activeFilter.discounted,
        activeFilter.priceRange[1] < 500,
      ].filter(Boolean).length
    : 0;

  const renderScrollHeader = () => (
    <>
      {/* ── Filter Pills (Yemeksepeti style — each pill is independent) ── */}
      <View style={styles.filterBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}>
          {/* Filter icon — opens full modal */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilterCount > 0 && styles.filterPillActive]}
            onPress={() => openFilterModal()}>
            <Text style={styles.filterPillIcon}>⚙️</Text>
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Sıralama — dropdown pill */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter?.sort !== 'recommended' && activeFilter?.sort != null && styles.filterPillActive]}
            onPress={() => openFilterModal('sort')}>
            <Text style={[styles.filterPillLabel, activeFilter?.sort !== 'recommended' && activeFilter?.sort != null && styles.filterPillLabelActive]}>
              {activeFilter?.sort === 'distance' ? t('packages.sortDistance') :
               activeFilter?.sort === 'price' ? t('packages.sortPrice') :
               activeFilter?.sort === 'rating' ? t('packages.sortRating') : t('packages.sortLabel')}
            </Text>
            <Text style={[styles.filterPillArrow, activeFilter?.sort !== 'recommended' && activeFilter?.sort != null && styles.filterPillArrowActive]}>▾</Text>
          </TouchableOpacity>

          {/* Teslimat var — toggle pill */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter?.hasDelivery && styles.filterPillActive]}
            onPress={() => {
              setActiveFilter(f => f
                ? {...f, hasDelivery: !f.hasDelivery}
                : {sort: 'recommended', hasDelivery: true, lastFew: false, discounted: false, payment: 'all', priceRange: [0, 500]},
              );
            }}>
            <Text style={[styles.filterPillLabel, activeFilter?.hasDelivery && styles.filterPillLabelActive]}>🛵 {t('packages.delivery')}</Text>
          </TouchableOpacity>

          {/* İndirimli — toggle pill */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter?.discounted && styles.filterPillActive]}
            onPress={() => {
              setActiveFilter(f => f
                ? {...f, discounted: !f.discounted}
                : {sort: 'recommended', hasDelivery: false, lastFew: false, discounted: true, payment: 'all', priceRange: [0, 500]},
              );
            }}>
            <Text style={[styles.filterPillLabel, activeFilter?.discounted && styles.filterPillLabelActive]}>🏷️ {t('packages.discounted')}</Text>
          </TouchableOpacity>

          {/* Son birkaç — toggle pill */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter?.lastFew && styles.filterPillActive]}
            onPress={() => {
              setActiveFilter(f => f
                ? {...f, lastFew: !f.lastFew}
                : {sort: 'recommended', hasDelivery: false, lastFew: true, discounted: false, payment: 'all', priceRange: [0, 500]},
              );
            }}>
            <Text style={[styles.filterPillLabel, activeFilter?.lastFew && styles.filterPillLabelActive]}>🔥 {t('packages.lastFew')}</Text>
          </TouchableOpacity>

          {/* Fiyat Aralığı — dropdown pill */}
          <TouchableOpacity
            style={[styles.filterPill, activeFilter?.priceRange[1] != null && activeFilter.priceRange[1] < 500 && styles.filterPillActive]}
            onPress={() => openFilterModal('price')}>
            <Text style={[styles.filterPillLabel, activeFilter?.priceRange[1] != null && activeFilter.priceRange[1] < 500 && styles.filterPillLabelActive]}>
              {activeFilter?.priceRange[1] != null && activeFilter.priceRange[1] < 500
                ? `${activeFilter.priceRange[0]}-${activeFilter.priceRange[1]} TL`
                : t('packages.priceRange')}
            </Text>
            <Text style={styles.filterPillArrow}>▾</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ── Distance Control ── */}
      <View style={styles.distanceSection}>
        <View style={styles.distanceHeader}>
          <Text style={styles.distanceLabel}>📍 {t('common.distance')}</Text>
          <Text style={styles.distanceValue}>
            {radius === 0 ? t('common.all') : radius >= 1000 ? `${(radius / 1000).toFixed(1)} km` : `${radius}m`}
          </Text>
        </View>
        <View style={styles.distanceSliderRow}>
          {([500, 1000, 2000, 3000, 5000, 0] as number[]).map(r => (
            <TouchableOpacity
              key={r}
              style={[styles.distanceChip, radius === r && styles.distanceChipActive]}
              onPress={() => setRadius(r)}>
              <Text style={[styles.distanceChipText, radius === r && styles.distanceChipTextActive]}>
                {r === 0 ? t('common.all') : r >= 1000 ? `${r / 1000}km` : `${r}m`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Referral Banner ── */}
      <TouchableOpacity
        style={styles.referralBanner}
        onPress={() => navigation.navigate('Referral')}
        activeOpacity={0.7}>
        <Text style={styles.referralBannerEmoji}>{'\uD83C\uDF81'}</Text>
        <View style={styles.referralBannerText}>
          <Text style={styles.referralBannerTitle}>{t('packages.referralBannerTitle')}</Text>
          <Text style={styles.referralBannerDesc}>{t('packages.referralBannerDesc')}</Text>
        </View>
        <Text style={styles.referralBannerArrow}>{'\u2192'}</Text>
      </TouchableOpacity>

      {/* ── Announcement Banner (dynamic from API) ── */}
      <AnnouncementBanner />

      {/* ── Category Icons ── */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}>
          {CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={styles.categoryItem}
              onPress={() => setCategory(cat.key)}
              activeOpacity={0.7}>
              <View
                style={[
                  styles.categoryCircle,
                  {backgroundColor: cat.color + '15'},
                  category === cat.key && {
                    borderWidth: 2.5,
                    borderColor: cat.color,
                  },
                ]}>
                <CategoryImage uri={cat.image} icon={cat.icon} />
              </View>
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.key && {color: cat.color, fontWeight: '700'},
                ]}>
                {t(cat.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Section Title ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {category === 'all'
            ? t('packages.nearbyPackages')
            : t('packages.categoryPackages', {category: t(CATEGORIES.find(c => c.key === category)?.labelKey || 'common.all')})}
        </Text>
        {filteredPackages.length > 0 && (
          <Text style={styles.sectionCount}>{t('packages.packageCount', {count: filteredPackages.length})}</Text>
        )}
      </View>
    </>
  );

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      StatusBar.setBackgroundColor(colors.primary);
    }, []),
  );

  return (
    <View style={styles.container}>

      {/* ── Sticky Header (sabit) ── */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <View style={styles.locationRow}>
          <TouchableOpacity
            style={styles.locationLeft}
            onPress={() => navigation.navigate('LocationPicker')}
            activeOpacity={0.7}>
            <Text style={styles.locationPin}>📍</Text>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationLabel}>{t('packages.deliveryAddress')}</Text>
              <Text style={styles.locationAddress} numberOfLines={1}>
                {address || (latitude && longitude ? `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` : t('packages.selectLocation'))}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('AiChat')}>
            <Icon name="robot" size={20} color="#FFFFFF" />
            <Text style={styles.aiLabel}>AI</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn} onPress={handleNotificationToggle}>
            <Text style={styles.headerIcon}>{notifEnabled ? '🔔' : '🔕'}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => navigation.navigate('Search')}
          activeOpacity={0.8}>
          <Text style={styles.searchIcon}>🔍</Text>
          <Text style={styles.searchPlaceholder}>{t('packages.searchPlaceholder')}</Text>
        </TouchableOpacity>
      </View>

      <OfflineBanner />

      {/* ── Scrollable Content ── */}
      <FlatList
        data={filteredPackages}
        keyExtractor={item => item.id}
        renderItem={({item}) => (
          <View style={styles.cardWrapper}>
            <PackageCard item={item} onPress={() => handlePackagePress(item)} />
          </View>
        )}
        ListHeaderComponent={renderScrollHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={fetchPackages}
            colors={[colors.primary]}
            progressViewOffset={120}
          />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIconText}>🛍️</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('packages.emptyTitle')}</Text>
              <Text style={styles.emptyText}>
                {t('packages.emptyText')}
              </Text>
            </View>
          ) : null
        }
      />

      {/* Filter Modal */}
      <FilterModal
        visible={filterVisible}
        onClose={() => setFilterVisible(false)}
        onApply={handleFilterApply}
        initialFilter={activeFilter || undefined}
        initialSection={filterSection}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},

  // ── Header ──
  header: {
    backgroundColor: colors.primary,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  locationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  locationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  locationPin: {fontSize: 20},
  locationTextContainer: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  locationAddress: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerIcon: {fontSize: 18},
  aiLabel: {fontSize: 8, fontWeight: '700', color: '#FFFFFF', marginTop: 1},

  // ── Search ──
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    gap: 10,
  },
  searchIcon: {fontSize: 16},
  searchPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: '#9CA3AF',
  },

  // ── Filter Pills ──
  filterBar: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  filterList: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillIcon: {fontSize: 14, opacity: 0.8},
  filterPillLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#374151',
  },
  filterPillLabelActive: {
    color: '#FFFFFF',
  },
  filterPillArrow: {
    fontSize: 10,
    color: '#6B7280',
  },
  filterPillArrowActive: {
    color: '#FFFFFF',
  },
  filterBadge: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 2,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ── Distance ──
  distanceSection: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  distanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  distanceLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  distanceValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  distanceSliderRow: {
    flexDirection: 'row',
    gap: 8,
  },
  distanceChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  distanceChipActive: {
    backgroundColor: colors.primary,
  },
  distanceChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  distanceChipTextActive: {
    color: '#FFFFFF',
  },

  // ── Referral Banner ──
  referralBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d5016',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  referralBannerEmoji: {fontSize: 16, marginRight: 8},
  referralBannerText: {flex: 1},
  referralBannerTitle: {color: '#FFFFFF', fontWeight: '700', fontSize: 14},
  referralBannerDesc: {color: 'rgba(255,255,255,0.67)', fontSize: 12},
  referralBannerArrow: {color: '#FFFFFF', fontSize: 18},

  // ── Banner (handled by AnnouncementBanner component) ──

  // ── Categories ──
  categorySection: {
    backgroundColor: '#FFFFFF',
    marginTop: 12,
    paddingVertical: 16,
  },
  categoryList: {
    paddingHorizontal: 16,
    gap: 20,
  },
  categoryItem: {
    alignItems: 'center',
    width: 64,
  },
  categoryCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  categoryImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  categoryIcon: {
    fontSize: 24,
  },
  categoryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
  },

  // ── Section Header ──
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  sectionCount: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  // ── List ──
  list: {
    paddingBottom: 100,
  },
  cardWrapper: {
    paddingHorizontal: 16,
  },

  // ── Empty State ──
  empty: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIconText: {fontSize: 36},
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyCta: {
    marginTop: 20,
    backgroundColor: colors.primary,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
