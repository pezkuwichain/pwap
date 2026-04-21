import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useTranslation} from 'react-i18next';
import {colors} from '../../theme';
import * as faqApi from '../../api/faq';
import type {FaqItem} from '../../api/faq';

export default function FaqScreen({navigation}: any) {
  const {t} = useTranslation();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const insets = useSafeAreaInsets();

  useEffect(() => {
    faqApi.getFaqs().then(data => {
      setFaqs(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = ['all', ...new Set(faqs.map(f => f.category))];
  const filtered = activeCategory === 'all' ? faqs : faqs.filter(f => f.category === activeCategory);

  const CATEGORY_LABELS: Record<string, string> = {
    all: 'Tümü',
    genel: 'Genel',
    musteriler: 'Müşteriler',
    isletmeler: 'İşletmeler',
    odeme: 'Ödeme',
  };

  return (
    <View style={[styles.container, {paddingTop: insets.top}]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('faq.title')}</Text>
        <View style={{width: 40}} />
      </View>

      {/* Category tabs */}
      <FlatList
        horizontal
        data={categories}
        keyExtractor={item => item}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        renderItem={({item}) => (
          <TouchableOpacity
            style={[styles.categoryChip, activeCategory === item && styles.categoryChipActive]}
            onPress={() => setActiveCategory(item)}>
            <Text style={[styles.categoryChipText, activeCategory === item && styles.categoryChipTextActive]}>
              {CATEGORY_LABELS[item] || item}
            </Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator size="large" color={colors.primary} style={{marginTop: 40}} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          renderItem={({item}) => (
            <TouchableOpacity
              style={styles.faqItem}
              onPress={() => setExpandedId(expandedId === item.id ? null : item.id)}
              activeOpacity={0.7}>
              <View style={styles.faqQuestion}>
                <Text style={styles.faqQuestionText}>{item.question}</Text>
                <Text style={styles.faqArrow}>{expandedId === item.id ? '−' : '+'}</Text>
              </View>
              {expandedId === item.id && (
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              )}
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('faq.empty')}</Text>
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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  backBtn: {width: 40, height: 40, justifyContent: 'center', alignItems: 'center'},
  backIcon: {fontSize: 22, color: '#1A1A1A'},
  headerTitle: {fontSize: 17, fontWeight: '700', color: '#1A1A1A'},
  categoryList: {paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF'},
  categoryChip: {
    paddingHorizontal: 18, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB',
    minWidth: 70, alignItems: 'center' as const,
    marginRight: 8,
  },
  categoryChipActive: {backgroundColor: colors.primary, borderColor: colors.primary},
  categoryChipText: {fontSize: 14, fontWeight: '600', color: '#374151'},
  categoryChipTextActive: {color: '#FFFFFF'},
  list: {paddingHorizontal: 16, paddingTop: 12, paddingBottom: 100},
  faqItem: {
    backgroundColor: '#FFFFFF', borderRadius: 12,
    marginBottom: 8, overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {fontSize: 15, fontWeight: '600', color: '#1A1A1A', flex: 1, marginRight: 12},
  faqArrow: {fontSize: 20, fontWeight: '300', color: '#9CA3AF'},
  faqAnswer: {
    fontSize: 14, color: '#6B7280', lineHeight: 20,
    paddingHorizontal: 16, paddingBottom: 16,
  },
  empty: {alignItems: 'center', paddingTop: 40},
  emptyText: {fontSize: 14, color: '#9CA3AF'},
});
