import React, { createContext, useContext, ReactNode } from 'react';

// Mock colors instead of importing from shared
const LightColors = {
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#000000',
  textSecondary: '#666666',
  border: '#E0E0E0',
};

// Mock Theme Context for testing
interface ThemeContextType {
  isDarkMode: boolean;
  toggleDarkMode: () => Promise<void>;
  colors: typeof LightColors;
  fontSize: 'small' | 'medium' | 'large';
  setFontSize: (size: 'small' | 'medium' | 'large') => Promise<void>;
  fontScale: number;
}

const mockThemeContext: ThemeContextType = {
  isDarkMode: false,
  toggleDarkMode: jest.fn().mockResolvedValue(undefined),
  colors: LightColors,
  fontSize: 'medium',
  setFontSize: jest.fn().mockResolvedValue(undefined),
  fontScale: 1,
};

const ThemeContext = createContext<ThemeContextType>(mockThemeContext);

export const MockThemeProvider: React.FC<{ children: ReactNode; value?: Partial<ThemeContextType> }> = ({
  children,
  value = {}
}) => {
  const contextValue = { ...mockThemeContext, ...value };
  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => useContext(ThemeContext);

export default ThemeContext;
