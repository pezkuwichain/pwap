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
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useLocationStore} from '../../store/locationStore';
import * as mealsApi from '../../api/meals';
import type {MealNearby} from '../../types/models';
import {useTranslation} from 'react-i18next';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import OfflineBanner from '../../components/OfflineBanner';

const THEME = '#C68B1E'; // Amber/gold theme for Komşu
const THEME_DARK = '#92400E';
const THEME_LIGHT = '#FEF3C7';
const BASE_URL = 'https://bereketli.pezkiwi.app';

const MEAL_IMAGES: Record<string, string> = {
  corba: `${BASE_URL}/meal-soup.png`,
  soup: `${BASE_URL}/meal-soup.png`,
  mercimek: `${BASE_URL}/meal-soup.png`,
  borek: `${BASE_URL}/meal-borek.jpg`,
  ispanak: `${BASE_URL}/meal-borek.jpg`,
  fasulye: `${BASE_URL}/meal-fasulye.jpg`,
  pilav: `${BASE_URL}/meal-fasulye.jpg`,
  karniyarik: `${BASE_URL}/meal-karniyarik.jpg`,
  patlican: `${BASE_URL}/meal-karniyarik.jpg`,
};

function getMealImage(title: string): string {
  const lower = title.toLowerCase();
  for (const [key, url] of Object.entries(MEAL_IMAGES)) {
    if (lower.includes(key)) return url;
  }
  return `${BASE_URL}/homemade-meal.png`;
}

export default function KomsuListScreen({navigation}: any) {
  const {t} = useTranslation();
  const {latitude, longitude, updateLocation} = useLocationStore();
  const [meals, setMeals] = useState<MealNearby[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [radius, setRadius] = useState(0); // Default: Tümü
  const insets = useSafeAreaInsets();

  const fetchMeals = useCallback(async () => {
    setLoading(true);
    try {
      let data: MealNearby[];
      if (radius === 0) {
        data = await mealsApi.getAllMeals();
      } else if (latitude && longitude) {
        data = await mealsApi.getNearbyMeals(latitude, longitude, radius);
      } else {
        data = [];
      }
      setMeals(data);
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, [latitude, longitude, radius]);

  useEffect(() => {
    updateLocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- updateLocation is a stable zustand store action
  }, []);

  useEffect(() => {
    fetchMeals();
  }, [fetchMeals]);

  const filteredMeals = searchQuery.trim()
    ? meals.filter(
        m =>
          m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.cook_name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : meals;

  const formatDistance = (m: number) =>
    m < 1000 ? `${Math.round(m)}m` : `${(m / 1000).toFixed(1)}km`;

  const renderMealCard = ({item}: {item: MealNearby}) => (
    <View style={styles.cardWrapper}>
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => navigation.navigate('MealDetail', {mealId: item.id, cookName: item.cook_name})}>
        {/* Image */}
        <View style={styles.cardImage}>
          <Image
            source={{uri:
              item.photos && item.photos.length > 0
                ? (item.photos[0].startsWith('http') ? item.photos[0] : `${BASE_URL}${item.photos[0]}`)
                : getMealImage(item.title)
            }}
            style={styles.cardImg}
            resizeMode="cover"
          />
          {/* Delivery badge */}
          <View style={[styles.deliveryBadge, {backgroundColor: item.pickup_or_delivery === 'delivery' ? '#10B981' : THEME}]}>
            <Text style={styles.deliveryText}>
              {item.pickup_or_delivery === 'pickup' ? t('meals.pickup') :
               item.pickup_or_delivery === 'delivery' ? t('meals.delivery') : t('meals.pickupOrDelivery')}
            </Text>
          </View>
          {/* Portions badge */}
          {item.remaining_portions <= 3 && (
            <View style={styles.portionBadge}>
              <Text style={styles.portionText}>{t('meals.lastPortions', {count: item.remaining_portions})}</Text>
            </View>
          )}
        </View>

        {/* Info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={styles.cardCookName} numberOfLines={1}>{item.cook_name}</Text>
            {item.distance_m > 0 && (
              <Text style={styles.cardDistance}>📍 {formatDistance(item.distance_m)}</Text>
            )}
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          {item.description && (
            <Text style={styles.cardDesc} numberOfLines={1}>{item.description}</Text>
          )}
          <View style={styles.cardPriceRow}>
            <Text style={styles.cardPrice}>{item.price_per_portion.toFixed(0)} TL</Text>
            <Text style={styles.cardPriceLabel}> / porsiyon</Text>
            {item.remaining_portions > 3 && (
              <Text style={styles.cardPortions}>{item.remaining_portions} porsiyon</Text>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderScrollHeader = () => (
    <>
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
        <Text style={styles.sectionTitle}>{t('meals.nearbyMeals')}</Text>
        {filteredMeals.length > 0 && (
          <Text style={styles.sectionCount}>{t('meals.mealCount', {count: filteredMeals.length})}</Text>
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
            <Text style={styles.headerTitle}>{t('meals.title')}</Text>
            <Text style={styles.headerSubtitle}>{t('meals.subtitle')}</Text>
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
            placeholder={t('meals.searchPlaceholder')}
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
        data={filteredMeals}
        keyExtractor={item => item.id}
        renderItem={renderMealCard}
        ListHeaderComponent={renderScrollHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={fetchMeals} colors={[THEME]} />
        }
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIconText}>🍲</Text>
              </View>
              <Text style={styles.emptyTitle}>{t('meals.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('meals.emptyText')}</Text>
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
  header: {
    backgroundColor: THEME,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
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
  deliveryBadge: {
    position: 'absolute', bottom: 10, left: 10,
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3,
  },
  deliveryText: {fontSize: 11, fontWeight: '700', color: '#FFFFFF'},
  portionBadge: {
    position: 'absolute', top: 10, right: 10,
    backgroundColor: '#F59E0B', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  portionText: {fontSize: 11, fontWeight: '700', color: '#FFFFFF'},
  cardInfo: {padding: 12},
  cardNameRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
  cardCookName: {fontSize: 13, fontWeight: '600', color: THEME_DARK, flex: 1},
  cardDistance: {fontSize: 12, color: '#9CA3AF'},
  cardTitle: {fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4, lineHeight: 22},
  cardDesc: {fontSize: 13, color: '#6B7280', marginBottom: 8},
  cardPriceRow: {flexDirection: 'row', alignItems: 'baseline'},
  cardPrice: {fontSize: 18, fontWeight: '800', color: THEME},
  cardPriceLabel: {fontSize: 13, color: '#6B7280'},
  cardPortions: {fontSize: 12, color: '#9CA3AF', marginLeft: 'auto'},

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
