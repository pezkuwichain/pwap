import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import * as mealsApi from '../../api/meals';
import type {MealListing} from '../../types/models';

const BASE_URL = 'https://bereketli.pezkiwi.app';
const THEME = '#C68B1E';

const MEAL_IMAGES: Record<string, string> = {
  corba: `${BASE_URL}/meal-soup.png`,
  soup: `${BASE_URL}/meal-soup.png`,
  borek: `${BASE_URL}/meal-borek.png`,
  fasulye: `${BASE_URL}/meal-fasulye.png`,
  karniyarik: `${BASE_URL}/meal-karniyarik.png`,
};

function getMealImage(title: string): string {
  const lower = title.toLowerCase();
  for (const [key, url] of Object.entries(MEAL_IMAGES)) {
    if (lower.includes(key)) return url;
  }
  return `${BASE_URL}/homemade-meal.png`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

export default function MealDetailScreen({route, navigation}: any) {
  const {t} = useTranslation();
  const {mealId, cookName} = route.params;
  const [meal, setMeal] = useState<MealListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [ordering, setOrdering] = useState(false);
  const [portions, setPortions] = useState(1);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    mealsApi.getMeal(mealId).then(data => {
      setMeal(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [mealId]);

  const handleOrder = async () => {
    if (!meal) return;
    setOrdering(true);
    try {
      const order = await mealsApi.orderMeal(mealId, portions);
      Alert.alert(
        'Sipariş Verildi!',
        `Sipariş #${order.id.slice(0, 8).toUpperCase()}\n${portions} porsiyon ${meal.title}\nToplam: ${(meal.price_per_portion * portions).toFixed(0)} TL\n\nAşçı onayladıktan sonra bilgilendirileceksiniz.`,
        [{text: 'Tamam', onPress: () => navigation.goBack()}],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Sipariş oluşturulamadı.';
      Alert.alert('Hata', msg);
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME} />
      </View>
    );
  }

  if (!meal) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{t('mealDetail.notFound')}</Text>
      </View>
    );
  }

  const photoUri = meal.photos && meal.photos.length > 0
    ? (meal.photos[0].startsWith('http') ? meal.photos[0] : `${BASE_URL}${meal.photos[0]}`)
    : getMealImage(meal.title);

  const total = meal.price_per_portion * portions;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('mealDetail.title')}</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Image */}
        <Image source={{uri: photoUri}} style={styles.image} resizeMode="cover" />

        {/* Info */}
        <View style={styles.info}>
          <Text style={styles.cookName}>{cookName || t('mealDetail.defaultCook')}</Text>
          <Text style={styles.title}>{meal.title}</Text>
          {meal.description && (
            <Text style={styles.description}>{meal.description}</Text>
          )}

          {/* Details */}
          <View style={styles.detailCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Fiyat</Text>
              <Text style={styles.detailValue}>{meal.price_per_portion.toFixed(0)} TL / porsiyon</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Müsait</Text>
              <Text style={styles.detailValue}>{formatTime(meal.available_until)}'e kadar</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Kalan</Text>
              <Text style={styles.detailValue}>{meal.remaining_portions} / {meal.total_portions} porsiyon</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Teslim</Text>
              <Text style={styles.detailValue}>
                {meal.pickup_or_delivery === 'pickup' ? 'Gel Al' :
                 meal.pickup_or_delivery === 'delivery' ? 'Adrese Teslimat' : 'Gel Al / Teslimat'}
              </Text>
            </View>
          </View>

          {/* Portion selector */}
          <View style={styles.portionSection}>
            <Text style={styles.portionLabel}>Porsiyon</Text>
            <View style={styles.portionSelector}>
              <TouchableOpacity
                style={styles.portionBtn}
                onPress={() => setPortions(Math.max(1, portions - 1))}>
                <Text style={styles.portionBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.portionCount}>{portions}</Text>
              <TouchableOpacity
                style={styles.portionBtn}
                onPress={() => setPortions(Math.min(meal.remaining_portions, portions + 1))}>
                <Text style={styles.portionBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom bar */}
      <View style={[styles.bottomBar, {paddingBottom: Math.max(insets.bottom, 20)}]}>
        <View>
          <Text style={styles.totalLabel}>Toplam</Text>
          <Text style={styles.totalPrice}>{total.toFixed(0)} TL</Text>
        </View>
        <TouchableOpacity
          style={[styles.orderBtn, ordering && {opacity: 0.6}]}
          onPress={handleOrder}
          disabled={ordering || meal.remaining_portions === 0}>
          <Text style={styles.orderBtnText}>
            {ordering ? t('mealDetail.ordering') : meal.remaining_portions === 0 ? t('mealDetail.soldOut') : t('mealDetail.order')}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F8'},
  errorText: {fontSize: 16, color: '#9CA3AF'},

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: THEME,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backIcon: {fontSize: 22, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},

  scroll: {paddingBottom: 120},
  image: {width: '100%', height: 220},

  info: {padding: 16},
  cookName: {fontSize: 14, fontWeight: '600', color: THEME, marginBottom: 4},
  title: {fontSize: 22, fontWeight: '700', color: '#1A1A1A', marginBottom: 8},
  description: {fontSize: 15, color: '#6B7280', lineHeight: 22, marginBottom: 16},

  detailCard: {backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 16},
  detailRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10},
  detailDivider: {height: 1, backgroundColor: '#F3F4F6'},
  detailLabel: {fontSize: 14, color: '#6B7280'},
  detailValue: {fontSize: 14, fontWeight: '600', color: '#1A1A1A'},

  portionSection: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16,
  },
  portionLabel: {fontSize: 16, fontWeight: '600', color: '#1A1A1A'},
  portionSelector: {flexDirection: 'row', alignItems: 'center', gap: 16},
  portionBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  portionBtnText: {fontSize: 20, fontWeight: '600', color: '#1A1A1A'},
  portionCount: {fontSize: 20, fontWeight: '700', color: '#1A1A1A', minWidth: 30, textAlign: 'center'},

  bottomBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 16,
    backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  totalLabel: {fontSize: 12, color: '#9CA3AF'},
  totalPrice: {fontSize: 22, fontWeight: '800', color: THEME},
  orderBtn: {backgroundColor: THEME, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 14},
  orderBtnText: {fontSize: 16, fontWeight: '700', color: '#FFFFFF'},
});
