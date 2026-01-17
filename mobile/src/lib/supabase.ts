/**
 * Supabase Client Configuration
 *
 * Centralized Supabase client for all database operations
 * Used for: Forum, P2P Platform, Notifications, Referrals
 */

// Note: react-native-url-polyfill removed - React Native 0.81+ has native URL support
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../config/environment';

// Hardcoded fallbacks for production builds where ENV may not be available
const FALLBACK_SUPABASE_URL = 'https://vsyrpfiwhjvahofxwytr.supabase.co';
const FALLBACK_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZzeXJwZml3aGp2YWhvZnh3eXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwMjYxNTgsImV4cCI6MjA3NTYwMjE1OH0.dO2c8YWIph2D95X7jFdlGYJ8MXyuyorkLcjQ6onH-HE';

// Initialize Supabase client from environment variables with fallbacks
const supabaseUrl = ENV.supabaseUrl || FALLBACK_SUPABASE_URL;
const supabaseKey = ENV.supabaseAnonKey || FALLBACK_SUPABASE_KEY;

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Database type definitions
export interface ForumCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  created_at: string;
}

export interface ForumDiscussion {
  id: string;
  category_id: string;
  author_address: string;
  author_name: string;
  title: string;
  content: string;
  likes: number;
  replies_count: number;
  created_at: string;
  updated_at: string;
}

export interface P2PAd {
  id: string;
  user_address: string;
  type: 'buy' | 'sell';
  merchant_name: string;
  rating: number;
  trades_count: number;
  price: number;
  currency: string;
  amount: string;
  min_limit: string;
  max_limit: string;
  payment_methods: string[];
  status: 'active' | 'inactive' | 'completed';
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  user_address: string;
  type: 'transaction' | 'governance' | 'p2p' | 'referral' | 'system';
  title: string;
  message: string;
  read: boolean;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_address: string;
  referee_address: string;
  status: 'pending' | 'active' | 'completed';
  earnings: number;
  created_at: string;
  updated_at: string;
}

// Helper functions for common queries
export const supabaseHelpers = {
  // Forum
  async getForumCategories() {
    const { data, error } = await supabase
      .from('forum_categories')
      .select('*')
      .order('name', { ascending: true });

    if (error) throw error;
    return data as ForumCategory[];
  },

  async getForumDiscussions(categoryId?: string) {
    let query = supabase
      .from('forum_discussions')
      .select('*')
      .order('created_at', { ascending: false });

    if (categoryId) {
      query = query.eq('category_id', categoryId);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as ForumDiscussion[];
  },

  // P2P
  async getP2PAds(type?: 'buy' | 'sell') {
    let query = supabase
      .from('p2p_ads')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', type);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as P2PAd[];
  },

  // Notifications
  async getUserNotifications(userAddress: string) {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_address', userAddress)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data as Notification[];
  },

  async getUnreadNotificationsCount(userAddress: string) {
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_address', userAddress)
      .eq('read', false);

    if (error) throw error;
    return count || 0;
  },

  async markNotificationAsRead(notificationId: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);

    if (error) throw error;
  },

  async markAllNotificationsAsRead(userAddress: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_address', userAddress)
      .eq('read', false);

    if (error) throw error;
  },

  // Referrals
  async getUserReferrals(userAddress: string) {
    const { data, error } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_address', userAddress)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data as Referral[];
  },

  async getReferralStats(userAddress: string) {
    const { data, error } = await supabase
      .from('referrals')
      .select('status, earnings')
      .eq('referrer_address', userAddress);

    if (error) throw error;

    const stats = {
      total: data?.length || 0,
      active: data?.filter(r => r.status === 'active').length || 0,
      completed: data?.filter(r => r.status === 'completed').length || 0,
      totalEarnings: data?.reduce((sum, r) => sum + r.earnings, 0) || 0,
    };

    return stats;
  },
};

export default supabase;
