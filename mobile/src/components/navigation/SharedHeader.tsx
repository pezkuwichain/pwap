import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { KurdistanColors } from '../../theme/colors';
import type { StackHeaderProps } from '@react-navigation/stack';
import type { BottomTabHeaderProps } from '@react-navigation/bottom-tabs';

type HeaderPropsBase = StackHeaderProps | BottomTabHeaderProps;

interface GradientHeaderProps extends Omit<HeaderPropsBase, 'progress' | 'styleInterpolator'> {
  subtitle?: string;
  rightButtons?: React.ReactNode;
  gradientColors?: [string, string];
  progress?: unknown;
  styleInterpolator?: unknown;
}

export const GradientHeader: React.FC<GradientHeaderProps> = ({
  navigation,
  options,
  route,
  subtitle,
  rightButtons,
  gradientColors = [KurdistanColors.kesk, '#008f43'],
}) => {
  const getTitle = () => {
    if (typeof options.headerTitle === 'string') return options.headerTitle;
    if (typeof options.title === 'string') return options.title;
    return route.name;
  };
  const title = getTitle();

  const canGoBack = navigation.canGoBack();

  return (
    <LinearGradient colors={gradientColors} style={styles.gradientHeader}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{title}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
        </View>

        <View style={styles.headerRight}>{rightButtons}</View>
      </View>
    </LinearGradient>
  );
};

interface SimpleHeaderProps extends Omit<HeaderPropsBase, 'progress' | 'styleInterpolator'> {
  rightButtons?: React.ReactNode;
  progress?: unknown;
  styleInterpolator?: unknown;
}

export const SimpleHeader: React.FC<SimpleHeaderProps> = ({
  navigation,
  options,
  route,
  rightButtons,
}) => {
  const getTitle = () => {
    if (typeof options.headerTitle === 'string') return options.headerTitle;
    if (typeof options.title === 'string') return options.title;
    return route.name;
  };
  const title = getTitle();

  const canGoBack = navigation.canGoBack();

  return (
    <View style={styles.simpleHeader}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.simpleBackButtonText}>←</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.simpleHeaderTitle}>{title}</Text>
        </View>

        <View style={styles.headerRight}>{rightButtons}</View>
      </View>
    </View>
  );
};

export const BackButton: React.FC<{ onPress?: () => void; color?: string }> = ({
  onPress,
  color = '#FFFFFF',
}) => {
  return (
    <TouchableOpacity onPress={onPress} style={styles.backButton}>
      <Text style={[styles.backButtonText, { color }]}>←</Text>
    </TouchableOpacity>
  );
};

interface AppBarHeaderProps extends Omit<HeaderPropsBase, 'progress' | 'styleInterpolator'> {
  rightButtons?: React.ReactNode;
  progress?: unknown;
  styleInterpolator?: unknown;
}

export const AppBarHeader: React.FC<AppBarHeaderProps> = ({
  navigation,
  options,
  route,
  rightButtons,
}) => {
  const getTitle = () => {
    if (typeof options.headerTitle === 'string') return options.headerTitle;
    if (typeof options.title === 'string') return options.title;
    return route.name;
  };
  const title = getTitle();

  const canGoBack = navigation.canGoBack();

  return (
    <View style={styles.appBarHeader}>
      <View style={styles.headerContent}>
        <View style={styles.headerLeft}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButton}
            >
              <Text style={styles.appBarBackButtonText}>←</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.headerCenter}>
          <Text style={styles.appBarTitle}>{title}</Text>
        </View>

        <View style={styles.headerRight}>{rightButtons}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  gradientHeader: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  simpleHeader: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    width: 60,
    alignItems: 'flex-start',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerRight: {
    width: 60,
    alignItems: 'flex-end',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  simpleHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  simpleBackButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.reş,
  },
  appBarHeader: {
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    boxShadow: '0px 2px 4px rgba(0, 0, 0, 0.1)',
    elevation: 4,
  },
  appBarTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: KurdistanColors.reş,
  },
  appBarBackButtonText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: KurdistanColors.kesk,
  },
});
