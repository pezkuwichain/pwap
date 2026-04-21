import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Image,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors} from '../../theme';
import * as searchApi from '../../api/search';
import type {PackageNearby} from '../../types/models';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const BASE_URL = 'https://bereketli.pezkiwi.app';

const POPULAR_SEARCHES = [
  'Fırın', 'Pastane', 'Restoran', 'Market', 'Börek', 'Ekmek', 'Tatlı', 'Kahvaltı',
];

const POPULAR_CATEGORIES = [
  {label: 'Fırın', image: `${BASE_URL}/package-bakery.png`, category: 'bakery'},
  {label: 'Restoran', image: `${BASE_URL}/package-restaurant.png`, category: 'restaurant'},
  {label: 'Pastane', image: `${BASE_URL}/package-pastry.png`, category: 'pastry'},
  {label: 'Market', image: `${BASE_URL}/package-market.png`, category: 'market'},
];

export default function SearchScreen({navigation}: any) {
  const {t} = useTranslation();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PackageNearby[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setHasSearched(false);
      return;
    }
    setSearching(true);
    setHasSearched(true);
    try {
      const data = await searchApi.searchPackages(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => handleSearch(query), 400);
    return () => clearTimeout(timer);
  }, [query, handleSearch]);

  const handleCategoryPress = (_category: string) => {
    navigation.goBack();
    // TODO: Pass selected category back to parent for filtering
  };

  const handleResultPress = (item: PackageNearby) => {
    navigation.navigate('PackageDetail', {
      packageId: item.id,
      storeName: item.store_name,
      storeAddress: item.store_address,
    });
  };

  return (
    <View style={styles.container}>
      {/* Search header */}
      <View style={[styles.header, {paddingTop: insets.top + 8}]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="arrow-left" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.searchBar}>
          <Icon name="magnify" size={20} color="#9CA3AF" />
          <TextInput
            style={styles.searchInput}
            placeholder={t('search.placeholder')}
            placeholderTextColor="#9CA3AF"
            value={query}
            onChangeText={setQuery}
            autoFocus
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Icon name="close" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {!hasSearched ? (
        <FlatList
          ListHeaderComponent={
            <>
              {/* Popular categories (YS style — photo cards) */}
              <Text style={styles.sectionTitle}>{t('search.popularCategories')}</Text>
              <FlatList
                horizontal
                showsHorizontalScrollIndicator={false}
                data={POPULAR_CATEGORIES}
                keyExtractor={item => item.category}
                contentContainerStyle={styles.categoriesList}
                renderItem={({item}) => (
                  <TouchableOpacity
                    style={styles.categoryCard}
                    onPress={() => handleCategoryPress(item.category)}
                    activeOpacity={0.8}>
                    <Image source={{uri: item.image}} style={styles.categoryImage} resizeMode="cover" />
                    <Text style={styles.categoryLabel}>{item.label}</Text>
                  </TouchableOpacity>
                )}
              />

              {/* Popular searches (YS style — pill tags) */}
              <Text style={styles.sectionTitle}>{t('search.popularSearches')}</Text>
              <View style={styles.tagsContainer}>
                {POPULAR_SEARCHES.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={styles.tag}
                    onPress={() => setQuery(tag)}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          }
          data={[]}
          renderItem={() => null}
        />
      ) : searching ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={results}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
          ListHeaderComponent={
            <Text style={styles.resultCount}>
              {results.length > 0 ? t('search.resultCount', {count: results.length}) : ''}
            </Text>
          }
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.resultCard}
              onPress={() => handleResultPress(item)}
              activeOpacity={0.8}>
              <Image
                source={{uri: `${BASE_URL}/package-${item.category || 'bakery'}.png`}}
                style={styles.resultImage}
                resizeMode="cover"
              />
              <View style={styles.resultInfo}>
                <Text style={styles.resultStore} numberOfLines={1}>{item.store_name}</Text>
                <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
                <View style={styles.resultPriceRow}>
                  <Text style={styles.resultPrice}>{item.price.toFixed(0)} TL</Text>
                  <Text style={styles.resultOriginal}>{item.original_value.toFixed(0)} TL</Text>
                </View>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.emptySearch}>
              <Icon name="magnify" size={48} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t('search.emptyTitle')}</Text>
              <Text style={styles.emptyText}>{t('search.emptyText')}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#F8F8F8'},

  header: {
    backgroundColor: colors.primary,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  backBtn: {padding: 4},
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    gap: 8,
  },
  searchInput: {flex: 1, fontSize: 14, color: '#1A1A1A', padding: 0},

  sectionTitle: {
    fontSize: 18, fontWeight: '700', color: '#1A1A1A',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12,
  },

  // Categories (YS style)
  categoriesList: {paddingHorizontal: 16, gap: 12},
  categoryCard: {
    width: 140, height: 120, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  categoryImage: {width: '100%', height: 80},
  categoryLabel: {
    fontSize: 14, fontWeight: '600', color: '#1A1A1A',
    textAlign: 'center', paddingVertical: 8,
  },

  // Tags (YS style pill chips)
  tagsContainer: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 16, gap: 8,
  },
  tag: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  tagText: {fontSize: 14, color: '#374151', fontWeight: '500'},

  // Results
  loadingContainer: {flex: 1, justifyContent: 'center', alignItems: 'center'},
  resultsList: {paddingHorizontal: 16, paddingTop: 8, paddingBottom: 100},
  resultCount: {fontSize: 13, color: '#9CA3AF', marginBottom: 12},
  resultCard: {
    flexDirection: 'row', backgroundColor: '#FFFFFF', borderRadius: 12,
    marginBottom: 10, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05, shadowRadius: 4, elevation: 2,
  },
  resultImage: {width: 100, height: 90},
  resultInfo: {flex: 1, padding: 12, justifyContent: 'center'},
  resultStore: {fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 2},
  resultTitle: {fontSize: 15, fontWeight: '700', color: '#1A1A1A', marginBottom: 6},
  resultPriceRow: {flexDirection: 'row', alignItems: 'baseline', gap: 6},
  resultPrice: {fontSize: 16, fontWeight: '800', color: colors.primary},
  resultOriginal: {fontSize: 12, color: '#9CA3AF', textDecorationLine: 'line-through'},

  // Empty
  emptySearch: {alignItems: 'center', paddingTop: 60},
  emptyTitle: {fontSize: 18, fontWeight: '700', color: '#1A1A1A', marginTop: 12},
  emptyText: {fontSize: 14, color: '#6B7280', marginTop: 4},
});
