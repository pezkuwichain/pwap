import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {colors, spacing, typography} from '../theme';

interface SectionHeaderProps {
  title: string;
}

export default function SectionHeader({title}: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.small,
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});
