import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { KurdistanColors } from '../theme/colors';

// Types
interface Business {
  id: string;
  walletAddress: string;
  name: string;
  description: string;
  region: string;
  rating: number;
  reviewCount: number;
  verified: boolean;
  createdAt: number;
}

interface Listing {
  id: string;
  businessId: string;
  business: Business;
  title: string;
  description: string;
  category: CategoryType;
  price: number;
  currency: 'HEZ' | 'PEZ' | 'USDT';
  unit: string;
  minOrder: number;
  images: string[];
  location: string;
  isService: boolean;
  createdAt: number;
  status: 'active' | 'sold' | 'paused';
}

type CategoryType =
  | 'agriculture'
  | 'manufacturing'
  | 'technology'
  | 'logistics'
  | 'construction'
  | 'food'
  | 'textiles'
  | 'services';

interface Category {
  id: CategoryType;
  nameKu: string;
  nameEn: string;
  icon: string;
}

const CATEGORIES: Category[] = [
  { id: 'agriculture', nameKu: 'Çandinî', nameEn: 'Agriculture', icon: '🌾' },
  { id: 'manufacturing', nameKu: 'Pîşesazî', nameEn: 'Manufacturing', icon: '🏭' },
  { id: 'technology', nameKu: 'Teknolojî', nameEn: 'Technology', icon: '💻' },
  { id: 'logistics', nameKu: 'Veguhaztin', nameEn: 'Logistics', icon: '🚛' },
  { id: 'construction', nameKu: 'Avahîsazî', nameEn: 'Construction', icon: '🏗️' },
  { id: 'food', nameKu: 'Xwarin', nameEn: 'Food & Beverage', icon: '🍽️' },
  { id: 'textiles', nameKu: 'Tekstîl', nameEn: 'Textiles', icon: '🧵' },
  { id: 'services', nameKu: 'Xizmet', nameEn: 'Services', icon: '💼' },
];

// Mock data - will be replaced with Supabase/blockchain
const MOCK_LISTINGS: Listing[] = [
  {
    id: '1',
    businessId: 'b1',
    business: {
      id: 'b1',
      walletAddress: '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY',
      name: 'Agro Kurdistan Co.',
      description: 'Leading agricultural exports',
      region: 'Hewlêr',
      rating: 4.8,
      reviewCount: 45,
      verified: true,
      createdAt: Date.now() - 86400000 * 30,
    },
    title: 'Premium Kurdish Wheat - Export Quality',
    description: 'High-quality wheat from the fertile lands of Kurdistan. Organic farming methods. Bulk orders available.',
    category: 'agriculture',
    price: 500,
    currency: 'HEZ',
    unit: 'ton',
    minOrder: 10,
    images: [],
    location: 'Hewlêr, Başûr',
    isService: false,
    createdAt: Date.now() - 86400000 * 5,
    status: 'active',
  },
  {
    id: '2',
    businessId: 'b2',
    business: {
      id: 'b2',
      walletAddress: '5FHneW46xGXgs5mUiveU4sbTyGBzmstUspZC92UhjJM694ty',
      name: 'TechKurd Solutions',
      description: 'Software development & IT services',
      region: 'Diaspora',
      rating: 4.9,
      reviewCount: 128,
      verified: true,
      createdAt: Date.now() - 86400000 * 60,
    },
    title: 'Full-Stack Web Development',
    description: 'Professional web application development. React, Node.js, Blockchain integration. Kurdish & English support.',
    category: 'technology',
    price: 5000,
    currency: 'HEZ',
    unit: 'project',
    minOrder: 1,
    images: [],
    location: 'Diaspora (Remote)',
    isService: true,
    createdAt: Date.now() - 86400000 * 2,
    status: 'active',
  },
  {
    id: '3',
    businessId: 'b3',
    business: {
      id: 'b3',
      walletAddress: '5DAAnrj7VHTznn2AWBemMuyBwZWs6FNFjdyVXUeYum3PTXFy',
      name: 'Kurdistan Textiles',
      description: 'Traditional & modern textile production',
      region: 'Amed',
      rating: 4.6,
      reviewCount: 67,
      verified: true,
      createdAt: Date.now() - 86400000 * 90,
    },
    title: 'Traditional Kurdish Kilim - Wholesale',
    description: 'Handwoven Kurdish kilims with traditional patterns. Perfect for export. Custom designs available.',
    category: 'textiles',
    price: 200,
    currency: 'HEZ',
    unit: 'piece',
    minOrder: 50,
    images: [],
    location: 'Amed, Bakur',
    isService: false,
    createdAt: Date.now() - 86400000 * 1,
    status: 'active',
  },
  {
    id: '4',
    businessId: 'b4',
    business: {
      id: 'b4',
      walletAddress: '5HGjWAeFDfFCWPsjFQdVV2Msvz2XtMktvgocEZcCj68kUMaw',
      name: 'Kurdistan Logistics',
      description: 'Cross-border shipping & logistics',
      region: 'Silêmanî',
      rating: 4.7,
      reviewCount: 89,
      verified: true,
      createdAt: Date.now() - 86400000 * 45,
    },
    title: 'International Shipping - Kurdistan to Europe',
    description: 'Reliable shipping from Kurdistan to European countries. Full documentation support. Crypto payments accepted.',
    category: 'logistics',
    price: 150,
    currency: 'HEZ',
    unit: 'shipment',
    minOrder: 1,
    images: [],
    location: 'Silêmanî, Başûr',
    isService: true,
    createdAt: Date.now() - 86400000 * 3,
    status: 'active',
  },
];

