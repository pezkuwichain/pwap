import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
} from 'react-native';
import { KurdistanColors } from '../../theme/colors';
import { usePezkuwi } from '../../contexts/PezkuwiContext';

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface Discussion {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  authorName: string;
  authorAddress: string;
  isPinned: boolean;
  isLocked: boolean;
  viewsCount: number;
  repliesCount: number;
  upvotes: number;
  tags: string[];
  createdAt: string;
  lastActivityAt: string;
}

// Forum data stored in Supabase - categories and discussions fetched from database

const ForumScreen: React.FC = () => {
  const { selectedAccount } = usePezkuwi();

  const [categories, setCategories] = useState<Category[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'replies'>('recent');

  // Stats calculated from real data
  const stats = {
    totalDiscussions: discussions.length,
    totalReplies: discussions.reduce((sum, d) => sum + d.repliesCount, 0),
    totalMembers: 0, // Will be fetched from Supabase
    onlineNow: 0, // Will be calculated from active sessions
  };

  const fetchForumData = async () => {
    try {
      setLoading(true);

      // Note: Forum uses Supabase database, not blockchain
      // This is a web2 component for community discussions
      // TODO: Implement Supabase client and fetch real data
      // const { data: categoriesData } = await supabase.from('forum_categories').select('*');
      // const { data: discussionsData } = await supabase.from('forum_discussions').select('*');

      // For now, set empty arrays - will be populated when Supabase is configured
      setCategories([]);
      setDiscussions([]);

    } catch (error) {
      console.error('Failed to load forum data:', error);
      Alert.alert('Error', 'Failed to load forum data from database');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchForumData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchForumData();
  };

  const handleCreateTopic = () => {
    if (!selectedAccount) {
      Alert.alert('Login Required', 'You need to connect your wallet to create topics');
      return;
    }
    Alert.alert('Create Topic', 'Create topic modal would open here');
    // TODO: Navigate to CreateTopicScreen
  };

  const handleDiscussionPress = (discussion: Discussion) => {
    Alert.alert(
      discussion.title,
      `${discussion.content.substring(0, 200)}...\n\nAuthor: ${discussion.authorName}\nReplies: ${discussion.repliesCount} | Views: ${discussion.viewsCount} | Upvotes: ${discussion.upvotes}`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View Thread', onPress: () => Alert.alert('Thread View', 'Thread details screen would open here') },
      ]
    );
  };

  const getCategoryById = (categoryId: string): Category | undefined => {
    return CATEGORIES.find(c => c.id === categoryId);
  };

  const getTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const filteredDiscussions = discussions
    .filter(d => !selectedCategory || d.categoryId === selectedCategory)
    .filter(d => !searchQuery || d.title.toLowerCase().includes(searchQuery.toLowerCase()) || d.content.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;

      switch (sortBy) {
        case 'popular':
          return b.viewsCount - a.viewsCount;
        case 'replies':
          return b.repliesCount - a.repliesCount;
        default:
          return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
      }
    });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Community Forum</Text>
          <Text style={styles.headerSubtitle}>Discuss, share ideas, and connect</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>📋</Text>
            <Text style={styles.statValue}>{stats.totalDiscussions}</Text>
            <Text style={styles.statLabel}>Topics</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>💬</Text>
            <Text style={styles.statValue}>{stats.totalReplies}</Text>
            <Text style={styles.statLabel}>Replies</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statIcon}>👥</Text>
            <Text style={styles.statValue}>{stats.totalMembers}</Text>
            <Text style={styles.statLabel}>Members</Text>
          </View>
          <View style={styles.statCard}>
            <View style={styles.onlineIndicator} />
            <Text style={styles.statValue}>{stats.onlineNow}</Text>
            <Text style={styles.statLabel}>Online</Text>
          </View>
        </View>

        {/* Create Topic Button */}
        <TouchableOpacity style={styles.createButton} onPress={handleCreateTopic}>
          <Text style={styles.createButtonText}>➕ Create New Topic</Text>
        </TouchableOpacity>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Text style={styles.searchIcon}>🔍</Text>
          <TextInput
            style={styles.searchInput}
            placeholder="Search discussions..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories Filter */}
        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>Categories</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoriesScroll}>
            <TouchableOpacity
              style={[styles.categoryChip, !selectedCategory && styles.categoryChipActive]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[styles.categoryChipText, !selectedCategory && styles.categoryChipTextActive]}>
                📋 All Topics
              </Text>
            </TouchableOpacity>
            {CATEGORIES.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.categoryChipActive,
                  selectedCategory === category.id && { backgroundColor: `${category.color}20` },
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text
                  style={[
                    styles.categoryChipText,
                    selectedCategory === category.id && { color: category.color },
                  ]}
                >
                  {category.icon} {category.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Sort Tabs */}
        <View style={styles.sortTabs}>
          <TouchableOpacity
            style={[styles.sortTab, sortBy === 'recent' && styles.sortTabActive]}
            onPress={() => setSortBy('recent')}
          >
            <Text style={[styles.sortTabText, sortBy === 'recent' && styles.sortTabTextActive]}>
              ⏰ Recent
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortTab, sortBy === 'popular' && styles.sortTabActive]}
            onPress={() => setSortBy('popular')}
          >
            <Text style={[styles.sortTabText, sortBy === 'popular' && styles.sortTabTextActive]}>
              👁️ Popular
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.sortTab, sortBy === 'replies' && styles.sortTabActive]}
            onPress={() => setSortBy('replies')}
          >
            <Text style={[styles.sortTabText, sortBy === 'replies' && styles.sortTabTextActive]}>
              💬 Replies
            </Text>
          </TouchableOpacity>
        </View>

        {/* Discussions List */}
        <View style={styles.discussionsList}>
          {filteredDiscussions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No discussions found matching your search' : 'No discussions yet'}
              </Text>
              {!searchQuery && (
                <TouchableOpacity style={styles.emptyButton} onPress={handleCreateTopic}>
                  <Text style={styles.emptyButtonText}>Create First Topic</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            filteredDiscussions.map((discussion) => {
              const category = getCategoryById(discussion.categoryId);
              return (
                <TouchableOpacity
                  key={discussion.id}
                  style={[
                    styles.discussionCard,
                    discussion.isPinned && styles.discussionCardPinned,
                  ]}
                  onPress={() => handleDiscussionPress(discussion)}
                >
                  {/* Discussion Header */}
                  <View style={styles.discussionHeader}>
                    <View style={styles.discussionAvatar}>
                      <Text style={styles.discussionAvatarText}>
                        {discussion.authorName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.discussionHeaderInfo}>
                      <Text style={styles.discussionAuthor}>{discussion.authorName}</Text>
                      <Text style={styles.discussionTime}>{getTimeAgo(discussion.lastActivityAt)}</Text>
                    </View>
                  </View>

                  {/* Badges */}
                  <View style={styles.badgesRow}>
                    {discussion.isPinned && (
                      <View style={styles.pinnedBadge}>
                        <Text style={styles.pinnedBadgeText}>📌 PINNED</Text>
                      </View>
                    )}
                    {discussion.isLocked && (
                      <View style={styles.lockedBadge}>
                        <Text style={styles.lockedBadgeText}>🔒 LOCKED</Text>
                      </View>
                    )}
                    {category && (
                      <View style={[styles.categoryBadge, { backgroundColor: `${category.color}15` }]}>
                        <Text style={[styles.categoryBadgeText, { color: category.color }]}>
                          {category.icon} {category.name}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Title */}
                  <Text style={styles.discussionTitle} numberOfLines={2}>
                    {discussion.title}
                  </Text>

                  {/* Content Preview */}
                  <Text style={styles.discussionContent} numberOfLines={2}>
                    {discussion.content}
                  </Text>

                  {/* Tags */}
                  {discussion.tags.length > 0 && (
                    <View style={styles.tagsRow}>
                      {discussion.tags.slice(0, 3).map((tag, idx) => (
                        <View key={idx} style={styles.tag}>
                          <Text style={styles.tagText}>#{tag}</Text>
                        </View>
                      ))}
                      {discussion.tags.length > 3 && (
                        <Text style={styles.tagsMore}>+{discussion.tags.length - 3} more</Text>
                      )}
                    </View>
                  )}

                  {/* Stats */}
                  <View style={styles.discussionStats}>
                    <View style={styles.discussionStat}>
                      <Text style={styles.discussionStatIcon}>💬</Text>
                      <Text style={styles.discussionStatText}>{discussion.repliesCount}</Text>
                    </View>
                    <View style={styles.discussionStat}>
                      <Text style={styles.discussionStatIcon}>👁️</Text>
                      <Text style={styles.discussionStatText}>{discussion.viewsCount}</Text>
                    </View>
                    <View style={styles.discussionStat}>
                      <Text style={styles.discussionStatIcon}>👍</Text>
                      <Text style={[styles.discussionStatText, styles.discussionStatUpvotes]}>
                        {discussion.upvotes}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Info Note */}
        <View style={styles.infoNote}>
          <Text style={styles.infoNoteIcon}>ℹ️</Text>
          <Text style={styles.infoNoteText}>
            Connect your wallet to create topics, reply to discussions, and upvote helpful content.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  scrollContent: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  statsGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  statIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 10,
    color: '#999',
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: KurdistanColors.kesk,
    marginBottom: 4,
  },
  createButton: {
    backgroundColor: KurdistanColors.kesk,
    marginHorizontal: 16,
    marginBottom: 20,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    boxShadow: '0px 1px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
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
  categoriesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  categoriesScroll: {
    paddingHorizontal: 16,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#E5E5E5',
    marginRight: 8,
  },
  categoryChipActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  categoryChipTextActive: {
    color: '#FFFFFF',
  },
  sortTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 20,
    gap: 8,
  },
  sortTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#E5E5E5',
    alignItems: 'center',
  },
  sortTabActive: {
    backgroundColor: KurdistanColors.kesk,
  },
  sortTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  sortTabTextActive: {
    color: '#FFFFFF',
  },
  discussionsList: {
    paddingHorizontal: 16,
    gap: 12,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: KurdistanColors.kesk,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  discussionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.05)',
    elevation: 2,
  },
  discussionCardPinned: {
    borderWidth: 1,
    borderColor: '#F59E0B',
  },
  discussionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  discussionAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: KurdistanColors.kesk,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  discussionAvatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  discussionHeaderInfo: {
    flex: 1,
  },
  discussionAuthor: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  discussionTime: {
    fontSize: 12,
    color: '#999',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 8,
  },
  pinnedBadge: {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  pinnedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#F59E0B',
  },
  lockedBadge: {
    backgroundColor: 'rgba(102, 102, 102, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#666',
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  discussionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    lineHeight: 22,
  },
  discussionContent: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    color: '#666',
  },
  tagsMore: {
    fontSize: 11,
    color: '#999',
    alignSelf: 'center',
  },
  discussionStats: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  discussionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  discussionStatIcon: {
    fontSize: 14,
  },
  discussionStatText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  discussionStatUpvotes: {
    color: KurdistanColors.kesk,
  },
  infoNote: {
    flexDirection: 'row',
    backgroundColor: '#E0F2FE',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 24,
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  infoNoteIcon: {
    fontSize: 20,
  },
  infoNoteText: {
    flex: 1,
    fontSize: 12,
    color: '#0C4A6E',
    lineHeight: 18,
  },
});

export default ForumScreen;
