import {
  getNotificationPreferences,
  saveNotificationPreferences,
} from '../NotificationService';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock expo-notifications
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'ExponentPushToken[xxx]' }),
  setNotificationChannelAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(),
  getBadgeCountAsync: jest.fn().mockResolvedValue(0),
  setBadgeCountAsync: jest.fn(),
  AndroidImportance: { MAX: 5, HIGH: 4, DEFAULT: 3 },
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotificationPreferences', () => {
    it('returns defaults when no saved prefs', async () => {
      AsyncStorage.getItem.mockResolvedValue(null);
      const prefs = await getNotificationPreferences();
      expect(prefs).toEqual({
        transactions: true,
        governance: true,
        staking: true,
        general: true,
      });
    });

    it('returns saved preferences merged with defaults', async () => {
      AsyncStorage.getItem.mockResolvedValue(JSON.stringify({ transactions: false }));
      const prefs = await getNotificationPreferences();
      expect(prefs.transactions).toBe(false);
      expect(prefs.governance).toBe(true);
    });
  });

  describe('saveNotificationPreferences', () => {
    it('saves preferences to AsyncStorage', async () => {
      const prefs = { transactions: false, governance: true, staking: true, general: false };
      await saveNotificationPreferences(prefs);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@pezkuwi_notification_prefs',
        JSON.stringify(prefs)
      );
    });
  });
});
