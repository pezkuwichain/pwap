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
  Linking,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import * as merchantsApi from '../../api/merchants';
import client from '../../api/client';
import type {Merchant, LoyaltyProgram, LoyaltyCard} from '../../types/models';
import type {MerchantProduct, MerchantPackage} from '../../api/merchants';

const BASE_URL = 'https://bereketli.pezkuwi.app';
const THEME = '#DC2626';

const CATEGORY_IMAGES: Record<string, string> = {
  barber: `${BASE_URL}/esnaf-barber.png`,
  cafe: `${BASE_URL}/esnaf-cafe.png`,
  butcher: `${BASE_URL}/esnaf-butcher.png`,
  greengrocer: `${BASE_URL}/esnaf-greengrocer.png`,
  tailor: `${BASE_URL}/esnaf-tailor.png`,
  bakery: `${BASE_URL}/package-bakery.png`,
  other: `${BASE_URL}/local-barber.png`,
};

const CATEGORY_LABELS: Record<string, string> = {
  barber: 'Berber', cafe: 'Kafe', butcher: 'Kasap',
  greengrocer: 'Manav', tailor: 'Terzi', bakery: 'Fırın',
  pharmacy: 'Eczane', other: 'Diğer',
};

// Which categories support appointments vs orders
const APPOINTMENT_CATEGORIES = ['barber', 'tailor'];

function discountPercent(price: number, original: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - price) / original) * 100);
}

