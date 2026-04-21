import React from 'react';
import {TouchableOpacity, View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../theme';

interface SettingItemProps {
  icon: string;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  showArrow?: boolean;
  value?: string;
  destructive?: boolean;
}

export default function SettingItem({
  icon,
  title,
  subtitle,
  onPress,
  showArrow = true,
  value,
  destructive = false,
}: SettingItemProps) {
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            destructive && styles.titleDestructive,
          ]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text style={styles.value}>{value}</Text>
      ) : null}
      {showArrow && onPress ? (
        <Text style={styles.arrow}>{'\u203A'}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderLight,
  },
  icon: {
    fontSize: 20,
    marginRight: spacing.md,
    width: 28,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    ...typography.body,
    color: colors.textPrimary,
  },
  titleDestructive: {
    color: colors.error,
  },
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
  value: {
    ...typography.caption,
    color: colors.textSecondary,
    marginRight: spacing.sm,
  },
  arrow: {
    fontSize: 22,
    color: colors.textLight,
  },
});
