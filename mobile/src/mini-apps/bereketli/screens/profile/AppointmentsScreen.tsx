import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors} from '../../theme';
import * as merchantsApi from '../../api/merchants';
import type {Appointment} from '../../api/merchants';

const STATUS_LABELS: Record<string, {label: string; color: string; bg: string}> = {
  pending: {label: 'Bekliyor', color: '#D97706', bg: '#FEF3C7'},
  confirmed: {label: 'Onaylandı', color: '#059669', bg: '#D1FAE5'},
  completed: {label: 'Tamamlandı', color: '#6B7280', bg: '#F3F4F6'},
  cancelled: {label: 'İptal', color: '#DC2626', bg: '#FEE2E2'},
  no_show: {label: 'Gelmedi', color: '#9CA3AF', bg: '#F3F4F6'},
};

export default function AppointmentsScreen({navigation}: any) {
  const {t} = useTranslation();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const insets = useSafeAreaInsets();

  const fetchAppointments = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const data = await merchantsApi.getMyAppointments();
      setAppointments(data);
    } catch {
      // Silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleCancel = async (id: string) => {
    Alert.alert('Randevu İptal', 'Bu randevuyu iptal etmek istediğinizden emin misiniz?', [
      {text: 'Vazgeç', style: 'cancel'},
      {
        text: 'İptal Et',
        style: 'destructive',
        onPress: async () => {
          try {
            await merchantsApi.cancelAppointment(id);
            fetchAppointments();
          } catch {
            Alert.alert('Hata', 'Randevu iptal edilemedi.');
          }
        },
      },
    ]);
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
    return `${d.getDate()}.${(d.getMonth() + 1).toString().padStart(2, '0')} ${days[d.getDay()]}`;
  };

  if (loading && appointments.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('appointments.title')}</Text>
        <View style={{width: 40}} />
      </View>

      <FlatList
        data={appointments}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAppointments(true)} colors={[colors.primary]} />
        }
        renderItem={({item}) => {
          const status = STATUS_LABELS[item.status] || STATUS_LABELS.pending;
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.merchantName}>{item.merchant_name}</Text>
                <View style={[styles.statusBadge, {backgroundColor: status.bg}]}>
                  <Text style={[styles.statusText, {color: status.color}]}>{status.label}</Text>
                </View>
              </View>
              <Text style={styles.serviceName}>{item.service_name}</Text>
              <View style={styles.cardMeta}>
                <Text style={styles.metaItem}>📅 {formatDate(item.appointment_date)}</Text>
                <Text style={styles.metaItem}>🕐 {item.time_slot}</Text>
                <Text style={styles.metaItem}>⏱ {item.duration_minutes} dk</Text>
                {item.price != null && (
                  <Text style={styles.metaPrice}>{item.price.toFixed(0)} TL</Text>
                )}
              </View>
              {item.notes && <Text style={styles.notes}>{item.notes}</Text>}
              {(item.status === 'pending' || item.status === 'confirmed') && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item.id)}>
                  <Text style={styles.cancelBtnText}>İptal Et</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📅</Text>
            <Text style={styles.emptyTitle}>{t('appointments.emptyTitle')}</Text>
            <Text style={styles.emptyText}>{t('appointments.emptyText')}</Text>
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
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.primary,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backIcon: {fontSize: 22, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},
  list: {padding: 16, paddingBottom: 100},
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  cardHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  merchantName: {fontSize: 16, fontWeight: '700', color: '#1A1A1A', flex: 1},
  statusBadge: {borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3},
  statusText: {fontSize: 12, fontWeight: '700'},
  serviceName: {fontSize: 15, fontWeight: '500', color: '#374151', marginBottom: 10},
  cardMeta: {flexDirection: 'row', flexWrap: 'wrap', gap: 12},
  metaItem: {fontSize: 13, color: '#6B7280'},
  metaPrice: {fontSize: 14, fontWeight: '700', color: colors.primary},
  notes: {fontSize: 13, color: '#9CA3AF', fontStyle: 'italic', marginTop: 8},
  cancelBtn: {
    marginTop: 12, alignSelf: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#EF4444',
  },
  cancelBtnText: {fontSize: 13, fontWeight: '600', color: '#EF4444'},
  empty: {alignItems: 'center', paddingTop: 48},
  emptyIcon: {fontSize: 48, marginBottom: 12},
  emptyTitle: {fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 6},
  emptyText: {fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 40},
});
