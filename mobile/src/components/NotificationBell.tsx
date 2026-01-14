import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { KurdistanColors } from '../theme/colors';
import { supabaseHelpers } from '../lib/supabase';

interface NotificationBellProps {
  onPress: () => void;
  style?: any;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onPress, style }) => {
  const { selectedAccount, api, isApiReady } = usePezkuwi();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!api || !isApiReady || !selectedAccount) {
      setUnreadCount(0);
      return;
    }

    // Fetch unread notification count from Supabase
    const fetchUnreadCount = async () => {
      try {
        const count = await supabaseHelpers.getUnreadNotificationsCount(selectedAccount.address);
        setUnreadCount(count);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
        // If tables don't exist yet, set to 0
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();

    // Refresh every 30 seconds
    const interval = setInterval(fetchUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [api, isApiReady, selectedAccount]);

  return (
    <TouchableOpacity onPress={onPress} style={[styles.container, style]}>
      <Text style={styles.bellIcon}>🔔</Text>
      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bellIcon: {
    fontSize: 24,
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: KurdistanColors.sor,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
});