const B2BScreen: React.FC = () => {
  const navigation = useNavigation();
  const { selectedAccount, api, getKeyPair } = usePezkuwi();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | 'all'>('all');
  const [listings, setListings] = useState<Listing[]>(MOCK_LISTINGS);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);

  // Create listing form state
  const [newListing, setNewListing] = useState({
    title: '',
    description: '',
    category: 'services' as CategoryType,
    price: '',
    unit: '',
    minOrder: '1',
    location: '',
    isService: false,
  });

  // Contact form state
  const [contactMessage, setContactMessage] = useState('');
  const [offerAmount, setOfferAmount] = useState('');

  // Filter listings
  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      const matchesSearch =
        listing.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        listing.business.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || listing.category === selectedCategory;
      return matchesSearch && matchesCategory && listing.status === 'active';
    });
  }, [listings, searchQuery, selectedCategory]);

  // Refresh listings
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // TODO: Fetch from Supabase/blockchain
    await new Promise(resolve => setTimeout(resolve, 1000));
    setRefreshing(false);
  }, []);

  // Create new listing
  const handleCreateListing = async () => {
    if (!selectedAccount) {
      Alert.alert('Şaşî / Error', 'Ji kerema xwe berê wallet ve girêbidin / Please connect wallet first');
      return;
    }

    if (!newListing.title || !newListing.description || !newListing.price) {
      Alert.alert('Şaşî / Error', 'Ji kerema xwe hemû qadan dagirin / Please fill all fields');
      return;
    }

    // Create listing object
    const listing: Listing = {
      id: `listing_${Date.now()}`,
      businessId: selectedAccount.address,
      business: {
        id: selectedAccount.address,
        walletAddress: selectedAccount.address,
        name: selectedAccount.meta?.name || 'My Business',
        description: '',
        region: newListing.location,
        rating: 0,
        reviewCount: 0,
        verified: false,
        createdAt: Date.now(),
      },
      title: newListing.title,
      description: newListing.description,
      category: newListing.category,
      price: parseFloat(newListing.price),
      currency: 'HEZ',
      unit: newListing.unit || 'piece',
      minOrder: parseInt(newListing.minOrder) || 1,
      images: [],
      location: newListing.location,
      isService: newListing.isService,
      createdAt: Date.now(),
      status: 'active',
    };

    // TODO: Save to Supabase/blockchain
    setListings(prev => [listing, ...prev]);
    setShowCreateModal(false);
    setNewListing({
      title: '',
      description: '',
      category: 'services',
      price: '',
      unit: '',
      minOrder: '1',
      location: '',
      isService: false,
    });

    Alert.alert(
      'Serketî / Success',
      'Îlana we hat çêkirin!\nYour listing has been created!',
      [{ text: 'Temam / OK' }]
    );
  };

  // Send contact/offer
  const handleSendContact = async () => {
    if (!selectedAccount || !selectedListing) return;

    if (!contactMessage) {
      Alert.alert('Şaşî / Error', 'Ji kerema xwe peyamekê binivîsin / Please write a message');
      return;
    }

    // TODO: Send message via blockchain or Supabase
    Alert.alert(
      'Serketî / Success',
      `Peyama we ji ${selectedListing.business.name} re hat şandin!\nYour message has been sent!`,
      [{ text: 'Temam / OK' }]
    );

    setShowContactModal(false);
    setContactMessage('');
    setOfferAmount('');
  };

  // Start escrow payment
  const handleStartEscrow = async () => {
    if (!selectedAccount || !selectedListing || !api) return;

    const amount = offerAmount || String(selectedListing.price * selectedListing.minOrder);

    Alert.alert(
      'Escrow Payment',
      `Hûn ê ${amount} HEZ bişînin escrow.\nYou will send ${amount} HEZ to escrow.\n\nEv drav dê were parastin heta ku we mal/xizmet wergirt.\nFunds will be held until you receive goods/services.`,
      [
        { text: 'Betal / Cancel', style: 'cancel' },
        {
          text: 'Piştrast / Confirm',
          onPress: async () => {
            try {
              const keyPair = await getKeyPair(selectedAccount.address);
              if (!keyPair) throw new Error('KeyPair not found');

              // TODO: Implement actual escrow transaction
              Alert.alert(
                'Serketî / Success',
                'Escrow hate damezrandin!\nEscrow has been created!\n\nDrav di ewlehiyê de ye.\nFunds are secured.',
                [{ text: 'Temam / OK' }]
              );
            } catch (error) {
              Alert.alert('Şaşî / Error', 'Escrow nehat damezrandin / Escrow failed');
            }
          },
        },
      ]
    );
  };

  // Render category chip
  const renderCategory = (category: Category | { id: 'all'; nameKu: string; nameEn: string; icon: string }) => (
    <TouchableOpacity
      key={category.id}
      style={[
        styles.categoryChip,
        selectedCategory === category.id && styles.categoryChipActive,
      ]}
      onPress={() => setSelectedCategory(category.id as CategoryType | 'all')}
    >
      <Text style={styles.categoryIcon}>{category.icon}</Text>
      <Text style={[
        styles.categoryText,
        selectedCategory === category.id && styles.categoryTextActive,
      ]}>
        {category.nameKu}
      </Text>
    </TouchableOpacity>
  );

  // Render listing card
  const renderListing = ({ item }: { item: Listing }) => (
    <TouchableOpacity
      style={styles.listingCard}
      onPress={() => {
        setSelectedListing(item);
        setShowDetailModal(true);
      }}
      activeOpacity={0.7}
    >
      <View style={styles.listingHeader}>
        <View style={styles.businessInfo}>
          <View style={styles.businessAvatar}>
            <Text style={styles.businessAvatarText}>
              {item.business.name.charAt(0)}
            </Text>
          </View>
          <View>
            <View style={styles.businessNameRow}>
              <Text style={styles.businessName}>{item.business.name}</Text>
              {item.business.verified && <Text style={styles.verifiedBadge}>✓</Text>}
            </View>
            <Text style={styles.businessLocation}>{item.location}</Text>
          </View>
        </View>
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingStar}>⭐</Text>
          <Text style={styles.ratingText}>{item.business.rating.toFixed(1)}</Text>
        </View>
      </View>

      <Text style={styles.listingTitle}>{item.title}</Text>
      <Text style={styles.listingDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.listingFooter}>
        <View style={styles.priceContainer}>
          <Text style={styles.priceValue}>{item.price.toLocaleString()}</Text>
          <Text style={styles.priceCurrency}> {item.currency}</Text>
          <Text style={styles.priceUnit}>/{item.unit}</Text>
        </View>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryBadgeText}>
            {CATEGORIES.find(c => c.id === item.category)?.icon} {item.isService ? 'Xizmet' : 'Hilber'}
          </Text>
        </View>
      </View>

      <View style={styles.minOrderContainer}>
        <Text style={styles.minOrderText}>
          Min. Order: {item.minOrder} {item.unit}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Action Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>B2B Bazirganî</Text>
          <Text style={styles.headerSubtitle}>Kurdish Business Marketplace</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            if (!selectedAccount) {
              Alert.alert('Şaşî / Error', 'Ji kerema xwe berê wallet ve girêbidin / Please connect wallet first');
              return;
            }
            setShowCreateModal(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Îlan</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Lêgerîn / Search businesses..."
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

      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContent}
        >
          {renderCategory({ id: 'all', nameKu: 'Hemû', nameEn: 'All', icon: '📋' })}
          {CATEGORIES.map(renderCategory)}
        </ScrollView>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {filteredListings.length} îlan / listings
        </Text>
      </View>

      {/* Listings */}
      <FlatList
        data={filteredListings}
        renderItem={renderListing}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[KurdistanColors.kesk]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>Îlan nehat dîtin</Text>
            <Text style={styles.emptySubtext}>No listings found</Text>
          </View>
        }
      />

      {/* Create Listing Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Îlana Nû / New Listing</Text>
            <View style={{ width: 30 }} />
          </View>

          <ScrollView style={styles.modalContent}>
            {/* Type Selection */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Cure / Type</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeButton, !newListing.isService && styles.typeButtonActive]}
                  onPress={() => setNewListing(prev => ({ ...prev, isService: false }))}
                >
                  <Text style={styles.typeIcon}>📦</Text>
                  <Text style={[styles.typeText, !newListing.isService && styles.typeTextActive]}>
                    Hilber / Product
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeButton, newListing.isService && styles.typeButtonActive]}
                  onPress={() => setNewListing(prev => ({ ...prev, isService: true }))}
                >
                  <Text style={styles.typeIcon}>💼</Text>
                  <Text style={[styles.typeText, newListing.isService && styles.typeTextActive]}>
                    Xizmet / Service
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Category */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Kategorî / Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.categorySelector}>
                  {CATEGORIES.map(cat => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categorySelectorItem,
                        newListing.category === cat.id && styles.categorySelectorItemActive,
                      ]}
                      onPress={() => setNewListing(prev => ({ ...prev, category: cat.id }))}
                    >
                      <Text style={styles.categorySelectorIcon}>{cat.icon}</Text>
                      <Text style={[
                        styles.categorySelectorText,
                        newListing.category === cat.id && styles.categorySelectorTextActive,
                      ]}>
                        {cat.nameKu}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Title */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Sernav / Title *</Text>
              <TextInput
                style={styles.formInput}
                value={newListing.title}
                onChangeText={text => setNewListing(prev => ({ ...prev, title: text }))}
                placeholder="Navê hilber an xizmetê..."
                placeholderTextColor="#999"
              />
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Danasîn / Description *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={newListing.description}
                onChangeText={text => setNewListing(prev => ({ ...prev, description: text }))}
                placeholder="Agahdariya berfireh li ser hilber an xizmetê..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </View>

            {/* Price & Unit */}
            <View style={styles.formRow}>
              <View style={[styles.formGroup, { flex: 2 }]}>
                <Text style={styles.formLabel}>Biha / Price (HEZ) *</Text>
                <TextInput
                  style={styles.formInput}
                  value={newListing.price}
                  onChangeText={text => setNewListing(prev => ({ ...prev, price: text }))}
                  placeholder="0"
                  placeholderTextColor="#999"
                  keyboardType="decimal-pad"
                />
              </View>
              <View style={[styles.formGroup, { flex: 1, marginLeft: 12 }]}>
                <Text style={styles.formLabel}>Yekîne / Unit</Text>
                <TextInput
                  style={styles.formInput}
                  value={newListing.unit}
                  onChangeText={text => setNewListing(prev => ({ ...prev, unit: text }))}
                  placeholder="kg, piece..."
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Min Order */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Kêmtirîn Spartin / Min Order</Text>
              <TextInput
                style={styles.formInput}
                value={newListing.minOrder}
                onChangeText={text => setNewListing(prev => ({ ...prev, minOrder: text }))}
                placeholder="1"
                placeholderTextColor="#999"
                keyboardType="number-pad"
              />
            </View>

            {/* Location */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Cîh / Location</Text>
              <TextInput
                style={styles.formInput}
                value={newListing.location}
                onChangeText={text => setNewListing(prev => ({ ...prev, location: text }))}
                placeholder="Hewlêr, Amed, Diaspora..."
                placeholderTextColor="#999"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} onPress={handleCreateListing}>
              <Text style={styles.submitButtonText}>Îlan Çêke / Create Listing</Text>
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Listing Detail Modal */}
      <Modal
        visible={showDetailModal}
        animationType="slide"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          {selectedListing && (
            <>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowDetailModal(false)}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Hûrgulî / Details</Text>
                <View style={{ width: 30 }} />
              </View>

              <ScrollView style={styles.modalContent}>
                {/* Business Header */}
                <View style={styles.detailBusinessCard}>
                  <View style={styles.detailBusinessAvatar}>
                    <Text style={styles.detailBusinessAvatarText}>
                      {selectedListing.business.name.charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.detailBusinessInfo}>
                    <View style={styles.businessNameRow}>
                      <Text style={styles.detailBusinessName}>{selectedListing.business.name}</Text>
                      {selectedListing.business.verified && (
                        <View style={styles.verifiedBadgeLarge}>
                          <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.detailBusinessLocation}>📍 {selectedListing.location}</Text>
                    <View style={styles.detailRating}>
                      <Text>⭐ {selectedListing.business.rating.toFixed(1)}</Text>
                      <Text style={styles.reviewCount}>
                        ({selectedListing.business.reviewCount} reviews)
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Listing Info */}
                <View style={styles.detailSection}>
                  <Text style={styles.detailTitle}>{selectedListing.title}</Text>
                  <View style={styles.detailCategoryBadge}>
                    <Text style={styles.detailCategoryText}>
                      {CATEGORIES.find(c => c.id === selectedListing.category)?.icon}{' '}
                      {CATEGORIES.find(c => c.id === selectedListing.category)?.nameKu}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailSection}>
                  <Text style={styles.detailSectionTitle}>Danasîn / Description</Text>
                  <Text style={styles.detailDescription}>{selectedListing.description}</Text>
                </View>

                {/* Price Card */}
                <View style={styles.priceCard}>
                  <View>
                    <Text style={styles.priceCardLabel}>Biha / Price</Text>
                    <View style={styles.priceCardValue}>
                      <Text style={styles.priceCardAmount}>
                        {selectedListing.price.toLocaleString()}
                      </Text>
                      <Text style={styles.priceCardCurrency}> {selectedListing.currency}</Text>
                      <Text style={styles.priceCardUnit}>/{selectedListing.unit}</Text>
                    </View>
                  </View>
                  <View>
                    <Text style={styles.priceCardLabel}>Min. Order</Text>
                    <Text style={styles.priceCardMinOrder}>
                      {selectedListing.minOrder} {selectedListing.unit}
                    </Text>
                  </View>
                </View>

                {/* Action Buttons */}
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.contactButton}
                    onPress={() => {
                      setShowDetailModal(false);
                      setShowContactModal(true);
                    }}
                  >
                    <Text style={styles.contactButtonText}>💬 Pêwendî / Contact</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.escrowButton} onPress={handleStartEscrow}>
                    <Text style={styles.escrowButtonText}>🔒 Escrow Payment</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* Contact Modal */}
      <Modal
        visible={showContactModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowContactModal(false)}
      >
        <View style={styles.contactModalOverlay}>
          <View style={styles.contactModalContent}>
            <Text style={styles.contactModalTitle}>
              Pêwendî bi {selectedListing?.business.name}
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Peyam / Message *</Text>
              <TextInput
                style={[styles.formInput, styles.formTextArea]}
                value={contactMessage}
                onChangeText={setContactMessage}
                placeholder="Peyama xwe binivîsin..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={4}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Pêşniyara Biha / Price Offer (HEZ)</Text>
              <TextInput
                style={styles.formInput}
                value={offerAmount}
                onChangeText={setOfferAmount}
                placeholder={selectedListing ? String(selectedListing.price) : '0'}
                placeholderTextColor="#999"
                keyboardType="decimal-pad"
              />
            </View>

            <View style={styles.contactModalButtons}>
              <TouchableOpacity
                style={styles.contactModalCancel}
                onPress={() => setShowContactModal(false)}
              >
                <Text style={styles.contactModalCancelText}>Betal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactModalSend} onPress={handleSendContact}>
                <Text style={styles.contactModalSendText}>Bişîne / Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: KurdistanColors.spi,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  addButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: KurdistanColors.spi,
    fontWeight: '600',
    fontSize: 14,
  },
  searchContainer: {
    padding: 16,
    backgroundColor: KurdistanColors.spi,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  clearIcon: {
    fontSize: 16,
    color: '#999',
    padding: 4,
  },
  categoriesContainer: {
    backgroundColor: KurdistanColors.spi,
    paddingBottom: 12,
  },
  categoriesContent: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  categoryIcon: {
    fontSize: 16,
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
  statsContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F5F5F5',
  },
  statsText: {
    fontSize: 12,
    color: '#666',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  listingCard: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  listingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  businessAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  businessAvatarText: {
    color: KurdistanColors.spi,
    fontSize: 18,
    fontWeight: 'bold',
  },
  businessNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  businessName: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  verifiedBadge: {
    color: KurdistanColors.kesk,
    fontSize: 14,
    marginLeft: 4,
    fontWeight: 'bold',
  },
  businessLocation: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF9E6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  ratingStar: {
    fontSize: 12,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginLeft: 4,
  },
  listingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  listingDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  listingFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  priceCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  priceUnit: {
    fontSize: 12,
    color: '#666',
  },
  categoryBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryBadgeText: {
    fontSize: 12,
    color: '#555',
  },
  minOrderContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  minOrderText: {
    fontSize: 12,
    color: '#888',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: KurdistanColors.spi,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalClose: {
    fontSize: 24,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    color: KurdistanColors.reş,
  },
  formTextArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  formRow: {
    flexDirection: 'row',
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    backgroundColor: '#F8F9FA',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeButtonActive: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: `${KurdistanColors.kesk}10`,
  },
  typeIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  typeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  typeTextActive: {
    color: KurdistanColors.kesk,
  },
  categorySelector: {
    flexDirection: 'row',
    gap: 8,
  },
  categorySelectorItem: {
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  categorySelectorItemActive: {
    borderColor: KurdistanColors.kesk,
    backgroundColor: `${KurdistanColors.kesk}10`,
  },
  categorySelectorIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  categorySelectorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  categorySelectorTextActive: {
    color: KurdistanColors.kesk,
  },
  submitButton: {
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  // Detail Modal
  detailBusinessCard: {
    flexDirection: 'row',
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailBusinessAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  detailBusinessAvatarText: {
    color: KurdistanColors.spi,
    fontSize: 24,
    fontWeight: 'bold',
  },
  detailBusinessInfo: {
    flex: 1,
  },
  detailBusinessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  verifiedBadgeLarge: {
    backgroundColor: `${KurdistanColors.kesk}20`,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 8,
  },
  verifiedBadgeText: {
    fontSize: 11,
    color: KurdistanColors.kesk,
    fontWeight: '600',
  },
  detailBusinessLocation: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  detailRating: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  reviewCount: {
    fontSize: 12,
    color: '#888',
    marginLeft: 4,
  },
  detailSection: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  detailTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 12,
  },
  detailCategoryBadge: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
  },
  detailCategoryText: {
    fontSize: 14,
    color: '#555',
  },
  detailSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
    marginBottom: 8,
  },
  detailDescription: {
    fontSize: 15,
    color: '#444',
    lineHeight: 22,
  },
  priceCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: `${KurdistanColors.kesk}10`,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: `${KurdistanColors.kesk}30`,
  },
  priceCardLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  priceCardValue: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  priceCardAmount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
  priceCardCurrency: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  priceCardUnit: {
    fontSize: 14,
    color: '#666',
  },
  priceCardMinOrder: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  actionButtons: {
    gap: 12,
  },
  contactButton: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: KurdistanColors.kesk,
  },
  contactButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: KurdistanColors.kesk,
  },
  escrowButton: {
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  escrowButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
  // Contact Modal
  contactModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  contactModalContent: {
    backgroundColor: KurdistanColors.spi,
    borderRadius: 16,
    padding: 20,
  },
  contactModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
    marginBottom: 20,
    textAlign: 'center',
  },
  contactModalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  contactModalCancel: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  contactModalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  contactModalSend: {
    flex: 1,
    backgroundColor: KurdistanColors.kesk,
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  contactModalSendText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: KurdistanColors.spi,
  },
});

export default B2BScreen;
