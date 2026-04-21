import React, {useEffect, useState, useCallback, useRef} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Image,
  Linking,
  ActivityIndicator,
} from 'react-native';
import type {ViewToken} from 'react-native';
import {colors} from '../theme';
import {
  getAnnouncements,
  trackView,
  trackClick,
} from '../api/announcements';
import type {Announcement} from '../api/announcements';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32;
const CARD_HEIGHT = 130;

const TYPE_COLORS: Record<string, string> = {
  promo: '#2D6A4F',
  sponsor: '#E8A838',
  duyuru: '#2563EB',
  kampanya: '#DC2626',
};

function getBackgroundColor(type: string): string {
  return TYPE_COLORS[type] || colors.primary;
}

function AnnouncementCard({
  item,
  onVisible,
}: {
  item: Announcement;
  onVisible?: () => void;
}) {
  const hasImage = !!item.image_url;
  const [imgError, setImgError] = useState(false);
  const bgColor = getBackgroundColor(item.announcement_type);

  useEffect(() => {
    onVisible?.();
  }, [onVisible]);

  const handlePress = useCallback(() => {
    trackClick(item.id).catch(() => {});
    if (item.link_url) {
      Linking.openURL(item.link_url).catch(() => {});
    }
  }, [item.id, item.link_url]);

  const renderContent = () => (
    <View style={cardStyles.textContainer}>
      <Text style={cardStyles.title} numberOfLines={2}>
        {item.title}
      </Text>
      {item.content ? (
        <Text style={cardStyles.content} numberOfLines={1}>
          {item.content}
        </Text>
      ) : null}
      {item.link_label ? (
        <View style={cardStyles.linkRow}>
          <Text style={cardStyles.linkLabel}>{item.link_label} {'\u2192'}</Text>
        </View>
      ) : null}
    </View>
  );

  if (hasImage && !imgError) {
    return (
      <TouchableOpacity
        style={cardStyles.card}
        onPress={handlePress}
        activeOpacity={0.85}>
        <Image
          source={{uri: item.image_url!}}
          style={cardStyles.bgImage}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
        <View style={cardStyles.gradient} />
        {renderContent()}
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[cardStyles.card, {backgroundColor: bgColor}]}
      onPress={handlePress}
      activeOpacity={0.85}>
      {renderContent()}
    </TouchableOpacity>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  textContainer: {
    padding: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  content: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 16,
  },
  linkRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

const AUTO_SCROLL_INTERVAL = 4000; // 4 saniye

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewedIds = useRef<Set<string>>(new Set());
  const flatListRef = useRef<FlatList<Announcement>>(null);
  const autoScrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const userInteracted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAnnouncements()
      .then(data => {
        if (!cancelled) {
          setAnnouncements(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeIndexRef = useRef(0);
  activeIndexRef.current = activeIndex;

  // Auto-scroll
  useEffect(() => {
    if (announcements.length <= 1) return;

    autoScrollTimer.current = setInterval(() => {
      if (userInteracted.current) {
        userInteracted.current = false;
        return;
      }
      const nextIndex = (activeIndexRef.current + 1) % announcements.length;
      flatListRef.current?.scrollToOffset({
        offset: nextIndex * (CARD_WIDTH + 12),
        animated: true,
      });
    }, AUTO_SCROLL_INTERVAL);

    return () => {
      if (autoScrollTimer.current) {
        clearInterval(autoScrollTimer.current);
      }
    };
  }, [announcements.length]);

  const handleScrollBeginDrag = useCallback(() => {
    userInteracted.current = true;
  }, []);

  const handleViewableItemsChanged = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      if (viewableItems.length > 0) {
        const firstVisible = viewableItems[0];
        if (typeof firstVisible.index === 'number') {
          setActiveIndex(firstVisible.index);
        }
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const handleCardVisible = useCallback((id: string) => {
    if (!viewedIds.current.has(id)) {
      viewedIds.current.add(id);
      trackView(id).catch(() => {});
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || announcements.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={announcements}
        keyExtractor={item => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.listContent}
        onViewableItemsChanged={handleViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        onScrollBeginDrag={handleScrollBeginDrag}
        renderItem={({item}) => (
          <View style={styles.cardWrapper}>
            <AnnouncementCard
              item={item}
              onVisible={() => handleCardVisible(item.id)}
            />
          </View>
        )}
      />
      {announcements.length > 1 && (
        <View style={styles.dotsContainer}>
          {announcements.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.dot,
                index === activeIndex ? styles.dotActive : styles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  loaderContainer: {
    height: CARD_HEIGHT,
    marginTop: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
  },
  cardWrapper: {
    marginRight: 12,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginHorizontal: 3,
  },
  dotActive: {
    backgroundColor: colors.primary,
    width: 20,
    borderRadius: 4,
  },
  dotInactive: {
    backgroundColor: '#D1D5DB',
  },
});
