import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { KurdistanColors } from '../theme/colors';
import { usePezkuwi } from '../contexts/PezkuwiContext';
import { supabaseHelpers } from '../lib/supabase';

interface Notification {
  id: string;
  type: 'transaction' | 'governance' | 'p2p' | 'referral' | 'system';
  title: string;
  message: string;
  read: boolean;
  timestamp: string;
}

interface NotificationCenterModalProps {
  visible: boolean;
  onClose: () => void;
}

// Notifications are stored in Supabase database

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  visible,
  onClose,
}) => {
  const { selectedAccount } = usePezkuwi();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && selectedAccount) {
      const fetchNotifications = async () => {
        try {
          setLoading(true);

          // Fetch notifications from Supabase
          const data = await supabaseHelpers.getUserNotifications(selectedAccount.address);

          // Transform to match component interface
          const transformed = data.map(n => ({
            ...n,
            timestamp: n.created_at,
          }));

          setNotifications(transformed);

        } catch (error) {
          console.error('Failed to fetch notifications:', error);
          // If tables don't exist yet, show empty state
          setNotifications([]);
        } finally {
          setLoading(false);
        }
      };

      fetchNotifications();
    }
  }, [visible, selectedAccount]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      // Update UI immediately
      setNotifications(prev =>
        prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
      );

      // Update in Supabase
      await supabaseHelpers.markNotificationAsRead(notificationId);
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!selectedAccount) return;

    try {
      // Update UI immediately
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));

      // Update in Supabase
      await supabaseHelpers.markAllNotificationsAsRead(selectedAccount.address);

      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      Alert.alert('Error', 'Failed to update notifications');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setNotifications([]);
              // TODO: Implement delete from Supabase when needed
              // For now, just clear from UI
            } catch (error) {
              console.error('Failed to clear notifications:', error);
            }
          },
        },
      ]
    );
  };

  const getNotificationIcon = (type: string): string => {
    const icons: Record<string, string> = {
      transaction: '💰',
      governance: '🏛️',
      p2p: '🤝',
      referral: '👥',
      system: '⚙️',
    };
    return icons[type] || '📬';
  };

  const getNotificationColor = (type: string): string => {
    const colors: Record<string, string> = {
      transaction: KurdistanColors.kesk,
      governance: '#3B82F6',
      p2p: '#F59E0B',
      referral: '#8B5CF6',
      system: '#6B7280',
    };
    return colors[type] || '#666';
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const unreadCount = notifications.filter(n => !n.read).length;
  const groupedNotifications = {
    today: notifications.filter(n => {
      const date = new Date(n.timestamp);
      const today = new Date();
      return date.toDateString() === today.toDateString();
    }),
    earlier: notifications.filter(n => {
      const date = new Date(n.timestamp);
      const today = new Date();
      return date.toDateString() !== today.toDateString();
    }),
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.headerTitle}>Notifications</Text>
              {unreadCount > 0 && (
                <Text style={styles.headerSubtitle}>{unreadCount} unread</Text>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Actions */}
          {notifications.length > 0 && (
            <View style={styles.actions}>
              {unreadCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllAsRead} style={styles.actionButton}>
                  <Text style={styles.actionButtonText}>Mark all as read</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={handleClearAll} style={styles.actionButton}>
                <Text style={[styles.actionButtonText, styles.actionButtonDanger]}>Clear all</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Notifications List */}
          <ScrollView style={styles.notificationsList} showsVerticalScrollIndicator={false}>
            {notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateIcon}>📬</Text>
                <Text style={styles.emptyStateText}>No notifications</Text>
                <Text style={styles.emptyStateSubtext}>You're all caught up!</Text>
              </View>
            ) : (
              <>
                {/* Today */}
                {groupedNotifications.today.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Today</Text>
                    {groupedNotifications.today.map((notification) => (
                      <TouchableOpacity
                        key={notification.id}
                        style={[
                          styles.notificationCard,
                          !notification.read && styles.notificationCardUnread,
                        ]}
                        onPress={() => handleMarkAsRead(notification.id)}
                      >
                        <View
                          style={[
                            styles.notificationIcon,
                            { backgroundColor: `${getNotificationColor(notification.type)}15` },
                          ]}
                        >
                          <Text style={styles.notificationIconText}>
                            {getNotificationIcon(notification.type)}
                          </Text>
                        </View>
                        <View style={styles.notificationContent}>
                          <View style={styles.notificationHeader}>
                            <Text style={styles.notificationTitle}>{notification.title}</Text>
                            {!notification.read && <View style={styles.unreadDot} />}
                          </View>
                          <Text style={styles.notificationMessage} numberOfLines={2}>
                            {notification.message}
                          </Text>
                          <Text style={styles.notificationTime}>
                            {formatTimestamp(notification.timestamp)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Earlier */}
                {groupedNotifications.earlier.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Earlier</Text>
                    {groupedNotifications.earlier.map((notification) => (
                      <TouchableOpacity
                        key={notification.id}
                        style={[
                          styles.notificationCard,
                          !notification.read && styles.notificationCardUnread,
                        ]}
                        onPress={() => handleMarkAsRead(notification.id)}
                      >
                        <View
                          style={[
                            styles.notificationIcon,
                            { backgroundColor: `${getNotificationColor(notification.type)}15` },
                          ]}
                        >
                          <Text style={styles.notificationIconText}>
                            {getNotificationIcon(notification.type)}
                          </Text>
                        </View>
                        <View style={styles.notificationContent}>
                          <View style={styles.notificationHeader}>
                            <Text style={styles.notificationTitle}>{notification.title}</Text>
                            {!notification.read && <View style={styles.unreadDot} />}
                          </View>
                          <Text style={styles.notificationMessage} numberOfLines={2}>
                            {notification.message}
                          </Text>
                          <Text style={styles.notificationTime}>
                            {formatTimestamp(notification.timestamp)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 14,
    color: KurdistanColors.kesk,
    marginTop: 2,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    color: '#666',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F5F5F5',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#666',
  },
  actionButtonDanger: {
    color: '#EF4444',
  },
  notificationsList: {
    flex: 1,
    padding: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#999',
    marginBottom: 12,
    marginTop: 8,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  notificationCardUnread: {
    backgroundColor: '#F8F9FA',
    borderColor: KurdistanColors.kesk,
  },
  notificationIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notificationIconText: {
    fontSize: 20,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: KurdistanColors.kesk,
    marginLeft: 8,
  },
  notificationMessage: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyStateIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
  },
});
