import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../utils/logger';

const PUSH_TOKEN_KEY = '@pezkuwi_push_token';
const NOTIFICATION_PREFS_KEY = '@pezkuwi_notification_prefs';

export interface NotificationPreferences {
  transactions: boolean;
  governance: boolean;
  staking: boolean;
  general: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  transactions: true,
  governance: true,
  staking: true,
  general: true,
};

/**
 * Configure notification handling
 */
export function configureNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

/**
 * Request push notification permissions and get token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      return null;
    }

    // Android needs a notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
      });

      await Notifications.setNotificationChannelAsync('transactions', {
        name: 'Transactions',
        importance: Notifications.AndroidImportance.HIGH,
        description: 'Transaction confirmations and alerts',
      });

      await Notifications.setNotificationChannelAsync('governance', {
        name: 'Governance',
        importance: Notifications.AndroidImportance.DEFAULT,
        description: 'Voting and proposal notifications',
      });
    }

    const tokenData = await Notifications.getExpoPushTokenAsync();
    const token = tokenData.data;

    // Save token locally
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);

    return token;
  } catch (error) {
    logger.error('[Notifications] Registration failed:', error);
    return null;
  }
}

/**
 * Get saved push token
 */
export async function getPushToken(): Promise<string | null> {
  return AsyncStorage.getItem(PUSH_TOKEN_KEY);
}

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
    if (data) return { ...DEFAULT_PREFS, ...JSON.parse(data) };
  } catch { /* use defaults */ }
  return DEFAULT_PREFS;
}

/**
 * Save notification preferences
 */
export async function saveNotificationPreferences(prefs: NotificationPreferences): Promise<void> {
  await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(prefs));
}

/**
 * Schedule a local notification (for transaction confirmations)
 */
export async function notifyTransactionComplete(
  txHash: string,
  amount: string,
  token: string,
  type: 'sent' | 'received'
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.transactions) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: type === 'sent' ? 'Transaction Sent' : 'Transaction Received',
      body: `${type === 'sent' ? 'Sent' : 'Received'} ${amount} ${token}`,
      data: { txHash, type },
      ...(Platform.OS === 'android' ? { channelId: 'transactions' } : {}),
    },
    trigger: null, // Immediately
  });
}

/**
 * Schedule a governance notification
 */
export async function notifyGovernanceEvent(
  title: string,
  body: string
): Promise<void> {
  const prefs = await getNotificationPreferences();
  if (!prefs.governance) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      ...(Platform.OS === 'android' ? { channelId: 'governance' } : {}),
    },
    trigger: null,
  });
}

/**
 * Get badge count
 */
export async function getBadgeCount(): Promise<number> {
  return Notifications.getBadgeCountAsync();
}

/**
 * Clear badge
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
