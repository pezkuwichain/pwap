import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors, borderRadius} from '../../theme';
import {getMyCards, redeemReward} from '../../api/merchants';
import type {LoyaltyCard} from '../../types/models';

const CATEGORY_EMOJI: Record<string, string> = {
  barber: '💈',
  cafe: '☕',
  butcher: '🥩',
  greengrocer: '🥬',
  pharmacy: '💊',
  tailor: '🧵',
  bakery: '🍞',
  other: '🏪',
};

function progressPercent(card: LoyaltyCard): number {
  if (card.program_type === 'stamp' && card.stamps_required) {
    return Math.min(100, (card.current_stamps / card.stamps_required) * 100);
  }
  if (card.program_type === 'points' && card.points_required) {
    return Math.min(100, (card.current_points / card.points_required) * 100);
  }
  if (card.program_type === 'frequency' && card.frequency_required) {
    return Math.min(100, (card.visit_count / card.frequency_required) * 100);
  }
  return 0;
}

function progressText(card: LoyaltyCard): string {
  if (card.program_type === 'stamp' && card.stamps_required) {
    return `${card.current_stamps}/${card.stamps_required} pul`;
  }
  if (card.program_type === 'points' && card.points_required) {
    return `${card.current_points}/${card.points_required} puan`;
  }
  if (card.program_type === 'frequency' && card.frequency_required) {
    return `${card.visit_count}/${card.frequency_required} ziyaret`;
  }
  return '';
}

export default function LoyaltyCardsScreen({navigation}: any) {
  const {t} = useTranslation();
  const [cards, setCards] = useState<LoyaltyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchCards = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await getMyCards();
      setCards(data);
    } catch {
      setCards([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchCards();
    }, []),
  );

  const handleRedeem = async (card: LoyaltyCard) => {
    const pct = progressPercent(card);
    if (pct < 100) {
      Alert.alert('Henuz hazir degil', `Odulunuzu almak icin ${progressText(card)} tamamlayin.`);
      return;
    }
    Alert.alert(
      'Odul Al',
      `${card.reward_description}\n\nOdulunuzu almak istiyor musunuz?`,
      [
        {text: 'Vazgec', style: 'cancel'},
        {
          text: 'Odul Al',
          onPress: async () => {
            try {
              await redeemReward(card.id);
              Alert.alert('Tebrikler!', 'Odulunuz kullanildi.');
              fetchCards();
            } catch (err: any) {
              Alert.alert('Hata', err?.response?.data?.message || 'Odul alinamadi');
            }
          },
        },
      ],
    );
  };

  if (loading && cards.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('loyalty.title')}</Text>
        <View style={{width: 30}} />
      </View>

      <FlatList
        data={cards}
        keyExtractor={item => item.id}
        renderItem={({item}) => {
          const pct = progressPercent(item);
          const emoji = CATEGORY_EMOJI[item.merchant_category] || '🏪';
          const ready = pct >= 100;

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardEmoji}>{emoji}</Text>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardMerchant}>{item.merchant_name}</Text>
                  <Text style={styles.cardProgram}>{item.program_name}</Text>
                </View>
                {ready && (
                  <TouchableOpacity style={styles.redeemBtn} onPress={() => handleRedeem(item)}>
                    <Text style={styles.redeemText}>{t('loyalty.redeemButton')}</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.progressBar}>
                <View style={[styles.progressFill, {width: `${pct}%`}]} />
              </View>

              <View style={styles.cardFooter}>
                <Text style={styles.progressLabel}>{progressText(item)}</Text>
                <Text style={styles.rewardLabel}>{item.reward_description}</Text>
              </View>

              {item.last_visit && (
                <Text style={styles.lastVisit}>Son ziyaret: {item.last_visit.split('T')[0]}</Text>
              )}
            </View>
          );
        }}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchCards(true)} colors={[colors.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{fontSize: 48, marginBottom: 16}}>💳</Text>
            <Text style={styles.emptyTitle}>{t('loyalty.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('loyalty.emptyText')}</Text>
            <TouchableOpacity
              style={styles.explorBtn}
              onPress={() => navigation.navigate('EsnafMap')}>
              <Text style={styles.explorText}>{t('loyalty.exploreMerchants')}</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F8'},
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 16, backgroundColor: colors.primary,
  },
  backIcon: {fontSize: 22, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},
  list: {padding: 16, paddingBottom: 100},
  card: {
    backgroundColor: '#FFFFFF', borderRadius: borderRadius.lg, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardHeader: {flexDirection: 'row', alignItems: 'center', marginBottom: 12},
  cardEmoji: {fontSize: 28, marginRight: 12},
  cardInfo: {flex: 1},
  cardMerchant: {fontSize: 16, fontWeight: '700', color: '#1A1A1A'},
  cardProgram: {fontSize: 12, color: '#6B7280', marginTop: 2},
  redeemBtn: {
    backgroundColor: colors.primary, borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  redeemText: {fontSize: 12, fontWeight: '700', color: '#FFFFFF'},
  progressBar: {
    height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden',
  },
  progressFill: {
    height: '100%', backgroundColor: colors.primary, borderRadius: 4,
  },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', marginTop: 8,
  },
  progressLabel: {fontSize: 12, fontWeight: '600', color: '#374151'},
  rewardLabel: {fontSize: 12, color: colors.primary, fontWeight: '600'},
  lastVisit: {fontSize: 11, color: '#9CA3AF', marginTop: 6},
  empty: {alignItems: 'center', paddingTop: 60, paddingHorizontal: 40},
  emptyTitle: {fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 8},
  emptyText: {fontSize: 14, color: '#6B7280', textAlign: 'center', marginBottom: 20},
  explorBtn: {
    backgroundColor: colors.primary, borderRadius: 12,
    paddingHorizontal: 24, paddingVertical: 12,
  },
  explorText: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},
});
