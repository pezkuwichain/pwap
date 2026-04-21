import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Linking,
  Image,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors, spacing, typography, borderRadius} from '../../theme';
import * as packagesApi from '../../api/packages';
import {createOrder} from '../../api/orders';
import client from '../../api/client';

const BASE_URL = 'https://bereketli.pezkiwi.app';
const CATEGORY_IMAGES: Record<string, string> = {
  bakery: `${BASE_URL}/package-bakery.png`,
  restaurant: `${BASE_URL}/package-restaurant.png`,
  pastry: `${BASE_URL}/package-pastry.png`,
  market: `${BASE_URL}/package-market.png`,
  catering: `${BASE_URL}/package-restaurant.png`,
  butcher: `${BASE_URL}/pkg-meat.jpg`,
  greengrocer: `${BASE_URL}/pkg-vegetable.jpg`,
  other: `${BASE_URL}/bereketli_paket.png`,
};

function getDetailImage(title: string, category: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('et ') || lower.includes('kıyma') || lower.includes('sucuk')) return `${BASE_URL}/pkg-meat.jpg`;
  if (lower.includes('mangal') || lower.includes('izgara')) return `${BASE_URL}/pkg-mangal.jpg`;
  if (lower.includes('sebze')) return `${BASE_URL}/pkg-vegetable.jpg`;
  if (lower.includes('meyve')) return `${BASE_URL}/pkg-fruit.jpg`;
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.other;
}
import type {Package} from '../../types/models';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';

type RootStackParamList = {
  PackageDetail: {packageId: string; storeName?: string; storeAddress?: string};
  OrderDetail: {orderId: string};
};

type Props = NativeStackScreenProps<RootStackParamList, 'PackageDetail'>;

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
}

function discountPercent(price: number, original: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - price) / original) * 100);
}

