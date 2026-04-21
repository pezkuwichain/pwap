/**
 * Bereketli Mini App Configuration
 */

export const API_BASE_URL = 'https://bereketli.pezkiwi.app/v1';

// Google Maps API key (shared with main app)
export const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '';

// Feature flags
export const FEATURES = {
  AI_CHAT: true,
  LOYALTY: true,
  REFERRAL: true,
  NOTIFICATIONS: false, // Disabled until expo-notifications integration (Faz 4)
};
