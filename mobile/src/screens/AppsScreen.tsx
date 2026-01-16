import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { KurdistanColors } from '../theme/colors';

type CategoryType = 'All' | 'Finance' | 'Governance' | 'Social' | 'Education' | 'Health' | 'Entertainment' | 'Tools' | 'Gaming';

interface MiniApp {
  id: string;
  name: string;
  icon: string;
  developer: string;
  category: Exclude<CategoryType, 'All'>;
  description: string;
  status: 'live' | 'coming_soon';
}

const FEATURED_APPS: MiniApp[] = [
  {
    id: 'pezkuwi-b2b-ai',
    name: 'PezkuwiB2B AI',
    icon: '🤖',
    developer: 'Dijital Kurdistan Tech Inst',
    category: 'Finance',
    description: 'B2B marketplace specialized AI',
    status: 'coming_soon',
  },
  {
    id: 'kurd-health',
    name: 'KurdHealth',
    icon: '🏥',
    developer: 'Health Ministry',
    category: 'Health',
    description: 'Digital health records & telemedicine',
    status: 'coming_soon',
  },
  {
    id: 'kurd-games',
    name: 'KurdGames',
    icon: '🎮',
    developer: 'Dijital Kurdistan Tech Inst',
    category: 'Gaming',
    description: 'Play-to-earn Kurdish games',
    status: 'coming_soon',
  },
];

const CATEGORIES: { name: CategoryType; icon: string }[] = [
  { name: 'All', icon: '📱' },
  { name: 'Finance', icon: '💰' },
  { name: 'Governance', icon: '🏛️' },
  { name: 'Social', icon: '💬' },
  { name: 'Education', icon: '📚' },
  { name: 'Health', icon: '🏥' },
  { name: 'Entertainment', icon: '🎬' },
  { name: 'Tools', icon: '🛠️' },
  { name: 'Gaming', icon: '🎮' },
];

const AppsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('All');
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [appName, setAppName] = useState('');
  const [appDescription, setAppDescription] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactName, setContactName] = useState('');

  const filteredApps = FEATURED_APPS.filter(app => {
    const matchesSearch = app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         app.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || app.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleConnectWallet = () => {
    navigation.navigate('Wallet');
  };

  const handleSubmitApp = () => {
    if (!appName.trim() || !appDescription.trim() || !contactEmail.trim() || !contactName.trim()) {
      Alert.alert('Missing Information', 'Please fill in all fields to submit your mini app.');
      return;
    }

    setShowSubmitModal(false);
    setAppName('');
    setAppDescription('');
    setContactEmail('');
    setContactName('');

    Alert.alert(
      'Application Submitted ✅',
      'Dijital Kurdistan Tech Inst officials will contact you as soon as possible.\n\nSpas bo xebata te!',
      [{ text: 'Temam' }]
    );
  };

  const renderMiniAppCard = (app: MiniApp) => (
    <TouchableOpacity
      key={app.id}
      style={styles.miniAppCard}
      activeOpacity={0.7}
      onPress={() => Alert.alert(app.name, `${app.description}\n\nby ${app.developer}\n\nStatus: Coming Soon`)}
    >
      <View style={styles.miniAppIconContainer}>
        <Text style={styles.miniAppIcon}>{app.icon}</Text>
      </View>
      <View style={styles.miniAppInfo}>
        <View style={styles.miniAppHeader}>
          <Text style={styles.miniAppName}>{app.name}</Text>
          {app.status === 'coming_soon' && (
            <View style={styles.comingSoonBadge}>
              <Text style={styles.comingSoonText}>Coming Soon</Text>
            </View>
          )}
        </View>
        <Text style={styles.miniAppDescription}>{app.description}</Text>
        <Text style={styles.miniAppDeveloper}>by {app.developer}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.headerTitle}>MiniApps Store</Text>
              <Text style={styles.headerSubtitle}>Discover & Build on Pezkuwichain</Text>
            </View>
            <TouchableOpacity style={styles.connectButton} onPress={handleConnectWallet}>
              <Text style={styles.connectButtonText}>Connect</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Search mini apps..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholderTextColor="#999"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Categories - Horizontal Scroll */}
        <View style={styles.categoriesContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoriesContent}
          >
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.name}
                style={[
                  styles.categoryChip,
                  selectedCategory === cat.name && styles.categoryChipActive
                ]}
                onPress={() => setSelectedCategory(cat.name)}
              >
                <Text style={styles.categoryEmoji}>{cat.icon}</Text>
                <Text style={[
                  styles.categoryText,
                  selectedCategory === cat.name && styles.categoryTextActive
                ]}>
                  {cat.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Build on Pezkuwichain Section */}
        <View style={styles.buildSection}>
          <View style={styles.buildContent}>
            <View style={styles.buildTextContainer}>
              <Text style={styles.buildTitle}>Build on Pezkuwichain</Text>
              <Text style={styles.buildSubtitle}>Submit your mini app to the ecosystem</Text>
            </View>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowSubmitModal(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.addButtonText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Featured Apps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {selectedCategory === 'All' ? 'Featured Mini Apps' : `${selectedCategory} Apps`}
          </Text>
          {filteredApps.length > 0 ? (
            filteredApps.map(renderMiniAppCard)
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🔍</Text>
              <Text style={styles.emptyText}>No apps found in this category yet</Text>
              <Text style={styles.emptySubtext}>Be the first to submit one!</Text>
            </View>
          )}
        </View>

        {/* Footer Note */}
        <View style={styles.footerNote}>
          <Text style={styles.footerIcon}>💡</Text>
          <Text style={styles.footerText}>
            Access all other apps from Home screen
          </Text>
        </View>
      </ScrollView>

      {/* Submit App Modal */}
      <Modal
        visible={showSubmitModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSubmitModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Submit Your Mini App</Text>
                <Text style={styles.modalSubtitle}>Join the Pezkuwichain ecosystem</Text>
              </View>
              <TouchableOpacity
                style={styles.modalCloseButton}
                onPress={() => setShowSubmitModal(false)}
              >
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>App Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., KurdPay"
                  value={appName}
                  onChangeText={setAppName}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Briefly describe what your app does and its value to the community..."
                  value={appDescription}
                  onChangeText={setAppDescription}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#999"
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Your Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Full name or organization"
                  value={contactName}
                  onChangeText={setContactName}
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Contact Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="your@email.com"
                  value={contactEmail}
                  onChangeText={setContactEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholderTextColor="#999"
                />
              </View>

              <View style={styles.infoBox}>
                <Text style={styles.infoIcon}>📧</Text>
                <View style={styles.infoTextContainer}>
                  <Text style={styles.infoTitle}>Review Process</Text>
                  <Text style={styles.infoText}>
                    Your submission will be reviewed by Dijital Kurdistan Tech Inst. We'll contact you within 5-7 business days.
                  </Text>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setShowSubmitModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmitApp}
              >
                <Text style={styles.submitButtonText}>Submit Application</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  connectButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  connectButtonText: {
    color: KurdistanColors.spi,
    fontSize: 13,
    fontWeight: '600',
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  searchIcon: {
    fontSize: 16,
    marginRight: 10,
    opacity: 0.5,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  clearIcon: {
    fontSize: 14,
    color: '#999',
    padding: 4,
  },
  categoriesContainer: {
    marginBottom: 16,
  },
  categoriesContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: KurdistanColors.spi,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryChipActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  categoryEmoji: {
    fontSize: 14,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#555',
  },
  categoryTextActive: {
    color: KurdistanColors.spi,
  },
  buildSection: {
    marginHorizontal: 20,
    marginBottom: 20,
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 16,
    padding: 18,
    shadowColor: KurdistanColors.kesk,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 5,
  },
  buildContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buildTextContainer: {
    flex: 1,
  },
  buildTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
    marginBottom: 3,
  },
  buildSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.85)',
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: KurdistanColors.spi,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  addButtonText: {
    fontSize: 26,
    fontWeight: '600',
    color: KurdistanColors.kesk,
    marginTop: -2,
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  miniAppCard: {
    flexDirection: 'row',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  miniAppIconContainer: {
    width: 52,
    height: 52,
    borderRadius: 13,
    backgroundColor: '#F0F8F0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  miniAppIcon: {
    fontSize: 26,
  },
  miniAppInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  miniAppHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  miniAppName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  comingSoonBadge: {
    backgroundColor: KurdistanColors.zer,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    marginLeft: 8,
  },
  comingSoonText: {
    fontSize: 9,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  miniAppDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  miniAppDeveloper: {
    fontSize: 10,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: KurdistanColors.spi,
    borderRadius: 14,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 12,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#999',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 16,
  },
  footerIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  footerText: {
    fontSize: 12,
    color: '#888',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: KurdistanColors.spi,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalClose: {
    fontSize: 20,
    color: '#999',
  },
  modalBody: {
    padding: 20,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: KurdistanColors.reş,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  textArea: {
    height: 90,
    paddingTop: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#F0F8F0',
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoTextContainer: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: KurdistanColors.kesk,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#666',
  },
  submitButton: {
    flex: 2,
    padding: 14,
    borderRadius: 12,
    backgroundColor: KurdistanColors.kesk,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: KurdistanColors.spi,
  },
});

export default AppsScreen;
