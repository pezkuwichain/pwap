import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  MessageSquare,
  Eye,
  Search,
  Pin,
  Lock,
  TrendingUp,
  Users,
  Clock,
  ChevronRight,
  ThumbsUp,
  Loader2,
  RefreshCw,
  Filter,
  Megaphone,
  LogIn,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Category {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  display_order: number;
}

interface Discussion {
  id: string;
  category_id: string;
  title: string;
  content: string;
  author_id: string;
  author_name: string;
  author_address: string;
  is_pinned: boolean;
  is_locked: boolean;
  views_count: number;
  replies_count: number;
  tags: string[];
  created_at: string;
  last_activity_at: string;
  category?: Category;
  upvotes?: number;
}

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: 'info' | 'warning' | 'success' | 'critical';
  created_at: string;
}

interface ForumStats {
  totalDiscussions: number;
  totalReplies: number;
  totalUsers: number;
  onlineNow: number;
}

const Forum: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [categories, setCategories] = useState<Category[]>([]);
  const [discussions, setDiscussions] = useState<Discussion[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [stats, setStats] = useState<ForumStats>({ totalDiscussions: 0, totalReplies: 0, totalUsers: 0, onlineNow: 0 });

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'replies'>('recent');

  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // New topic form
  const [newTopic, setNewTopic] = useState({
    title: '',
    content: '',
    category_id: '',
    tags: '',
  });

  // Auth-gated action wrapper
  const requireAuth = (action: () => void) => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    action();
  };

  // Fetch categories
  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (!error && data) {
      setCategories(data);
    }
  };

  // Fetch discussions
  const fetchDiscussions = useCallback(async () => {
    let query = supabase
      .from('forum_discussions')
      .select(`
        *,
        category:forum_categories(id, name, icon, color)
      `);

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }

    if (searchQuery) {
      query = query.or(`title.ilike.%${searchQuery}%,content.ilike.%${searchQuery}%`);
    }

    // Sort pinned first, then by selected criteria
    switch (sortBy) {
      case 'popular':
        query = query.order('is_pinned', { ascending: false }).order('views_count', { ascending: false });
        break;
      case 'replies':
        query = query.order('is_pinned', { ascending: false }).order('replies_count', { ascending: false });
        break;
      default:
        query = query.order('is_pinned', { ascending: false }).order('last_activity_at', { ascending: false });
    }

    query = query.limit(50);

    const { data, error } = await query;

    if (!error && data) {
      setDiscussions(data);
    }
  }, [selectedCategory, searchQuery, sortBy]);

  // Fetch announcements
  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from('admin_announcements')
      .select('*')
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.now()')
      .order('priority', { ascending: false })
      .limit(3);

    if (!error && data) {
      setAnnouncements(data);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    const [discussionsResult, repliesResult] = await Promise.all([
      supabase.from('forum_discussions').select('id', { count: 'exact', head: true }),
      supabase.from('forum_replies').select('id', { count: 'exact', head: true }),
    ]);

    setStats({
      totalDiscussions: discussionsResult.count || 0,
      totalReplies: repliesResult.count || 0,
      totalUsers: 156,
      onlineNow: Math.floor(Math.random() * 20) + 5,
    });
  };

  // Create new discussion
  const handleCreateTopic = async () => {
    if (!user || !newTopic.title || !newTopic.content || !newTopic.category_id) return;

    setIsCreating(true);

    const { data, error } = await supabase
      .from('forum_discussions')
      .insert({
        title: newTopic.title,
        content: newTopic.content,
        category_id: newTopic.category_id,
        author_id: user.id,
        author_name: user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
        author_address: user.user_metadata?.wallet_address || null,
        tags: newTopic.tags ? newTopic.tags.split(',').map(t => t.trim()) : [],
      })
      .select()
      .single();

    setIsCreating(false);

    if (!error && data) {
      setIsCreateModalOpen(false);
      setNewTopic({ title: '', content: '', category_id: '', tags: '' });
      fetchDiscussions();
      navigate(`/forum/${data.id}`);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([
        fetchCategories(),
        fetchDiscussions(),
        fetchAnnouncements(),
        fetchStats(),
      ]);
      setIsLoading(false);
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload discussions when filters change
  useEffect(() => {
    fetchDiscussions();
  }, [fetchDiscussions]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchDiscussions();
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const getAnnouncementStyle = (type: string) => {
    switch (type) {
      case 'critical':
        return 'bg-red-500/20 border-red-500/50 text-red-400';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      case 'success':
        return 'bg-green-500/20 border-green-500/50 text-green-400';
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-400';
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <MessageSquare className="w-8 h-8 text-green-500" />
                Community Forum
              </h1>
              <p className="text-gray-400 mt-1">
                Discuss proposals, share ideas, and connect with the community
              </p>
            </div>
            <Button
              onClick={() => requireAuth(() => setIsCreateModalOpen(true))}
              className="bg-gradient-to-r from-green-600 to-yellow-500 hover:from-green-700 hover:to-yellow-600"
            >
              <Plus className="w-4 h-4 mr-2" />
              New Topic
            </Button>
          </div>

          {/* Guest Banner */}
          {!user && (
            <div className="mb-6 p-4 rounded-lg bg-gradient-to-r from-green-900/30 to-yellow-900/30 border border-green-500/30">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <Eye className="w-5 h-5 text-green-400" />
                  <div>
                    <p className="text-white font-medium">You are browsing as a guest</p>
                    <p className="text-gray-400 text-sm">Login to create topics, reply, and interact with the community</p>
                  </div>
                </div>
                <Button
                  onClick={() => navigate('/login')}
                  variant="outline"
                  className="border-green-500 text-green-400 hover:bg-green-500/20"
                >
                  <LogIn className="w-4 h-4 mr-2" />
                  Login
                </Button>
              </div>
            </div>
          )}

          {/* Announcements */}
          {announcements.length > 0 && (
            <div className="mb-6 space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  className={`flex items-start gap-3 p-4 rounded-lg border ${getAnnouncementStyle(announcement.type)}`}
                >
                  <Megaphone className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold">{announcement.title}</h3>
                    <p className="text-sm opacity-80 mt-1">{announcement.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Sidebar - Categories */}
            <div className="lg:col-span-1 space-y-4">
              {/* Stats Card */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-500" />
                    Forum Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Topics</span>
                    <span className="text-white font-semibold">{stats.totalDiscussions}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Replies</span>
                    <span className="text-white font-semibold">{stats.totalReplies}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Members</span>
                    <span className="text-white font-semibold">{stats.totalUsers}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Online Now</span>
                    <span className="text-green-400 font-semibold flex items-center gap-1">
                      <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                      {stats.onlineNow}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Categories */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Filter className="w-5 h-5 text-yellow-500" />
                    Categories
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                      !selectedCategory
                        ? 'bg-green-500/20 text-green-400'
                        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span>📋</span>
                      <span>All Topics</span>
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {categories.map((category) => (
                    <button
                      key={category.id}
                      onClick={() => setSelectedCategory(category.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                        selectedCategory === category.id
                          ? 'bg-green-500/20 text-green-400'
                          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                      </span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ))}
                </CardContent>
              </Card>

              {/* Quick Links */}
              <Card className="bg-gray-900 border-gray-800">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-500" />
                    Quick Links
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <a href="/governance" className="block text-gray-400 hover:text-green-400 text-sm transition-colors">
                    → Governance Dashboard
                  </a>
                  <a href="/docs" className="block text-gray-400 hover:text-green-400 text-sm transition-colors">
                    → Documentation
                  </a>
                  <a href="https://discord.gg/pezkuwi" target="_blank" rel="noopener noreferrer" className="block text-gray-400 hover:text-green-400 text-sm transition-colors">
                    → Join Discord
                  </a>
                </CardContent>
              </Card>
            </div>

            {/* Main Content - Discussions */}
            <div className="lg:col-span-3">
              {/* Search and Sort */}
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Search discussions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'recent' | 'popular' | 'replies')}>
                  <SelectTrigger className="w-[180px] bg-gray-900 border-gray-700 text-white">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="recent" className="text-white hover:bg-gray-800">
                      <span className="flex items-center gap-2">
                        <Clock className="w-4 h-4" /> Recent Activity
                      </span>
                    </SelectItem>
                    <SelectItem value="popular" className="text-white hover:bg-gray-800">
                      <span className="flex items-center gap-2">
                        <Eye className="w-4 h-4" /> Most Viewed
                      </span>
                    </SelectItem>
                    <SelectItem value="replies" className="text-white hover:bg-gray-800">
                      <span className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Most Replies
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => fetchDiscussions()}
                  className="border-gray-700 text-gray-400 hover:text-white"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>

              {/* Discussions List */}
              {isLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-green-500 animate-spin" />
                </div>
              ) : discussions.length === 0 ? (
                <Card className="bg-gray-900 border-gray-800">
                  <CardContent className="py-16 text-center">
                    <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-white mb-2">No discussions yet</h3>
                    <p className="text-gray-400 mb-6">Be the first to start a conversation!</p>
                    <Button
                      onClick={() => requireAuth(() => setIsCreateModalOpen(true))}
                      className="bg-gradient-to-r from-green-600 to-yellow-500"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create First Topic
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {discussions.map((discussion) => (
                    <Card
                      key={discussion.id}
                      className={`bg-gray-900 border-gray-800 hover:border-gray-700 transition-all cursor-pointer ${
                        discussion.is_pinned ? 'ring-1 ring-yellow-500/30' : ''
                      }`}
                      onClick={() => navigate(`/forum/${discussion.id}`)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-4">
                          {/* Author Avatar */}
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-yellow-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                            {discussion.author_name.charAt(0).toUpperCase()}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              {discussion.is_pinned && (
                                <Badge variant="outline" className="border-yellow-500 text-yellow-500 text-xs">
                                  <Pin className="w-3 h-3 mr-1" />
                                  Pinned
                                </Badge>
                              )}
                              {discussion.is_locked && (
                                <Badge variant="outline" className="border-gray-500 text-gray-500 text-xs">
                                  <Lock className="w-3 h-3 mr-1" />
                                  Locked
                                </Badge>
                              )}
                              {discussion.category && (
                                <Badge
                                  style={{ backgroundColor: `${discussion.category.color}20`, color: discussion.category.color, borderColor: `${discussion.category.color}50` }}
                                  variant="outline"
                                  className="text-xs"
                                >
                                  {discussion.category.icon} {discussion.category.name}
                                </Badge>
                              )}
                            </div>

                            <h3 className="text-lg font-semibold text-white hover:text-green-400 transition-colors line-clamp-1">
                              {discussion.title}
                            </h3>

                            <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                              {discussion.content.length > 150 ? `${discussion.content.substring(0, 150)}...` : discussion.content}
                            </p>

                            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                by <span className="text-gray-300">{discussion.author_name}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDistanceToNow(new Date(discussion.last_activity_at), { addSuffix: true })}
                              </span>
                            </div>
                          </div>

                          {/* Stats */}
                          <div className="hidden sm:flex flex-col items-end gap-2 flex-shrink-0">
                            <div className="flex items-center gap-1 text-gray-400 text-sm">
                              <MessageSquare className="w-4 h-4" />
                              <span>{discussion.replies_count}</span>
                            </div>
                            <div className="flex items-center gap-1 text-gray-400 text-sm">
                              <Eye className="w-4 h-4" />
                              <span>{discussion.views_count}</span>
                            </div>
                            {discussion.upvotes && discussion.upvotes > 0 && (
                              <div className="flex items-center gap-1 text-green-400 text-sm">
                                <ThumbsUp className="w-4 h-4" />
                                <span>{discussion.upvotes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Tags */}
                        {discussion.tags && discussion.tags.length > 0 && (
                          <div className="flex items-center gap-2 mt-3 pl-14">
                            {discussion.tags.slice(0, 3).map((tag, idx) => (
                              <span
                                key={idx}
                                className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400"
                              >
                                #{tag}
                              </span>
                            ))}
                            {discussion.tags.length > 3 && (
                              <span className="text-xs text-gray-500">+{discussion.tags.length - 3} more</span>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Login Prompt Modal */}
      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-white text-xl flex items-center gap-2">
              <LogIn className="w-6 h-6 text-green-500" />
              Login Required
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              You need to be logged in to perform this action.
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-500/20 to-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-gray-300 mb-2">Join our community to:</p>
            <ul className="text-gray-400 text-sm space-y-1">
              <li>• Create new discussion topics</li>
              <li>• Reply to existing discussions</li>
              <li>• Upvote helpful content</li>
              <li>• Participate in governance</li>
            </ul>
          </div>

          <DialogFooter className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowLoginPrompt(false)}
              className="flex-1 border-gray-700 text-gray-300"
            >
              Continue Browsing
            </Button>
            <Button
              onClick={() => {
                setShowLoginPrompt(false);
                navigate('/login');
              }}
              className="flex-1 bg-gradient-to-r from-green-600 to-yellow-500 hover:from-green-700 hover:to-yellow-600"
            >
              <LogIn className="w-4 h-4 mr-2" />
              Login
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Topic Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-white text-xl">Create New Topic</DialogTitle>
            <DialogDescription className="text-gray-400">
              Start a new discussion with the community
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Category</label>
              <Select
                value={newTopic.category_id}
                onValueChange={(v) => setNewTopic({ ...newTopic, category_id: v })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-white hover:bg-gray-700">
                      <span className="flex items-center gap-2">
                        <span>{category.icon}</span>
                        <span>{category.name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Title</label>
              <Input
                value={newTopic.title}
                onChange={(e) => setNewTopic({ ...newTopic, title: e.target.value })}
                placeholder="Enter a descriptive title"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Content</label>
              <Textarea
                value={newTopic.content}
                onChange={(e) => setNewTopic({ ...newTopic, content: e.target.value })}
                placeholder="Write your discussion content here..."
                rows={8}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 mb-2 block">Tags (optional)</label>
              <Input
                value={newTopic.tags}
                onChange={(e) => setNewTopic({ ...newTopic, tags: e.target.value })}
                placeholder="governance, proposal, treasury (comma separated)"
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsCreateModalOpen(false)}
              className="border-gray-700 text-gray-300"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateTopic}
              disabled={isCreating || !newTopic.title || !newTopic.content || !newTopic.category_id}
              className="bg-gradient-to-r from-green-600 to-yellow-500 hover:from-green-700 hover:to-yellow-600"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Create Topic
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default Forum;
