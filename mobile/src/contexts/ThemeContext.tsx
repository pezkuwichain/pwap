import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LightColors, DarkColors } from '../../../shared/theme/colors';

const THEME_STORAGE_KEY = '@pezkuwi/theme';
const FONT_SIZE_STORAGE_KEY = '@pezkuwi/font_size';

type ThemeColors = typeof LightColors;
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

  // Load theme and font size preference on mount
  useEffect(() => {
    loadTheme();
    loadFontSize();
  }, []);

  const loadTheme = async () => {
    try {
      const theme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (theme === 'dark') {
        setIsDarkMode(true);
      }
    } catch (error) {
      console.error('[Theme] Failed to load theme:', error);
    }
  };

  const loadFontSize = async () => {
    try {
      const size = await AsyncStorage.getItem(FONT_SIZE_STORAGE_KEY);
      if (size === 'small' || size === 'medium' || size === 'large') {
        setFontSizeState(size);
      }
    } catch (error) {
      console.error('[Theme] Failed to load font size:', error);
    }
  };

  const toggleDarkMode = async () => {
    try {
      const newMode = !isDarkMode;
      setIsDarkMode(newMode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, newMode ? 'dark' : 'light');
      console.log('[Theme] Theme changed to:', newMode ? 'dark' : 'light');
    } catch (error) {
      console.error('[Theme] Failed to save theme:', error);
    }
  };

  const setFontSize = async (size: FontSize) => {
    try {
      setFontSizeState(size);
      await AsyncStorage.setItem(FONT_SIZE_STORAGE_KEY, size);
      console.log('[Theme] Font size changed to:', size);
    } catch (error) {
      console.error('[Theme] Failed to save font size:', error);
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
