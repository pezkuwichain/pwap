import React, {useState, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  StatusBar,
  LayoutChangeEvent,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {colors} from '../theme';

export type SortOption = 'recommended' | 'distance' | 'price' | 'rating';

export interface FilterState {
  sort: SortOption;
  hasDelivery: boolean;
  lastFew: boolean;
  discounted: boolean;
  payment: string;
  priceRange: [number, number];
}

const DEFAULT_FILTER: FilterState = {
  sort: 'recommended',
  hasDelivery: false,
  lastFew: false,
  discounted: false,
  payment: 'all',
  priceRange: [0, 500],
};

export type FilterSection = 'sort' | 'quickFilters' | 'price';

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filter: FilterState) => void;
  initialFilter?: FilterState;
  initialSection?: FilterSection;
}

const SORT_OPTIONS: {key: SortOption; label: string}[] = [
  {key: 'recommended', label: 'Önerilen (Varsayılan)'},
  {key: 'distance', label: 'Mesafe'},
  {key: 'price', label: 'Fiyat'},
  {key: 'rating', label: 'Puan'},
];

const PRICE_RANGES: {label: string; range: [number, number]}[] = [
  {label: 'Tümü', range: [0, 500]},
  {label: '0 - 50 TL', range: [0, 50]},
  {label: '50 - 100 TL', range: [50, 100]},
  {label: '100 - 200 TL', range: [100, 200]},
  {label: '200+ TL', range: [200, 500]},
];

function RadioButton({selected}: {selected: boolean}) {
  return (
    <View style={[radioStyles.outer, selected && radioStyles.outerSelected]}>
      {selected && <View style={radioStyles.inner} />}
    </View>
  );
}

const radioStyles = StyleSheet.create({
  outer: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outerSelected: {
    borderColor: colors.primary,
  },
  inner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
});

function Checkbox({checked}: {checked: boolean}) {
  return (
    <View style={[checkStyles.box, checked && checkStyles.boxChecked]}>
      {checked && <Text style={checkStyles.check}>✓</Text>}
    </View>
  );
}

const checkStyles = StyleSheet.create({
  box: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default function FilterModal({
  visible,
  onClose,
  onApply,
  initialFilter,
  initialSection,
}: FilterModalProps) {
  const [filter, setFilter] = useState<FilterState>(initialFilter || DEFAULT_FILTER);
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const sectionPositions = useRef<Record<string, number>>({});

  // Sync filter state when modal opens with new initialFilter
  React.useEffect(() => {
    if (visible) {
      setFilter(initialFilter || DEFAULT_FILTER);
    }
  }, [visible, initialFilter]);

  // Scroll to initialSection when modal opens
  React.useEffect(() => {
    if (visible && initialSection && scrollRef.current) {
      const timeout = setTimeout(() => {
        const y = sectionPositions.current[initialSection];
        if (y != null) {
          scrollRef.current?.scrollTo({y, animated: true});
        }
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [visible, initialSection]);

  const handleSectionLayout = useCallback((section: string) => (e: LayoutChangeEvent) => {
    sectionPositions.current[section] = e.nativeEvent.layout.y;
  }, []);

  const handleReset = () => {
    setFilter(DEFAULT_FILTER);
  };

  const handleApply = () => {
    onApply(filter);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, {paddingTop: insets.top}]}>
        <StatusBar barStyle="dark-content" />

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeIcon}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filtre</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetText}>Sıfırla</Text>
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Sıralama */}
          <View onLayout={handleSectionLayout('sort')}>
            <Text style={styles.sectionTitle}>Sıralama</Text>
          </View>
          {SORT_OPTIONS.map(opt => (
            <TouchableOpacity
              key={opt.key}
              style={styles.optionRow}
              onPress={() => setFilter(f => ({...f, sort: opt.key}))}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <RadioButton selected={filter.sort === opt.key} />
            </TouchableOpacity>
          ))}

          <View style={styles.divider} />

          {/* Hızlı filtreler */}
          <View onLayout={handleSectionLayout('quickFilters')}>
            <Text style={styles.sectionTitle}>Hızlı filtreler</Text>
          </View>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setFilter(f => ({...f, hasDelivery: !f.hasDelivery}))}>
            <Text style={styles.optionLabel}>Teslimat var</Text>
            <Checkbox checked={filter.hasDelivery} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setFilter(f => ({...f, lastFew: !f.lastFew}))}>
            <Text style={styles.optionLabel}>Son birkaç kaldı</Text>
            <Checkbox checked={filter.lastFew} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.optionRow}
            onPress={() => setFilter(f => ({...f, discounted: !f.discounted}))}>
            <Text style={styles.optionLabel}>İndirimli</Text>
            <Checkbox checked={filter.discounted} />
          </TouchableOpacity>

          <View style={styles.divider} />

          {/* Fiyat Aralığı */}
          <View onLayout={handleSectionLayout('price')}>
            <Text style={styles.sectionTitle}>Ortalama Fiyat Aralığı</Text>
          </View>
          {PRICE_RANGES.map((opt, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.optionRow}
              onPress={() => setFilter(f => ({...f, priceRange: opt.range}))}>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <RadioButton
                selected={
                  filter.priceRange[0] === opt.range[0] &&
                  filter.priceRange[1] === opt.range[1]
                }
              />
            </TouchableOpacity>
          ))}

          <View style={{height: 100}} />
        </ScrollView>

        {/* Apply Button */}
        <View style={[styles.footer, {paddingBottom: insets.bottom + 16}]}>
          <TouchableOpacity style={styles.applyBtn} onPress={handleApply}>
            <Text style={styles.applyText}>Uygula</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeIcon: {
    fontSize: 18,
    color: '#1A1A1A',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  resetText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginTop: 24,
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  optionLabel: {
    fontSize: 15,
    color: '#374151',
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginTop: 8,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  applyBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
