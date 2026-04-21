import React from 'react';
import {TouchableOpacity, View, Text, Image, StyleSheet} from 'react-native';
import {colors} from '../theme';
import type {PackageNearby, StoreType} from '../types/models';

interface PackageCardProps {
  item: PackageNearby;
  onPress: () => void;
}

const BASE_URL = 'https://bereketli.pezkiwi.app';

// Real category images from production
const CATEGORY_IMAGES: Record<StoreType, string> = {
  bakery: `${BASE_URL}/package-bakery.png`,
  restaurant: `${BASE_URL}/package-restaurant.png`,
  pastry: `${BASE_URL}/package-pastry.png`,
  market: `${BASE_URL}/package-market.png`,
  catering: `${BASE_URL}/package-restaurant.png`,
  other: `${BASE_URL}/bereketli_paket.png`,
};

// Smart image selection based on package title keywords
function getPackageImage(title: string, category: StoreType, storePhotos: string[]): string {
  if (storePhotos && storePhotos.length > 0) {
    return storePhotos[0].startsWith('http') ? storePhotos[0] : `${BASE_URL}${storePhotos[0]}`;
  }
  const lower = title.toLowerCase();
  if (lower.includes('et ') || lower.includes('kıyma') || lower.includes('sucuk') || lower.includes('kasap')) return `${BASE_URL}/pkg-meat.jpg`;
  if (lower.includes('mangal') || lower.includes('barbekü') || lower.includes('izgara')) return `${BASE_URL}/pkg-mangal.jpg`;
  if (lower.includes('sebze') || lower.includes('manav')) return `${BASE_URL}/pkg-vegetable.jpg`;
  if (lower.includes('meyve')) return `${BASE_URL}/pkg-fruit.jpg`;
  return CATEGORY_IMAGES[category] || CATEGORY_IMAGES.other;
}

const CATEGORY_LABELS: Record<StoreType, string> = {
  bakery: 'Fırın',
  restaurant: 'Restoran',
  pastry: 'Pastane',
  market: 'Market',
  catering: 'Catering',
  other: 'Diğer',
};

function formatPrice(price: number): string {
  return `${price.toFixed(0)} TL`;
}

function discountPercent(price: number, original: number): number {
  if (original <= 0) return 0;
  return Math.round(((original - price) / original) * 100);
}

function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m)}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

function formatPickupTime(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const sh = s.getHours().toString().padStart(2, '0');
    const sm = s.getMinutes().toString().padStart(2, '0');
    const eh = e.getHours().toString().padStart(2, '0');
    const em = e.getMinutes().toString().padStart(2, '0');
    return `${sh}:${sm} - ${eh}:${em}`;
  } catch {
    return '';
  }
}

export default function PackageCard({item, onPress}: PackageCardProps) {
  const pct = discountPercent(item.price, item.original_value);
  const catLabel = CATEGORY_LABELS[item.category] || 'Diğer';
  const pickupTime = formatPickupTime(item.pickup_start, item.pickup_end);

  const photoUri = getPackageImage(item.title, item.category, item.store_photos);

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      {/* ── Image Area (Yemeksepeti style) ── */}
      <View style={styles.imageContainer}>
        <Image
          source={{uri: photoUri}}
          style={styles.image}
          resizeMode="cover"
        />

        {/* Heart / Favorite — top right (like Yemeksepeti) */}
        <TouchableOpacity style={styles.heartBtn} activeOpacity={0.7}>
          <Text style={styles.heartIcon}>♡</Text>
        </TouchableOpacity>

        {/* "Öne Çıkan" style badge — bottom right */}
        {item.remaining <= 3 && (
          <View style={styles.featuredBadge}>
            <Text style={styles.featuredText}>Son {item.remaining}!</Text>
          </View>
        )}

        {/* Discount badge — top left */}
        {pct > 0 && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>%{pct}</Text>
          </View>
        )}
      </View>

      {/* ── Info Area (Yemeksepeti style) ── */}
      <View style={styles.info}>
        {/* Store name + Rating — same row */}
        <View style={styles.nameRow}>
          <Text style={styles.storeName} numberOfLines={1}>{item.store_name}</Text>
          {item.store_rating > 0 && (
            <View style={styles.ratingContainer}>
              <Text style={styles.ratingStar}>★</Text>
              <Text style={styles.ratingValue}>{item.store_rating.toFixed(1)}</Text>
            </View>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>

        {/* Meta line (YS style: "446m · 19:00-20:30 · Fırın") */}
        <Text style={styles.metaLine} numberOfLines={1}>
          {[
            item.distance_m > 0 ? formatDistance(item.distance_m) : null,
            pickupTime || null,
            catLabel,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>

        {/* Delivery badge (YS style "🛵 Ücretsiz" or "Gel Al") */}
        <View style={styles.deliveryRow}>
          <View style={[styles.deliveryBadge, {backgroundColor: item.delivery_available ? '#EFF6FF' : '#F0FDF4'}]}>
            <Text style={[styles.deliveryBadgeText, {color: item.delivery_available ? '#2563EB' : '#16A34A'}]}>
              {item.delivery_available ? '🛵 Teslimat' : '🏪 Gel Al'}
            </Text>
          </View>
          {item.remaining <= 5 && item.remaining > 0 && (
            <Text style={styles.urgencyText}>Son {item.remaining} paket!</Text>
          )}
        </View>

        {/* Price row */}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatPrice(item.price)}</Text>
          <Text style={styles.originalPrice}>{formatPrice(item.original_value)}</Text>
          {item.remaining > 3 && (
            <Text style={styles.remainingText}>{item.remaining} kaldı</Text>
          )}
        </View>

        {/* Green promo strip (like Yemeksepeti "350₺'ye 250₺ indirim") */}
        {pct > 0 && (
          <View style={styles.promoStrip}>
            <Text style={styles.promoText}>
              🏷️ {formatPrice(item.original_value)} değerinde, sadece {formatPrice(item.price)}!
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  // ── Image ──
  imageContainer: {
    height: 180,
    position: 'relative',
    backgroundColor: '#F3F4F6',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  // placeholder styles removed — always using real images now

  // Heart button — top right (Yemeksepeti style)
  heartBtn: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  heartIcon: {
    fontSize: 18,
    color: '#9CA3AF',
  },

  // Featured badge — bottom right ("Öne Çıkan" style)
  featuredBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featuredText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // Discount badge — top left
  discountBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#EF4444',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discountText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ── Info Section ──
  info: {
    padding: 12,
  },

  // Store name + rating row
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  storeName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  ratingStar: {
    fontSize: 13,
    color: '#F59E0B',
  },
  ratingValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A1A1A',
  },

  // Title
  title: {
    fontSize: 13,
    fontWeight: '400',
    color: '#6B7280',
    marginBottom: 4,
  },

  // Meta line ("25-50 dk · ₺₺ · Tost & Sandviç" style)
  metaLine: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 8,
  },

  // Delivery
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  deliveryBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  deliveryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#EF4444',
  },

  // Price row
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  originalPrice: {
    fontSize: 13,
    color: '#9CA3AF',
    textDecorationLine: 'line-through',
  },
  remainingText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 'auto',
  },

  // Green promo strip (Yemeksepeti style)
  promoStrip: {
    backgroundColor: '#D1FAE5',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
  },
  promoText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#059669',
  },
});
