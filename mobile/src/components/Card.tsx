import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable } from 'react-native';
import { AppColors } from '../theme/colors';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
  variant?: 'elevated' | 'outlined' | 'filled';
}

/**
 * Modern Card Component
 * Inspired by Material Design 3 and Kurdistan aesthetics
 */
export const Card: React.FC<CardProps> = ({
  children,
  style,
  onPress,
  variant = 'elevated'
}) => {
  const cardStyle = [
    styles.card,
    variant === 'elevated' && styles.elevated,
    variant === 'outlined' && styles.outlined,
    variant === 'filled' && styles.filled,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...cardStyle,
          pressed && styles.pressed,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    backgroundColor: AppColors.surface,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  outlined: {
    borderWidth: 1,
    borderColor: AppColors.border,
    shadowOpacity: 0,
    elevation: 0,
  },
  filled: {
    backgroundColor: AppColors.background,
    shadowOpacity: 0,
    elevation: 0,
  },
  pressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});
