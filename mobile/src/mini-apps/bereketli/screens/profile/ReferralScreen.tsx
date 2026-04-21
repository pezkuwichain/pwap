import React, {useCallback, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Share,
  Linking,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors, borderRadius} from '../../theme';
import {getReferralStats, getReferralHistory} from '../../api/referral';
import type {ReferralStats, ReferralHistoryItem} from '../../api/referral';

export default function ReferralScreen({navigation}: {navigation: {goBack: () => void}}) {
  const {t} = useTranslation();
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [history, setHistory] = useState<ReferralHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const [statsData, historyData] = await Promise.all([
        getReferralStats(),
        getReferralHistory(),
      ]);
      setStats(statsData);
      setHistory(historyData);
    } catch {
      // Silently handle — empty state will show
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, []),
  );

  const shareText =
    stats?.code
      ? `Bereketli'ye katil, birlikte kazanalim! Davet kodum: ${stats.code}\nhttps://bereketli.pezkiwi.app/davet/${stats.code}`
      : '';

  const handleCopy = async () => {
    if (!stats?.code) return;
    try {
      const Clipboard = require('react-native').Clipboard;
      Clipboard.setString(stats.code);
      Alert.alert('Kopyalandi', `Davet kodun: ${stats.code}`);
    } catch {
      Share.share({message: stats.code});
    }
  };

  const handleWhatsApp = () => {
    if (!shareText) return;
    const url = `whatsapp://send?text=${encodeURIComponent(shareText)}`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(
        `https://wa.me/?text=${encodeURIComponent(shareText)}`,
      ).catch(() => {});
    });
  };

  const handleShare = () => {
    if (!shareText) return;
    Share.share({message: shareText});
  };

  if (loading && !stats) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const pointsBalance = stats?.stats.points_balance ?? 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 12}]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>{'\u2190'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('referral.title')}</Text>
        <View style={{width: 30}} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchData(true)}
            colors={[colors.primary]}
          />
        }>
        {/* Points Balance */}
        <View style={styles.pointsCard}>
          <Text style={styles.pointsLabel}>{t('referral.totalPoints')}</Text>
          <Text style={styles.pointsValue}>{pointsBalance}</Text>
          <Text style={styles.pointsUnit}>{t('referral.pointsUnit')}</Text>
          {stats && (
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.stats.total_referrals}</Text>
                <Text style={styles.statLabel}>Davet</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.stats.completed_referrals}</Text>
                <Text style={styles.statLabel}>Tamamlanan</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statNumber}>{stats.stats.total_earned}</Text>
                <Text style={styles.statLabel}>Kazanilan</Text>
              </View>
            </View>
          )}
        </View>

        {/* Referral Code */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Davet Kodun</Text>
          <View style={styles.codeCard}>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{stats?.code || '---'}</Text>
            </View>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.codeBtn} onPress={handleCopy}>
                <Text style={styles.codeBtnText}>Kopyala</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.codeBtn, styles.whatsappBtn]}
                onPress={handleWhatsApp}>
                <Text style={styles.whatsappBtnText}>WhatsApp ile Paylas</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.codeBtn, styles.shareBtn]}
                onPress={handleShare}>
                <Text style={styles.shareBtnText}>Paylas</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nasil Calisir?</Text>
          <View style={styles.stepsCard}>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepEmoji}>{'\uD83D\uDC64'}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Arkadasin kayit olur</Text>
                <Text style={styles.stepDesc}>
                  {stats?.stats.next_signup_points ?? 50}+ puan kazan
                </Text>
              </View>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepEmoji}>{'\uD83D\uDED2'}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Ilk siparisini verir</Text>
                <Text style={styles.stepDesc}>100 puan kazan</Text>
              </View>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepEmoji}>{'\uD83D\uDCC8'}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Ne kadar cok davet</Text>
                <Text style={styles.stepDesc}>O kadar cok puan!</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Use Points */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Puanlarini Kullan</Text>
          <View style={styles.stepsCard}>
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepEmoji}>{'\uD83C\uDF81'}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>Paketlerde indirim</Text>
                <Text style={styles.stepDesc}>Magazalarin belirledigi teklifler</Text>
              </View>
            </View>
            <View style={styles.stepDivider} />
            <View style={styles.stepRow}>
              <View style={styles.stepIcon}>
                <Text style={styles.stepEmoji}>{'\uD83E\uDE99'}</Text>
              </View>
              <View style={styles.stepText}>
                <Text style={styles.stepTitle}>HEZ Coin'e cevir</Text>
                <Text style={styles.stepDesc}>Yakinda</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Referral History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Davet Gecmisi</Text>
          {history.length === 0 ? (
            <View style={styles.emptyHistory}>
              <Text style={styles.emptyEmoji}>{'\uD83D\uDC65'}</Text>
              <Text style={styles.emptyTitle}>Henuz davetiniz yok</Text>
              <Text style={styles.emptyText}>
                Kodunuzu paylasin ve puan kazanmaya baslayin
              </Text>
            </View>
          ) : (
            <View style={styles.historyCard}>
              {history.map((item, index) => (
                <View key={`${item.referred_name}-${item.created_at}`}>
                  {index > 0 && <View style={styles.historyDivider} />}
                  <View style={styles.historyRow}>
                    <View style={styles.historyLeft}>
                      <Text style={styles.historyName}>{item.referred_name}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(item.created_at).toLocaleDateString('tr-TR')}
                      </Text>
                    </View>
                    <View style={styles.historyRight}>
                      <Text style={styles.historyStatus}>
                        {item.status === 'first_purchase' ? '\u2705' : '\u23F3'}
                      </Text>
                      <Text style={styles.historyPoints}>+{item.points_earned}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={{height: 100}} />
      </ScrollView>
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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.primary,
  },
  backIcon: {fontSize: 22, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},

  // Points
  pointsCard: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  pointsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    fontWeight: '500',
  },
  pointsValue: {
    fontSize: 48,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
  },
  pointsUnit: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    marginTop: -4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statItem: {flex: 1, alignItems: 'center'},
  statNumber: {fontSize: 18, fontWeight: '700', color: '#FFFFFF'},
  statLabel: {fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2},
  statDivider: {width: 1, backgroundColor: 'rgba(255,255,255,0.2)'},

  // Sections
  section: {marginTop: 16, paddingHorizontal: 16},
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 10,
    marginLeft: 4,
  },

  // Code
  codeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
  },
  codeBox: {
    backgroundColor: '#F3F4F6',
    borderRadius: borderRadius.md,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  codeText: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: 3,
  },
  codeActions: {marginTop: 12},
  codeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 8,
  },
  codeBtnText: {fontSize: 14, fontWeight: '600', color: colors.textPrimary},
  whatsappBtn: {
    backgroundColor: '#25D366',
    borderColor: '#25D366',
  },
  whatsappBtnText: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},
  shareBtn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  shareBtnText: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},

  // Steps
  stepsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
  },
  stepRow: {flexDirection: 'row', alignItems: 'center'},
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepEmoji: {fontSize: 20},
  stepText: {flex: 1},
  stepTitle: {fontSize: 14, fontWeight: '600', color: '#1A1A1A'},
  stepDesc: {fontSize: 12, color: '#6B7280', marginTop: 2},
  stepDivider: {height: 1, backgroundColor: '#F3F4F6', marginVertical: 12, marginLeft: 56},

  // History
  emptyHistory: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 32,
    alignItems: 'center',
  },
  emptyEmoji: {fontSize: 40, marginBottom: 12},
  emptyTitle: {fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginBottom: 4},
  emptyText: {fontSize: 13, color: '#6B7280', textAlign: 'center'},
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    padding: 16,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  historyLeft: {flex: 1},
  historyName: {fontSize: 14, fontWeight: '600', color: '#1A1A1A'},
  historyDate: {fontSize: 11, color: '#9CA3AF', marginTop: 2},
  historyRight: {flexDirection: 'row', alignItems: 'center'},
  historyStatus: {fontSize: 16, marginRight: 8},
  historyPoints: {fontSize: 14, fontWeight: '700', color: colors.primary},
  historyDivider: {height: 1, backgroundColor: '#F3F4F6'},
});