export default function MerchantDetailScreen({route, navigation}: any) {
  const {t} = useTranslation();
  const {merchantId} = route.params;
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [myCards, setMyCards] = useState<LoyaltyCard[]>([]);
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [packages, setPackages] = useState<MerchantPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    Promise.all([
      merchantsApi.getMerchant(merchantId),
      merchantsApi.getMyCards().catch(() => []),
      merchantsApi.getMerchantProducts(merchantId),
      merchantsApi.getMerchantPackages(merchantId),
    ]).then(([data, cards, prods, pkgs]) => {
      setMerchant(data.merchant);
      setPrograms(data.programs);
      setMyCards(cards.filter((c: LoyaltyCard) => c.merchant_id === merchantId));
      setProducts(prods);
      setPackages(pkgs);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [merchantId]);

  const handleCall = () => {
    if (merchant?.phone) {
      Linking.openURL(`tel:${merchant.phone}`);
    } else {
      Alert.alert('Bilgi', 'Telefon numarası kayıtlı değil.');
    }
  };

  const handleBookAppointment = (service: MerchantProduct) => {
    // Simple appointment booking with date/time selection
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];

    Alert.alert(
      'Randevu Al',
      `${service.name} — ${service.price.toFixed(0)} TL\n\nYarın için uygun saatler:`,
      [
        {text: '09:00', onPress: () => confirmBooking(service, dateStr, '09:00')},
        {text: '10:00', onPress: () => confirmBooking(service, dateStr, '10:00')},
        {text: '11:00', onPress: () => confirmBooking(service, dateStr, '11:00')},
        {text: '14:00', onPress: () => confirmBooking(service, dateStr, '14:00')},
        {text: 'İptal', style: 'cancel'},
      ],
    );
  };

  const confirmBooking = async (service: MerchantProduct, date: string, time: string) => {
    try {
      await merchantsApi.bookAppointment(merchantId, service.name, date, time);
      Alert.alert('Randevu Oluşturuldu!', `${service.name}\n${date} saat ${time}\n\nEsnaf onayladığında bilgilendirileceksiniz.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Randevu oluşturulamadı.';
      Alert.alert('Hata', msg);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME} />
      </View>
    );
  }

  if (!merchant) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{fontSize: 16, color: '#9CA3AF'}}>{t('merchantDetail.notFound')}</Text>
      </View>
    );
  }

  const photoUri = merchant.photos && merchant.photos.length > 0
    ? (merchant.photos[0].startsWith('http') ? merchant.photos[0] : `${BASE_URL}${merchant.photos[0]}`)
    : CATEGORY_IMAGES[merchant.category] || CATEGORY_IMAGES.other;

  const isAppointmentBased = APPOINTMENT_CATEGORIES.includes(merchant.category);

  // Group products by category
  const productCategories = [...new Set(products.map(p => p.category || 'Diğer'))];

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{merchant.name}</Text>
        <TouchableOpacity onPress={handleCall}>
          <Text style={styles.callIcon}>📞</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Cover image */}
        <Image source={{uri: photoUri}} style={styles.coverImage} resizeMode="cover" />

        {/* Info */}
        <View style={styles.infoSection}>
          <View style={styles.nameRow}>
            <Text style={styles.merchantName}>{merchant.name}</Text>
            {merchant.rating > 0 && (
              <View style={styles.ratingBadge}>
                <Text style={styles.ratingText}>★ {merchant.rating.toFixed(1)}</Text>
                <Text style={styles.reviewCount}>({merchant.total_reviews})</Text>
              </View>
            )}
          </View>
          <Text style={styles.category}>
            {CATEGORY_LABELS[merchant.category]} · {merchant.address}
          </Text>
          {merchant.description && <Text style={styles.description}>{merchant.description}</Text>}
          {merchant.story && (
            <View style={styles.storyCard}>
              <Text style={styles.storyQuote}>"{merchant.story}"</Text>
            </View>
          )}
        </View>

        {/* ── Products/Services — REAL DATA ── */}
        {products.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {isAppointmentBased ? 'Hizmetler' : 'Ürünler'}
            </Text>
            {productCategories.map(cat => (
              <View key={cat}>
                {productCategories.length > 1 && (
                  <Text style={styles.productCategoryLabel}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </Text>
                )}
                {products.filter(p => (p.category || 'Diğer') === cat).map(product => (
                  <TouchableOpacity
                    key={product.id}
                    style={styles.productRow}
                    onPress={() => {
                      if (isAppointmentBased) {
                        handleBookAppointment(product);
                      } else {
                        Alert.alert(
                          product.name,
                          `${product.description || ''}\n\nFiyat: ${product.price.toFixed(0)} TL / ${product.unit}`,
                          [
                            {text: 'Kapat'},
                            ...(merchant?.phone ? [{text: '📞 Ara ve Sipariş Ver', onPress: handleCall}] : []),
                          ],
                        );
                      }
                    }}
                    activeOpacity={0.7}>
                    <View style={styles.productInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      {product.description && (
                        <Text style={styles.productDesc} numberOfLines={1}>{product.description}</Text>
                      )}
                    </View>
                    <View style={styles.productPriceCol}>
                      <Text style={styles.productPrice}>{product.price.toFixed(0)} TL</Text>
                      <Text style={styles.productUnit}>/ {product.unit}</Text>
                    </View>
                    {isAppointmentBased && (
                      <Text style={styles.bookIcon}>📅</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
        )}

        {/* ── Surprise Packages — REAL DATA ── */}
        {packages.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sürpriz Paketler</Text>
            {packages.map(pkg => {
              const pct = discountPercent(pkg.price, pkg.original_value);
              const handleBuyPackage = async () => {
                try {
                  const order = await merchantsApi.orderMerchantPackage(merchantId, pkg.id);
                  // Try Stripe payment
                  try {
                    const {data: payment} = await client.post<{checkout_url: string}>('/payment/create-checkout', {order_id: order.id});
                    if (payment.checkout_url) await Linking.openURL(payment.checkout_url);
                  } catch {}
                  Alert.alert('Sipariş Oluşturuldu!', `${pkg.title}\nToplam: ${pkg.price.toFixed(0)} TL`);
                } catch (err: any) {
                  Alert.alert('Hata', err?.response?.data?.message || 'Sipariş oluşturulamadı');
                }
              };
              return (
                <View key={pkg.id} style={styles.packageCard}>
                  <View style={styles.packageHeader}>
                    <Text style={styles.packageTitle}>{pkg.title}</Text>
                    {pct > 0 && (
                      <View style={styles.packageDiscount}>
                        <Text style={styles.packageDiscountText}>%{pct}</Text>
                      </View>
                    )}
                  </View>
                  {pkg.description && (
                    <Text style={styles.packageDesc}>{pkg.description}</Text>
                  )}
                  <View style={styles.packageFooter}>
                    <View style={styles.packagePriceRow}>
                      <Text style={styles.packagePrice}>{pkg.price.toFixed(0)} TL</Text>
                      <Text style={styles.packageOriginal}>{pkg.original_value.toFixed(0)} TL</Text>
                    </View>
                    <TouchableOpacity style={styles.buyBtn} onPress={handleBuyPackage} activeOpacity={0.7}>
                      <Text style={styles.buyBtnText}>Satın Al</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* ── Loyalty Programs ── */}
        {programs.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sadakat Programı</Text>
            {programs.map(prog => {
              const myCard = myCards.find(c => c.program_id === prog.id);
              return (
                <View key={prog.id} style={styles.loyaltyCard}>
                  <Text style={styles.loyaltyName}>{prog.name}</Text>
                  <Text style={styles.loyaltyReward}>🎁 {prog.reward_description}</Text>
                  {myCard ? (
                    <View style={styles.progressBar}>
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, {
                          width: `${Math.min(100, (
                            prog.program_type === 'stamp' ? (myCard.current_stamps / (prog.stamps_required || 10)) :
                            prog.program_type === 'points' ? (myCard.current_points / (prog.points_required || 100)) :
                            (myCard.visit_count / (prog.frequency_required || 10))
                          ) * 100)}%`,
                        }]} />
                      </View>
                      <Text style={styles.progressText}>
                        {prog.program_type === 'stamp' ? `${myCard.current_stamps}/${prog.stamps_required}` :
                         prog.program_type === 'points' ? `${myCard.current_points}/${prog.points_required}` :
                         `${myCard.visit_count}/${prog.frequency_required}`}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.loyaltyJoin}>İlk ziyaretinde otomatik katılırsın</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ── Contact ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>İletişim</Text>
          <View style={styles.contactCard}>
            <Text style={styles.contactItem}>📍 {merchant.address}</Text>
            {merchant.phone && (
              <TouchableOpacity onPress={handleCall}>
                <Text style={styles.contactItemLink}>📞 {merchant.phone} — Ara</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F8F8'},

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: THEME,
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backIcon: {fontSize: 22, color: '#FFFFFF'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#FFFFFF', flex: 1, textAlign: 'center'},
  callIcon: {fontSize: 20, padding: 8},

  scroll: {paddingBottom: 100},
  coverImage: {width: '100%', height: 180},

  infoSection: {padding: 16},
  nameRow: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4},
  merchantName: {fontSize: 22, fontWeight: '700', color: '#1A1A1A', flex: 1},
  ratingBadge: {flexDirection: 'row', alignItems: 'center', gap: 4},
  ratingText: {fontSize: 15, fontWeight: '700', color: '#F59E0B'},
  reviewCount: {fontSize: 13, color: '#9CA3AF'},
  category: {fontSize: 14, color: '#6B7280', marginBottom: 12},
  description: {fontSize: 15, color: '#374151', lineHeight: 22, marginBottom: 12},
  storyCard: {
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 16,
    borderLeftWidth: 4, borderLeftColor: '#F59E0B',
  },
  storyQuote: {fontSize: 14, color: '#92400E', fontStyle: 'italic', lineHeight: 20},

  // Section
  section: {paddingHorizontal: 16, marginBottom: 20},
  sectionTitle: {fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginBottom: 12},

  // Products
  productCategoryLabel: {
    fontSize: 13, fontWeight: '700', color: '#6B7280',
    textTransform: 'uppercase', marginTop: 12, marginBottom: 8, letterSpacing: 1,
  },
  productRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#FFFFFF', borderRadius: 10, padding: 14,
    marginBottom: 6, gap: 12,
  },
  productInfo: {flex: 1},
  productName: {fontSize: 15, fontWeight: '600', color: '#1A1A1A'},
  productDesc: {fontSize: 12, color: '#9CA3AF', marginTop: 2},
  productPriceCol: {alignItems: 'flex-end'},
  productPrice: {fontSize: 16, fontWeight: '700', color: THEME},
  productUnit: {fontSize: 11, color: '#9CA3AF'},
  bookIcon: {fontSize: 18},

  // Packages
  packageCard: {
    backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 10,
    borderLeftWidth: 4, borderLeftColor: '#10B981',
  },
  packageHeader: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6},
  packageTitle: {fontSize: 16, fontWeight: '700', color: '#1A1A1A', flex: 1},
  packageDiscount: {backgroundColor: '#EF4444', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2},
  packageDiscountText: {fontSize: 12, fontWeight: '800', color: '#FFFFFF'},
  packageDesc: {fontSize: 13, color: '#6B7280', lineHeight: 18, marginBottom: 10},
  packageFooter: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'},
  packagePriceRow: {flexDirection: 'row', alignItems: 'baseline', gap: 8},
  packagePrice: {fontSize: 20, fontWeight: '800', color: '#10B981'},
  packageOriginal: {fontSize: 14, color: '#9CA3AF', textDecorationLine: 'line-through'},
  buyBtn: {
    backgroundColor: '#10B981', borderRadius: 10,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  buyBtnText: {fontSize: 14, fontWeight: '700', color: '#FFFFFF'},

  // Loyalty
  loyaltyCard: {backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginBottom: 8},
  loyaltyName: {fontSize: 16, fontWeight: '600', color: '#1A1A1A', marginBottom: 4},
  loyaltyReward: {fontSize: 14, color: '#059669', marginBottom: 12},
  progressBar: {flexDirection: 'row', alignItems: 'center', gap: 10},
  progressTrack: {flex: 1, height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden'},
  progressFill: {height: '100%', backgroundColor: THEME, borderRadius: 4},
  progressText: {fontSize: 13, fontWeight: '600', color: '#374151'},
  loyaltyJoin: {fontSize: 13, color: '#9CA3AF', fontStyle: 'italic'},

  // Contact
  contactCard: {backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, gap: 10},
  contactItem: {fontSize: 14, color: '#374151'},
  contactItemLink: {fontSize: 14, color: THEME, fontWeight: '600'},
});
