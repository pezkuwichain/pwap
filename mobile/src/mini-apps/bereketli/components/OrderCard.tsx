import React from 'react';
import {TouchableOpacity, View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography, borderRadius} from '../theme';
import type {Order} from '../types/models';

interface OrderCardProps {
  order: Order;
  storeName?: string;
  onPress: () => void;
}

const STATUS_LABELS: Record<Order['status'], string> = {
  pending: 'Bekliyor',
  paid: 'Odendi',
  picked_up: 'Teslim Alindi',
  cancelled: 'Iptal Edildi',
  refunded: 'Iade Edildi',
};

const STATUS_COLORS: Record<Order['status'], string> = {
  pending: colors.warning,
  paid: colors.info,
  picked_up: colors.success,
  cancelled: colors.error,
  refunded: colors.textSecondary,
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month} ${hours}:${mins}`;
}

function shortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

export default function OrderCard({order, storeName, onPress}: OrderCardProps) {
  const statusColor = STATUS_COLORS[order.status];
  const statusLabel = STATUS_LABELS[order.status];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.orderId}>#{shortId(order.id)}</Text>
        <View style={[styles.statusBadge, {backgroundColor: statusColor}]}>
          <Text style={styles.statusText}>{statusLabel}</Text>
        </View>
      </View>

      {storeName ? (
        <Text style={styles.storeName}>{storeName}</Text>
      ) : null}

      <View style={styles.footer}>
        <Text style={styles.price}>{order.total_price.toFixed(0)} TL</Text>
        <Text style={styles.date}>{formatDate(order.created_at)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderId: {
    ...typography.captionBold,
    color: colors.textSecondary,
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
  storeName: {
    ...typography.bodyBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
