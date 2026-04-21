import React from 'react';
import {View, Text, Switch, StyleSheet, ActivityIndicator} from 'react-native';
import {colors, spacing, typography} from '../theme';

interface SettingToggleProps {
  icon: string;
  title: string;
  subtitle?: string;
  value: boolean;
  onToggle: (value: boolean) => void;
  loading?: boolean;
}

export default function SettingToggle({
  icon,
  title,
  subtitle,
  value,
  onToggle,
  loading = false,
}: SettingToggleProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Switch
          value={value}
          onValueChange={onToggle}
          trackColor={{false: colors.border, true: colors.primaryLight}}
          thumbColor={value ? colors.primary : colors.textLight}
        />
      )}
    </View>
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
  subtitle: {
    ...typography.small,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
