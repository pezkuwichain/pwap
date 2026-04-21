import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import {useTranslation} from 'react-i18next';
import {colors, spacing, typography, borderRadius} from '../../theme';
import {getOrder, cancelOrder} from '../../api/orders';
import {createReview} from '../../api/reviews';
import type {Order} from '../../types/models';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type RootStackParamList = {
  OrderDetail: {orderId: string};
};

type Props = NativeStackScreenProps<RootStackParamList, 'OrderDetail'>;

const STATUS_LABEL_KEYS: Record<Order['status'], string> = {
  pending: 'orders.statusPending',
  paid: 'orders.statusPaid',
  picked_up: 'orders.statusPickedUp',
  cancelled: 'orders.statusCancelled',
  refunded: 'orders.statusRefunded',
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
  const year = d.getFullYear();
  const hours = d.getHours().toString().padStart(2, '0');
  const mins = d.getMinutes().toString().padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${mins}`;
}

export default function OrderDetailScreen({route, navigation}: Props) {
  const {t} = useTranslation();
  const {orderId} = route.params;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    loadOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadOrder depends on orderId from route params which won't change
  }, []);

  const loadOrder = async () => {
    try {
      const data = await getOrder(orderId);
      setOrder(data);
    } catch {
      Alert.alert(t('common.error'), t('orderDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      t('orderDetail.cancelTitle'),
      t('orderDetail.cancelMessage'),
      [
        {text: t('common.cancel'), style: 'cancel'},
        {
          text: t('orderDetail.cancelConfirm'),
          style: 'destructive',
          onPress: async () => {
            setCancelling(true);
            try {
              const updated = await cancelOrder(orderId);
              setOrder(updated);
              Alert.alert(t('changePassword.successTitle'), t('orderDetail.cancelSuccess'));
            } catch {
              Alert.alert(t('common.error'), t('orderDetail.cancelFailed'));
            } finally {
              setCancelling(false);
            }
          },
        },
      ],
    );
  };

  const handleReviewSubmit = async () => {
    if (reviewRating === 0) {
      Alert.alert(t('common.error'), t('orderDetail.reviewRatingRequired'));
      return;
    }
    if (!order?.store_id) return;
    setSubmittingReview(true);
    try {
      await createReview(
        'store',
        order.store_id,
        reviewRating,
        reviewComment.trim() || undefined,
        order.id,
      );
      setReviewSubmitted(true);
      setShowReview(false);
      Alert.alert(t('orderDetail.reviewSuccessTitle'), t('orderDetail.reviewSuccess'));
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('orderDetail.reviewFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'} {t('common.back')}</Text>
        </TouchableOpacity>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>{t('orderDetail.notFound')}</Text>
          <TouchableOpacity
            style={{marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12}}
            onPress={() => navigation.goBack()}>
            <Text style={{color: '#FFFFFF', fontWeight: '700', fontSize: 14}}>{t('common.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[order.status];
  const statusLabel = t(STATUS_LABEL_KEYS[order.status]);
  const canCancel = order.status === 'pending';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Back button */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>{'\u2190'} {t('common.back')}</Text>
        </TouchableOpacity>

        {/* Status header */}
        <View style={[styles.statusHeader, {backgroundColor: statusColor}]}>
          <Text style={styles.statusIcon}>
            {order.status === 'picked_up'
              ? '\u2705'
              : order.status === 'cancelled'
              ? '\u274C'
              : order.status === 'paid'
              ? '\uD83D\uDCB3'
              : '\u23F3'}
          </Text>
          <Text style={styles.statusLabel}>{statusLabel}</Text>
        </View>

        {/* QR Code section */}
        {order.qr_token && (order.status === 'pending' || order.status === 'paid') && (
          <View style={styles.qrSection}>
            <Text style={styles.qrTitle}>{t('orderDetail.pickupCode')}</Text>
            <View style={styles.qrContainer}>
              <QRCode
                value={order.qr_token}
                size={180}
                backgroundColor={colors.qrBackground}
                color={colors.textPrimary}
              />
            </View>
            <View style={styles.tokenContainer}>
              <Text style={styles.tokenLabel}>Token</Text>
              <Text style={styles.tokenValue}>{order.qr_token}</Text>
            </View>
            <Text style={styles.qrHint}>
              {t('orderDetail.qrHint')}
            </Text>
          </View>
        )}

        {/* Order details */}
        <View style={styles.detailsSection}>
          <Text style={styles.sectionTitle}>{t('orderDetail.orderDetails')}</Text>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('orderDetail.orderNo')}</Text>
            <Text style={styles.detailValue}>
              #{order.id.slice(0, 8).toUpperCase()}
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('orderDetail.quantity')}</Text>
            <Text style={styles.detailValue}>{order.quantity}</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('orderDetail.unitPrice')}</Text>
            <Text style={styles.detailValue}>{order.unit_price.toFixed(0)} TL</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('orderDetail.total')}</Text>
            <Text style={styles.totalPrice}>{order.total_price.toFixed(0)} TL</Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('orderDetail.date')}</Text>
            <Text style={styles.detailValue}>{formatDate(order.created_at)}</Text>
          </View>

          {order.paid_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('orderDetail.paymentDate')}</Text>
              <Text style={styles.detailValue}>{formatDate(order.paid_at)}</Text>
            </View>
          )}

          {order.picked_up_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('orderDetail.pickupDate')}</Text>
              <Text style={styles.detailValue}>{formatDate(order.picked_up_at)}</Text>
            </View>
          )}

          {order.cancelled_at && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>{t('orderDetail.cancelDate')}</Text>
              <Text style={styles.detailValue}>{formatDate(order.cancelled_at)}</Text>
            </View>
          )}
        </View>

        {/* Cancel button */}
        {canCancel && (
          <TouchableOpacity
            style={[styles.cancelButton, cancelling && styles.cancelButtonDisabled]}
            onPress={handleCancel}
            disabled={cancelling}>
            <Text style={styles.cancelText}>
              {cancelling ? t('orderDetail.cancelling') : t('orderDetail.cancelOrder')}
            </Text>
          </TouchableOpacity>
        )}

        {/* Review section — only for picked_up orders */}
        {order.status === 'picked_up' && !reviewSubmitted && (
          <View style={styles.reviewSection}>
            {!showReview ? (
              <TouchableOpacity
                style={styles.reviewButton}
                onPress={() => setShowReview(true)}>
                <Text style={styles.reviewButtonText}>{t('orderDetail.reviewButton')}</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.reviewForm}>
                <Text style={styles.reviewFormTitle}>{t('orderDetail.reviewTitle')}</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map(star => (
                    <TouchableOpacity key={star} onPress={() => setReviewRating(star)}>
                      <Text style={[styles.star, star <= reviewRating && styles.starActive]}>
                        {star <= reviewRating ? '\u2605' : '\u2606'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput
                  style={styles.reviewInput}
                  placeholder={t('orderDetail.reviewPlaceholder')}
                  placeholderTextColor="#9CA3AF"
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  multiline
                  maxLength={500}
                />
                <TouchableOpacity
                  style={[styles.reviewSubmitBtn, submittingReview && {opacity: 0.6}]}
                  onPress={handleReviewSubmit}
                  disabled={submittingReview}>
                  <Text style={styles.reviewSubmitText}>
                    {submittingReview ? t('orderDetail.reviewSubmitting') : t('orderDetail.reviewSubmit')}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {reviewSubmitted && (
          <View style={styles.reviewSection}>
            <Text style={styles.reviewDoneText}>{t('orderDetail.reviewDone')}</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  errorText: {...typography.body, color: colors.textSecondary},
  scroll: {paddingBottom: spacing.xxxl},
  backButton: {
    paddingTop: 56,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.md,
  },
  backText: {...typography.body, color: colors.primary},
  statusHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    marginHorizontal: spacing.xl,
    borderRadius: borderRadius.lg,
  },
  statusIcon: {fontSize: 40, marginBottom: spacing.sm},
  statusLabel: {...typography.h3, color: colors.textWhite},
  qrSection: {
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  qrTitle: {...typography.h3, color: colors.textPrimary, marginBottom: spacing.lg},
  qrContainer: {
    padding: spacing.lg,
    backgroundColor: colors.qrBackground,
    borderRadius: borderRadius.md,
  },
  tokenContainer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
  tokenLabel: {...typography.small, color: colors.textSecondary},
  tokenValue: {
    ...typography.h3,
    color: colors.primary,
    marginTop: spacing.xs,
    letterSpacing: 2,
  },
  qrHint: {
    ...typography.small,
    color: colors.textLight,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  detailsSection: {
    backgroundColor: colors.backgroundWhite,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  sectionTitle: {
    ...typography.captionBold,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {...typography.caption, color: colors.textSecondary},
  detailValue: {...typography.captionBold, color: colors.textPrimary},
  totalPrice: {...typography.price, color: colors.primary},
  cancelButton: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.error,
  },
  cancelButtonDisabled: {opacity: 0.6},
  cancelText: {...typography.button, color: colors.error},
  reviewSection: {
    marginHorizontal: spacing.xl,
    marginTop: spacing.xl,
  },
  reviewButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  reviewButtonText: {...typography.button, color: '#FFFFFF'},
  reviewForm: {
    backgroundColor: colors.backgroundWhite,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
  },
  reviewFormTitle: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  starRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: spacing.lg,
  },
  star: {
    fontSize: 36,
    color: '#D1D5DB',
  },
  starActive: {
    color: '#F59E0B',
  },
  reviewInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.md,
  },
  reviewSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  reviewSubmitText: {...typography.button, color: '#FFFFFF'},
  reviewDoneText: {
    ...typography.body,
    color: colors.success,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
});
