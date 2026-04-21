// API response tipleri — backend struct'lariyla birebir eslesir

export interface User {
  id: string;
  email: string;
  phone: string | null;
  name: string;
  avatar_url: string | null;
  role: 'customer' | 'store_owner' | 'cook' | 'merchant' | 'admin';
  email_verified: boolean;
  phone_verified: boolean;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
}

export interface Store {
  id: string;
  owner_id: string;
  name: string;
  store_type: StoreType;
  description: string | null;
  address: string;
  rating: number;
  total_reviews: number;
  photos: string[];
  opening_hours: Record<string, string> | null;
  phone: string | null;
  delivers: boolean;
  delivery_radius_m: number;
  verified: boolean;
  active: boolean;
  created_at: string;
}

export interface StoreNearby extends Store {
  lat: number;
  lon: number;
  distance_m: number;
}

export interface Package {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  price: number;
  original_value: number;
  category: StoreType;
  pickup_start: string;
  pickup_end: string;
  total_quantity: number;
  remaining: number;
  status: 'active' | 'sold_out' | 'expired' | 'cancelled';
  created_at: string;
}

export interface PackageNearby {
  id: string;
  store_id: string;
  title: string;
  description: string | null;
  price: number;
  original_value: number;
  category: StoreType;
  pickup_start: string;
  pickup_end: string;
  remaining: number;
  status: string;
  created_at: string;
  store_name: string;
  store_rating: number;
  store_address: string;
  store_photos: string[];
  store_lat: number;
  store_lon: number;
  distance_m: number;
  delivery_available: boolean;
}

export interface Order {
  id: string;
  user_id: string;
  package_id: string;
  store_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  status: 'pending' | 'paid' | 'picked_up' | 'cancelled' | 'refunded';
  qr_code: string | null;
  qr_token: string;
  payment_id: string | null;
  paid_at: string | null;
  picked_up_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface MealListing {
  id: string;
  cook_id: string;
  title: string;
  description: string | null;
  photos: string[];
  price_per_portion: number;
  total_portions: number;
  remaining_portions: number;
  available_until: string;
  pickup_or_delivery: 'pickup' | 'delivery' | 'both';
  address: string;
  status: 'active' | 'sold_out' | 'expired' | 'cancelled';
  created_at: string;
}

export interface MealNearby extends MealListing {
  cook_name: string;
  lat: number;
  lon: number;
  distance_m: number;
}

export interface MealOrder {
  id: string;
  buyer_id: string;
  listing_id: string;
  cook_id: string;
  portions: number;
  total_price: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';
  qr_code: string | null;
  qr_token: string;
  created_at: string;
  accepted_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
}

export interface Merchant {
  id: string;
  owner_id: string;
  name: string;
  category: MerchantCategory;
  description: string | null;
  story: string | null;
  address: string;
  photos: string[];
  opening_hours: Record<string, string> | null;
  rating: number;
  total_reviews: number;
  phone: string | null;
  plan: 'free' | 'pro' | 'business';
  active: boolean;
  created_at: string;
}

export interface MerchantNearby extends Merchant {
  lat: number;
  lon: number;
  distance_m: number;
}

export interface LoyaltyProgram {
  id: string;
  merchant_id: string;
  name: string;
  program_type: 'stamp' | 'points' | 'frequency';
  stamps_required: number | null;
  points_required: number | null;
  frequency_required: number | null;
  reward_description: string;
  reward_value: number | null;
  active: boolean;
  created_at: string;
}

export interface LoyaltyCard {
  id: string;
  program_id: string;
  merchant_id: string;
  merchant_name: string;
  merchant_category: MerchantCategory;
  program_name: string;
  program_type: 'stamp' | 'points' | 'frequency';
  current_stamps: number;
  current_points: number;
  visit_count: number;
  stamps_required: number | null;
  points_required: number | null;
  frequency_required: number | null;
  reward_description: string;
  last_visit: string | null;
}

export interface Review {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  rating: number;
  comment: string | null;
  photos: string[];
  created_at: string;
}

export type StoreType = 'bakery' | 'restaurant' | 'pastry' | 'market' | 'catering' | 'other';
export type MerchantCategory = 'barber' | 'cafe' | 'butcher' | 'greengrocer' | 'pharmacy' | 'tailor' | 'bakery' | 'other';
