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
  TextInput,
  Image,
  ScrollView,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocationStore} from '../../store/locationStore';
import * as merchantsApi from '../../api/merchants';
import type {MerchantNearby, MerchantCategory} from '../../types/models';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import OfflineBanner from '../../components/OfflineBanner';

const THEME = '#DC2626'; // Red theme for Esnaf
const THEME_LIGHT = '#FEE2E2';
const BASE_URL = 'https://bereketli.pezkiwi.app';

// Real Canva-generated category images
const MERCHANT_CATEGORY_IMAGES: Record<string, string> = {
  barber: `${BASE_URL}/esnaf-barber.png`,
  cafe: `${BASE_URL}/esnaf-cafe.png`,
  butcher: `${BASE_URL}/esnaf-butcher.png`,
  greengrocer: `${BASE_URL}/esnaf-greengrocer.png`,
  tailor: `${BASE_URL}/esnaf-tailor.png`,
  bakery: `${BASE_URL}/package-bakery.png`,
  pharmacy: `${BASE_URL}/esnaf-cafe.png`,
  other: `${BASE_URL}/local-barber.png`,
};

const CATEGORY_KEYS: {key: MerchantCategory | 'all'; i18nKey: string; icon: string}[] = [
  {key: 'all', i18nKey: 'common.all', icon: '🏪'},
  {key: 'barber', i18nKey: 'merchants.categoryBarber', icon: '💈'},
  {key: 'cafe', i18nKey: 'merchants.categoryCafe', icon: '☕'},
  {key: 'butcher', i18nKey: 'merchants.categoryButcher', icon: '🥩'},
  {key: 'greengrocer', i18nKey: 'merchants.categoryGreengrocer', icon: '🥬'},
  {key: 'bakery', i18nKey: 'merchants.categoryBakery', icon: '🍞'},
  {key: 'pharmacy', i18nKey: 'merchants.categoryPharmacy', icon: '💊'},
  {key: 'tailor', i18nKey: 'merchants.categoryTailor', icon: '🧵'},
];