export default function PackageDetailScreen({route, navigation}: Props) {
  const {t} = useTranslation();
  const {packageId, storeName, storeAddress} = route.params;
  const [pkg, setPkg] = useState<Package | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery'>('pickup');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    loadPackage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadPackage depends on packageId from route params which won't change
  }, []);

  const loadPackage = async () => {
    try {
      const data = await packagesApi.getPackage(packageId);
      setPkg(data);
    } catch {
      Alert.alert(t('common.error'), t('packageDetail.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async () => {
    if (!pkg) return;
    if (deliveryType === 'delivery' && !deliveryAddress.trim()) {
      Alert.alert(t('common.error'), t('packageDetail.deliveryAddressRequired'));
      return;
    }

    setPurchasing(true);
    try {
      // 1. Sipariş oluştur
      const order = await createOrder(
        pkg.id,
        1,
        deliveryType,
        deliveryType === 'delivery' ? deliveryAddress : undefined,
      );

      // 2. Ödeme sayfasına yönlendir (Stripe Checkout)
      try {
        const {data: payment} = await client.post<{checkout_url: string; order_id: string}>(
          '/payment/create-checkout',
          {order_id: order.id},
        );
        if (payment.checkout_url) {
          await Linking.openURL(payment.checkout_url);
        }
      } catch {
        // Ödeme sistemi yapılandırılmamış olabilir — siparişi yine göster
      }

      Alert.alert(
        t('packageDetail.orderCreated'),
        t('packageDetail.orderCreatedMsg', {orderId: order.id.slice(0, 8).toUpperCase(), price: pkg.price.toFixed(0)}),
        [{text: t('packageDetail.viewOrder'), onPress: () => navigation.replace('OrderDetail', {orderId: order.id})}],
      );
    } catch (err: any) {
      const msg = err?.response?.data?.message || t('packageDetail.orderFailed');
      Alert.alert(t('common.error'), msg);
    } finally {
      setPurchasing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!pkg) {
    return (
      <View style={styles.container}>
        <View style={[styles.headerBar, {paddingTop: insets.top + 8}]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}>
            <Text style={styles.backIcon}>{'\u2190'}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('packageDetail.title')}</Text>
          <View style={{width: 40}} />
        </View>
        <View style={styles.loadingContainer}>
          <Text style={{fontSize: 48, marginBottom: 16}}>📦</Text>
          <Text style={styles.errorText}>{t('packageDetail.notFound')}</Text>
          <TouchableOpacity
            style={{marginTop: 20, backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12}}
            onPress={() => navigation.goBack()}>
            <Text style={{color: '#FFFFFF', fontWeight: '700', fontSize: 14}}>{t('common.goBack')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pct = discountPercent(pkg.price, pkg.original_value);
  const categoryImage = getDetailImage(pkg.title, pkg.category);

  return (
    <View style={styles.container}>
      {/* Header with safe area */}
      <View style={[styles.headerBar, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('packageDetail.title')}</Text>
        <View style={{width: 40}} />
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* Hero image */}
        <View style={styles.hero}>
          <Image
            source={{uri: categoryImage}}
            style={styles.heroImage}
            resizeMode="cover"
          />
          {pct > 0 && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{t('packageDetail.discount', {percent: pct})}</Text>
            </View>
          )}
        </View>

        {/* Title & store */}
        <View style={styles.infoSection}>
          <Text style={styles.title}>{pkg.title}</Text>
          {storeName && <Text style={styles.storeName}>{storeName}</Text>}
          {storeAddress && <Text style={styles.address}>{storeAddress}</Text>}
        </View>

        {/* Description */}
        {pkg.description && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('packageDetail.description')}</Text>
            <Text style={styles.description}>{pkg.description}</Text>
          </View>
        )}

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('packageDetail.details')}</Text>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('packageDetail.priceLabel')}</Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{pkg.price.toFixed(0)} TL</Text>
              <Text style={styles.originalPrice}>{pkg.original_value.toFixed(0)} TL</Text>
            </View>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('packageDetail.pickupTime')}</Text>
            <Text style={styles.detailValue}>
              {formatTime(pkg.pickup_start)} - {formatTime(pkg.pickup_end)}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('packageDetail.remaining')}</Text>
            <Text style={styles.detailValue}>{pkg.remaining} / {pkg.total_quantity}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>{t('packageDetail.status')}</Text>
            <Text style={[
              styles.detailValue,
              pkg.status === 'active' ? styles.statusActive : styles.statusInactive,
            ]}>
              {pkg.status === 'active' ? t('packageDetail.statusActive') : pkg.status === 'sold_out' ? t('packageDetail.statusSoldOut') : t('packageDetail.statusExpired')}
            </Text>
          </View>
        </View>

        {/* Delivery type picker */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('packageDetail.deliveryMethod')}</Text>
          <View style={styles.deliveryOptions}>
            <TouchableOpacity
              style={[
                styles.deliveryOption,
                deliveryType === 'pickup' && styles.deliveryOptionActive,
              ]}
              onPress={() => setDeliveryType('pickup')}>
              <Text style={styles.deliveryEmoji}>{'\uD83D\uDEB6'}</Text>
              <Text style={[
                styles.deliveryLabel,
                deliveryType === 'pickup' && styles.deliveryLabelActive,
              ]}>
                {t('packageDetail.pickup')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deliveryOption,
                deliveryType === 'delivery' && styles.deliveryOptionActive,
              ]}
              onPress={() => setDeliveryType('delivery')}>
              <Text style={styles.deliveryEmoji}>{'\uD83D\uDE97'}</Text>
              <Text style={[
                styles.deliveryLabel,
                deliveryType === 'delivery' && styles.deliveryLabelActive,
              ]}>
                {t('packageDetail.deliveryToAddress')}
              </Text>
            </TouchableOpacity>
          </View>

          {deliveryType === 'delivery' && (
            <TextInput
              style={styles.addressInput}
              placeholder={t('packageDetail.deliveryAddressPlaceholder')}
              placeholderTextColor={colors.textLight}
              value={deliveryAddress}
              onChangeText={setDeliveryAddress}
              multiline
              numberOfLines={2}
            />
          )}
        </View>
      </ScrollView>

      {/* Purchase button */}
      {pkg.status === 'active' && pkg.remaining > 0 && (
        <View style={styles.bottomBar}>
          <View style={styles.bottomPrice}>
            <Text style={styles.bottomPriceLabel}>{t('packageDetail.total')}</Text>
            <Text style={styles.bottomPriceValue}>{pkg.price.toFixed(0)} TL</Text>
          </View>
          <TouchableOpacity
            style={[styles.purchaseButton, purchasing && styles.purchaseButtonDisabled]}
            onPress={handlePurchase}
            disabled={purchasing}>
            <Text style={styles.purchaseText}>
              {purchasing ? t('packageDetail.purchasing') : t('packageDetail.purchase')}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: colors.primary,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backIcon: {fontSize: 22, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF'},
  scroll: {paddingBottom: 100},
  hero: {
    height: 200,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  heroImage: {width: '100%', height: '100%'},
  discountBadge: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    marginTop: spacing.md,
  },
  discountText: {...typography.bodyBold, color: colors.textWhite},
  infoSection: {
    padding: spacing.xl,
    backgroundColor: colors.backgroundWhite,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {...typography.h2, color: colors.textPrimary},
  storeName: {...typography.captionBold, color: colors.primary, marginTop: spacing.xs},
  address: {...typography.caption, color: colors.textSecondary, marginTop: 2},
  section: {
    padding: spacing.xl,
    backgroundColor: colors.backgroundWhite,
    marginTop: spacing.sm,
  },
  sectionTitle: {...typography.captionBold, color: colors.textSecondary, marginBottom: spacing.md},
  description: {...typography.body, color: colors.textPrimary, lineHeight: 24},
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
  priceRow: {flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm},
  price: {...typography.price, color: colors.primary},
  originalPrice: {
    ...typography.caption,
    color: colors.textLight,
    textDecorationLine: 'line-through',
  },
  statusActive: {color: colors.success},
  statusInactive: {color: colors.error},
  deliveryOptions: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  deliveryOption: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.backgroundWhite,
  },
  deliveryOptionActive: {
    borderColor: colors.primary,
    backgroundColor: '#E8F5E9',
  },
  deliveryEmoji: {fontSize: 24, marginBottom: spacing.xs},
  deliveryLabel: {...typography.captionBold, color: colors.textSecondary},
  deliveryLabelActive: {color: colors.primary},
  addressInput: {
    backgroundColor: colors.backgroundWhite,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.lg,
    fontSize: 16,
    color: colors.textPrimary,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundWhite,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  bottomPrice: {flex: 1},
  bottomPriceLabel: {...typography.small, color: colors.textSecondary},
  bottomPriceValue: {...typography.h2, color: colors.primary},
  purchaseButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
  },
  purchaseButtonDisabled: {opacity: 0.6},
  purchaseText: {...typography.button, color: colors.textWhite},
});
