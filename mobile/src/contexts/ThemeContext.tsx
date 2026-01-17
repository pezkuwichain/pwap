import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '../../../shared/theme/colors';

const THEME_STORAGE_KEY = '@pezkuwi/theme';
const FONT_SIZE_STORAGE_KEY = '@pezkuwi/font_size';

export type ThemeColors = typeof LightColors;
type FontSize = 'small' | 'medium' | 'large';

interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => Promise<void>;
  colors: ThemeColors;
  fontSize: FontSize;
  setFontSize: (size: FontSize) => Promise<void>;
  fontScale: number;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [fontSize, setFontSizeState] = useState<FontSize>('medium');

  const loadTheme = useCallback(async () => {
    try {
      const theme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (theme === 'dark') {
        setIsDarkMode(true);
      }
    } catch (error) {
      if (__DEV__) console.warn('[Theme] Failed to load theme:', error);
    }
  }, []);

  const loadFontSize = useCallback(async () => {
    try {
      const size = await AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (size === 'small' || size === 'medium' || size === 'large') {
        setFontSizeState(size);
      }
    } catch (error) {
      if (__DEV__) console.warn('[Theme] Failed to load font size:', error);
    }
  }, []);

  // Load theme and font size preference on mount
  useEffect(() => {
    // Load preferences - setState is async inside callbacks
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadTheme();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadFontSize();
  }, [loadTheme, loadFontSize]);

  const toggleDarkMode = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');
      if (__DEV__) console.warn('[Theme] Theme changed to:', newMode ? 'dark' : 'light');
    } catch (error) {
      if (__DEV__) console.warn('[Theme] Failed to save theme:', error);
    }
  };

  const setFontSize = async (size: FontSize) => {
    try {
      setFontSizeState(size);
      await AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
      if (__DEV__) console.warn('[Theme] Font size changed to:', size);
    } catch (error) {
      if (__DEV__) console.warn('[Theme] Failed to save font size:', error);
    }
  };

  // Get current theme colors based on mode
  const colors = useMemo(() => {
    return isDarkMode ? DarkColors : LightColors;
  }, [isDarkMode]);

  // Get font scale multiplier based on size
  const fontScale = useMemo(() => {
    switch (fontSize) {
      case 'small':
        return 0.875; // 87.5%
      case 'large':
        return 1.125; // 112.5%
      default:
        return 1; // 100%
    }
  }, [fontSize]);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleDarkMode, colors, fontSize, setFontSize, fontScale }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
