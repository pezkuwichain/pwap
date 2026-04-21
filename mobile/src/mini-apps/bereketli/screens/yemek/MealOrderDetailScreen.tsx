import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import QRCode from 'react-native-qrcode-svg';
import {useTranslation} from 'react-i18next';
import {colors, spacing, typography, borderRadius} from '../../theme';
import type {MealOrder} from '../../types/models';

const STATUS_LABEL_KEYS: Record<MealOrder['status'], string> = {
  pending: 'orders.statusPending',
  accepted: 'orders.statusAccepted',
  rejected: 'orders.statusRejected',
  completed: 'orders.statusCompleted',
  cancelled: 'orders.statusCancelled',
};

const STATUS_COLORS: Record<MealOrder['status'], string> = {
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
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${mins}`;
}

export default function MealOrderDetailScreen({route, navigation}: any) {
  const {t} = useTranslation();
  const {order} = route.params as {order: MealOrder};
  const insets = useSafeAreaInsets();
  const statusColor = STATUS_COLORS[order.status];
  const statusLabel = t(STATUS_LABEL_KEYS[order.status]);
  const showQr = order.qr_token && (order.status === 'pending' || order.status === 'accepted');

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TouchableOpacity
          style={[styles.backButton, {paddingTop: insets.top + 8}]}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'} {t('common.back')}</Text>
        </TouchableOpacity>

        <View style={[styles.statusHeader, {backgroundColor: statusColor}]}>
          <Text style={styles.statusIcon}>
            {order.status === 'completed' ? '\u2705' :
             order.status === 'accepted' ? '\uD83D\uDC68\u200D\uD83C\uDF73' :
             order.status === 'rejected' ? '\u274C' :
             order.status === 'cancelled' ? '\u274C' : '\u23F3'}
          </Text>
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>

        {showQr && (
          <View style={styles.qrSection}>
            <Text style={styles.qrTitle}>{t('orderDetail.pickupCode')}</Text>
            <View style={styles.qrContainer}>
              <QRCode
                value={order.qr_token}
                size={180}
                backgroundColor="#FAFAFA"
                color={colors.textPrimary}
              />
            </View>
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>Token</Text>
              <Text style={styles.tokenValue}>{order.qr_token}</Text>
            </View>
            <Text style={styles.qrHint}>{t('mealOrderDetail.qrHint')}</Text>
          </View>
        )}

        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>{t('orderDetail.orderDetails')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('mealOrderDetail.portionLabel')}</Text>
            <Text style={styles.detailValue}>{order.portions}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('orderDetail.total')}</Text>
            <Text style={styles.totalPrice}>{order.total_price.toFixed(0)} TL</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('mealOrderDetail.orderDate')}</Text>
            <Text style={styles.detailValue}>{formatDate(order.created_at)}</Text>
          </View>

          {order.accepted_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('mealOrderDetail.acceptDate')}</Text>
              <Text style={styles.detailValue}>{formatDate(order.accepted_at)}</Text>
            </View>
          )}

          {order.completed_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('mealOrderDetail.deliveryDate')}</Text>
              <Text style={styles.detailValue}>{formatDate(order.completed_at)}</Text>
            </View>
          )}

          {order.cancelled_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('mealOrderDetail.cancelDate')}</Text>
              <Text style={styles.detailValue}>{formatDate(order.cancelled_at)}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  scroll: {paddingBottom: 100},
  backButton: {paddingHorizontal: spacing.xl, paddingBottom: spacing.md},
  backText: {...typography.body, color: colors.primary},
  statusHeader: {
    alignItems: 'center', paddingVertical: spacing.xxl,
    marginHorizontal: spacing.xl, borderRadius: borderRadius.lg,
  },
  statusIcon: {fontSize: 40, marginBottom: spacing.sm},
  statusLabel: {...typography.h3, color: colors.textWhite},
  qrSection: {
    alignItems: 'center', backgroundColor: colors.backgroundWhite,
    marginHorizontal: spacing.xl, marginTop: spacing.lg,
    borderRadius: borderRadius.lg, padding: spacing.xl,
  },
  qrTitle: {...typography.h3, color: colors.textPrimary, marginBottom: spacing.lg},
  qrContainer: {padding: spacing.lg, backgroundColor: '#FAFAFA', borderRadius: borderRadius.md},
  tokenContainer: {marginTop: spacing.lg, alignItems: 'center'},
  tokenLabel: {...typography.small, color: colors.textSecondary},
  tokenValue: {...typography.h3, color: colors.primary, marginTop: spacing.xs, letterSpacing: 2},
  qrHint: {...typography.small, color: colors.textLight, marginTop: spacing.md, textAlign: 'center'},
  detailsSection: {
    backgroundColor: colors.backgroundWhite, marginHorizontal: spacing.xl,
    marginTop: spacing.lg, borderRadius: borderRadius.lg, padding: spacing.xl,
  },
  sectionTitle: {...typography.captionBold, color: colors.textSecondary, marginBottom: spacing.lg},
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {...typography.caption, color: colors.textSecondary},
  detailValue: {...typography.captionBold, color: colors.textPrimary},
  totalPrice: {...typography.price, color: colors.primary},
});
