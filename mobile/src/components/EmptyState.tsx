import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { KurdistanColors } from '../theme/colors';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = '📋',
  title,
  description,
  actionLabel,
  onAction,
}) => (
  <View style={styles.container} accessibilityRole="text" accessibilityLabel={title}>
    <Text style={styles.icon}>{icon}</Text>
    <Text style={styles.title}>{title}</Text>
    {description && <Text style={styles.description}>{description}</Text>}
    {actionLabel && onAction && (
      <TouchableOpacity
        style={styles.actionBtn}
        onPress={onAction}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
      >
        <Text style={styles.actionBtnText}>{actionLabel}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48, paddingHorizontal: 32 },
  icon: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '600', color: '#333', textAlign: 'center', marginBottom: 6 },
  description: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  actionBtn: {
    marginTop: 20, backgroundColor: KurdistanColors.kesk, paddingHorizontal: 24,
    paddingVertical: 12, borderRadius: 12,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
});