export default function EsnafMapScreen({navigation}: any) {
  const {t} = useTranslation();
  const {latitude, longitude, updateLocation} = useLocationStore();
  const [merchants, setMerchants] = useState<MerchantNearby[]>([]);
  const [category, setCategory] = useState<MerchantCategory | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(0); // Default: Tümü
  const insets = useSafeAreaInsets();

  const fetchMerchants = useCallback(async () => {
    setLoading(true);
    try {
      let data: MerchantNearby[];
      if (radius === 0) {
        // Tümü — show all merchants regardless of location
        data = await merchantsApi.getAllMerchants();
      } else if (latitude && longitude) {
        data = await merchantsApi.getNearbyMerchants(latitude, longitude, radius, category === 'all' ? undefined : category);
      } else {
        data = [];
      }
      setMerchants(data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, category, radius]);

  useEffect(() => {
    updateLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateLocation is a stable zustand store action
  }, []);

  useEffect(() => {
    fetchMerchants();
  }, [fetchMerchants]);

  const filteredMerchants = searchQuery.trim()
    ? merchants.filter(
        m =>
          m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (m.description || '').toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : merchants;

  const formatDistance = (m: number) =>
    m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

  const renderMerchantCard = ({item}: {item: MerchantNearby}) => {
    const catInfo = CATEGORY_KEYS.find(c => c.key === item.category);
    return (
      <View style={styles.cardWrapper}>
        <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => navigation.navigate('MerchantDetail', {merchantId: item.id})}>
          {/* Image */}
          <View style={styles.cardImage}>
            <Image
              source={{uri:
                item.photos && item.photos.length > 0
                  ? (item.photos[0].startsWith('http') ? item.photos[0] : `${BASE_URL}${item.photos[0]}`)
                  : MERCHANT_CATEGORY_IMAGES[item.category] || MERCHANT_CATEGORY_IMAGES.other
              }}
              style={styles.cardImg}
              resizeMode="cover"
            />
            {/* Category badge */}
            <View style={styles.categoryBadge}>
              <Text style={styles.categoryBadgeText}>{catInfo?.icon} {t(catInfo?.i18nKey || '') || item.category}</Text>
            </View>
            {/* Heart */}
            <TouchableOpacity style={styles.heartBtn} activeOpacity={0.7}>
              <Text style={styles.heartIcon}>♡</Text>
            </TouchableOpacity>
          </View>

          {/* Info */}
          <View style={styles.cardInfo}>
            <View style={styles.cardNameRow}>
              <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
              {item.rating > 0 && (
                <View style={styles.ratingBadge}>
                  <Text style={styles.ratingStar}>★</Text>
                  <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
                  {item.total_reviews > 0 && (
                    <Text style={styles.reviewCount}>({item.total_reviews})</Text>
                  )}
                </View>
              )}
            </View>

            {item.story && (
              <Text style={styles.cardStory} numberOfLines={2}>"{item.story}"</Text>
            )}

            <View style={styles.cardMetaRow}>
              {item.distance_m > 0 && (
                <Text style={styles.cardDistance}>📍 {formatDistance(item.distance_m)}</Text>
              )}
              <Text style={styles.cardAddress} numberOfLines={1}>{item.address}</Text>
            </View>

            {/* Plan badge */}
            {item.plan !== 'free' && (
              <View style={styles.planBadge}>
                <Text style={styles.planText}>⭐ {item.plan === 'pro' ? 'Pro Esnaf' : 'Business'}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  const renderScrollHeader = () => (
    <>
      {/* ── Categories ── */}
      <View style={styles.categorySection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}>
          {CATEGORY_KEYS.map(cat => (
            <TouchableOpacity
              key={cat.key}
              style={[styles.categoryChip, category === cat.key && styles.categoryChipActive]}
              onPress={() => setCategory(cat.key)}>
              <Text style={styles.categoryChipIcon}>{cat.icon}</Text>
              <Text style={[styles.categoryChipText, category === cat.key && styles.categoryChipTextActive]}>
                {t(cat.i18nKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Distance ── */}
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

      {/* ── Section Title ── */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          {category === 'all' ? t('merchants.nearbyMerchants') : (t(CATEGORY_KEYS.find(c => c.key === category)?.i18nKey || ''))}
        </Text>
        {filteredMerchants.length > 0 && (
          <Text style={styles.sectionCount}>{t('merchants.merchantCount', {count: filteredMerchants.length})}</Text>
        )}
      </View>
    </>
  );

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle('light-content');
      StatusBar.setBackgroundColor(THEME);
    }, []),
  );

  return (
    <View style={styles.container}>

      {/* ── Sticky Header ── */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>{t('merchants.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('merchants.subtitle')}</Text>
          </View>
          <TouchableOpacity style={styles.headerIconBtn} onPress={() => navigation.navigate('AiChat')}>
            <Icon name="robot" size={20} color="#FFFFFF" />
            <Text style={styles.aiLabel}>AI</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder={t('merchants.searchPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={styles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <OfflineBanner />

      {/* ── Scrollable ── */}
      <FlatList
        data={filteredMerchants}
        keyExtractor={item => item.id}
        renderItem={renderMerchantCard}
        ListHeaderComponent={renderScrollHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchMerchants} colors={[THEME]} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIconText}>🏪</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('merchants.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('merchants.emptyText')}</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},

  // Header
  header: {backgroundColor: THEME, paddingBottom: 16, paddingHorizontal: 16},
  headerRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12},
  headerTitle: {fontSize: 22, fontWeight: '700', color: '#FFFFFF'},
  headerSubtitle: {fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: '500', marginTop: 2},
  headerIconBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerIcon: {fontSize: 18},
  aiLabel: {fontSize: 8, fontWeight: '700', color: '#FFFFFF', marginTop: 1},

  // Search
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12,
    paddingHorizontal: 14, height: 46, gap: 10,
  },
  searchIcon: {fontSize: 16},
  searchInput: {flex: 1, fontSize: 14, color: '#1A1A1A', padding: 0},
  clearIcon: {fontSize: 16, color: '#9CA3AF', padding: 4},

  // Categories
  categorySection: {backgroundColor: '#FFFFFF', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6'},
  categoryList: {paddingHorizontal: 16, gap: 8},
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
  },
  categoryChipActive: {backgroundColor: THEME, borderColor: THEME},
  categoryChipIcon: {fontSize: 14},
  categoryChipText: {fontSize: 13, fontWeight: '500', color: '#374151'},
  categoryChipTextActive: {color: '#FFFFFF'},

  // Distance
  distanceSection: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  distanceHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8},
  distanceLabel: {fontSize: 13, fontWeight: '600', color: '#374151'},
  distanceValue: {fontSize: 13, fontWeight: '700', color: THEME},
  distanceSliderRow: {flexDirection: 'row', gap: 8},
  distanceChip: {
    flex: 1, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  distanceChipActive: {backgroundColor: THEME},
  distanceChipText: {fontSize: 12, fontWeight: '600', color: '#6B7280'},
  distanceChipTextActive: {color: '#FFFFFF'},

  // Section
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
  },
  sectionTitle: {fontSize: 20, fontWeight: '700', color: '#1A1A1A'},
  sectionCount: {fontSize: 13, color: '#9CA3AF', fontWeight: '500'},

  // List
  list: {paddingBottom: 100},
  cardWrapper: {paddingHorizontal: 16},

  // Card
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardImage: {height: 160, position: 'relative', backgroundColor: THEME_LIGHT},
  cardImg: {width: '100%', height: '100%'},
  categoryBadge: {
    position: 'absolute', bottom: 10, left: 10,
    backgroundColor: THEME, borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  categoryBadgeText: {fontSize: 11, fontWeight: '700', color: '#FFFFFF'},
  heartBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center', alignItems: 'center',
  },
  heartIcon: {fontSize: 18, color: '#9CA3AF'},
  cardInfo: {padding: 12},
  cardNameRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
  cardName: {fontSize: 16, fontWeight: '700', color: '#1A1A1A', flex: 1, marginRight: 8},
  ratingBadge: {flexDirection: 'row', alignItems: 'center', gap: 2},
  ratingStar: {fontSize: 13, color: '#F59E0B'},
  ratingText: {fontSize: 13, fontWeight: '700', color: '#1A1A1A'},
  reviewCount: {fontSize: 11, color: '#9CA3AF'},
  cardStory: {fontSize: 13, color: '#6B7280', fontStyle: 'italic', marginBottom: 8, lineHeight: 18},
  cardMetaRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  cardDistance: {fontSize: 12, color: '#9CA3AF'},
  cardAddress: {fontSize: 12, color: '#9CA3AF', flex: 1},
  planBadge: {
    backgroundColor: '#FEF3C7', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', marginTop: 8,
  },
  planText: {fontSize: 11, fontWeight: '700', color: '#D97706'},

  // Empty
  empty: {alignItems: 'center', paddingTop: 48, paddingHorizontal: 40},
  emptyIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: THEME_LIGHT, justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  emptyIconText: {fontSize: 36},
  emptyTitle: {fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8},
  emptyText: {fontSize: 14, color: '#6B7280', textAlign: 'center'},
});
